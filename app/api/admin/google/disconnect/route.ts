export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body.password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { error } = await supabaseAdmin
      .from('settings')
      .delete()
      .eq('key', 'google_calendar_connection')

    if (error) {
      console.error('[google/disconnect]', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
