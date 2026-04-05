export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSettings, parseTourTimes } from '@/lib/settings'

// Returns available slots per date.
// Currently: all 3 slots shown on any day that has at least 1 active worker,
// except Mondays (closed). Google Calendar integration will be added in a later step.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to params required' }, { status: 400 })
  }

  // Check if there are any active workers
  const { count } = await supabaseAdmin
    .from('workers')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  const settings = await getSettings()
  const allSlots = parseTourTimes(settings.tour_times)
  const availability: Record<string, string[]> = {}

  const current = new Date(from)
  const end = new Date(to)

  while (current <= end) {
    const dayOfWeek = current.getDay() // 0=Sun, 1=Mon, 6=Sat
    const dateStr = current.toISOString().slice(0, 10)

    // Monday = closed
    if (dayOfWeek !== 1 && (count ?? 0) > 0) {
      availability[dateStr] = [...allSlots]
    }

    current.setDate(current.getDate() + 1)
  }

  return NextResponse.json({ availability })
}
