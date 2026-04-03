import { supabaseAdmin } from '@/lib/supabase'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Booking } from '@/types'
import Link from 'next/link'

export default async function BookingStatusPage({
  params,
}: {
  params: { token: string }
}) {
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('edit_token', params.token)
    .single()

  if (error || !booking) {
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

  const b = booking as Booking
  const dateStr = format(parseISO(b.tour_date), 'EEEE d MMMM yyyy', { locale: nl })

  const statusConfig = {
    pending: {
      label: 'Wacht op bevestiging',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: '⏳',
      description: 'Een van onze medewerkers zal je boeking zo snel mogelijk bevestigen.',
    },
    approved: {
      label: 'Bevestigd',
      color: 'bg-green-50 border-green-200 text-green-800',
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

  const status = statusConfig[b.status]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">Jouw boeking</h1>

        {/* Status badge */}
        <div className={`border rounded-2xl px-5 py-4 mb-5 flex items-start gap-3 ${status.color}`}>
          <span className="text-2xl">{status.icon}</span>
          <div>
            <p className="font-semibold">{status.label}</p>
            <p className="text-sm mt-0.5">{status.description}</p>
            {b.worker_message && (
              <p className="text-sm mt-2 italic">"{b.worker_message}"</p>
            )}
          </div>
        </div>

        {/* Booking details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Datum</span>
            <span className="font-medium text-gray-900">{dateStr}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tijdslot</span>
            <span className="font-medium text-gray-900">{b.tour_time}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Totaal personen</span>
            <span className="font-medium text-gray-900">{b.total_people}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Kinderen</span>
            <span className="font-medium text-gray-900">{b.children_count}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Pinguïns voeren</span>
            <span className="font-medium text-gray-900">{b.penguin_feeding_count} persoon{b.penguin_feeding_count !== 1 ? 'en' : ''}</span>
          </div>
          <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
            <span className="text-gray-500">Naam</span>
            <span className="font-medium text-gray-900">{b.visitor_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">E-mail</span>
            <span className="font-medium text-gray-900">{b.visitor_email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Telefoon</span>
            <span className="font-medium text-gray-900">{b.visitor_phone}</span>
          </div>
        </div>

        {/* CTA for denied */}
        {b.status === 'denied' && (
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
