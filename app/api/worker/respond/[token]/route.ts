export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  sendBookingApprovedEmail,
  sendBookingDeniedEmail,
  sendSlotTakenEmail,
} from '@/lib/email'
import { createBookingEvent } from '@/lib/googleCalendar'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { action, message } = await req.json()

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
    }

    // Find the booking_response by respond_token
    const { data: response, error: responseError } = await supabaseAdmin
      .from('booking_responses')
      .select('*, workers(*), bookings(*)')
      .eq('respond_token', params.token)
      .single()

    if (responseError || !response) {
      return NextResponse.json({ error: 'Token niet gevonden' }, { status: 404 })
    }

    // Already handled
    if (response.action !== null) {
      return NextResponse.json({
        already_handled: true,
        message: 'Deze boeking is al behandeld.',
      })
    }

    const booking = response.bookings
    const worker = response.workers

    // Check if booking was already handled by another worker
    if (booking.status !== 'pending') {
      return NextResponse.json({
        already_handled: true,
        message: 'Een andere medewerker heeft deze boeking al behandeld.',
      })
    }

    if (action === 'accept') {
      // Mark this response as accepted
      await supabaseAdmin
        .from('booking_responses')
        .update({ action: 'accept', message: message ?? null, responded_at: new Date().toISOString() })
        .eq('respond_token', params.token)

      // Update booking status
      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'approved',
          assigned_worker_id: worker.id,
          worker_message: message ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      // Send approval email to visitor
      await sendBookingApprovedEmail({ ...booking, worker_message: message ?? null }, worker.name)

      // Create event in the connected Google Calendar (fails silently), store event ID
      const calEventId = await createBookingEvent({ ...booking, worker_message: message ?? null })
      if (calEventId) {
        await supabaseAdmin
          .from('bookings')
          .update({ calendar_event_id: calEventId })
          .eq('id', booking.id)
      }

      // Notify other workers that the slot is taken
      const { data: otherResponses } = await supabaseAdmin
        .from('booking_responses')
        .select('*, workers(*)')
        .eq('booking_id', booking.id)
        .neq('respond_token', params.token)
        .is('action', null)

      if (otherResponses) {
        for (const other of otherResponses) {
          // Mark as declined (slot taken)
          await supabaseAdmin
            .from('booking_responses')
            .update({ action: 'decline', responded_at: new Date().toISOString() })
            .eq('id', other.id)

          await sendSlotTakenEmail(other.workers, booking)
        }
      }
    } else {
      // Decline
      await supabaseAdmin
        .from('booking_responses')
        .update({ action: 'decline', message: message ?? null, responded_at: new Date().toISOString() })
        .eq('respond_token', params.token)

      // Check if ALL workers have now declined
      const { data: allResponses } = await supabaseAdmin
        .from('booking_responses')
        .select('action')
        .eq('booking_id', booking.id)

      const allDeclined = allResponses?.every((r) => r.action === 'decline')

      if (allDeclined) {
        await supabaseAdmin
          .from('bookings')
          .update({ status: 'denied', worker_message: message ?? null, updated_at: new Date().toISOString() })
          .eq('id', booking.id)

        await sendBookingDeniedEmail(booking, message ?? undefined)
      }
    }

    return NextResponse.json({ success: true, action })
  } catch (err) {
    console.error('[worker respond]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
