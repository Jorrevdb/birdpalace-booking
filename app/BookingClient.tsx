"use client"

import { useState, useEffect, useCallback } from 'react'
import type { Settings } from '@/lib/settings'
import { nl } from 'date-fns/locale'
import { format, addMonths, parseISO, startOfMonth, endOfMonth, startOfToday } from 'date-fns'
import { StepIndicator } from '@/components/StepIndicator'
import { Counter } from '@/components/Counter'

// ── Custom Calendar ────────────────────────────────────────────────────────────
// Week starts on Monday. Dutch abbreviated day names.
const WEEKDAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

// ── Time input: HH:MM, digits only, colon always visible, max 23:59 ───────────
function TimeInput({
  onValidTime,
  resetKey,
}: {
  onValidTime: (time: string) => void
  resetKey?: string | number
}) {
  const [raw, setRaw] = useState('')

  // Reset when date changes or a slot button is clicked
  useEffect(() => { setRaw('') }, [resetKey])

  // Colon always appears after the first two digits: "18" → "18:", "180" → "18:0"
  const display = raw.length >= 2 ? `${raw.slice(0, 2)}:${raw.slice(2)}` : raw

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // When display is "HH:" and user presses backspace, delete the second hour digit
    // instead of just stripping the colon (which would re-appear immediately)
    if (e.key === 'Backspace' && raw.length === 2) {
      e.preventDefault()
      setRaw(raw.slice(0, 1))
      onValidTime('')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)

    // Block hours > 23
    if (digits.length >= 2 && parseInt(digits.slice(0, 2), 10) > 23) return
    // Block minutes > 59
    if (digits.length >= 4 && parseInt(digits.slice(2, 4), 10) > 59) return

    setRaw(digits)

    if (digits.length === 4) {
      onValidTime(`${digits.slice(0, 2)}:${digits.slice(2, 4)}`)
      return
    }
    onValidTime('')
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="--:--"
      value={display}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      maxLength={5}
      className="w-[68px] px-2 py-3 rounded-xl border-2 border-gray-200 text-center text-sm font-semibold text-gray-700 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600 transition-all"
    />
  )
}

function CalendarGrid({
  month,
  selectedDateStr,
  availability,
  onSelect,
}: {
  month: Date
  selectedDateStr: string
  availability: Record<string, string[]>
  onSelect: (dateStr: string) => void
}) {
  const today = startOfToday()
  const todayStr = format(today, 'yyyy-MM-dd')
  const first = startOfMonth(month)
  const daysInMonth = endOfMonth(month).getDate()

  // Monday-first offset: Mon=0 … Sun=6
  const rawStartDay = first.getDay() // 0=Sun … 6=Sat
  const mondayOffset = (rawStartDay + 6) % 7

  const cells: (Date | null)[] = [
    ...Array(mondayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), i + 1)
    ),
  ]
  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="w-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-gray-400 py-2 select-none">
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="h-10 sm:h-[54px]" />

          const dateStr = format(day, 'yyyy-MM-dd')
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDateStr
          const isNotAvailable = day <= today  // Today and past: not selectable
          const hasSlots = (availability[dateStr]?.length ?? 0) > 0
          const isAvailable = hasSlots && !isNotAvailable
          // Future days without slots can still be clicked to suggest a custom time
          const isSuggestable = !isNotAvailable && !hasSlots

          // Dot = today indicator (always, unless selected)
          const showDot = isToday && !isSelected

          let circleClass = ''
          if (isSelected) {
            circleClass = 'bg-brand-600 text-white'
          } else if (isAvailable) {
            // Green ring = has scheduled slots
            circleClass = 'ring-2 ring-brand-600 text-gray-900 hover:bg-brand-50 cursor-pointer'
          } else if (isSuggestable) {
            // No slots but future: black text, clickable to suggest own time
            circleClass = 'text-gray-900 hover:bg-gray-100 cursor-pointer'
          } else {
            circleClass = 'text-gray-300 cursor-default'
          }

          const isClickable = isAvailable || isSuggestable

          return (
            <div key={dateStr} className="flex items-center justify-center h-10 sm:h-[54px]">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onSelect(dateStr)}
                className={`relative flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-full text-[11px] sm:text-sm font-semibold transition-colors select-none focus:outline-none ${circleClass}`}
              >
                {/* Number — nudge up slightly when dot sits below */}
                <span className={showDot ? 'translate-y-[-2px]' : ''}>
                  {day.getDate()}
                </span>

                {/* Today dot */}
                {showDot && (
                  <span className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-[4px] h-[4px] sm:w-[5px] sm:h-[5px] rounded-full bg-gray-900" />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Phone formatting ──────────────────────────────────────────────────────────
function formatBelgianPhone(raw: string): string {
  const hasPlus = raw.startsWith('+')
  const digits = raw.replace(/\D/g, '')
  if (!digits) return hasPlus ? '+' : ''

  // International +32
  if (hasPlus && digits.startsWith('32')) {
    const local = digits.slice(2)
    if (local.startsWith('4')) {
      // Mobile: +32 4XX XX XX XX
      const d = local.slice(0, 9)
      return ['+32', d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)]
        .filter(Boolean).join(' ')
    }
    // Fixed: +32 X XXX XX XX
    const d = local.slice(0, 8)
    return ['+32', d.slice(0, 1), d.slice(1, 4), d.slice(4, 6), d.slice(6, 8)]
      .filter(Boolean).join(' ')
  }

  // Mobile 04XX XX XX XX (10 digits)
  if (digits.startsWith('04')) {
    const d = digits.slice(0, 10)
    return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)]
      .filter(Boolean).join(' ')
  }

  // Fixed 02/03/09 XX XXX XX XX (9 digits, 2-digit area code)
  if (/^0[2-9]/.test(digits) && !digits.startsWith('04')) {
    const d = digits.slice(0, 9)
    if (digits.startsWith('02') || digits.startsWith('03') || digits.startsWith('09')) {
      return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
    }
    // 3-digit area code (011, 016, etc.)
    return [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
  }

  return raw // unknown format — leave as-is
}

