import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingApprovedEmail, sendBookingDeniedEmail } from '@/lib/email'
import { google } from 'googleapis'
import { getSettings, getTourDuration } from '@/lib/settings'

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

async function insertCalendarEvent(workerCalendarId: string, booking: any) {
  const sa = parseServiceAccount()
  if (!sa) throw new Error('Missing service account')

  const jwt = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  await jwt.authorize()
  const calendar = google.calendar({ version: 'v3', auth: jwt })

  const settings = await getSettings()
  const duration = getTourDuration(settings.tour_duration_minutes)

  // Use local datetime + timeZone to avoid UTC offset issues on Vercel servers
  const [h, m] = booking.tour_time.split(':').map(Number)
  const totalMins = h * 60 + m + duration
  const endH = String(Math.floor(totalMins / 60) % 24).padStart(2, '0')
  const endM = String(totalMins % 60).padStart(2, '0')

  const event = {
    summary: `Tour – ${booking.visitor_name}`,
    description: `Bezoeker: ${booking.visitor_name} (${booking.visitor_email})\nPersonen: ${booking.total_people}`,
    start: { dateTime: `${booking.tour_date}T${booking.tour_time}:00`, timeZone: 'Europe/Brussels' },
    end: { dateTime: `${booking.tour_date}T${endH}:${endM}:00`, timeZone: 'Europe/Brussels' },
  }

  return calendar.events.insert({ calendarId: workerCalendarId, requestBody: event })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { password, action, worker_id, message, new_date, new_time } = body
    if (password !== getAdminPassword()) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    if (!['accept', 'deny', 'reschedule'].includes(action)) return NextResponse.json({ ok: false, message: 'Invalid action' }, { status: 400 })

    const { data: booking } = await supabaseAdmin.from('bookings').select('*').eq('id', params.id).single()
    if (!booking) return NextResponse.json({ ok: false, message: 'Booking not found' }, { status: 404 })

    if (action === 'accept') {
      if (!worker_id) return NextResponse.json({ ok: false, message: 'worker_id required' }, { status: 400 })
      // fetch worker
      const { data: worker } = await supabaseAdmin.from('workers').select('*').eq('id', worker_id).single()
      if (!worker) return NextResponse.json({ ok: false, message: 'Worker not found' }, { status: 404 })

      await supabaseAdmin.from('bookings').update({ status: 'approved', worker_id: worker_id, worker_message: message ?? null }).eq('id', params.id)

      // Create calendar event for the worker (if possible)
      try {
        if (worker.google_calendar_id) {
          await insertCalendarEvent(worker.google_calendar_id, booking)
        }
      } catch (calErr: any) {
        console.error('Failed to insert calendar event', calErr)
      }

      // Send approval email to visitor
      try {
        await sendBookingApprovedEmail(booking, worker.name)
      } catch (emailErr: any) {
        console.error('Failed to send approved email', emailErr)
      }

      return NextResponse.json({ ok: true })
    }

    if (action === 'deny') {
      await supabaseAdmin.from('bookings').update({ status: 'denied', worker_message: message ?? null }).eq('id', params.id)
      await sendBookingDeniedEmail(booking, message ?? undefined)
      return NextResponse.json({ ok: true })
    }

    if (action === 'reschedule') {
      if (!new_date || !new_time) return NextResponse.json({ ok: false, message: 'new_date and new_time required' }, { status: 400 })
      await supabaseAdmin.from('bookings').update({ tour_date: new_date, tour_time: new_time, status: 'pending' }).eq('id', params.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, message: 'Unhandled' }, { status: 400 })
  } catch (err: any) {
    console.error('admin booking action failed', err)
    return NextResponse.json({ ok: false, message: err.message ?? 'Server error' }, { status: 500 })
  }
}
