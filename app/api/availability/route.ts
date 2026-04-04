export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// MOCK – generates realistic availability for the next 60 days
// Replace this with real Supabase + Google Calendar logic once API keys are set
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to params required' }, { status: 400 })
  }

  const availability: Record<string, string[]> = {}
  const allSlots = ['11:00', '13:00', '15:00']

  // Generate mock availability: weekdays get 2-3 slots, weekends get all 3
  const current = new Date(from)
  const end = new Date(to)

  while (current <= end) {
    const dayOfWeek = current.getDay() // 0=Sun, 6=Sat
    const dateStr = current.toISOString().slice(0, 10)

    // Skip Mondays (day off in mock)
    if (dayOfWeek !== 1) {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Weekend: all slots available
        availability[dateStr] = [...allSlots]
      } else {
        // Weekday: randomly 1-2 slots (deterministic based on date)
        const dayNum = current.getDate()
        if (dayNum % 3 === 0) {
          availability[dateStr] = ['11:00', '15:00']
        } else if (dayNum % 3 === 1) {
          availability[dateStr] = ['13:00']
        } else {
          availability[dateStr] = ['11:00', '13:00', '15:00']
        }
      }
    }

    current.setDate(current.getDate() + 1)
  }

  return NextResponse.json({ availability })
}