type Step = 1 | 2 | 3 | 'done'

interface BookingForm {
  tour_date: string
  tour_time: string
  adults_count: number
  children_count: number
  visitor_name: string
  visitor_email: string
  visitor_phone: string
  visitor_message: string
}

export default function BookingClient({ initialSiteTitle, initialSettings }: { initialSiteTitle?: string; initialSettings?: Settings }) {
  const [step, setStep] = useState<Step>(1)
  const [siteTitle, setSiteTitle] = useState(initialSiteTitle ?? (initialSettings?.site_name ?? 'Boek een tour'))
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [loadingAvailability, setLoadingAvailability] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editToken, setEditToken] = useState('')
  // Tracks whether the currently selected time came from the custom "Anders" input
  const [isCustomTime, setIsCustomTime] = useState(false)
  // Incrementing this key remounts TimeInput, resetting its displayed value
  const [timeInputResetKey, setTimeInputResetKey] = useState(0)

  const [form, setForm] = useState<BookingForm>({
    tour_date: '',
    tour_time: '',
    adults_count: 1,
    children_count: 0,
    visitor_name: '',
    visitor_email: '',
    visitor_phone: '',
    visitor_message: '',
  })

  const fetchAvailability = useCallback(async (month: Date) => {
    setLoadingAvailability(true)
    try {
      const from = format(startOfMonth(month), 'yyyy-MM-dd')
      const to = format(endOfMonth(addMonths(month, 1)), 'yyyy-MM-dd')
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
          // Only set --primary-color-600; globals.css derives 700/50/100 via color-mix()
          document.documentElement.style.setProperty('--primary-color-600', color)
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

  function handleTimeSelect(time: string) {
    setIsCustomTime(false)
    setTimeInputResetKey((k) => k + 1) // resets the TimeInput display
    setForm((f) => ({ ...f, tour_time: time }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const payload = {
        ...form,
        total_people: form.adults_count + form.children_count,
        visitor_message: form.visitor_message.trim() || null,
      }
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    const monthLabelRaw = format(selectedMonth, 'MMMM yyyy', { locale: nl })
    const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1)

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">{siteTitle}</h1>
          <p className="text-center text-gray-500 text-sm mb-6">Kies een datum en tijdslot</p>
          <StepIndicator currentStep={1} />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {loadingAvailability && Object.keys(availability).length === 0 ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="w-full">
                  {/* Month navigation — same width as calendar grid below */}
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedMonth(new Date())}
                      className="px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      Vandaag
                    </button>

                    <h3 className="text-2xl font-semibold text-gray-900 text-center">{monthLabel}</h3>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
                        className="w-10 h-10 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-xl leading-none transition-colors"
                        aria-label="Vorige maand"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
                        className="w-10 h-10 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 text-xl leading-none transition-colors"
                        aria-label="Volgende maand"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Custom calendar — full card width */}
                  <CalendarGrid
                    month={selectedMonth}
                    selectedDateStr={form.tour_date}
                    availability={availability}
                    onSelect={(dateStr) => {
                      setForm((f) => ({ ...f, tour_date: dateStr, tour_time: '' }))
                      setIsCustomTime(false)
                      setTimeInputResetKey((k) => k + 1)
                    }}
                  />
                </div>

                {form.tour_date && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {slotsForSelectedDate.length > 0 ? (
                      /* ── Situation 1: day has scheduled slots ── */
                      <>
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Beschikbare tijdstippen op{' '}
                          <span className="text-brand-700">
                            {format(parseISO(form.tour_date), 'EEEE d MMMM', { locale: nl })}
                          </span>
                        </p>
                        <div className="flex gap-2 sm:gap-3 flex-wrap items-center">
                          {slotsForSelectedDate.map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => handleTimeSelect(time)}
                              className={`px-5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                                !isCustomTime && form.tour_time === time
                                  ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                                  : 'border-gray-200 text-gray-700 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                          <span className="text-sm font-medium text-gray-500 ml-1">Anders:</span>
                          <TimeInput
                            resetKey={timeInputResetKey}
                            onValidTime={(t) => {
                              if (t) {
                                setIsCustomTime(true)
                                setForm((f) => ({ ...f, tour_time: t }))
                              } else {
                                if (isCustomTime) {
                                  setIsCustomTime(false)
                                  setForm((f) => ({ ...f, tour_time: '' }))
                                }
                              }
                            }}
                          />
                        </div>
                        {isCustomTime && (
                          <p className="mt-2 text-xs text-gray-500">
                            Je hebt een ander tijdstip voorgesteld dan gebruikelijk voor onze rondleidingen. We zullen bekijken of dit mogelijk is.
                          </p>
                        )}
                      </>
                    ) : (
                      /* ── Situation 2: day has no scheduled slots ── */
                      <>
                        <p className="text-sm text-gray-600 mb-3">
                          Op{' '}
                          <span className="text-brand-700 font-medium">
                            {format(parseISO(form.tour_date), 'd MMMM', { locale: nl })}
                          </span>{' '}
                          zijn we <strong>niet open</strong>, past enkel dan? Stel een moment voor en we kijken of het past!
                        </p>
                        <TimeInput
                          resetKey={timeInputResetKey}
                          onValidTime={(t) => {
                            setIsCustomTime(!!t)
                            setForm((f) => ({ ...f, tour_time: t }))
                          }}
                        />
                      </>
                    )}
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
              label="Aantal volwassenen"
              description="Ouder dan 12 jaar"
              value={form.adults_count}
              min={1}
              max={50}
              onChange={(v) => setForm((f) => ({ ...f, adults_count: v }))}
            />
            <Counter
              label="Aantal kinderen"
              description="-12 jaar"
              value={form.children_count}
              min={0}
              max={50}
              onChange={(v) => setForm((f) => ({ ...f, children_count: v }))}
            />

            {/* Total count indicator */}
            <div className="flex items-center justify-between px-1 pt-2 pb-2 border-t border-gray-100 text-sm text-gray-500">
              <span>Totaal aantal personen</span>
              <span className="font-semibold text-gray-900">{form.adults_count + form.children_count}</span>
            </div>

            {/* Penguin feeding — decided on-site, no number needed */}
            <div className="flex items-start gap-3 pt-6 border-t border-gray-100">
              <span className="text-2xl leading-none mt-0.5">🐧</span>
              <div>
                <p className="text-sm font-medium text-gray-800">Pinguïns voeren</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Interesse? Dat beslis je ter plaatse. De gids regelt alles op het moment zelf — geen zorgen!
                </p>
              </div>
            </div>

            {/* Optional visitor message */}
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Opmerking <span className="font-normal text-gray-400">(optioneel)</span>
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-600 text-gray-900 placeholder:text-gray-400 resize-none text-sm"
                rows={3}
                placeholder="Vragen of opmerkingen kan je hier schrijven"
                value={form.visitor_message}
                onChange={(e) => setForm((f) => ({ ...f, visitor_message: e.target.value }))}
              />
            </div>
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
      'w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent transition text-gray-900 placeholder:text-gray-400'

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
                  <span className="font-medium">Volwassenen:</span> {form.adults_count} &nbsp;·&nbsp;
                  <span className="font-medium">Kinderen:</span> {form.children_count} &nbsp;·&nbsp;
                  <span className="font-medium">Totaal:</span> {form.adults_count + form.children_count}
                </p>
                {form.visitor_message.trim() && (
                  <p>
                    <span className="font-medium">Opmerking:</span> {form.visitor_message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Naam</label>
                <input
                  className={inputClass}
                  type="text"
                  name="name"
                  autoComplete="name"
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
                  name="email"
                  autoComplete="email"
                  inputMode="email"
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
                  name="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="0470 12 34 56"
                  value={form.visitor_phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, visitor_phone: formatBelgianPhone(e.target.value) }))
                  }
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
          <p className="text-gray-700 mb-1">
            We hebben een bevestigingsmail gestuurd naar{' '}
            <span className="font-semibold text-gray-900">{form.visitor_email}</span>.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Wij checken bij de pinguïns en toerako's of dit past — dat kan tot 2 werkdagen duren.
          </p>

          <div className="bg-brand-50 rounded-xl p-4 text-sm text-gray-700 space-y-1 text-left mb-6">
            <p>
              <span className="font-medium">Datum:</span>{' '}
              {form.tour_date && format(parseISO(form.tour_date), 'EEEE d MMMM yyyy', { locale: nl })} om {form.tour_time}
            </p>
            <p>
              <span className="font-medium">Volwassenen:</span> {form.adults_count} &nbsp;·&nbsp;
              <span className="font-medium">Kinderen:</span> {form.children_count} &nbsp;·&nbsp;
              <span className="font-medium">Totaal:</span> {form.adults_count + form.children_count}
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
