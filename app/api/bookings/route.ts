export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingReceivedEmail, sendWorkerNotificationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tour_date,
      tour_time,
      total_people,
      children_count,
      visitor_name,
      visitor_email,
      visitor_phone,
      visitor_message,
    } = body

    if (!tour_date || !tour_time || !total_people || !visitor_name || !visitor_email || !visitor_phone) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    // Insert booking into Supabase (without visitor_message first for safety)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        tour_date,
        tour_time,
        total_people,
        children_count: children_count ?? 0,
        visitor_name,
        visitor_email,
        visitor_phone,
        status: 'pending',
      })
      .select()
      .single()

    if (bookingError || !booking) {
      console.error('[bookings POST] insert error', bookingError)
      return NextResponse.json({ error: 'Kon boeking niet opslaan' }, { status: 500 })
    }

    // Store visitor message separately so a missing column never breaks bookings
    if (visitor_message) {
      try {
        await supabaseAdmin
          .from('bookings')
          .update({ visitor_message })
          .eq('id', booking.id)
        booking.visitor_message = visitor_message
      } catch (vmErr) {
        console.warn('[bookings POST] visitor_message not saved – run migration:', vmErr)
      }
    }

    // Fetch active workers
    const { data: workers } = await supabaseAdmin
      .from('workers')
      .select('*')
      .eq('active', true)

    if (workers && workers.length > 0) {
      // Create a respond_token for each worker and send notification emails
      for (const worker of workers) {
        const { data: response } = await supabaseAdmin
          .from('booking_responses')
          .insert({ booking_id: booking.id, worker_id: worker.id })
          .select('respond_token')
          .single()

        if (response?.respond_token) {
          const workerMailResult = await sendWorkerNotificationEmail(booking, worker, response.respond_token)
          if (!workerMailResult.ok) {
            console.error('[bookings POST] worker email FAILED for', worker.email, workerMailResult.error)
          }
        }
      }
    }

    // Send confirmation email to visitor
    const visitorMailResult = await sendBookingReceivedEmail(booking)
    if (!visitorMailResult.ok) {
      console.error('[bookings POST] visitor confirmation email FAILED:', visitorMailResult.error)
    }

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err) {
    console.error('[bookings POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
