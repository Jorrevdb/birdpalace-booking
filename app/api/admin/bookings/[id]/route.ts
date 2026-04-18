import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingApprovedEmail, sendBookingUpdatedEmail } from '@/lib/email'
import { createBookingEvent, updateBookingEvent, deleteBookingEvent } from '@/lib/googleCalendar'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { password, updates, notify } = body || {}

    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Fetch current booking before update so we know what changed
    const { data: currentBooking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', params.id)
      .single()

    const allowedStatus = ['pending', 'approved', 'denied']
    const patch: any = {}

    if (updates && typeof updates === 'object') {
      if (typeof updates.status === 'string' && allowedStatus.includes(updates.status)) patch.status = updates.status
      if (typeof updates.tour_date === 'string') patch.tour_date = updates.tour_date
      if (typeof updates.tour_time === 'string') patch.tour_time = updates.tour_time
      if (typeof updates.visitor_name === 'string') patch.visitor_name = updates.visitor_name
      if (typeof updates.visitor_email === 'string') patch.visitor_email = updates.visitor_email
      if (typeof updates.visitor_phone === 'string') patch.visitor_phone = updates.visitor_phone
      if (typeof updates.total_people === 'number') patch.total_people = updates.total_people
      if (typeof updates.children_count === 'number') patch.children_count = updates.children_count
      if (updates.penguin_feeding_count === null || typeof updates.penguin_feeding_count === 'number') patch.penguin_feeding_count = updates.penguin_feeding_count
      if (updates.visitor_message === null || typeof updates.visitor_message === 'string') patch.visitor_message = updates.visitor_message
      if (updates.worker_message === null || typeof updates.worker_message === 'string') patch.worker_message = updates.worker_message
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, message: 'No valid updates provided' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('bookings')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error || !updated) {
      return NextResponse.json({ ok: false, message: error?.message || 'Update failed' }, { status: 500 })
    }

    // ── Google Calendar sync ───────────────────────────────────────────────────
    const wasApproved = currentBooking?.status === 'approved'
    const isNowApproved = updated.status === 'approved'
    const existingEventId: string | null = (updated.calendar_event_id ?? currentBooking?.calendar_event_id) ?? null

    if (isNowApproved && !existingEventId) {
      // Approved and no calendar event yet → create one.
      // Covers: newly approved, re-approved after failure, or missed on a previous save.
      const eventId = await createBookingEvent(updated as any)
      if (eventId) {
        await supabaseAdmin.from('bookings').update({ calendar_event_id: eventId }).eq('id', params.id)
      }
    } else if (wasApproved && isNowApproved && existingEventId) {
      // Still approved and event exists → always sync any changes to the calendar
      await updateBookingEvent(updated as any, existingEventId)
    } else if (wasApproved && !isNowApproved && existingEventId) {
      // Was approved, now denied/pending → delete calendar event
      await deleteBookingEvent(existingEventId)
      await supabaseAdmin.from('bookings').update({ calendar_event_id: null }).eq('id', params.id)
    }

    if (notify) {
      const justApproved = !wasApproved && isNowApproved

      if (justApproved) {
        // Newly approved → send the proper "tour bevestigd" approval email
        await sendBookingApprovedEmail(updated as any, '')
      } else {
        // Other status changes (re-scheduled, updated fields, etc.)
        await sendBookingUpdatedEmail(updated as any)
      }
    }

    return NextResponse.json({ ok: true, booking: updated })
  } catch (err: any) {
    console.error('[admin/bookings PATCH] failed', err)
    return NextResponse.json({ ok: false, message: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url)
    let password = url.searchParams.get('password') || ''

    if (!password) {
      try {
        const body = await req.json()
        password = body?.password || ''
      } catch {
        // ignore body parsing errors
      }
    }

    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Fetch booking first so we can delete the calendar event
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('calendar_event_id, status')
      .eq('id', params.id)
      .single()

    // Delete calendar event if booking was approved and has one
    if (booking?.status === 'approved' && booking?.calendar_event_id) {
      await deleteBookingEvent(booking.calendar_event_id)
    }

    const { error } = await supabaseAdmin.from('bookings').delete().eq('id', params.id)
    if (error) {
      return NextResponse.json({ ok: false, message: error.message || 'Delete failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[admin/bookings DELETE] failed', err)
    return NextResponse.json({ ok: false, message: err?.message || 'Server error' }, { status: 500 })
  }
}
