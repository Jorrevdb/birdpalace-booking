/**
 * Google Calendar integration — single OAuth-connected calendar.
 *
 * The admin connects ONE Google Calendar from the admin panel.
 * Tokens are stored in the Supabase `settings` table under key 'google_calendar_connection'.
 *
 * Availability logic:
 *   - If no calendar is connected: fall back to showing all slots (current behaviour).
 *   - If connected: a slot is available when no event in the calendar overlaps it.
 *
 * Booking confirmation:
 *   - When a booking is accepted, create a calendar event so the slot shows as busy.
 */

import { google } from 'googleapis'
import { supabaseAdmin } from './supabase'
import { createOAuth2Client, getGoogleOAuthConfigStatus } from './googleOAuth'
import {
  getSettings,
  parseTourTimes,
  getTourDuration,
  getPlanningTabs,
  type PlanningTab,
} from './settings'
import type { Booking } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

export type GoogleCalendarConnection = {
  calendar_id: string
  calendar_name?: string
  access_token: string
  refresh_token: string
  expires_at?: string // ISO string
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Read the stored OAuth connection from the settings table. */
export async function getCalendarConnection(): Promise<GoogleCalendarConnection | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'google_calendar_connection')
      .single()

    if (error || !data?.value) return null
    const conn = data.value as GoogleCalendarConnection
    if (!conn.access_token || !conn.refresh_token || !conn.calendar_id) return null
    return conn
  } catch {
    return null
  }
}

/** Save updated connection (e.g. after token refresh). */
async function saveCalendarConnection(conn: GoogleCalendarConnection) {
  await supabaseAdmin
    .from('settings')
    .upsert({ key: 'google_calendar_connection', value: conn }, { onConflict: 'key' })
}

/** Build an authenticated Google Calendar client from stored tokens. Returns null if not connected. */
async function getCalendarClient() {
  const conn = await getCalendarConnection()
  if (!conn) return null

  const cfg = getGoogleOAuthConfigStatus()
  if (!cfg.configured) {
    warnMissingOAuthConfigOnce('getCalendarClient')
    return null
  }

  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expiry_date: conn.expires_at ? new Date(conn.expires_at).getTime() : undefined,
  })

  // Persist refreshed tokens automatically
  oauth2.on('tokens', async (tokens) => {
    const updated: GoogleCalendarConnection = {
      ...conn,
      access_token: tokens.access_token ?? conn.access_token,
      expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : conn.expires_at,
    }
    await saveCalendarConnection(updated)
  })

  return { cal: google.calendar({ version: 'v3', auth: oauth2 }), conn }
}

// ── Date / time helpers ────────────────────────────────────────────────────────

function makeSlotRange(date: string, time: string, durationMinutes: number) {
  const [hour, minute] = time.split(':').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  const start = new Date(y, m - 1, d, hour, minute, 0)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return { start, end }
}

function overlaps(
  eventStart: string | null | undefined,
  eventEnd: string | null | undefined,
  slotStart: Date,
  slotEnd: Date
): boolean {
  if (!eventStart || !eventEnd) return false
  const es = new Date(eventStart)
  const ee = new Date(eventEnd)
  return es < slotEnd && ee > slotStart
}

function hasKeyword(summary: string | undefined, keyword: string) {
  if (!summary || !keyword) return false
  return summary.toLowerCase().includes(keyword)
}

function eventIntersectsDate(ev: any, date: string) {
  const startDate = ev?.start?.date
  const endDate = ev?.end?.date

  // All-day event: Google uses [start.date, end.date) (end is exclusive)
  if (startDate && endDate) {
    return startDate <= date && date < endDate
  }

  const s = ev?.start?.dateTime ?? ev?.start?.date
  const e = ev?.end?.dateTime ?? ev?.end?.date
  if (!s || !e) return false

  const sDate = new Date(s).toISOString().slice(0, 10)
  // subtract 1ms because end is exclusive in calendar semantics
  const eDate = new Date(new Date(e).getTime() - 1).toISOString().slice(0, 10)
  return sDate <= date && date <= eDate
}

