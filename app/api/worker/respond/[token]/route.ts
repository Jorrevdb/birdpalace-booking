export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  sendBookingApprovedEmail,
  sendBookingDeniedEmail,
  sendSlotTakenEmail,
} from '@/lib/email'
import { Booking, Worker } from '@/types'

// POST /api/worker/respond/[token]
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { action, message } = await req.json()

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
    }

    const { data: responseRow, error: fetchError } = await supabaseAdmin
      .from('booking_responses')
      .select('*, booking:bookings(*), worker:workers(*)')
      .eq('response_token', params.token)
      .single()

    if (fetchError || !responseRow) {
      return NextResponse.json({ error: 'Link niet gevonden of verlopen' }, { status: 404 })
    }

    const booking = responseRow.booking as Booking
    const worker = responseRow.worker as Worker

    if (responseRow.response !== 'pending') {
      return NextResponse.json({
        already_handled: true,
        message: 'Je hebt al gereageerd op deze boeking.',
      })
    }

    if (booking.status === 'approved') {
      return NextResponse.json({
        already_handled: true,
        message: 'Een collega heeft deze boeking al overgenomen.',
      })
    }

    if (action === 'accept') {
      await supabaseAdmin
        .from('booking_responses')
        .update({ response: 'accepted', message: message ?? null })
        .eq('id', responseRow.id)

      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'approved',
          worker_id: worker.id,
          worker_message: message ?? null,
        })
        .eq('id', booking.id)

      await sendBookingApprovedEmail(
        { ...booking, worker_message: message ?? null },
        worker.name
      )

      const { data: otherResponses } = await supabaseAdmin
        .from('booking_responses')
        .select('*, worker:workers(*)')
        .eq('booking_id', booking.id)
        .neq('worker_id', worker.id)

      if (otherResponses?.length) {
        await Promise.all(
          otherResponses.map((r) => sendSlotTakenEmail(r.worker as Worker, booking))
        )
        await supabaseAdmin
          .from('booking_responses')
          .update({ response: 'declined' })
          .eq('booking_id', booking.id)
          .neq('worker_id', worker.id)
      }

      return NextResponse.json({ success: true, action: 'accepted' })
    }

    // action === 'decline'
    await supabaseAdmin
      .from('booking_responses')
      .update({ response: 'declined', message: message ?? null })
      .eq('id', responseRow.id)

    const { data: allResponses } = await supabaseAdmin
      .from('booking_responses')
      .select('response')
      .eq('booking_id', booking.id)

    const allDeclined = allResponses?.every((r) => r.response === 'declined')

    if (allDeclined) {
      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'denied',
          worker_message: message ?? null,
        })
        .eq('id', booking.id)

      await sendBookingDeniedEmail(booking, message)

      return NextResponse.json({ success: true, action: 'declined', booking_denied: true })
    }

    return NextResponse.json({ success: true, action: 'declined', booking_denied: false })
  } catch (err) {
    console.error('[worker respond]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
