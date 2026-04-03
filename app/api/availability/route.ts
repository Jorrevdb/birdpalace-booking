import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAvailableSlotsForDate } from '@/lib/googleCalendar'
import { addDays, format, parseISO, isBefore, addHours } from 'date-fns'
import { MAX_BOOKING_DAYS_AHEAD, MIN_BOOKING_HOURS_AHEAD, TOUR_TIMES } from '@/lib/config'
import { Worker } from '@/types'

// GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns available slots per date for the given range
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to params required' }, { status: 400 })
    }

    // Fetch all workers
    const { data: workers, error } = await supabaseAdmin
      .from('workers')
      .select('*')

    if (error) throw error
    if (!workers?.length) {
      return NextResponse.json({ availability: {} })
    }

    const minBookingTime = addHours(new Date(), MIN_BOOKING_HOURS_AHEAD)
    const maxDate = addDays(new Date(), MAX_BOOKING_DAYS_AHEAD)

    // Build list of dates to check
    let current = parseISO(from)
    const end = parseISO(to)
    const dates: string[] = []

    while (!isBefore(end, current)) {
      const dateStr = format(current, 'yyyy-MM-dd')
      dates.push(dateStr)
      current = addDays(current, 1)
    }

    // Fetch availability for each date in parallel
    const results = await Promise.all(
      dates.map(async (date) => {
        const dateObj = parseISO(date)
        if (isBefore(maxDate, dateObj)) return { date, slots: [] }

        const availableSlots = await getAvailableSlotsForDate(workers as Worker[], date)

        // Filter out slots that are too soon
        const filteredSlots = availableSlots.filter((time) => {
          const [h, m] = time.split(':').map(Number)
          const slotDateTime = new Date(dateObj)
          slotDateTime.setHours(h, m, 0, 0)
          return !isBefore(slotDateTime, minBookingTime)
        })

        // Also remove already-booked slots
        const { data: existingBookings } = await supabaseAdmin
          .from('bookings')
          .select('tour_time')
          .eq('tour_date', date)
          .in('status', ['pending', 'approved'])

        const bookedTimes = new Set(existingBookings?.map((b) => b.tour_time) ?? [])

        return {
          date,
          slots: filteredSlots.filter((t) => !bookedTimes.has(t)),
        }
      })
    )

    // Return as { 'YYYY-MM-DD': ['11:00', '15:00'], ... }
    const availability: Record<string, string[]> = {}
    for (const { date, slots } of results) {
      if (slots.length > 0) {
        availability[date] = slots
      }
    }

    return NextResponse.json({ availability })
  } catch (err) {
    console.error('[availability]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
