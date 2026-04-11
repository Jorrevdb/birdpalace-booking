import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

function parseServiceAccountClientEmail() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    const sa = JSON.parse(raw)
    return sa.client_email ?? null
  } catch (err) {
    return null
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const password = url.searchParams.get('password')
  if (password !== getAdminPassword()) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const client_email = parseServiceAccountClientEmail()
  return NextResponse.json({ client_email })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { password, name, email, google_calendar_id } = body
    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
    if (!name || !email) {
      return new NextResponse('Missing fields', { status: 400 })
    }

    const { data, error } = await supabaseAdmin.from('workers').insert({ name, email, google_calendar_id }).select().single()
    if (error) {
      console.error('supabase insert error', error)
      return new NextResponse(error.message || 'Insert failed', { status: 500 })
    }

    return NextResponse.json({ worker: data })
  } catch (err: any) {
    console.error('admin workers POST failed', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
