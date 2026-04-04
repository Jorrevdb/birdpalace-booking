export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/bookings/[token] – get booking status for visitor
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('edit_token', params.token)
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: 'Boeking niet gevonden' }, { status: 404 })
  }

  return NextResponse.json({ booking })
}
