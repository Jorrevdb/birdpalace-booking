import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { forceCreateBookingEvent } from '@/lib/googleCalendar'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

/**
 * POST /api/admin/bookings/[id]/calendar
 * Manually force-adds a booking to Google Calendar.
 * Used from the admin edit modal when an event was accidentally removed.
 * If the booking is not "approved", the event is marked as [ONBEVESTIGD] with yellow color.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { password } = body || {}

    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !booking) {
      return NextResponse.json({ ok: false, message: 'Boeking niet gevonden' }, { status: 404 })
    }

    const pending = booking.status !== 'approved'

    let eventId: string | null = null
    try {
      eventId = await forceCreateBookingEvent(booking, pending)
    } catch (calErr: any) {
      console.error('[calendar force-add] createEvent failed', calErr)
      return NextResponse.json(
        { ok: false, message: calErr?.message || 'Google Calendar API fout. Controleer de kalenderverbinding.' },
        { status: 500 }
      )
    }

    if (!eventId) {
      return NextResponse.json(
        { ok: false, message: 'Kon niet toevoegen aan Google Agenda. Is de kalender nog verbonden?' },
        { status: 500 }
      )
    }

    // Store the event ID so future date/time changes can sync correctly
    await supabaseAdmin
      .from('bookings')
      .update({ calendar_event_id: eventId })
      .eq('id', params.id)

    return NextResponse.json({ ok: true, eventId, pending })
  } catch (err: any) {
    console.error('[calendar force-add] failed', err)
    return NextResponse.json({ ok: false, message: err?.message || 'Server error' }, { status: 500 })
  }
}
