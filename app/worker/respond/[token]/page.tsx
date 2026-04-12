'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import type { Settings } from '@/lib/settings'

function WorkerRespondInner({ token }: { token: string }) {
  const searchParams = useSearchParams()
  const action = searchParams.get('action') as 'accept' | 'decline' | null

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle')
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [redirectCount, setRedirectCount] = useState(2)

  useEffect(() => {
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
    if (action === 'accept' && settings?.worker_message_accepted_default) {
      setMessage(settings.worker_message_accepted_default)
    }
  }, [action, settings])

  // Countdown redirect after successful accept
  useEffect(() => {
    if (status !== 'success') return
    if (redirectCount <= 0) {
      window.location.href = '/admin'
      return
    }
    const t = setTimeout(() => setRedirectCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [status, redirectCount])

  async function handleRespond(respondAction: 'accept' | 'decline') {
    setStatus('loading')
    let finalMessage = message
    if (!finalMessage.trim() && settings?.worker_message_accepted_default) {
      finalMessage = settings.worker_message_accepted_default
    }
    try {
      const res = await fetch(`/api/worker/respond/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: respondAction, message: finalMessage }),
      })
      const data = await res.json()
      if (data.already_handled) {
        setErrorMsg(data.message)
        setStatus('error')
        return
      }
      if (res.ok) {
        setStatus('success')
      } else {
        setErrorMsg(data.error ?? 'Er is iets misgegaan.')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Kon de server niet bereiken.')
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
      <div className="bg-brand-50 border border-brand-600 rounded-2xl p-6 text-center space-y-3">
        <div className="text-3xl">✓</div>
        <p className="text-brand-700 font-semibold text-lg">Boeking bevestigd!</p>
        <p className="text-brand-600 text-sm">De bezoeker krijgt een bevestigingsmail.</p>
        <p className="text-gray-400 text-xs">
          Je wordt doorgestuurd naar het dashboard in {redirectCount}s…
        </p>
        <button
          onClick={() => { window.location.href = '/admin' }}
          className="text-brand-600 text-sm font-medium underline"
        >
          Ga nu naar dashboard →
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p className="text-red-800">{errorMsg}</p>
      </div>
    )
  }

  // Manual response form
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <p className="text-gray-700 font-medium">Kan jij deze tour begeleiden?</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Bericht voor de bezoeker <span className="font-normal text-gray-400">(optioneel)</span>
        </label>
        <textarea
          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-600 text-gray-900 placeholder:text-gray-400 resize-none"
          rows={3}
          placeholder="Bijv. Welkom! We kijken ernaar uit jullie te ontvangen."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-1">
          Dit bericht verschijnt in de bevestigingsmail aan de bezoeker.
        </p>
      </div>

      <button
        onClick={() => handleRespond('accept')}
        className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors"
      >
        ✓ Boeking bevestigen
      </button>
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
