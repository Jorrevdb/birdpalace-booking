export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSettings, parseTourTimes } from '@/lib/settings'
import { getAvailableSlotsForDate } from '@/lib/googleCalendar'

/**
 * GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns available time slots per date.
 *
 * Slot availability:
 *  - Monday is always closed.
 *  - At least one active worker must exist.
 *  - If a Google Calendar is connected: slots blocked by calendar events are hidden.
 *  - If no calendar is connected: all configured slots are shown (fallback).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to params required' }, { status: 400 })
  }

  // Require at least one active worker
  const { count } = await supabaseAdmin
    .from('workers')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  if ((count ?? 0) === 0) {
    return NextResponse.json({ availability: {} })
  }

  const settings = await getSettings()
  const allSlots = parseTourTimes(settings.tour_times)
  const availability: Record<string, string[]> = {}

  const current = new Date(from)
  const end = new Date(to)

  while (current <= end) {
    const dayOfWeek = current.getDay() // 0=Sun, 1=Mon, 6=Sat
    const dateStr = current.toISOString().slice(0, 10)

    if (dayOfWeek !== 1) {
      // Query Google Calendar for this date (falls back to all slots if not connected)
      const slots = await getAvailableSlotsForDate(dateStr)
      if (slots.length > 0) {
        availability[dateStr] = slots
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return NextResponse.json({ availability })
}
