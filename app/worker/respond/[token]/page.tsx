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
    // Auto-submit if action is in the URL (from email link)
    if (action === 'accept' || action === 'decline') {
      handleRespond(action)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRespond(selectedAction: 'accept' | 'decline') {
    setStatus('loading')
    
    // Use default message if empty
    let finalMessage = message
    if (!finalMessage) {
      if (selectedAction === 'accept' && settings?.worker_message_accepted_default) {
        finalMessage = settings.worker_message_accepted_default
      } else if (selectedAction === 'decline' && settings?.worker_message_denied_default) {
        finalMessage = settings.worker_message_denied_default
      }
    }
    
    try {
      const res = await fetch(`/api/worker/respond/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: selectedAction, message: finalMessage }),
      })
      const data = await res.json()

      if (data.already_handled) {
        setResult(data.message)
        setStatus('success')
        return
      }

      if (res.ok) {
        setResult(
          selectedAction === 'accept'
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

  // Manual response (no action in URL)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <p className="text-gray-700">Kan jij deze tour begeleiden?</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Bericht (optioneel)
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
          onClick={() => handleRespond('accept')}
          className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors"
        >
          ✓ Ik accepteer
        </button>
        <button
          onClick={() => handleRespond('decline')}
          className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
        >
          ✗ Ik kan niet
        </button>
      </div>
    </div>
  )
}

export default function WorkerRespondPage({
  params,
}: {
  params: { token: string }
}) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">Boekingsverzoek</h1>
        <Suspense fallback={
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <WorkerRespondInner token={params.token} />
        </Suspense>
      </div>
    </div>
  )
}
