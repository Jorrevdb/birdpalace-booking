export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getCalendarConnection } from '@/lib/googleCalendar'
import { createOAuth2Client } from '@/lib/googleOAuth'
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

  const conn = await getCalendarConnection()
  if (!conn) {
    return NextResponse.json({ connected: false })
  }

  let calendar_id = conn.calendar_id
  let calendar_name = conn.calendar_name ?? conn.calendar_id

  try {
    const oauth2 = createOAuth2Client()
    oauth2.setCredentials({
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expiry_date: conn.expires_at ? new Date(conn.expires_at).getTime() : undefined,
    })

    const cal = google.calendar({ version: 'v3', auth: oauth2 })
    const list = await cal.calendarList.list({ maxResults: 50 })
    const items = list.data.items ?? []
    const primary = items.find((i) => i.primary) ?? items[0]
    if (primary) {
      calendar_id = primary.id ?? calendar_id
      calendar_name = primary.summary ?? calendar_name
    }

    if (calendar_id !== conn.calendar_id || calendar_name !== (conn.calendar_name ?? conn.calendar_id)) {
      const updated = { ...conn, calendar_id, calendar_name }
      await supabaseAdmin
        .from('settings')
        .upsert({ key: 'google_calendar_connection', value: updated }, { onConflict: 'key' })
    }
  } catch (err) {
    console.warn('[google/status] failed to refresh calendar identity', err)
  }

  return NextResponse.json({
    connected: true,
    calendar_id,
    calendar_name,
  })
}
