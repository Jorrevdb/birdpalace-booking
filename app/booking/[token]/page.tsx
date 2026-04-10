export const dynamic = 'force-dynamic'

import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import Link from 'next/link'
import { headers } from 'next/headers'

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

async function getBooking(token: string): Promise<Booking | null> {
  try {
    const h = headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    const baseUrl = host
      ? `${proto}://${host}`
      : (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/bookings/${token}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data.booking
  } catch {
    return null
  }
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
