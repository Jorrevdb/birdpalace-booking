'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

type State = 'loading' | 'ready' | 'submitting' | 'done' | 'already_handled' | 'error'

export default function WorkerRespondPage({
  params,
}: {
  params: { token: string }
}) {
  const searchParams = useSearchParams()
  const defaultAction = searchParams.get('action') as 'accept' | 'decline' | null

  const [state, setState] = useState<State>('ready')
  const [action, setAction] = useState<'accept' | 'decline'>(defaultAction ?? 'accept')
  const [message, setMessage] = useState('')
  const [resultMessage, setResultMessage] = useState('')
  const [bookingDenied, setBookingDenied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('submitting')

    try {
      const res = await fetch(`/api/worker/respond/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setResultMessage(data.error ?? 'Er is iets misgegaan.')
        return
      }

      if (data.already_handled) {
        setState('already_handled')
        setResultMessage(data.message)
        return
      }

      setBookingDenied(data.booking_denied)
      setState('done')
    } catch {
      setState('error')
      setResultMessage('Er is iets misgegaan. Probeer opnieuw.')
    }
  }

  if (state === 'already_handled') {
    return (
      <StatusCard icon="ℹ️" title="Al verwerkt" color="blue">
        <p className="text-gray-600">{resultMessage}</p>
      </StatusCard>
    )
  }

  if (state === 'done') {
    if (action === 'accept') {
      return (
        <StatusCard icon="✓" title="Boeking bevestigd" color="green">
          <p className="text-gray-600">De bezoeker heeft een bevestigingsmail ontvangen.</p>
        </StatusCard>
      )
    }
    return (
      <StatusCard icon="✓" title="Reactie ontvangen" color="gray">
        <p className="text-gray-600">
          {bookingDenied
            ? 'Alle medewerkers hebben geweigerd. De bezoeker is op de hoogte gesteld.'
            : 'Je afwijzing is verwerkt. Andere medewerkers kunnen deze boeking nog overnemen.'}
        </p>
      </StatusCard>
    )
  }

  if (state === 'error') {
    return (
      <StatusCard icon="✗" title="Fout" color="red">
        <p className="text-gray-600">{resultMessage}</p>
      </StatusCard>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
      <div className="max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">Boekingsaanvraag</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Action toggle */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Jouw reactie</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction('accept')}
                className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                  action === 'accept'
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-brand-400'
                }`}
              >
                ✓ Ik accepteer
              </button>
              <button
                type="button"
                onClick={() => setAction('decline')}
                className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                  action === 'decline'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-red-400'
                }`}
              >
                ✗ Ik kan niet
              </button>
            </div>
          </div>

          {/* Optional message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Bericht aan de bezoeker{' '}
              <span className="text-gray-400 font-normal">(optioneel)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                action === 'accept'
                  ? 'bijv. "Tot dan! Vergeet niet warm gekleed te komen."'
                  : 'bijv. "Helaas ben ik die dag verhinderd."'
              }
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={state === 'submitting'}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
              action === 'accept'
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'bg-red-600 hover:bg-red-700'
            } disabled:opacity-50`}
          >
            {state === 'submitting' ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Bezig...
              </>
            ) : action === 'accept' ? (
              'Boeking bevestigen'
            ) : (
              'Afwijzen'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// Small helper component
function StatusCard({
  icon,
  title,
  color,
  children,
}: {
  icon: string
  title: string
  color: 'green' | 'red' | 'blue' | 'gray'
  children: React.ReactNode
}) {
  const colors = {
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    blue: 'bg-blue-50 border-blue-200',
    gray: 'bg-gray-50 border-gray-200',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className={`max-w-sm w-full border rounded-2xl p-8 text-center ${colors[color]}`}>
        <span className="text-4xl">{icon}</span>
        <h2 className="text-xl font-bold text-gray-900 mt-3 mb-2">{title}</h2>
        {children}
      </div>
    </div>
  )
}
