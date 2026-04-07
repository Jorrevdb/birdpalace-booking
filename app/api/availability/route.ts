export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSettings, getPlanningTabs } from '@/lib/settings'
import { getAvailableSlotsForDate } from '@/lib/googleCalendar'

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
  const availability: Record<string, string[]> = {}

  const current = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)

  while (current <= end) {
    const dayOfWeek = current.getUTCDay() // 0=Sun, 1=Mon, 6=Sat
    const dateStr = current.toISOString().slice(0, 10)

    const dayCfg = defaultTab?.weekly_schedule?.[dayOfWeek]
    const defaultSlots = dayCfg && dayCfg.enabled ? dayCfg.times : []

    // Query Google Calendar for this date and merge with per-day defaults.
    // This allows closed-by-default days to become open via override keyword.
    const slots = await getAvailableSlotsForDate(dateStr, defaultSlots)
    if (slots.length > 0) {
      availability[dateStr] = slots
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return NextResponse.json({ availability })
}
