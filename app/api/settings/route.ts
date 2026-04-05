import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Prefer the keyed 'site' row if present (we store settings as { key: 'site', value: {...} })
    const { data: keyed, error: keyedError } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('key', 'site')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!keyedError && keyed && keyed.length > 0) {
      const row: any = keyed[0]
      const settings = row && row.value ? row.value : row
      return NextResponse.json(
        { settings },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } },
      )
    }

    // fallback: return first row
    const { data, error } = await supabaseAdmin.from('settings').select('*').order('updated_at', { ascending: false }).limit(1)
    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { settings: {} },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } },
      )
    }
    const row: any = data[0]
    const settings = row && row.value ? row.value : row
    return NextResponse.json(
      { settings },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } },
    )
  } catch (err) {
    console.error('public settings GET failed', err)
    return NextResponse.json(
      { settings: {} },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } },
    )
  }
}
