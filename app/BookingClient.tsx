"use client"

import { useState, useEffect, useCallback } from 'react'
import type { Settings } from '@/lib/settings'
import { DayPicker } from 'react-day-picker'
import { nl } from 'date-fns/locale'
import { format, addDays, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { StepIndicator } from '@/components/StepIndicator'
import { Counter } from '@/components/Counter'
import 'react-day-picker/dist/style.css'

type Step = 1 | 2 | 3 | 'done'

interface BookingForm {
  tour_date: string
  tour_time: string
  total_people: number
  children_count: number
  penguin_feeding_count: number
  visitor_name: string
  visitor_email: string
  visitor_phone: string
}

export default function BookingClient({ initialSiteTitle, initialSettings }: { initialSiteTitle?: string; initialSettings?: Settings }) {
  const [step, setStep] = useState<Step>(1)
  const [siteTitle, setSiteTitle] = useState(initialSiteTitle ?? (initialSettings?.site_name ?? 'Boek een tour'))
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [loadingAvailability, setLoadingAvailability] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [availabilityExplain, setAvailabilityExplain] = useState<any | null>(null)
  const [loadingExplain, setLoadingExplain] = useState(false)
  const [editToken, setEditToken] = useState('')

  const [form, setForm] = useState<BookingForm>({
    tour_date: '',
    tour_time: '',
    total_people: 1,
    children_count: 0,
    penguin_feeding_count: 0,
    visitor_name: '',
    visitor_email: '',
    visitor_phone: '',
  })

  const fetchAvailability = useCallback(async (month: Date) => {
    setLoadingAvailability(true)
    try {
      const from = format(startOfMonth(month), 'yyyy-MM-dd')
      const to = format(endOfMonth(addDays(month, 40)), 'yyyy-MM-dd')
      const res = await fetch(`/api/availability?from=${from}&to=${to}`)
      const data = await res.json()
      setAvailability((prev) => ({ ...prev, ...data.availability }))
    } finally {
      setLoadingAvailability(false)
    }
  }, [])

  useEffect(() => {
    fetchAvailability(selectedMonth)
  }, [selectedMonth, fetchAvailability])

  useEffect(() => {
    // apply initial settings from server on first mount (avoid flicker)
    if (initialSettings) {
      try {
        if (initialSettings.site_name) setSiteTitle(initialSettings.site_name)
        if (initialSettings.primary_color) {
          const raw = String(initialSettings.primary_color)
          const color = raw.startsWith('#') ? raw : `#${raw}`
          document.documentElement.style.setProperty('--primary-color', color)
          document.documentElement.style.setProperty('--primary-color-600', color)
          document.documentElement.style.setProperty('--primary-color-700', color)
        }
      } catch (err) {}
    }
    async function onSettingsUpdate(e?: any) {
      setAvailability({})
      fetchAvailability(selectedMonth)
      try {
        const s = e?.detail || null
        if (s && s.site_name) {
          setSiteTitle(s.site_name)
          return
        }
      } catch (err) {}
      try {
        const res = await fetch('/api/settings')
        const data = await res.json()
        const s = data.settings || {}
        if (s.site_name) setSiteTitle(s.site_name)
      } catch (err) {}
    }

    window.addEventListener('settings:updated', onSettingsUpdate)
    ;(async () => {
      // only fetch settings from API if we don't already have server initialSettings
      if (!initialSettings) {
        try {
          const res = await fetch('/api/settings')
          const data = await res.json()
          const s = data.settings || {}
          if (s.site_name) setSiteTitle(s.site_name)
        } catch (err) {}
      }
    })()

    function onStorage(e: StorageEvent) {
      if (e.key !== 'settings:updated') return
      try {
        const payload = JSON.parse(String(e.newValue))
        const s = payload?.settings || {}
        onSettingsUpdate({ detail: s })
      } catch (err) {}
    }

    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('settings:updated', onSettingsUpdate); window.removeEventListener('storage', onStorage) }
  }, [selectedMonth, fetchAvailability, initialSettings])

  const availableDays = Object.keys(availability)
    .filter((d) => availability[d].length > 0)
    .map((d) => parseISO(d))

  const selectedDate = form.tour_date ? parseISO(form.tour_date) : undefined

  function handleDaySelect(day: Date | undefined) {
    if (!day) return
    const dateStr = format(day, 'yyyy-MM-dd')
    setForm((f) => ({ ...f, tour_date: dateStr, tour_time: '' }))
  }

  function handleTimeSelect(time: string) {
    setForm((f) => ({ ...f, tour_time: time }))
  }

  useEffect(() => {
    if (!form.tour_date) {
      setAvailabilityExplain(null)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoadingExplain(true)
      try {
        const res = await fetch(`/api/availability/explain?date=${encodeURIComponent(form.tour_date)}`)
        const data = await res.json()
        if (!cancelled) setAvailabilityExplain(data.explain ?? null)
      } catch (err) {
        if (!cancelled) setAvailabilityExplain(null)
      } finally {
        if (!cancelled) setLoadingExplain(false)
      }
    })()

    return () => { cancelled = true }
  }, [form.tour_date])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Er is iets misgegaan. Probeer opnieuw.')
        return
      }

      setEditToken(data.booking.edit_token)
      setStep('done')
    } finally {
      setSubmitting(false)
    }
  }

  // ─────────────────────────────────────────
  // STEP 1 – Date & time
  // ─────────────────────────────────────────
  if (step === 1) {
    const slotsForSelectedDate = form.tour_date ? (availability[form.tour_date] ?? []) : []

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">{siteTitle}</h1>
          <p className="text-center text-gray-500 text-sm mb-6">Kies een datum en tijdslot</p>
          <StepIndicator currentStep={1} />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {loadingAvailability && availableDays.length === 0 ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDaySelect}
                  locale={nl}
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  disabled={[
                    { before: addDays(new Date(), 1) },
                    (day) => {
                      const d = format(day, 'yyyy-MM-dd')
                      return !availability[d] || availability[d].length === 0
                    },
                  ]}
                  modifiers={{ available: availableDays }}
                  modifiersClassNames={{ available: 'rdp-day_available' }}
                  className="w-full"
                />

                {form.tour_date && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Beschikbare tijdstippen op{' '}
                      <span className="text-brand-700">
                        {format(parseISO(form.tour_date), 'EEEE d MMMM', { locale: nl })}
                      </span>
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      {slotsForSelectedDate.map((time) => (
                        <button
                          key={time}
                          onClick={() => handleTimeSelect(time)}
                          className={`px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                            form.tour_time === time
                              ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                              : 'border-gray-200 text-gray-700 hover:border-brand-400 hover:text-brand-700'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700">
                      <p className="font-semibold mb-1">Waarom is deze datum beschikbaar/niet beschikbaar?</p>
                      {loadingExplain ? (
                        <p>Logica laden…</p>
                      ) : availabilityExplain ? (
                        <ul className="list-disc pl-4 space-y-1">
                          {availabilityExplain.reason === 'no_active_workers' ? (
                            <li>Geen actieve medewerkers gevonden.</li>
                          ) : (
                            <>
                              <li>Standaard tab: <strong>{availabilityExplain.defaultTab?.name ?? 'Default'}</strong></li>
                              <li>Actieve tab voor deze datum: <strong>{availabilityExplain.activeTab?.name ?? 'Default'}</strong></li>
                              <li>Keyword match: <strong>{availabilityExplain.matchedKeyword ?? 'geen'}</strong></li>
                              <li>Start slots: <strong>{(availabilityExplain.baseSlots ?? []).join(', ') || 'geen'}</strong></li>
                              <li>Beschikbaar: <strong>{(availabilityExplain.availableSlots ?? []).join(', ') || 'geen'}</strong></li>
                              <li>Geblokkeerd door events: <strong>{(availabilityExplain.blockedSlots ?? []).length}</strong></li>
                            </>
                          )}
                        </ul>
                      ) : (
                        <p>Geen debug-info beschikbaar.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!form.tour_date || !form.tour_time}
              className="px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors"
            >
              Volgende →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────
  // STEP 2 – Group composition
  // ─────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">Boek een tour</h1>
          <p className="text-center text-gray-500 text-sm mb-6">Vertel ons meer over jullie groep</p>
          <StepIndicator currentStep={2} />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 text-sm text-brand-700 font-medium mb-6 bg-brand-50 px-4 py-2.5 rounded-lg">
              <span>📅</span>
              <span>
                {format(parseISO(form.tour_date), 'EEEE d MMMM yyyy', { locale: nl })} — {form.tour_time}
              </span>
            </div>

            <Counter
              label="Totaal aantal personen"
              value={form.total_people}
              min={1}
              max={50}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  total_people: v,
                  children_count: Math.min(f.children_count, v),
                  penguin_feeding_count: Math.min(f.penguin_feeding_count, v),
                }))
              }
            />
            <Counter
              label="Waarvan kinderen"
              description="Jonger dan 12 jaar"
              value={form.children_count}
              min={0}
              max={form.total_people}
              onChange={(v) => setForm((f) => ({ ...f, children_count: v }))}
            />
            <Counter
              label="Pinguïns voeren"
              description="Hoeveel personen willen pinguïns voeren?"
              value={form.penguin_feeding_count}
              min={0}
              max={form.total_people}
              onChange={(v) => setForm((f) => ({ ...f, penguin_feeding_count: v }))}
            />
          </div>

          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-3 text-gray-500 rounded-xl font-medium hover:text-gray-700 transition-colors"
            >
              ← Terug
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors"
            >
              Volgende →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────
  // STEP 3 – Contact info
  // ─────────────────────────────────────────
  if (step === 3) {
    const inputClass =
      'w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400'

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">Boek een tour</h1>
          <p className="text-center text-gray-500 text-sm mb-6">Jouw contactgegevens</p>
          <StepIndicator currentStep={3} />

          <form onSubmit={handleSubmit}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="bg-brand-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
                <p>
                  <span className="font-medium">Datum:</span>{' '}
                  {format(parseISO(form.tour_date), 'EEEE d MMMM yyyy', { locale: nl })} om {form.tour_time}
                </p>
                <p>
                  <span className="font-medium">Personen:</span> {form.total_people} ({form.children_count} kinderen)
                </p>
                <p>
                  <span className="font-medium">Pinguïns voeren:</span> {form.penguin_feeding_count} persoon
                  {form.penguin_feeding_count !== 1 ? 'en' : ''}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Naam</label>
                <input
                  className={inputClass}
                  type="text"
                  placeholder="Voor- en achternaam"
                  value={form.visitor_name}
                  onChange={(e) => setForm((f) => ({ ...f, visitor_name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mailadres</label>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="jouw@email.be"
                  value={form.visitor_email}
                  onChange={(e) => setForm((f) => ({ ...f, visitor_email: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefoonnummer</label>
                <input
                  className={inputClass}
                  type="tel"
                  placeholder="+32 ..."
                  value={form.visitor_phone}
                  onChange={(e) => setForm((f) => ({ ...f, visitor_phone: e.target.value }))}
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-3 text-gray-500 rounded-xl font-medium hover:text-gray-700 transition-colors"
              >
                ← Terug
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Bezig...
                  </>
                ) : (
                  'Aanvraag versturen'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────
  // DONE – confirmation
  // ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
      <div className="max-w-lg mx-auto text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aanvraag ontvangen!</h2>
          <p className="text-gray-500 mb-1">
            Je ontvangt een e-mail zodra een medewerker je boeking heeft bevestigd.
          </p>
          <p className="text-gray-500 text-sm mb-6">Dat duurt normaal niet lang.</p>

          <div className="bg-brand-50 rounded-xl p-4 text-sm text-gray-700 space-y-1 text-left mb-6">
            <p>
              <span className="font-medium">Datum:</span>{' '}
              {form.tour_date && format(parseISO(form.tour_date), 'EEEE d MMMM yyyy', { locale: nl })} om {form.tour_time}
            </p>
            <p>
              <span className="font-medium">Personen:</span> {form.total_people} ({form.children_count} kinderen)
            </p>
            <p>
              <span className="font-medium">Pinguïns voeren:</span> {form.penguin_feeding_count}
            </p>
          </div>

          <a
            href={`/booking/${editToken}`}
            className="inline-block px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition-colors"
          >
            Bekijk je boekingsstatus
          </a>
        </div>
      </div>
    </div>
  )
}
