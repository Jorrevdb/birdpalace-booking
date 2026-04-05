export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCalendarConnection } from '@/lib/googleCalendar'

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

  return NextResponse.json({
    connected: true,
    calendar_id: conn.calendar_id,
    calendar_name: conn.calendar_name ?? conn.calendar_id,
  })
}
