export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('edit_token', token)
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: 'Boeking niet gevonden' }, { status: 404 })
  }

  return NextResponse.json({ booking })
}
