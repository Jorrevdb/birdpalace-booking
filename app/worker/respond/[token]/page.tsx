'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import type { Settings } from '@/lib/settings'

function WorkerRespondInner({ token }: { token: string }) {
  const searchParams = useSearchParams()
  const action = searchParams.get('action') as 'accept' | 'decline' | null

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<string>('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [selectedAction, setSelectedAction] = useState<'accept' | 'decline' | null>(action)

  useEffect(() => {
    // Fetch settings to get default messages
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSettings(data.settings ?? {})
        }
      } catch (err) {
        console.error('Failed to fetch settings', err)
      }
    }
    fetchSettings()
  }, [])

  useEffect(() => {
    // If action is in URL, initialize with default message
    if (action) {
      setSelectedAction(action)
      if (action === 'accept' && settings?.worker_message_accepted_default) {
        setMessage(settings.worker_message_accepted_default)
      } else if (action === 'decline' && settings?.worker_message_denied_default) {
        setMessage(settings.worker_message_denied_default)
      }
    }
  }, [action, settings])

  async function handleRespond(action: 'accept' | 'decline') {
    setStatus('loading')
    
    // Use default message only if message is truly empty
    let finalMessage = message
    if (!finalMessage.trim()) {
      if (action === 'accept' && settings?.worker_message_accepted_default) {
        finalMessage = settings.worker_message_accepted_default
      } else if (action === 'decline' && settings?.worker_message_denied_default) {
        finalMessage = settings.worker_message_denied_default
      }
    }
    
    try {
      const res = await fetch(`/api/worker/respond/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: finalMessage }),
      })
      const data = await res.json()

      if (data.already_handled) {
        setResult(data.message)
        setStatus('success')
        return
      }

      if (res.ok) {
        setResult(
          action === 'accept'
            ? 'Je hebt de boeking geaccepteerd. De bezoeker krijgt een bevestigingsmail.'
            : 'Je hebt de boeking geweigerd.'
        )
        setStatus('success')
      } else {
        setResult(data.error ?? 'Er is iets misgegaan.')
        setStatus('error')
      }
    } catch {
      setResult('Kon de server niet bereiken.')
      setStatus('error')
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="text-green-800 font-medium">{result}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-800">{result}</p>
      </div>
    )
  }

  // Manual response
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <p className="text-gray-700">Kan jij deze tour begeleiden?</p>

      {selectedAction && (
        <div className={`p-3 rounded-lg text-sm font-medium ${selectedAction === 'accept' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          Je hebt gekozen: <strong>{selectedAction === 'accept' ? '✓ Accepteren' : '✗ Weigeren'}</strong> (klik opnieuw om te veranderen)
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Bericht {selectedAction ? '(optioneel)' : '(optioneel)'}
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Accepteren: <em>{settings?.worker_message_accepted_default || 'Alles in orde. Tot ziens!'}</em> | 
          Weigeren: <em>{settings?.worker_message_denied_default || 'Helaas kan ik niet beschikbaar zijn.'}</em>
        </p>
        <textarea
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 placeholder:text-gray-400 resize-none"
          rows={3}
          placeholder="Voeg een bericht toe voor de bezoeker (optioneel, anders wordt standaard bericht gebruikt)..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            setSelectedAction('accept')
            if (!message && settings?.worker_message_accepted_default) {
              setMessage(settings.worker_message_accepted_default)
            }
          }}
          className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
            selectedAction === 'accept'
              ? 'bg-brand-600 text-white'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          ✓ Ik accepteer
        </button>
        <button
          onClick={() => {
            setSelectedAction('decline')
            if (!message && settings?.worker_message_denied_default) {
              setMessage(settings.worker_message_denied_default)
            }
          }}
          className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
            selectedAction === 'decline'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          ✗ Ik kan niet
        </button>
      </div>

      {selectedAction && (
        <button
          onClick={() => handleRespond(selectedAction)}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Bevestig {selectedAction === 'accept' ? 'acceptatie' : 'weigering'}
        </button>
      )}
    </div>
  )
}

export default async function WorkerRespondPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">Boekingsverzoek</h1>
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <WorkerRespondInner token={token} />
        </Suspense>
      </div>
    </div>
  )
}
