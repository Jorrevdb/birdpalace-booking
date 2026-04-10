export const dynamic = 'force-dynamic'

import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

interface Booking {
  id: string
  edit_token: string
  tour_date: string
  tour_time: string
  total_people: number
  children_count: number
  penguin_feeding_count: number
  visitor_name: string
  visitor_email: string
  visitor_phone: string
  visitor_message?: string | null
  status: 'pending' | 'approved' | 'denied'
  worker_message: string | null
}

// Query Supabase directly — avoids any Next.js internal-fetch caching that would
// cause the page to show stale status after an admin approve/deny action.
async function getBooking(token: string): Promise<Booking | null> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('edit_token', token)
    .single()
  if (error || !data) return null
  return data as Booking
}

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const booking = await getBooking(token)

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-sm">
          <p className="text-gray-600">Boeking niet gevonden.</p>
          <Link href="/" className="mt-4 inline-block text-brand-600 font-medium hover:underline">
            Nieuwe boeking maken
          </Link>
        </div>
      </div>
    )
  }

  const dateStr = format(parseISO(booking.tour_date), 'EEEE d MMMM yyyy', { locale: nl })

  // ── Calendar & Maps links (only used when approved) ──────────────────────────
  const MAPS_URL = 'https://maps.app.goo.gl/WXgroKXYJiGK95QLA'

  const [y, mo, d] = booking.tour_date.split('-')
  const [hh, mm] = booking.tour_time.split(':')
  const endHh = String(parseInt(hh, 10) + 1).padStart(2, '0')
  const gcalStart = `${y}${mo}${d}T${hh}${mm}00`
  const gcalEnd   = `${y}${mo}${d}T${endHh}${mm}00`
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Tour+Bird+Palace&dates=${gcalStart}%2F${gcalEnd}&details=Rondleiding+bij+Bird+Palace&location=Bird+Palace%2C+Koerheide+1%2C+3900+Pelt&ctz=Europe%2FBrussels`
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=Tour+Bird+Palace&startdt=${booking.tour_date}T${booking.tour_time}:00&enddt=${booking.tour_date}T${endHh}:${mm}:00&body=Rondleiding+bij+Bird+Palace&location=Bird+Palace%2C+Koerheide+1%2C+3900+Pelt`

  const statusConfig = {
    pending: {
      label: 'Wacht op bevestiging',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: '⏳',
      description: 'Een van onze medewerkers zal je boeking zo snel mogelijk bevestigen.',
    },
    approved: {
      label: 'Bevestigd ✓',
      color: 'bg-brand-50 border-brand-600 text-brand-700',
      icon: '✓',
      description: 'Jullie tour is bevestigd. We kijken ernaar uit jullie te verwelkomen!',
    },
    denied: {
      label: 'Niet beschikbaar',
      color: 'bg-red-50 border-red-200 text-red-800',
      icon: '✗',
      description: 'Helaas konden we deze datum niet bevestigen.',
    },
  }

  const status = statusConfig[booking.status]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">Jouw boeking</h1>

        <div className={`border rounded-2xl px-5 py-4 mb-5 flex items-start gap-3 ${status.color}`}>
          <span className="text-2xl">{status.icon}</span>
          <div>
            <p className="font-semibold">{status.label}</p>
            <p className="text-sm mt-0.5">{status.description}</p>
            {booking.worker_message && (
              <p className="text-sm mt-2 italic">&ldquo;{booking.worker_message}&rdquo;</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Datum</span>
            <span className="font-medium text-gray-900">{dateStr}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tijdslot</span>
            <span className="font-medium text-gray-900">{booking.tour_time}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Volwassenen (+12j)</span>
            <span className="font-medium text-gray-900">{booking.total_people - (booking.children_count ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Kinderen (-12j)</span>
            <span className="font-medium text-gray-900">{booking.children_count ?? 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Totaal</span>
            <span className="font-medium text-gray-900">{booking.total_people}</span>
          </div>
          {booking.visitor_message && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Opmerking</span>
              <span className="font-medium text-gray-900 text-right max-w-[60%]">{booking.visitor_message}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
            <span className="text-gray-500">Naam</span>
            <span className="font-medium text-gray-900">{booking.visitor_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">E-mail</span>
            <span className="font-medium text-gray-900">{booking.visitor_email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Telefoon</span>
            <span className="font-medium text-gray-900">{booking.visitor_phone}</span>
          </div>
        </div>

        {booking.status === 'approved' && (
          <div className="mt-4 space-y-3">
            {/* Google Maps — outline/secondary CTA */}
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-white border-2 border-[#1a73e8] text-[#1a73e8] rounded-xl font-semibold hover:bg-[#e8f0fe] transition-colors text-sm"
            >
              📍 Bekijk op Google Maps
            </a>

            {/* Add to calendar */}
            <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">Toevoegen aan agenda</p>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 px-3 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700"
              >
                <span className="text-xl">📅</span>
                Google
              </a>
              <a
                href={`/api/bookings/${token}/ics`}
                className="flex flex-col items-center gap-1 px-3 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700"
              >
                <span className="text-xl">🍎</span>
                Apple
              </a>
              <a
                href={outlookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 px-3 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-xs font-medium text-gray-700"
              >
                <span className="text-xl">📧</span>
                Outlook
              </a>
            </div>
          </div>
        )}

        {booking.status === 'denied' && (
          <div className="mt-4 text-center">
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors"
            >
              Kies een andere datum
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
