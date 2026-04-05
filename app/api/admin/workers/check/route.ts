import { NextResponse } from 'next/server'
import { google } from 'googleapis'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

function parseServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    const sa = JSON.parse(raw)
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
    return sa
  } catch (err) {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { password, google_calendar_id } = body
    if (password !== getAdminPassword()) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    if (!google_calendar_id) return NextResponse.json({ ok: false, message: 'Missing calendar id' }, { status: 400 })

    const sa = parseServiceAccount()
    if (!sa) return NextResponse.json({ ok: false, message: 'Missing service account JSON' }, { status: 500 })

    const jwt = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })

    try {
      await jwt.authorize()
    } catch (authErr: any) {
      console.error('JWT authorize failed', authErr)
      return NextResponse.json({ ok: false, message: `JWT authorize failed: ${authErr.message || String(authErr)}` }, { status: 500 })
    }
    const calendar = google.calendar({ version: 'v3', auth: jwt })

    // check freebusy for tomorrow (small window) to detect access
    const now = new Date()
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59)

    try {
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: tomorrowStart.toISOString(),
          timeMax: tomorrowEnd.toISOString(),
          items: [{ id: google_calendar_id }],
        },
      })

      const calendars = res.data.calendars ?? {}
      const cal = calendars[google_calendar_id]
      if (!cal) {
        return NextResponse.json({ ok: false, message: 'No access or calendar not found' })
      }

      // If we get a calendars entry, we have at least freebusy visibility
      return NextResponse.json({ ok: true, message: 'Accessible', busy: cal.busy ?? [] })
    } catch (err: any) {
      // likely 403 or 404
      return NextResponse.json({ ok: false, message: err.message || 'No access' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('check calendar failed', err)
    const msg = err?.message ?? String(err)
    return NextResponse.json({ ok: false, message: `Server error: ${msg}` }, { status: 500 })
  }
}
