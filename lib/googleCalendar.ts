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
import { createOAuth2Client } from './googleOAuth'
import {
  getSettings,
  parseTourTimes,
  getTourDuration,
  getCalendarOpenKeyword,
  getCalendarClosedKeyword,
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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns available time slots for a given date.
 * Falls back to all configured slots when no calendar is connected.
 */
export async function getAvailableSlotsForDate(date: string, defaultSlots?: string[]): Promise<string[]> {
  const ctx = await getCalendarClient()

  const settings = await getSettings()
  const allSlots = defaultSlots && defaultSlots.length > 0
    ? [...defaultSlots]
    : Array.from(parseTourTimes(settings.tour_times))
  const fallbackAllSlots = Array.from(parseTourTimes(settings.tour_times))
  const duration = getTourDuration(settings.tour_duration_minutes)
  const openKeyword = getCalendarOpenKeyword(settings.calendar_override_open_keyword)
  const closedKeyword = getCalendarClosedKeyword(settings.calendar_override_closed_keyword)

  if (!ctx) {
    // No calendar connected → show defaults from schedule settings.
    return [...allSlots]
  }

  const { cal, conn } = ctx
  const [y, m, d] = date.split('-').map(Number)
  const dayStart = new Date(y, m - 1, d, 0, 0, 0)
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59)

  let events: any[] = []
  try {
    const res = await cal.events.list({
      calendarId: conn.calendar_id,
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })
    events = res.data.items ?? []
  } catch (err) {
    console.error('[googleCalendar] events.list failed', err)
    // On error, fall back to all slots rather than hiding everything
    return [...allSlots]
  }

  const forceClosed = events.some((ev) => hasKeyword(ev.summary ?? '', closedKeyword))
  const forceOpen = events.some((ev) => hasKeyword(ev.summary ?? '', openKeyword))

  // Closed override always wins if both words accidentally exist on the same date.
  if (forceClosed) return []

  // Open override can open a normally-closed day (no default slots).
  const baseSlots = allSlots.length > 0 ? allSlots : (forceOpen ? fallbackAllSlots : [])

  // Ignore marker events when determining busy overlaps.
  const busyEvents = events.filter((ev) => {
    const summary = (ev.summary ?? '').toLowerCase()
    return !summary.includes(openKeyword) && !summary.includes(closedKeyword)
  })

  const available: string[] = []
  for (const slot of baseSlots) {
    const { start, end } = makeSlotRange(date, slot, duration)
    const blocked = busyEvents.some((ev) =>
      overlaps(
        ev.start?.dateTime ?? ev.start?.date,
        ev.end?.dateTime ?? ev.end?.date,
        start,
        end
      )
    )
    if (!blocked) available.push(slot)
  }

  return available
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
