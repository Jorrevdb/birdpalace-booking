export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getWorkersForSlot } from '@/lib/googleCalendar'
import {
  sendBookingReceivedEmail,
  sendWorkerNotificationEmail,
} from '@/lib/email'
import { Worker } from '@/types'

// POST /api/bookings – create a new booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tour_date,
      tour_time,
      total_people,
      children_count,
      penguin_feeding_count,
      visitor_name,
      visitor_email,
      visitor_phone,
    } = body

    // Basic validation
    if (!tour_date || !tour_time || !total_people || !visitor_name || !visitor_email || !visitor_phone) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    if (children_count > total_people || penguin_feeding_count > total_people) {
      return NextResponse.json({ error: 'Ongeldig aantal personen' }, { status: 400 })
    }

    // Check slot is not already booked
    const { data: existing } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('tour_date', tour_date)
      .eq('tour_time', tour_time)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Dit tijdslot is helaas al bezet. Kies een ander moment.' },
        { status: 409 }
      )
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        tour_date,
        tour_time,
        total_people,
        children_count: children_count ?? 0,
        penguin_feeding_count: penguin_feeding_count ?? 0,
        visitor_name,
        visitor_email,
        visitor_phone,
      })
      .select()
      .single()

    if (bookingError) throw bookingError

    // Fetch all workers
    const { data: allWorkers } = await supabaseAdmin.from('workers').select('*')
    if (!allWorkers?.length) {
      console.warn('No workers found – skipping worker notifications')
    }

    // Find workers available for this slot
    const availableWorkers = allWorkers?.length
      ? await getWorkersForSlot(allWorkers as Worker[], tour_date, tour_time)
      : []

    // Create a booking_response row for each available worker
    if (availableWorkers.length > 0) {
      const responseRows = availableWorkers.map((w) => ({
        booking_id: booking.id,
        worker_id: w.id,
      }))

      const { data: responses, error: responseError } = await supabaseAdmin
        .from('booking_responses')
        .insert(responseRows)
        .select()

      if (responseError) throw responseError

      // Send notification emails to all available workers
      await Promise.all(
        responses.map((resp) => {
          const worker = availableWorkers.find((w) => w.id === resp.worker_id)!
          return sendWorkerNotificationEmail(booking, worker, resp.response_token)
        })
      )
    }

    // Send confirmation email to visitor
    await sendBookingReceivedEmail(booking)

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err) {
    console.error('[bookings POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
