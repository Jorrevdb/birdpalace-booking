import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingApprovedEmail } from '@/lib/email'
import { createBookingEvent, forceCreateBookingEvent } from '@/lib/googleCalendar'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

/**
 * POST /api/admin/bookings/create
 * Manually creates a booking from the admin panel (e.g. for phone bookings).
 * Unlike the public /api/bookings route, this:
 *  - Requires admin password
 *  - Accepts optional visitor fields (name/email/phone can be empty)
 *  - Defaults to status 'approved' (admin already confirmed it)
 *  - Optionally sends the visitor a confirmation email
 *  - Optionally adds the booking to Google Calendar
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      password,
      tour_date,
      tour_time,
      adults,
      children_count = 0,
      penguin_feeding_count = null,
      visitor_name = '',
      visitor_email = '',
      visitor_phone = '',
      visitor_message = '',
      status = 'approved',
      notify_visitor = false,
      add_to_calendar = false,
    } = body || {}

    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!tour_date || !tour_time) {
      return NextResponse.json({ ok: false, message: 'Datum en tijdslot zijn verplicht' }, { status: 400 })
    }

    const adultsNum   = Math.max(0, Number(adults) || 0)
    const childrenNum = Math.max(0, Number(children_count) || 0)
    const total_people = adultsNum + childrenNum
    const penguinNum  = penguin_feeding_count != null && penguin_feeding_count !== '' ? Math.max(0, Number(penguin_feeding_count)) : null

    // Insert booking
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        tour_date,
        tour_time,
        total_people,
        children_count: childrenNum,
        penguin_feeding_count: penguinNum,
        visitor_name:    visitor_name.trim()    || 'Onbekend',
        visitor_email:   visitor_email.trim()   || '',
        visitor_phone:   visitor_phone.trim()   || '',
        visitor_message: visitor_message.trim() || null,
        status,
        // Mark as manually created so it's distinct from public bookings
        worker_message: null,
      })
      .select('*')
      .single()

    if (error || !booking) {
      console.error('[admin/bookings/create] insert error', error)
      return NextResponse.json({ ok: false, message: error?.message || 'Kon boeking niet opslaan' }, { status: 500 })
    }

    // Optionally add to Google Calendar
    if (add_to_calendar) {
      try {
        const pending = status !== 'approved'
        const eventId = pending
          ? await forceCreateBookingEvent(booking, true)
          : await createBookingEvent(booking)
        if (eventId) {
          await supabaseAdmin.from('bookings').update({ calendar_event_id: eventId }).eq('id', booking.id)
          booking.calendar_event_id = eventId
        }
      } catch (calErr) {
        console.warn('[admin/bookings/create] calendar event failed (non-fatal)', calErr)
      }
    }

    // Optionally send confirmation email to visitor
    if (notify_visitor && visitor_email.trim()) {
      try {
        await sendBookingApprovedEmail(booking, '')
      } catch (mailErr) {
        console.warn('[admin/bookings/create] email failed (non-fatal)', mailErr)
      }
    }

    return NextResponse.json({ ok: true, booking })
  } catch (err: any) {
    console.error('[admin/bookings/create]', err)
    return NextResponse.json({ ok: false, message: err?.message || 'Server error' }, { status: 500 })
  }
}
