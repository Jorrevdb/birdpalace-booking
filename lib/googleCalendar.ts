// Google Calendar integration (service account – see SETUP.md)
import { google } from 'googleapis'
import { Worker } from '@/types'
import { getSettings, parseTourTimes, getTourDuration } from './settings'

function parseServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    const sa = JSON.parse(raw)
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
    return sa
  } catch (err) {
    console.error('[googleCalendar] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON', err)
    return null
  }
}

async function getCalendarClient() {
  const sa = parseServiceAccount()
  if (!sa) return null

  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'],
  })

  await jwt.authorize()
  return google.calendar({ version: 'v3', auth: jwt })
}

function toISO(date: Date) {
  return date.toISOString()
}

function makeSlotRange(date: string, time: string, durationMinutes: number) {
  const [hour, minute] = time.split(':').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  const start = new Date(y, m - 1, d, hour, minute, 0)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return { start, end }
}

export async function getAvailableSlotsForDate(
  workers: Worker[],
  date: string
): Promise<string[]> {
  const calendar = await getCalendarClient()
  if (!calendar) return []

  // Query busy ranges for the whole day once
  const dayStart = new Date(...date.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))))
  // fallback: construct from parts
  const [y, m, d] = date.split('-').map(Number)
  const timeMin = new Date(y, m - 1, d, 0, 0, 0)
  const timeMax = new Date(y, m - 1, d, 23, 59, 59)

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: toISO(timeMin),
        timeMax: toISO(timeMax),
        items: workers.map((w) => ({ id: w.google_calendar_id })),
      },
    })

    const calendarsBusy = res.data.calendars ?? {}

    const settings = await getSettings()
    const times = parseTourTimes(settings.tour_times)
    const duration = getTourDuration(settings.tour_duration_minutes)

    const available: string[] = []

    for (const t of times) {
      const { start, end } = makeSlotRange(date, t, duration)
      // Check if at least one worker is free for this slot
      let slotHasFree = false
      for (const w of workers) {
        const busy = calendarsBusy[w.google_calendar_id]?.busy ?? []
        const isBusy = busy.some((b: any) => {
          const bs = new Date(b.start)
          const be = new Date(b.end)
          return bs < end && be > start
        })
        if (!isBusy) {
          slotHasFree = true
          break
        }
      }
      if (slotHasFree) available.push(t)
    }

    return available
  } catch (err) {
    console.error('[googleCalendar] freebusy.query failed', err)
    return []
  }
}

export async function getWorkersForSlot(
  workers: Worker[],
  date: string,
  time: string
): Promise<Worker[]> {
  const calendar = await getCalendarClient()
  if (!calendar) return []

  const settings = await getSettings()
  const duration = getTourDuration(settings.tour_duration_minutes)
  const { start, end } = makeSlotRange(date, time, duration)

  try {
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: toISO(start),
        timeMax: toISO(end),
        items: workers.map((w) => ({ id: w.google_calendar_id })),
      },
    })

    const calendarsBusy = res.data.calendars ?? {}

    const availableWorkers: Worker[] = []
    for (const w of workers) {
      const busy = calendarsBusy[w.google_calendar_id]?.busy ?? []
      const isBusy = busy.some((b: any) => {
        const bs = new Date(b.start)
        const be = new Date(b.end)
        return bs < end && be > start
      })
      if (!isBusy) availableWorkers.push(w)
    }

    return availableWorkers
  } catch (err) {
    console.error('[googleCalendar] freebusy.query failed', err)
    return []
  }
}
