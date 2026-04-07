import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const password = url.searchParams.get('password')
  if (password !== getAdminPassword()) return new NextResponse('Unauthorized', { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .order('tour_date', { ascending: true })
    .order('tour_time', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) {
    console.error('fetch bookings error', error)
    return new NextResponse('Failed', { status: 500 })
  }

  return NextResponse.json({ bookings: data })
}
