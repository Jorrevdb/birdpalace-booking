export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSettings, getPlanningTabs } from '@/lib/settings'
import { explainAvailabilityForDate } from '@/lib/googleCalendar'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: 'date param required' }, { status: 400 })
  }

  const { count } = await supabaseAdmin
    .from('workers')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  if ((count ?? 0) === 0) {
    return NextResponse.json({
      ok: true,
      explain: {
        date,
        reason: 'no_active_workers',
        availableSlots: [],
      },
    })
  }

  const settings = await getSettings()
  const tabs = getPlanningTabs(settings)

  const dt = new Date(`${date}T00:00:00Z`)
  const dayOfWeek = dt.getUTCDay()
  const defaultTab = tabs[0]
  const dayCfg = defaultTab?.weekly_schedule?.[dayOfWeek]
  const defaultSlots = dayCfg && dayCfg.enabled ? dayCfg.times : []

  const explain = await explainAvailabilityForDate(date, defaultSlots)
  return NextResponse.json({ ok: true, explain })
}
