import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { clearSettingsCache } from '@/lib/settings'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

// Single-row settings table: key/value JSON stored in a 'settings' table.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const password = url.searchParams.get('password')
  if (password !== getAdminPassword()) return new NextResponse('Unauthorized', { status: 401 })
  // try to read settings row. Support both key/value (value jsonb) and flat column schemas.
  const { data, error } = await supabaseAdmin.from('settings').select('*').limit(1).single()
  if (error) {
    console.error('fetch settings error', error.message || error)
    return NextResponse.json({ settings: {} })
  }

  // if table uses a jsonb `value` column, return that object for client convenience
  if (data && typeof data === 'object' && 'value' in data && data.value) {
    return NextResponse.json({ settings: data.value })
  }

  return NextResponse.json({ settings: data })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { password, settings } = body
    if (password !== getAdminPassword()) return new NextResponse('Unauthorized', { status: 401 })
    // Prefer storing settings as a jsonb `value` under a stable key 'site'.
    // Fall back to flat-column upsert if the table doesn't have `value`.
    try {
      const kv = { key: 'site', value: settings }
      const { data: d1, error: e1 } = await supabaseAdmin.from('settings').upsert(kv, { onConflict: 'key' }).select().single()
      if (!e1) {
        // if stored as kv, return the inner value for the client
        try { clearSettingsCache() } catch (e) {}
        return NextResponse.json({ settings: d1 && d1.value ? d1.value : d1 })
      }
      console.warn('kv upsert failed, falling back to flat upsert', e1)
    } catch (e) {
      console.warn('kv upsert attempt failed', e)
    }

    // fallback: try flat upsert into columns (old schema)
    try {
      const payload = { id: 1, ...settings }
      const { data: d2, error: e2 } = await supabaseAdmin.from('settings').upsert(payload).select().single()
      if (e2) {
        console.error('upsert settings error', e2)
        return new NextResponse('Failed', { status: 500 })
      }
      try { clearSettingsCache() } catch (e) {}
      return NextResponse.json({ settings: d2 })
    } catch (err2) {
      console.error('settings POST final failure', err2)
      return new NextResponse('Failed', { status: 500 })
    }
  } catch (err: any) {
    console.error('settings POST failed', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
