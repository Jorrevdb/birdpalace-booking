export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// MOCK – stores bookings in memory (resets on server restart)
// Replace this with real Supabase logic once API keys are set
const mockBookings: Record<string, object> = {}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tour_date,
      tour_time,
      total_people,
      children_count,
      penguin_feeding_count,
      visitor_name,
      visitor_email,
      visitor_phone,
    } = body

    if (!tour_date || !tour_time || !total_people || !visitor_name || !visitor_email || !visitor_phone) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    const edit_token = crypto.randomUUID()
    const booking = {
      id: crypto.randomUUID(),
      edit_token,
      tour_date,
      tour_time,
      total_people,
      children_count: children_count ?? 0,
      penguin_feeding_count: penguin_feeding_count ?? 0,
      visitor_name,
      visitor_email,
      visitor_phone,
      status: 'pending',
      worker_message: null,
      created_at: new Date().toISOString(),
    }

    mockBookings[edit_token] = booking

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err) {
    console.error('[bookings POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
