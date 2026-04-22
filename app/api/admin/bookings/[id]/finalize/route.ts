import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingFinalizedEmail } from '@/lib/email'
import { deleteBookingEvent } from '@/lib/googleCalendar'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

/**
 * POST /api/admin/bookings/[id]/finalize
 * Sets booking status to 'afgerond' and optionally sends a follow-up email to the visitor.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { password, notify, email_subject, email_body } = body || {}

    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Fetch current booking
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ ok: false, message: fetchError?.message || 'Boeking niet gevonden' }, { status: 404 })
    }

    // Update status to 'afgerond'
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'afgerond' })
      .eq('id', params.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ ok: false, message: updateError?.message || 'Update mislukt' }, { status: 500 })
    }

    // Remove from Google Calendar (tour is done)
    if (booking.calendar_event_id) {
      try {
        await deleteBookingEvent(booking.calendar_event_id)
        await supabaseAdmin.from('bookings').update({ calendar_event_id: null }).eq('id', params.id)
      } catch (calErr) {
        console.warn('[finalize] calendar delete failed (non-fatal)', calErr)
      }
    }

    // Optionally send finalized email to visitor
    if (notify && booking.visitor_email) {
      try {
        await sendBookingFinalizedEmail(updated as any, email_subject, email_body)
      } catch (mailErr) {
        console.warn('[finalize] email failed (non-fatal)', mailErr)
      }
    }

    return NextResponse.json({ ok: true, booking: updated })
  } catch (err: any) {
    console.error('[admin/bookings/finalize] failed', err)
    return NextResponse.json({ ok: false, message: err?.message || 'Server error' }, { status: 500 })
  }
}
