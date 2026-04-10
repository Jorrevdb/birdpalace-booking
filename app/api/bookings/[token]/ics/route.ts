export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/** Returns an .ics calendar file for the booking (Apple Calendar / Outlook desktop). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('tour_date, tour_time, visitor_name, total_people')
    .eq('edit_token', token)
    .eq('status', 'approved')
    .single()

  if (error || !booking) {
    return new NextResponse('Boeking niet gevonden of nog niet bevestigd', { status: 404 })
  }

  const [y, m, d] = booking.tour_date.split('-')
  const [hh, mm] = booking.tour_time.split(':')

  // End time = start + 1 hour
  const endHh = String(parseInt(hh, 10) + 1).padStart(2, '0')

  const dtStart = `${y}${m}${d}T${hh}${mm}00`
  const dtEnd   = `${y}${m}${d}T${endHh}${mm}00`
  const now     = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bird Palace//Booking//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:birdpalace-${token}@birdpalace.be`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Brussels:${dtStart}`,
    `DTEND;TZID=Europe/Brussels:${dtEnd}`,
    'SUMMARY:Tour Bird Palace',
    `DESCRIPTION:Rondleiding bij Bird Palace voor ${booking.total_people} personen.`,
    'LOCATION:Bird Palace\\, Ballaststraat 23\\, 3900 Pelt',
    'URL:https://maps.app.goo.gl/WXgroKXYJiGK95QLA',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tour-birdpalace.ics"',
    },
  })
}
