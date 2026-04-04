export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// MOCK – returns a demo booking for any token
// Replace with real Supabase logic once API keys are set
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const booking = {
    id: 'mock-id',
    edit_token: params.token,
    tour_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    tour_time: '11:00',
    total_people: 4,
    children_count: 2,
    penguin_feeding_count: 2,
    visitor_name: 'Demo Bezoeker',
    visitor_email: 'demo@voorbeeld.be',
    visitor_phone: '+32 470 00 00 00',
    status: 'pending',
    worker_message: null,
    created_at: new Date().toISOString(),
  }

  return NextResponse.json({ booking })
}
