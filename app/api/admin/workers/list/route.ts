import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const password = url.searchParams.get('password')
  if (password !== getAdminPassword()) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { data, error } = await supabaseAdmin.from('workers').select('*').order('created_at', { ascending: true })
  if (error) {
    console.error('supabase fetch workers error', error)
    return new NextResponse('Failed to fetch', { status: 500 })
  }

  return NextResponse.json({ workers: data })
}
