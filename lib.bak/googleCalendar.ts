import { google } from 'googleapis'
import { addMinutes, parseISO, startOfDay, endOfDay } from 'date-fns'
import { TOUR_TIMES, TOUR_DURATION_MINUTES } from './config'
import { Worker } from '@/types'

// Google service account credentials from environment
function getGoogleAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  })
}

// Check if a worker is available for a specific tour slot
// Worker must be available for the full duration of the tour
function workerCoversSlot(
  slotStart: Date,
  slotEnd: Date,
  events: { start: Date; end: Date }[]
): boolean {
  return events.some(
    (event) =>
      event.start <= slotStart && event.end >= slotEnd
  )
}

interface CalendarEvent {
  start: Date
  end: Date
  summary: string
}

// Fetch all-day or timed events from a Google Calendar for a given date range
async function fetchWorkerEvents(
  calendarId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<CalendarEvent[]> {
  const auth = getGoogleAuth()
  const calendar = google.calendar({ version: 'v3', auth })

  const response = await calendar.events.list({
    calendarId,
    timeMin: startOfDay(dateFrom).toISOString(),
    timeMax: endOfDay(dateTo).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    // We only care about events with our specific availability tag
    // Workers mark availability by creating events – we read ALL events
    // and the availability logic is based on time overlap
  })

  const events: CalendarEvent[] = []

  for (const event of response.data.items ?? []) {
    let start: Date
    let end: Date

    if (event.start?.dateTime) {
      // Timed event
      start = parseISO(event.start.dateTime)
      end = parseISO(event.end!.dateTime!)
    } else if (event.start?.date) {
      // All-day event → treat as available the whole day
      start = startOfDay(parseISO(event.start.date))
      end = endOfDay(parseISO(event.end!.date!))
    } else {
      continue
    }

    events.push({ start, end, summary: event.summary ?? '' })
  }

  return events
}

// Returns which tour times are available on a given date
// A slot is available if AT LEAST ONE worker covers it
export async function getAvailableSlotsForDate(
  workers: Worker[],
  date: string // YYYY-MM-DD
): Promise<string[]> {
  const dateObj = parseISO(date)
  const availableSlots: string[] = []

  // Fetch all worker calendars in parallel
  const workerEvents = await Promise.all(
    workers.map((w) => fetchWorkerEvents(w.google_calendar_id, dateObj, dateObj))
  )

  for (const tourTime of TOUR_TIMES) {
    const [hours, minutes] = tourTime.split(':').map(Number)
    const slotStart = new Date(dateObj)
    slotStart.setHours(hours, minutes, 0, 0)
    const slotEnd = addMinutes(slotStart, TOUR_DURATION_MINUTES)

    // At least one worker must cover this slot
    const hasAvailableWorker = workerEvents.some((events) =>
      workerCoversSlot(slotStart, slotEnd, events)
    )

    if (hasAvailableWorker) {
      availableSlots.push(tourTime)
    }
  }

  return availableSlots
}

// Returns all workers available for a specific slot (used when sending approval emails)
export async function getWorkersForSlot(
  workers: Worker[],
  date: string,
  time: string
): Promise<Worker[]> {
  const dateObj = parseISO(date)
  const [hours, minutes] = time.split(':').map(Number)
  const slotStart = new Date(dateObj)
  slotStart.setHours(hours, minutes, 0, 0)
  const slotEnd = addMinutes(slotStart, TOUR_DURATION_MINUTES)

  const workerEvents = await Promise.all(
    workers.map((w) => fetchWorkerEvents(w.google_calendar_id, dateObj, dateObj))
  )

  return workers.filter((_, i) => workerCoversSlot(slotStart, slotEnd, workerEvents[i]))
}
