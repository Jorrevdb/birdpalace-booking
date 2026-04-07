export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSettings, getPlanningTabs } from '@/lib/settings'
import { getAvailableSlotsForRange } from '@/lib/googleCalendar'

const ACCEPTED_STATUSES = ['approved', 'accepted']

/**
 * GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns available time slots per date.
 *
 * Slot availability:
 *  - At least one active worker must exist.
 *  - Default slots come from planning tab "Default" (weekly schedule).
 *  - Google events can switch a date to another planning tab via keyword match.
 *  - Remaining Google events block overlapping slots.
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
  const planningTabs = getPlanningTabs(settings)
  const defaultTab = planningTabs[0]
  const defaultSlotsByDate: Record<string, string[]> = {}

  const current = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)

  while (current <= end) {
    const dayOfWeek = current.getUTCDay() // 0=Sun, 1=Mon, 6=Sat
    const dateStr = current.toISOString().slice(0, 10)

    const dayCfg = defaultTab?.weekly_schedule?.[dayOfWeek]
    defaultSlotsByDate[dateStr] = dayCfg && dayCfg.enabled ? dayCfg.times : []

    current.setUTCDate(current.getUTCDate() + 1)
  }

  const availability = await getAvailableSlotsForRange(from, to, defaultSlotsByDate)

  // Final source-of-truth blocking: accepted bookings in DB should always make slot unavailable.
  const { data: acceptedBookings, error: acceptedErr } = await supabaseAdmin
    .from('bookings')
    .select('tour_date,tour_time,status')
    .gte('tour_date', from)
    .lte('tour_date', to)
    .in('status', ACCEPTED_STATUSES)

  if (!acceptedErr && acceptedBookings && acceptedBookings.length > 0) {
    const blockedByDate = new Map<string, Set<string>>()
    for (const b of acceptedBookings as Array<{ tour_date: string; tour_time: string }>) {
      const d = String(b.tour_date)
      const t = String(b.tour_time)
      if (!blockedByDate.has(d)) blockedByDate.set(d, new Set<string>())
      blockedByDate.get(d)!.add(t)
    }

    for (const [date, slots] of Object.entries(availability)) {
      const blocked = blockedByDate.get(date)
      if (!blocked) continue
      const filtered = slots.filter((s) => !blocked.has(s))
      if (filtered.length > 0) availability[date] = filtered
      else delete availability[date]
    }
  }

  return NextResponse.json({ availability })
}