function getSlotsForTabDate(tab: PlanningTab | null, dayOfWeek: number): string[] {
  if (!tab) return []
  const cfg = tab.weekly_schedule?.[dayOfWeek]
  if (!cfg || !cfg.enabled) return []
  return Array.from(cfg.times || [])
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type AvailabilityExplain = {
  date: string
  connected: boolean
  defaultTab: { id: string; name: string } | null
  activeTab: { id: string; name: string } | null
  matchedKeyword: string | null
  dayOfWeek: number
  defaultSlots: string[]
  baseSlots: string[]
  availableSlots: string[]
  blockedSlots: Array<{ time: string; reason: string }>
  markerEventsCount: number
  busyEventsCount: number
  ignoredNonMarkerEventsCount?: number
}

const RANGE_CACHE_TTL_MS = 15_000
const rangeCache = new Map<string, { ts: number; availability: Record<string, string[]> }>()
let lastConfigWarnAt = 0

function warnMissingOAuthConfigOnce(source: string) {
  const now = Date.now()
  if (now - lastConfigWarnAt < 60_000) return
  lastConfigWarnAt = now
  const status = getGoogleOAuthConfigStatus()
  if (!status.configured) {
    console.warn(`[googleCalendar] ${source}: Google OAuth disabled (missing env: ${status.missing.join(', ')})`)
  }
}

function toYmdUTC(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseSlotMinutes(slot: string): number | null {
  const [h, m] = String(slot).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function extractMinutesFromDateTime(raw?: string | null): number | null {
  if (!raw) return null
  const match = String(raw).match(/T(\d{2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function isMarkerEvent(ev: any, keywords: string[]) {
  const summary = String(ev?.summary ?? '').toLowerCase()
  return keywords.some((kw) => summary.includes(kw))
}

function filterSlotsByMarkerWindows(slots: string[], markerEvents: any[]) {
  // If there are all-day marker events, keep full tab schedule.
  const hasAllDayMarker = markerEvents.some((ev) => !!(ev?.start?.date && ev?.end?.date))
  if (hasAllDayMarker) return slots

  const windows = markerEvents
    .map((ev) => ({
      start: extractMinutesFromDateTime(ev?.start?.dateTime),
      end: extractMinutesFromDateTime(ev?.end?.dateTime),
    }))
    .filter((w) => w.start !== null && w.end !== null && (w.end as number) > (w.start as number)) as Array<{ start: number; end: number }>

  if (windows.length === 0) return slots

  return slots.filter((slot) => {
    const mins = parseSlotMinutes(slot)
    if (mins === null) return false
    return windows.some((w) => mins >= w.start && mins < w.end)
  })
}

function computeDateAvailability(
  date: string,
  tabs: PlanningTab[],
  allBaseSlots: string[],
  eventsForDate: any[],
  explicitDefaultSlots?: string[]
) {
  const [y0, m0, d0] = date.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y0, m0 - 1, d0, 0, 0, 0)).getUTCDay()

  const defaultTab = tabs[0] ?? null
  const fallbackByDefaultTab = getSlotsForTabDate(defaultTab, dayOfWeek)
  const defaultSlots = explicitDefaultSlots
    ? [...explicitDefaultSlots]
    : (fallbackByDefaultTab.length > 0 ? fallbackByDefaultTab : allBaseSlots)

  const customTabs = tabs.slice(1).filter((t) => (t.keyword || '').trim().length > 0)
  let activeTab: PlanningTab | null = defaultTab
  let matchedKeyword: string | null = null

  for (const tab of customTabs) {
    const keyword = String(tab.keyword || '').toLowerCase()
    const hit = eventsForDate.some((ev) => hasKeyword(ev.summary ?? '', keyword))
    if (hit) {
      activeTab = tab
      matchedKeyword = keyword
      break
    }
  }

  const tabSlots = getSlotsForTabDate(activeTab, dayOfWeek)
  const tabSwitched = !!(activeTab && defaultTab && activeTab.id !== defaultTab.id)
  let baseSlots = tabSwitched ? tabSlots : defaultSlots

  // If tab override is active and marker event is timed (e.g. 14:00-19:00), keep only slots in that window.
  if (tabSwitched && matchedKeyword) {
    const markerEventsForMatchedTab = eventsForDate.filter((ev) => hasKeyword(ev.summary ?? '', matchedKeyword!))
    baseSlots = filterSlotsByMarkerWindows(baseSlots, markerEventsForMatchedTab)
  }

  // Requested behavior: ignore non-marker events for now.
  const markerKeywords = customTabs.map((t) => String(t.keyword || '').toLowerCase()).filter(Boolean)
  const markerEventsCount = eventsForDate.filter((ev) => isMarkerEvent(ev, markerKeywords)).length
  const nonMarkerEventsCount = eventsForDate.length - markerEventsCount

  const availableSlots = [...baseSlots]

  const explain: AvailabilityExplain = {
    date,
    connected: true,
    defaultTab: defaultTab ? { id: defaultTab.id, name: defaultTab.name } : null,
    activeTab: activeTab ? { id: activeTab.id, name: activeTab.name } : null,
    matchedKeyword,
    dayOfWeek,
    defaultSlots: [...defaultSlots],
    baseSlots: [...baseSlots],
    availableSlots: [...availableSlots],
    blockedSlots: [],
    markerEventsCount,
    busyEventsCount: 0,
    ignoredNonMarkerEventsCount: nonMarkerEventsCount,
  }

  return { slots: availableSlots, explain }
}

async function calculateAvailabilityForDate(date: string, defaultSlots?: string[]) {
  const ctx = await getCalendarClient()

  const settings = await getSettings()
  const allBaseSlots = Array.from(parseTourTimes(settings.tour_times))
  const duration = getTourDuration(settings.tour_duration_minutes)
  const tabs = getPlanningTabs(settings)

  const [y0, m0, d0] = date.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y0, m0 - 1, d0, 0, 0, 0)).getUTCDay()

  const defaultTab = tabs[0] ?? null
  const fallbackByDefaultTab = getSlotsForTabDate(defaultTab, dayOfWeek)
  const allSlots = defaultSlots
    ? [...defaultSlots]
    : (fallbackByDefaultTab.length > 0 ? fallbackByDefaultTab : allBaseSlots)

  if (!ctx) {
    return {
      slots: [...allSlots],
      explain: {
        date,
        connected: false,
        defaultTab: defaultTab ? { id: defaultTab.id, name: defaultTab.name } : null,
        activeTab: defaultTab ? { id: defaultTab.id, name: defaultTab.name } : null,
        matchedKeyword: null,
        dayOfWeek,
        defaultSlots: [...allSlots],
        baseSlots: [...allSlots],
        availableSlots: [...allSlots],
        blockedSlots: [],
        markerEventsCount: 0,
        busyEventsCount: 0,
        ignoredNonMarkerEventsCount: 0,
      } as AvailabilityExplain,
    }
  }

  const { cal, conn } = ctx
  const [y, m, d] = date.split('-').map(Number)
  const queryMin = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0))
  const queryMax = new Date(Date.UTC(y, m - 1, d + 2, 0, 0, 0))

  let events: any[] = []
  try {
    const res = await cal.events.list({
      calendarId: conn.calendar_id,
      timeMin: queryMin.toISOString(),
      timeMax: queryMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })
    events = res.data.items ?? []
  } catch (err) {
    console.error('[googleCalendar] events.list failed', err)
    return {
      slots: [...allSlots],
      explain: {
        date,
        connected: true,
        defaultTab: defaultTab ? { id: defaultTab.id, name: defaultTab.name } : null,
        activeTab: defaultTab ? { id: defaultTab.id, name: defaultTab.name } : null,
        matchedKeyword: null,
        dayOfWeek,
        defaultSlots: [...allSlots],
        baseSlots: [...allSlots],
        availableSlots: [...allSlots],
        blockedSlots: [],
        markerEventsCount: 0,
        busyEventsCount: 0,
      } as AvailabilityExplain,
    }
  }

  const eventsForDate = events.filter((ev) => eventIntersectsDate(ev, date))
  return computeDateAvailability(date, tabs, allBaseSlots, eventsForDate, allSlots)
}

/**
 * Returns available time slots for a given date.
 * Falls back to all configured slots when no calendar is connected.
 */
export async function getAvailableSlotsForDate(date: string, defaultSlots?: string[]): Promise<string[]> {
  const result = await calculateAvailabilityForDate(date, defaultSlots)
  return result.slots
}

export async function explainAvailabilityForDate(date: string, defaultSlots?: string[]): Promise<AvailabilityExplain> {
  const result = await calculateAvailabilityForDate(date, defaultSlots)
  return result.explain
}

export async function getAvailableSlotsForRange(
  from: string,
  to: string,
  defaultSlotsByDate: Record<string, string[]>
): Promise<Record<string, string[]>> {
  const settings = await getSettings()
  const tabs = getPlanningTabs(settings)
  const allBaseSlots = Array.from(parseTourTimes(settings.tour_times))

  const conn = await getCalendarConnection()
  const cfg = getGoogleOAuthConfigStatus()
  const settingsSig = JSON.stringify({
    tabs: (settings as any).planning_tabs ?? null,
    weekly_schedule: (settings as any).weekly_schedule ?? null,
    tour_times: settings.tour_times,
  })
  const cacheKey = `${conn?.calendar_id || 'no-conn'}|${from}|${to}|${settingsSig}`
  const cached = rangeCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < RANGE_CACHE_TTL_MS) {
    return cached.availability
  }

  const availability: Record<string, string[]> = {}

  // No connected calendar or missing OAuth config: only default tab schedule.
  if (!conn || !cfg.configured) {
    if (!cfg.configured) warnMissingOAuthConfigOnce('getAvailableSlotsForRange')
    for (const [date, slots] of Object.entries(defaultSlotsByDate)) {
      if (slots.length > 0) availability[date] = [...slots]
    }
    rangeCache.set(cacheKey, { ts: Date.now(), availability })
    return availability
  }

  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
    expiry_date: conn.expires_at ? new Date(conn.expires_at).getTime() : undefined,
  })

  oauth2.on('tokens', async (tokens) => {
    const updated: GoogleCalendarConnection = {
      ...conn,
      access_token: tokens.access_token ?? conn.access_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : conn.expires_at,
    }
    await saveCalendarConnection(updated)
  })

  const cal = google.calendar({ version: 'v3', auth: oauth2 })

  const fromDt = new Date(`${from}T00:00:00Z`)
  const toDt = new Date(`${to}T00:00:00Z`)
  const queryMin = new Date(fromDt.getTime() - 24 * 60 * 60 * 1000)
  const queryMax = new Date(toDt.getTime() + 2 * 24 * 60 * 60 * 1000)

  let events: any[] = []
  try {
    const res = await cal.events.list({
      calendarId: conn.calendar_id,
      timeMin: queryMin.toISOString(),
      timeMax: queryMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    })
    events = res.data.items ?? []
  } catch (err: any) {
    const msg = err?.response?.data?.error_description || err?.response?.data?.error || err?.message || 'unknown_error'
    console.warn(`[googleCalendar] events.list range failed: ${msg}`)
    // On quota/rate failure fallback to defaults immediately.
    for (const [date, slots] of Object.entries(defaultSlotsByDate)) {
      if (slots.length > 0) availability[date] = [...slots]
    }
    rangeCache.set(cacheKey, { ts: Date.now(), availability })
    return availability
  }

  const cursor = new Date(`${from}T00:00:00Z`)
  while (cursor <= toDt) {
    const date = toYmdUTC(cursor)
    const explicitDefaultSlots = defaultSlotsByDate[date] ?? []
    const eventsForDate = events.filter((ev) => eventIntersectsDate(ev, date))
    const result = computeDateAvailability(date, tabs, allBaseSlots, eventsForDate, explicitDefaultSlots)
    if (result.slots.length > 0) availability[date] = result.slots
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  rangeCache.set(cacheKey, { ts: Date.now(), availability })
  return availability
}

/**
 * Create a calendar event when a booking is confirmed.
 * Fails silently — a calendar error must never break the booking flow.
 */
export async function createBookingEvent(booking: Booking): Promise<void> {
  try {
    const ctx = await getCalendarClient()
    if (!ctx) return

    const { cal, conn } = ctx
    const settings = await getSettings()
    const duration = getTourDuration(settings.tour_duration_minutes)
    const { start, end } = makeSlotRange(booking.tour_date, booking.tour_time, duration)

    await cal.events.insert({
      calendarId: conn.calendar_id,
      requestBody: {
        summary: `Tour: ${booking.visitor_name} (${booking.total_people} pers.)`,
        description: [
          `Bezoeker: ${booking.visitor_name}`,
          `Email: ${booking.visitor_email}`,
          `Tel: ${booking.visitor_phone}`,
          `Pinguïns voeren: ${booking.penguin_feeding_count}`,
        ].join('\n'),
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    })
  } catch (err) {
    console.error('[googleCalendar] createBookingEvent failed', err)
  }
}
