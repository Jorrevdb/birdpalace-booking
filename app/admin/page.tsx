"use client"

import React, { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ExportColumn } from '@/lib/settings'

const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'tour_date',             label: 'Datum',               enabled: true  },
  { key: 'tour_time',             label: 'Tijdslot',            enabled: true  },
  { key: 'visitor_name',          label: 'Naam',                enabled: true  },
  { key: 'visitor_email',         label: 'E-mail',              enabled: true  },
  { key: 'visitor_phone',         label: 'Telefoon',            enabled: true  },
  { key: 'adults',                label: 'Volwassenen (+12j)',   enabled: true  },
  { key: 'children_count',        label: 'Kinderen (-12j)',      enabled: true  },
  { key: 'total_people',          label: 'Totaal personen',      enabled: true  },
  { key: 'penguin_feeding_count', label: 'Pinguïns voeren',     enabled: false },
  { key: 'status',                label: 'Status',               enabled: true  },
  { key: 'visitor_message',       label: 'Opmerking bezoeker',  enabled: false },
  { key: 'worker_message',        label: 'Bericht worker',       enabled: false },
  { key: 'created_at',            label: 'Aangemaakt op',        enabled: false },
]

type Worker = { id: string; name: string; email: string; google_calendar_id: string; created_at?: string }
type Tab = 'dashboard' | 'bookings' | 'workers' | 'calendar' | 'settings'

const NAV_ITEMS: { id: Tab; label: string; icon: string; href?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'bookings',  label: 'Boekingen',  icon: '📋' },
  { id: 'workers',   label: 'Workers',    icon: '👥' },
  { id: 'calendar',  label: 'Kalender',   icon: '📅' },
  { id: 'settings',  label: 'Instellingen', icon: '⚙️' },
  { id: 'settings',  label: 'Bekijk planning', icon: '🗓️', href: 'https://calendar.google.com/calendar/u/4/r/month' },
]

// Inner component so useSearchParams() is inside a Suspense boundary (Next.js 14 requirement)
function AdminPageInner() {
  const searchParams = useSearchParams()
  const deepBookingId = searchParams.get('booking')

  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [clientEmail, setClientEmail] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')

  const [workers, setWorkers] = useState<Worker[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [message, setMessage] = useState('')
  // Used when navigating from dashboard → bookings with a specific booking to open
  const [focusBookingId, setFocusBookingId] = useState<string | null>(null)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_pw') : null
    if (!saved) return
    setPassword(saved)
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/workers?password=${encodeURIComponent(saved)}`)
        if (!res.ok) { localStorage.removeItem('admin_pw'); return }
        const data = await res.json()
        setClientEmail(data.client_email ?? null)
        setAuthenticated(true)
        fetchWorkers(saved)
        if (deepBookingId) setTab('bookings')
      } catch {}
    })()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      const res = await fetch(`/api/admin/workers?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      setClientEmail(data.client_email ?? null)
      setAuthenticated(true)
      localStorage.setItem('admin_pw', password)
      fetchWorkers(password)
      if (deepBookingId) setTab('bookings')
    } catch {
      setMessage('Verkeerd wachtwoord')
    }
  }

  async function fetchWorkers(passwordForFetch?: string) {
    setLoadingWorkers(true)
    try {
      const pw = passwordForFetch ?? password
      const res = await fetch(`/api/admin/workers/list?password=${encodeURIComponent(pw)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      setWorkers(data.workers ?? [])
    } catch (err: any) {
      setMessage(err.message || 'Failed to fetch workers')
    } finally {
      setLoadingWorkers(false)
    }
  }

  useEffect(() => { if (authenticated) fetchWorkers() }, [authenticated])

  // ── Login screen ──────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', width: 360, boxShadow: '0 4px 24px rgba(0,0,0,.08)', border: '1px solid #e5e7eb' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🐦</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>Bird Palace</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>Admin panel</p>
          </div>
          <form onSubmit={handleLogin}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Wachtwoord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ display: 'block', width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
            {message && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#dc2626' }}>{message}</p>}
            <button
              type="submit"
              style={{ marginTop: 16, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Inloggen
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Authenticated layout ───────────────────────────────────────────────────────
  const pageTitle = NAV_ITEMS.find(n => n.id === tab)?.label ?? ''

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar — fixed height, scrolls independently if content overflows */}
      <aside style={{ width: 220, background: '#111827', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🐦</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>Bird Palace</div>
              <div style={{ color: '#6b7280', fontSize: 11 }}>Admin panel</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 10px' }}>
          {NAV_ITEMS.map(({ id, label, icon, href }, idx) => {
            const active = !href && tab === id
            const navStyle: React.CSSProperties = {
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              marginBottom: 2, textAlign: 'left', fontSize: 14, fontWeight: active ? 600 : 400,
              background: active ? 'rgba(255,255,255,.12)' : 'transparent',
              color: active ? '#fff' : '#9ca3af',
              transition: 'all .15s', textDecoration: 'none', boxSizing: 'border-box',
            }
            if (href) {
              return (
                <a
                  key={`${id}-${idx}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={navStyle}
                >
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  {label}
                </a>
              )
            }
            return (
              <button
                key={`${id}-${idx}`}
                onClick={() => setTab(id)}
                style={navStyle}
              >
                <span style={{ fontSize: 16 }}>{icon}</span>
                {label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <button
            onClick={() => { localStorage.removeItem('admin_pw'); window.location.reload() }}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: 0 }}
          >
            ← Uitloggen
          </button>
        </div>
      </aside>

      {/* Main — the only scroll container */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Page title — scrolls away normally */}
        <div style={{ padding: '22px 32px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>{pageTitle}</h1>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px', flex: 1 }}>
          {tab === 'dashboard' && (
            <DashboardPanel
              password={password}
              onNavigate={(t, bookingId) => {
                if (bookingId) setFocusBookingId(bookingId)
                setTab(t)
              }}
            />
          )}

          {tab === 'bookings' && (
            <BookingsTable
              password={password}
              deepBookingId={focusBookingId ?? deepBookingId}
            />
          )}

          {tab === 'workers' && (
            <div style={{ maxWidth: 860 }}>
              {clientEmail && (
                <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: '#475569' }}>
                  <strong style={{ color: '#1e293b' }}>📋 Service account e-mail</strong>
                  <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>Werknemers moeten hun Google Calendar delen met dit adres:</p>
                  <code style={{ display: 'inline-block', marginTop: 6, padding: '4px 10px', background: '#e2e8f0', borderRadius: 6, fontFamily: 'monospace', color: '#1e293b', userSelect: 'all' }}>{clientEmail}</code>
                </div>
              )}
              <AddWorkerForm password={password} onAdded={() => fetchWorkers()} />
              {loadingWorkers ? (
                <p style={{ color: '#9ca3af', marginTop: 16 }}>Laden…</p>
              ) : workers.length === 0 ? (
                <p style={{ color: '#9ca3af', marginTop: 16, fontSize: 14 }}>Nog geen workers aangemaakt.</p>
              ) : (
                <div style={{ marginTop: 20 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>{workers.length} worker{workers.length !== 1 ? 's' : ''}</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Naam</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>E-mail</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Aangemaakt</th>
                        <th style={{ padding: '10px 12px', borderBottom: '2px solid #e5e7eb' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((w) => (
                        <WorkerRow key={w.id} worker={w} password={password} onDeleted={() => fetchWorkers()} onUpdated={() => fetchWorkers()} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'settings' && <SettingsPanel password={password} />}

          {tab === 'calendar' && <CalendarPanel password={password} />}
        </div>
      </main>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPanel({ password, onNavigate }: { password: string; onNavigate: (tab: Tab, bookingId?: string) => void }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')

  // Approve confirmation modal
  const [approvingBooking, setApprovingBooking] = useState<any | null>(null)
  const [approveMessage, setApproveMessage] = useState('')
  const [approving, setApproving] = useState(false)
  const [defaultApproveMsg, setDefaultApproveMsg] = useState('')

  // Finalize modal (2-step)
  const [finalizeBooking, setFinalizeBooking] = useState<any | null>(null)
  const [finalizeStep, setFinalizeStep] = useState<1 | 2>(1)
  const [finalizeNotify, setFinalizeNotify] = useState(true)
  const [finalizeSubject, setFinalizeSubject] = useState('')
  const [finalizeBody, setFinalizeBody] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [savingFinStep1, setSavingFinStep1] = useState(false)
  const [defaultFinalizedSubject, setDefaultFinalizedSubject] = useState('')
  const [defaultFinalizedBody, setDefaultFinalizedBody] = useState('')
  // Finalize step-1 editable form fields
  const [finFormDate, setFinFormDate] = useState('')
  const [finFormTime, setFinFormTime] = useState('')
  const [finFormName, setFinFormName] = useState('')
  const [finFormEmail, setFinFormEmail] = useState('')
  const [finFormPhone, setFinFormPhone] = useState('')
  const [finFormAdults, setFinFormAdults] = useState(0)
  const [finFormChildren, setFinFormChildren] = useState(0)
  const [finFormWorkerMessage, setFinFormWorkerMessage] = useState('')
  const [finFormVisitorMessage, setFinFormVisitorMessage] = useState('')

  // Load default approve message + finalized email defaults from settings once
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings?.worker_message_accepted_default) setDefaultApproveMsg(d.settings.worker_message_accepted_default)
        if (d.settings?.email_finalized_subject) setDefaultFinalizedSubject(d.settings.email_finalized_subject)
        if (d.settings?.email_finalized_intro)   setDefaultFinalizedBody(d.settings.email_finalized_intro)
      })
      .catch(() => {})
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)
  const in14Str = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10) })()

  function fmtDate(iso: string) {
    try {
      return new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
        .format(new Date(`${iso}T00:00:00`))
    } catch { return iso }
  }

  async function fetchBookings() {
    try {
      const res = await fetch(`/api/admin/bookings/list?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      setBookings((data.bookings ?? []).slice().sort((a: any, b: any) =>
        `${a.tour_date} ${a.tour_time}` < `${b.tour_date} ${b.tour_time}` ? -1 : 1
      ))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBookings() }, [])

  function fillFinalizeVars(template: string, b: any): string {
    const adults = (b.total_people || 0) - (b.children_count || 0)
    const vars: Record<string, string> = {
      visitor_name:   b.visitor_name  || '',
      visitor_email:  b.visitor_email || '',
      visitor_phone:  b.visitor_phone || '',
      tour_date:      b.tour_date     || '',
      tour_time:      b.tour_time     || '',
      total_people:   String(b.total_people   || 0),
      adults_count:   String(adults),
      children_count: String(b.children_count || 0),
    }
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
  }

  async function openFinalizeModal(b: any) {
    // Populate editable form fields
    const children = Number(b.children_count || 0)
    const total    = Number(b.total_people   || 0)
    setFinFormDate(b.tour_date      || '')
    setFinFormTime(b.tour_time      || '')
    setFinFormName(b.visitor_name   || '')
    setFinFormEmail(b.visitor_email || '')
    setFinFormPhone(b.visitor_phone || '')
    setFinFormAdults(Math.max(0, total - children))
    setFinFormChildren(children)
    setFinFormWorkerMessage(b.worker_message  || '')
    setFinFormVisitorMessage(b.visitor_message || '')

    setFinalizeBooking(b)
    setFinalizeStep(1)
    setFinalizeNotify(!!b.visitor_email)
    setFinalizing(false)
    setSavingFinStep1(false)

    // Fetch fresh settings and pre-fill placeholders
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      const s = data.settings ?? {}
      const rawSubject = s.email_finalized_subject || `Bedankt voor jullie bezoek! – {{tour_date}}`
      const rawBody    = s.email_finalized_intro   || `Bedankt voor jullie bezoek aan Bird Palace op {{tour_date}}. We hopen dat jullie het fantastisch hebben gehad!`
      setFinalizeSubject(fillFinalizeVars(rawSubject, b))
      setFinalizeBody(fillFinalizeVars(rawBody, b))
    } catch {
      setFinalizeSubject(`Bedankt voor jullie bezoek! – ${b.tour_date}`)
      setFinalizeBody(`Bedankt voor jullie bezoek aan Bird Palace op ${b.tour_date}. We hopen dat jullie het fantastisch hebben gehad!`)
    }
  }

  async function saveFinStep1AndNext() {
    if (!finalizeBooking) return
    setSavingFinStep1(true)
    try {
      const adults   = Number(finFormAdults   || 0)
      const children = Number(finFormChildren || 0)
      const res = await fetch(`/api/admin/bookings/${finalizeBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          updates: {
            tour_date:       finFormDate,
            tour_time:       finFormTime,
            visitor_name:    finFormName,
            visitor_email:   finFormEmail,
            visitor_phone:   finFormPhone,
            total_people:    adults + children,
            children_count:  children,
            worker_message:  finFormWorkerMessage  || null,
            visitor_message: finFormVisitorMessage || null,
          },
          notify: false,
        }),
      })
      const data = await res.json()
      if (data.ok && data.booking) {
        setFinalizeBooking(data.booking)
        setFinalizeNotify(!!data.booking.visitor_email)
      }
    } catch { /* proceed anyway */ }
    setSavingFinStep1(false)
    setFinalizeStep(2)
  }

  async function doFinalizeBooking() {
    if (!finalizeBooking) return
    setFinalizing(true)
    try {
      const res = await fetch(`/api/admin/bookings/${finalizeBooking.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          notify: finalizeNotify && !!finalizeBooking.visitor_email,
          email_subject: finalizeSubject,
          email_body: finalizeBody,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Mislukt')
      setFinalizeBooking(null)
      setActionMsg(`✓ Boeking afgerond${finalizeNotify && finalizeBooking.visitor_email ? ' — opvolgmail verstuurd' : ''}`)
      fetchBookings()
      setTimeout(() => setActionMsg(''), 5000)
    } catch (err: any) {
      setActionMsg(err.message || 'Fout bij afronden')
    } finally {
      setFinalizing(false)
    }
  }

  async function approveBooking(id: string, workerMessage: string) {
    setApproving(true)
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          updates: { status: 'approved', worker_message: workerMessage.trim() || null },
          notify: true,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Mislukt')
      setApprovingBooking(null)
      setApproveMessage('')
      setActionMsg('✓ Boeking bevestigd en bezoeker op de hoogte gebracht')
      fetchBookings()
      setTimeout(() => setActionMsg(''), 4000)
    } catch (err: any) {
      setActionMsg(err.message || 'Fout bij bevestigen')
    } finally {
      setApproving(false)
    }
  }

  // Derived stats
  const pendingUpcoming = bookings.filter(b => b.status === 'pending' && b.tour_date >= todayStr)
  const upcomingApproved = bookings.filter(b => b.status === 'approved' && b.tour_date >= todayStr)
  // Past approved bookings that still need to be finalized (tour date+time is in the past)
  const pastApprovedToFinalize = bookings.filter(b => {
    if (b.status !== 'approved') return false
    try {
      const dt = new Date(`${b.tour_date}T${b.tour_time ?? '00:00'}`)
      return dt < new Date()
    } catch { return b.tour_date < todayStr }
  })
  const thisMonthStr = todayStr.slice(0, 7)
  const thisMonthTotal = bookings.filter(b => b.tour_date.startsWith(thisMonthStr)).length
  const next14 = bookings.filter(b => b.tour_date >= todayStr && b.tour_date <= in14Str)
  const totalPeople = upcomingApproved.reduce((s: number, b: any) => s + (b.total_people || 0), 0)

  const statCards = [
    { label: 'Wachten op bevestiging', value: pendingUpcoming.length, color: pendingUpcoming.length > 0 ? '#f59e0b' : '#6b7280', bg: pendingUpcoming.length > 0 ? '#fffbeb' : '#f9fafb', urgent: pendingUpcoming.length > 0 },
    { label: 'Aankomende tours', value: upcomingApproved.length, color: 'var(--primary-color-600)', bg: 'color-mix(in srgb, var(--primary-color-600) 8%, white)', urgent: false },
    { label: 'Personen verwacht', value: totalPeople, color: '#6366f1', bg: '#eef2ff', urgent: false },
    { label: 'Boekingen deze maand', value: thisMonthTotal, color: '#6b7280', bg: '#f9fafb', urgent: false },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9ca3af', fontSize: 15 }}>
        Laden…
      </div>
    )
  }

  return (
    <>
    <div>
      {actionMsg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 14 }}>
          {actionMsg}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {statCards.map(({ label, value, color, bg, urgent }) => (
          <div
            key={label}
            style={{ background: bg, border: `1px solid ${urgent ? '#fde68a' : '#e5e7eb'}`, borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}
          >
            {urgent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />}
            <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Left: Afwachtende boekingen */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>⏳ Afwachtende boekingen</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>Boekingen die wachten op bevestiging</p>
            </div>
            {pendingUpcoming.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                {pendingUpcoming.length}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {pendingUpcoming.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                ✓ Niets te bevestigen
              </div>
            ) : (
              pendingUpcoming.map((b: any) => (
                <div key={b.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{b.visitor_name}</div>
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                        {fmtDate(b.tour_date)} · {b.tour_time} · {b.total_people} pers.
                      </div>
                      {b.visitor_message && (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>"{b.visitor_message}"</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                      <button
                        onClick={() => { setApprovingBooking(b); setApproveMessage(defaultApproveMsg) }}
                        style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--primary-color-600)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ✓ Accepteren
                      </button>
                      <button
                        onClick={() => onNavigate('bookings', b.id)}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        ✎ Wijzigen
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {pendingUpcoming.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => onNavigate('bookings')} style={{ fontSize: 13, color: 'var(--primary-color-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                Bekijk alle boekingen →
              </button>
            </div>
          )}
        </div>

        {/* Right: Boeking afronden */}
        <div style={{ background: '#fff', border: `1px solid ${pastApprovedToFinalize.length > 0 ? '#c7d2fe' : '#e5e7eb'}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>✅ Boeking afronden</h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>Goedgekeurde tours die al zijn geweest</p>
            </div>
            {pastApprovedToFinalize.length > 0 && (
              <span style={{ background: '#6366f1', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                {pastApprovedToFinalize.length}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {pastApprovedToFinalize.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                ✓ Niets te afronden
              </div>
            ) : (
              pastApprovedToFinalize.map((b: any) => (
                <div key={b.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{b.visitor_name}</div>
                      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                        {fmtDate(b.tour_date)} · {b.tour_time} · {b.total_people} pers.
                      </div>
                    </div>
                    <button
                      onClick={() => openFinalizeModal(b)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12 }}
                    >
                      Afronden →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {pastApprovedToFinalize.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => onNavigate('bookings')} style={{ fontSize: 13, color: 'var(--primary-color-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                Bekijk alle boekingen →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: recent all bookings summary */}
      {bookings.filter(b => b.tour_date >= todayStr).length > 0 && (
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>🗓 Volgende 5 boekingen</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {bookings.filter(b => b.tour_date >= todayStr).slice(0, 5).map((b: any) => (
                <tr key={b.id}>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb', fontWeight: 500 }}>{fmtDate(b.tour_date)}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb', fontWeight: 600, color: '#374151' }}>{b.tour_time}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb' }}>{b.visitor_name}</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb', color: '#9ca3af', fontSize: 13 }}>{b.total_people} pers.</td>
                  <td style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      ...(b.status === 'approved'
                        ? { background: 'color-mix(in srgb, var(--primary-color-600) 10%, white)', color: 'var(--primary-color-700)', border: '1px solid var(--primary-color-600)' }
                        : b.status === 'denied'
                        ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }
                        : { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' })
                    }}>
                      {b.status === 'approved' ? 'Bevestigd' : b.status === 'denied' ? 'Geweigerd' : 'Afwachtend'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* ── Finalize modal (2-step) ──────────────────────────────────────────── */}
    {finalizeBooking !== null && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget && !finalizing) setFinalizeBooking(null) }}
      >
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
                Boeking afronden — Stap {finalizeStep}: {finalizeStep === 1 ? 'Gegevens controleren' : 'Opvolgmail'}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#9ca3af' }}>
                {finalizeStep === 1 ? 'Klopt alles? Dan gaan we door naar de opvolgmail.' : 'Stuur optioneel een bedankmail naar de bezoeker.'}
              </p>
            </div>
            <button
              onClick={() => { if (!finalizing) setFinalizeBooking(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', lineHeight: 1, padding: 4 }}
            >×</button>
          </div>

          {/* Step 1: Editable booking details */}
          {finalizeStep === 1 && (
            <>
              <div style={{ overflowY: 'auto', padding: '20px 24px', maxHeight: 'calc(90vh - 180px)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                  {/* Left: klantgegevens */}
                  <div style={{ paddingRight: 20, borderRight: '1px solid #f3f4f6' }}>
                    <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Klantgegevens</p>
                    <label style={{ display: 'block', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Naam</span>
                      <input value={finFormName} onChange={e => setFinFormName(e.target.value)} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ display: 'block', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>E-mailadres</span>
                      <input value={finFormEmail} onChange={e => setFinFormEmail(e.target.value)} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ display: 'block', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Telefoonnummer</span>
                      <input value={finFormPhone} onChange={e => setFinFormPhone(e.target.value)} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Opmerking bezoeker</span>
                      <textarea value={finFormVisitorMessage} onChange={e => setFinFormVisitorMessage(e.target.value)} rows={2} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </label>
                  </div>
                  {/* Right: boekingsgegevens */}
                  <div>
                    <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Boekingsgegevens</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 10 }}>
                      <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Datum</span>
                        <input type="date" value={finFormDate} onChange={e => setFinFormDate(e.target.value)} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                      </label>
                      <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tijdslot</span>
                        <TimeInput value={finFormTime} onChange={setFinFormTime} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                      </label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                      <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Volwassenen</span>
                        <input type="number" min={0} value={finFormAdults} onChange={e => setFinFormAdults(Math.max(0, Number(e.target.value || 0)))} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                      </label>
                      <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Kinderen</span>
                        <input type="number" min={0} value={finFormChildren} onChange={e => setFinFormChildren(Math.max(0, Number(e.target.value || 0)))} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                      </label>
                    </div>
                    <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#6b7280' }}>
                      Totaal: <strong style={{ color: '#111827' }}>{finFormAdults + finFormChildren} personen</strong>
                    </p>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Bericht aan bezoeker</span>
                      <textarea value={finFormWorkerMessage} onChange={e => setFinFormWorkerMessage(e.target.value)} rows={2} style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </label>
                  </div>
                </div>
                <p style={{ margin: '16px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  Na voltooien krijgt de boeking de status <strong style={{ color: '#4338ca' }}>Afgerond</strong>.
                </p>
              </div>
              {/* Footer step 1 */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <select
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'delete') {
                        if (confirm('Boeking verwijderen?')) {
                          fetch(`/api/admin/bookings/${finalizeBooking.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password }),
                          }).then(() => { setFinalizeBooking(null); fetchBookings(); setActionMsg('Boeking verwijderd.') }).catch(() => {})
                        }
                      } else if (v === 'denied') {
                        fetch(`/api/admin/bookings/${finalizeBooking.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ password, updates: { status: 'denied' }, notify: false }),
                        }).then(() => { setFinalizeBooking(null); fetchBookings(); setActionMsg('Boeking geweigerd.') }).catch(() => {})
                      }
                      e.target.value = ''
                    }}
                    defaultValue=""
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  >
                    <option value="" disabled>🚫 Kwam niet opdagen</option>
                    <option value="denied">→ Markeer als geweigerd</option>
                    <option value="delete">→ Verwijder boeking</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setFinalizeBooking(null)}
                    disabled={savingFinStep1}
                    style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={saveFinStep1AndNext}
                    disabled={savingFinStep1}
                    style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: savingFinStep1 ? 'not-allowed' : 'pointer', opacity: savingFinStep1 ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {savingFinStep1 ? (
                      <>
                        <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                        Opslaan…
                      </>
                    ) : 'Volgende →'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Email config */}
          {finalizeStep === 2 && (
            <>
              <div style={{ padding: '20px 24px' }}>
                {/* Visitor info */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 22 }}>👤</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{finalizeBooking.visitor_name}</div>
                    <div style={{ fontSize: 13, color: finalizeBooking.visitor_email ? '#374151' : '#9ca3af' }}>
                      {finalizeBooking.visitor_email || 'Geen e-mailadres bekend'}
                    </div>
                  </div>
                </div>

                {/* Notify toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: finalizeBooking.visitor_email ? 'pointer' : 'not-allowed', opacity: finalizeBooking.visitor_email ? 1 : 0.5, marginBottom: 16 }}>
                  <input
                    type="checkbox"
                    checked={finalizeNotify}
                    onChange={(e) => setFinalizeNotify(e.target.checked)}
                    disabled={!finalizeBooking.visitor_email || finalizing}
                    style={{ width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Bedankmail sturen naar bezoeker</span>
                </label>

                {finalizeNotify && finalizeBooking.visitor_email && (
                  <>
                    <label style={{ display: 'block', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Onderwerp</span>
                      <input
                        value={finalizeSubject}
                        onChange={(e) => setFinalizeSubject(e.target.value)}
                        disabled={finalizing}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                        Inhoud <span style={{ fontWeight: 400, color: '#9ca3af' }}>(vrije tekst, placeholders zoals {'{{visitor_name}}'} werken)</span>
                      </span>
                      <textarea
                        value={finalizeBody}
                        onChange={(e) => setFinalizeBody(e.target.value)}
                        rows={4}
                        disabled={finalizing}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Footer step 2 */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setFinalizeStep(1)}
                  disabled={finalizing}
                  style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                >
                  ← Terug
                </button>
                <button
                  onClick={doFinalizeBooking}
                  disabled={finalizing}
                  style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: finalizing ? 'not-allowed' : 'pointer', opacity: finalizing ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {finalizing ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Bezig…
                    </>
                  ) : '✓ Voltooien'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* ── Approve confirmation modal ───────────────────────────────────────── */}
    {approvingBooking !== null && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget && !approving) { setApprovingBooking(null); setApproveMessage('') } }}
      >
        <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>Boeking bevestigen</h2>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#9ca3af' }}>Stuur een bevestiging naar de bezoeker</p>
            </div>
            <button
              onClick={() => { if (!approving) { setApprovingBooking(null); setApproveMessage('') } }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          {/* Booking details */}
          <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 4 }}>
              {approvingBooking.visitor_name}
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              <span>📅 {fmtDate(approvingBooking.tour_date)}</span>
              <span>🕐 {approvingBooking.tour_time}</span>
              <span>👥 {approvingBooking.total_people} personen</span>
            </div>
            {approvingBooking.visitor_message && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, color: '#374151', fontStyle: 'italic' }}>
                "{approvingBooking.visitor_message}"
              </div>
            )}
          </div>

          {/* Message */}
          <div style={{ padding: '20px 24px' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Bericht voor de bezoeker <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optioneel)</span>
            </label>
            <textarea
              value={approveMessage}
              onChange={(e) => setApproveMessage(e.target.value)}
              placeholder="Bijv. Welkom! We kijken ernaar uit jullie te ontvangen."
              rows={3}
              disabled={approving}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: '#111827', outline: 'none', background: approving ? '#f9fafb' : '#fff' }}
            />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Vooraf ingevuld met het standaardbericht uit instellingen. Pas gerust aan — dit wordt opgenomen in de bevestigingsmail.
            </p>
          </div>

          {/* Actions */}
          <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { if (!approving) { setApprovingBooking(null); setApproveMessage('') } }}
              disabled={approving}
              style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              Annuleren
            </button>
            <button
              onClick={() => approveBooking(approvingBooking.id, approveMessage)}
              disabled={approving}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'var(--primary-color-600)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: approving ? 'not-allowed' : 'pointer', opacity: approving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {approving ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Bezig…
                </>
              ) : (
                '✓ Boeking bevestigen'
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ── Add Worker Form ────────────────────────────────────────────────────────────
function AddWorkerForm({ password, onAdded }: { password: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    if (!name.trim() || !email.trim()) {
      setError('Vul naam en e-mail in.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name: name.trim(), email: email.trim(), google_calendar_id: '' }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || 'Toevoegen mislukt')
      setName(''); setEmail(''); setOpen(false)
      onAdded()
    } catch (err: any) {
      setError(err.message || 'Fout bij toevoegen')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151' } as const

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
      >
        + Worker toevoegen
      </button>
    )
  }

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 4 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Nieuwe worker</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={labelStyle}>
          Naam
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jan Janssens" style={inputStyle} />
        </label>
        <label style={labelStyle}>
          E-mailadres
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jan@voorbeeld.be" style={inputStyle} />
        </label>
      </div>
      {error && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#dc2626' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={handleAdd}
          disabled={saving}
          style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          {saving ? 'Opslaan…' : 'Toevoegen'}
        </button>
        <button
          onClick={() => { setOpen(false); setError('') }}
          style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          Annuleren
        </button>
      </div>
    </div>
  )
}

function WorkerRow({ worker, password, onDeleted, onUpdated }: { worker: any; password: string; onDeleted?: () => void; onUpdated?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(worker.name)
  const [email, setEmail] = useState(worker.email)
  const [gid, setGid] = useState(worker.google_calendar_id)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'ok' | 'error' | 'info' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    setStatusMsg(null)
    try {
      const res = await fetch(`/api/admin/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name, email, google_calendar_id: gid }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Update mislukt')
        throw new Error(text || 'Update mislukt')
      }
      setEditing(false)
      onUpdated && onUpdated()
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Fout bij opslaan', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Weet je zeker dat je "${worker.name}" wil verwijderen?`)) return
    setDeleting(true)
    setStatusMsg(null)
    try {
      const res = await fetch(`/api/admin/workers/${worker.id}?password=${encodeURIComponent(password)}`, { method: 'DELETE' })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Verwijderen mislukt')
        throw new Error(text || 'Verwijderen mislukt')
      }
      onDeleted && onDeleted()
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Verwijderen mislukt', type: 'error' })
      setDeleting(false)
    }
  }

  const tdStyle = { padding: '13px 12px', borderBottom: '1px solid #f3f4f6', fontSize: 14 }
  const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' as const }

  return (
    <>
      <tr>
        <td style={tdStyle}>
          {editing ? <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /> : <span style={{ fontWeight: 500 }}>{name}</span>}
        </td>
        <td style={tdStyle}>
          {editing ? <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /> : email}
        </td>
        <td style={{ ...tdStyle, fontSize: 12, color: '#9ca3af' }}>
          {worker.created_at ? new Date(worker.created_at).toLocaleDateString('nl-BE') : '—'}
        </td>
        <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {editing ? (
            <>
              <button onClick={save} disabled={saving} style={{ marginRight: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {saving ? 'Opslaan…' : 'Opslaan'}
              </button>
              <button onClick={() => { setEditing(false); setName(worker.name); setEmail(worker.email) }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Annuleren
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} style={{ marginRight: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                Bewerk
              </button>
              <button onClick={remove} disabled={deleting} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                {deleting ? '…' : 'Verwijder'}
              </button>
            </>
          )}
        </td>
      </tr>
      {statusMsg && (
        <tr>
          <td colSpan={5} style={{ padding: '0 12px 10px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: statusMsg.type === 'ok' ? '#f0fdf4' : statusMsg.type === 'error' ? '#fef2f2' : '#f9fafb',
              color: statusMsg.type === 'ok' ? '#16a34a' : statusMsg.type === 'error' ? '#dc2626' : '#6b7280',
              border: `1px solid ${statusMsg.type === 'ok' ? '#bbf7d0' : statusMsg.type === 'error' ? '#fecaca' : '#e5e7eb'}`,
            }}>
              {statusMsg.text}
            </span>
          </td>
        </tr>
      )}
    </>
  )
}

function BookingsTable({ password, deepBookingId }: { password: string; deepBookingId?: string | null }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [modalOpen, setModalOpen] = useState(false)
  const deepLinkOpenedRef = useRef(false)
  const [activeBooking, setActiveBooking] = useState<any | null>(null)
  const [savingModal, setSavingModal] = useState(false)
  const [deletingModal, setDeletingModal] = useState(false)
  const [addingToCalendar, setAddingToCalendar] = useState(false)
  const [notifyVisitor, setNotifyVisitor] = useState(true)

  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'denied' | 'afgerond'>('all')
  const [filterTime, setFilterTime] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Export
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportStatusFilter, setExportStatusFilter] = useState<'all' | 'approved' | 'pending' | 'denied'>('all')
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS)

  // Create booking
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createDate, setCreateDate] = useState('')
  const [createTime, setCreateTime] = useState('')
  const [createAdults, setCreateAdults] = useState(1)
  const [createChildren, setCreateChildren] = useState(0)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createMessage, setCreateMessage] = useState('')
  const [createStatus, setCreateStatus] = useState('approved')
  const [createNotify, setCreateNotify] = useState(false)
  const [createAddCal, setCreateAddCal] = useState(true)
  const [createPenguinFeeding, setCreatePenguinFeeding] = useState<number | ''>('')

  const [formStatus, setFormStatus] = useState('pending')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('')
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAdults, setFormAdults] = useState(1)
  const [formChildren, setFormChildren] = useState(0)
  const [formPenguinFeeding, setFormPenguinFeeding] = useState<number | ''>('')
  const [formWorkerMessage, setFormWorkerMessage] = useState('')
  const [formVisitorMessage, setFormVisitorMessage] = useState('')

  function formatNlDate(isoDate: string) {
    try {
      const d = new Date(`${isoDate}T00:00:00`)
      return new Intl.DateTimeFormat('nl-BE', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(d)
    } catch {
      return isoDate
    }
  }

  function statusStyle(status: string) {
    if (status === 'approved') return { border: '1px solid var(--primary-color-600)', color: 'var(--primary-color-700)', background: 'color-mix(in srgb, var(--primary-color-600) 10%, white)' }
    if (status === 'denied') return { border: '1px solid #dc2626', color: '#991b1b', background: '#fef2f2' }
    if (status === 'afgerond') return { border: '1px solid #6366f1', color: '#4338ca', background: '#eef2ff' }
    return { border: '1px solid #d1d5db', color: '#374151', background: '#fff' }
  }

  function statusLabel(status: string) {
    if (status === 'approved') return 'Geaccepteerd'
    if (status === 'denied') return 'Geweigerd'
    if (status === 'afgerond') return 'Afgerond'
    return 'Afwachtend'
  }

  async function fetchBookings() {
    setLoading(true)
    try {
      const [bookRes, settingsRes] = await Promise.all([
        fetch(`/api/admin/bookings/list?password=${encodeURIComponent(password)}`),
        fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`),
      ])
      if (!bookRes.ok) throw new Error('Unauthorized')
      const data = await bookRes.json()
      const sorted = (data.bookings ?? []).slice().sort((a: any, b: any) => {
        const aKey = `${a.tour_date} ${a.tour_time}`
        const bKey = `${b.tour_date} ${b.tour_time}`
        if (aKey < bKey) return -1
        if (aKey > bKey) return 1
        return 0
      })
      setBookings(sorted)
      // Load export column config from settings
      if (settingsRes.ok) {
        const sData = await settingsRes.json()
        const saved = sData.settings?.export_columns
        if (Array.isArray(saved) && saved.length > 0) {
          const savedKeys = new Set(saved.map((c: ExportColumn) => c.key))
          const newDefaults = DEFAULT_EXPORT_COLUMNS.filter(c => !savedKeys.has(c.key))
          setExportColumns([...saved, ...newDefaults])
        }
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to fetch bookings')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchBookings() }, [])

  // Auto-open a specific booking when ?booking=<id> is passed as a prop (only once)
  useEffect(() => {
    if (!deepBookingId || !bookings.length || deepLinkOpenedRef.current) return
    const target = bookings.find((b: any) => b.id === deepBookingId)
    if (target) {
      deepLinkOpenedRef.current = true
      openModalFor(target)
    }
  }, [bookings, deepBookingId])

  function openModalFor(booking: any) {
    setActiveBooking(booking)
    setFormStatus(booking.status || 'pending')
    setFormDate(booking.tour_date || '')
    setFormTime(booking.tour_time || '')
    setFormName(booking.visitor_name || '')
    setFormEmail(booking.visitor_email || '')
    setFormPhone(booking.visitor_phone || '')
    // formAdults = adults only (total minus children)
    const children = Number(booking.children_count || 0)
    const total = Number(booking.total_people || 1)
    setFormAdults(Math.max(1, total - children))
    setFormChildren(children)
    setFormPenguinFeeding(booking.penguin_feeding_count != null ? Number(booking.penguin_feeding_count) : '')
    setFormWorkerMessage(booking.worker_message || '')
    setFormVisitorMessage(booking.visitor_message || '')
    setNotifyVisitor(false)
    setModalOpen(true)
  }

  async function quickUpdateStatus(booking: any, newStatus: string) {
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          updates: { status: newStatus },
          notify: true,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Status update failed')
      fetchBookings()
    } catch (err: any) {
      setMessage(err.message || 'Status update failed')
      setMessageType('error')
    }
  }

  async function saveModalEdits() {
    if (!activeBooking) return
    setSavingModal(true)
    try {
      const adults = Number(formAdults || 1)
      const children = Number(formChildren || 0)
      const payload = {
        password,
        updates: {
          status: formStatus,
          tour_date: formDate,
          tour_time: formTime,
          visitor_name: formName,
          visitor_email: formEmail,
          visitor_phone: formPhone,
          total_people: adults + children,
          children_count: children,
          penguin_feeding_count: formPenguinFeeding === '' ? null : Number(formPenguinFeeding),
          visitor_message: formVisitorMessage || null,
          worker_message: formWorkerMessage || null,
        },
        notify: notifyVisitor,
      }

      const res = await fetch(`/api/admin/bookings/${activeBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Save failed')
      setModalOpen(false)
      fetchBookings()
      setMessage(notifyVisitor ? 'Boeking opgeslagen en e-mail verstuurd.' : 'Boeking opgeslagen.')
      setMessageType('success')
    } catch (err: any) {
      setMessage(err.message || 'Error saving booking')
      setMessageType('error')
    } finally {
      setSavingModal(false)
    }
  }

  async function deleteActiveBooking() {
    if (!activeBooking) return
    if (!confirm('Weet je zeker dat je deze boeking wil verwijderen?')) return

    setDeletingModal(true)
    try {
      const res = await fetch(`/api/admin/bookings/${activeBooking.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      let data: any = {}
      try {
        data = await res.json()
      } catch {}
      if (!res.ok || !data.ok) throw new Error(data.message || 'Verwijderen mislukt')

      closeModal()
      fetchBookings()
      setMessage('Boeking verwijderd.')
      setMessageType('success')
    } catch (err: any) {
      setMessage(err.message || 'Error deleting booking')
      setMessageType('error')
    } finally {
      setDeletingModal(false)
    }
  }

  // ── Export helpers ────────────────────────────────────────────────────────
  function applyExportShortcut(shortcut: 'this_month' | 'last_month' | 'this_year' | 'all') {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const pad = (n: number) => String(n).padStart(2, '0')
    if (shortcut === 'this_month') {
      setExportFrom(`${y}-${pad(m + 1)}-01`)
      const lastDay = new Date(y, m + 1, 0).getDate()
      setExportTo(`${y}-${pad(m + 1)}-${pad(lastDay)}`)
    } else if (shortcut === 'last_month') {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      setExportFrom(`${ly}-${pad(lm + 1)}-01`)
      const lastDay = new Date(ly, lm + 1, 0).getDate()
      setExportTo(`${ly}-${pad(lm + 1)}-${pad(lastDay)}`)
    } else if (shortcut === 'this_year') {
      setExportFrom(`${y}-01-01`)
      setExportTo(`${y}-12-31`)
    } else {
      setExportFrom('')
      setExportTo('')
    }
  }

  function exportToXLS() {
    function escXml(v: any): string {
      return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
    function statusNL(s: string) {
      if (s === 'approved') return 'Geaccepteerd'
      if (s === 'denied') return 'Geweigerd'
      return 'Afwachtend'
    }
    function cellValue(b: any, key: string): string {
      switch (key) {
        case 'adults':   return String(b.total_people - (b.children_count ?? 0))
        case 'status':   return statusNL(b.status)
        case 'created_at': return b.created_at ? new Date(b.created_at).toLocaleString('nl-BE') : ''
        default:         return String(b[key] ?? '')
      }
    }

    // Filter bookings by selected range + status
    const rows = bookings.filter((b) => {
      if (exportStatusFilter !== 'all' && b.status !== exportStatusFilter) return false
      if (exportFrom && b.tour_date < exportFrom) return false
      if (exportTo   && b.tour_date > exportTo)   return false
      return true
    })

    const enabledCols = exportColumns.filter(c => c.enabled)

    const headerRow = enabledCols
      .map(c => `<Cell ss:StyleID="header"><Data ss:Type="String">${escXml(c.label)}</Data></Cell>`)
      .join('')

    const dataRows = rows.map(b => {
      const cells = enabledCols.map(c => {
        const val = cellValue(b, c.key)
        // Use Number type for numeric fields
        const numericKeys = ['adults', 'children_count', 'total_people', 'penguin_feeding_count']
        const isNum = numericKeys.includes(c.key) && val !== '' && !isNaN(Number(val))
        return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escXml(val)}</Data></Cell>`
      }).join('')
      return `<Row>${cells}</Row>`
    }).join('\n      ')

    const from = exportFrom || 'begin'
    const to   = exportTo   || 'einde'

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Boekingen">
    <Table>
      <Row>${headerRow}</Row>
      ${dataRows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `boekingen_${from}_${to}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  // ── Export preview count ──────────────────────────────────────────────────
  const exportPreviewCount = bookings.filter((b) => {
    if (exportStatusFilter !== 'all' && b.status !== exportStatusFilter) return false
    if (exportFrom && b.tour_date < exportFrom) return false
    if (exportTo   && b.tour_date > exportTo)   return false
    return true
  }).length

  async function forceAddToCalendar() {
    if (!activeBooking) return
    setAddingToCalendar(true)
    try {
      const res = await fetch(`/api/admin/bookings/${activeBooking.id}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Mislukt')
      const extra = data.pending ? ' (als onbevestigd — gele kleur in agenda)' : ''
      setMessage(`📅 Toegevoegd aan Google Agenda${extra}`)
      setMessageType('success')
      fetchBookings()
    } catch (err: any) {
      setMessage(err.message || 'Fout bij toevoegen aan agenda')
      setMessageType('error')
    } finally {
      setAddingToCalendar(false)
    }
  }

  function openCreateModal() {
    // Pre-fill date with today
    setCreateDate(new Date().toISOString().slice(0, 10))
    setCreateTime('')
    setCreateAdults(0)
    setCreateChildren(0)
    setCreatePenguinFeeding('')
    setCreateName('')
    setCreateEmail('')
    setCreatePhone('')
    setCreateMessage('')
    setCreateStatus('approved')
    setCreateNotify(false)
    setCreateAddCal(true)
    setCreateOpen(true)
  }

  async function saveNewBooking() {
    if (!createDate || !createTime) {
      setMessage('Datum en tijdslot zijn verplicht.')
      setMessageType('error')
      return
    }
    setCreateSaving(true)
    try {
      const res = await fetch('/api/admin/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          tour_date: createDate,
          tour_time: createTime,
          adults: createAdults,
          children_count: createChildren,
          penguin_feeding_count: createPenguinFeeding === '' ? null : Number(createPenguinFeeding),
          visitor_name: createName,
          visitor_email: createEmail,
          visitor_phone: createPhone,
          visitor_message: createMessage,
          status: createStatus,
          notify_visitor: createNotify && !!createEmail.trim(),
          add_to_calendar: createAddCal,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Mislukt')
      setCreateOpen(false)
      fetchBookings()
      setMessage(`✓ Boeking aangemaakt${createAddCal ? ' en toegevoegd aan agenda' : ''}${createNotify && createEmail ? ' — bevestigingsmail verstuurd' : ''}.`)
      setMessageType('success')
    } catch (err: any) {
      setMessage(err.message || 'Fout bij aanmaken boeking')
      setMessageType('error')
    } finally {
      setCreateSaving(false)
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Weet je zeker dat je ${selectedIds.size} boeking${selectedIds.size !== 1 ? 'en' : ''} wil verwijderen?`)) return
    setBulkDeleting(true)
    try {
      await Promise.all(Array.from(selectedIds).map(id =>
        fetch(`/api/admin/bookings/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })
      ))
      setSelectedIds(new Set())
      fetchBookings()
      setMessage(`${selectedIds.size} boeking${selectedIds.size !== 1 ? 'en' : ''} verwijderd.`)
      setMessageType('success')
    } catch (err: any) {
      setMessage(err.message || 'Fout bij verwijderen')
      setMessageType('error')
    } finally {
      setBulkDeleting(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setActiveBooking(null)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    if (filterTime === 'upcoming' && b.tour_date < todayStr) return false
    if (filterTime === 'past' && b.tour_date >= todayStr) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (
        !b.visitor_name?.toLowerCase().includes(q) &&
        !b.visitor_email?.toLowerCase().includes(q) &&
        !b.visitor_phone?.toLowerCase().includes(q) &&
        !b.tour_date?.includes(q)
      ) return false
    }
    return true
  })

  const pendingUpcomingCount = bookings.filter(b => b.status === 'pending' && b.tour_date >= todayStr).length

  const filterBtnBase: React.CSSProperties = { padding: '6px 14px', borderRadius: 999, border: '1px solid', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .15s' }
  const filterBtnActive: React.CSSProperties = { background: '#111827', color: '#fff', borderColor: '#111827' }
  const filterBtnInactive: React.CSSProperties = { background: '#fff', color: '#6b7280', borderColor: '#d1d5db' }

  return (
    <div>
      {/* ── Sticky toolbar (actie + filters) ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#f8fafc',
        marginBottom: 4,
        paddingBottom: 12,
      }}>
        {/* Actie-balk */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="🔍  Zoek op naam, e-mail, telefoon of datum…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', minWidth: 0 }}
          />
          <button
            onClick={openCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            + Nieuwe boeking
          </button>
          <button
            onClick={() => setExportOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            📊 Exporteren
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid #fecaca', background: '#fee2e2', fontSize: 13, fontWeight: 700, color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {bulkDeleting ? 'Verwijderen…' : `🗑 Verwijder ${selectedIds.size}`}
            </button>
          )}
        </div>

        {/* Filter-balk */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', background: '#f0f1f3', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {([
            { key: 'all' as const, label: 'Alle' },
            { key: 'pending' as const, label: `Afwachtend${pendingUpcomingCount > 0 ? ` (${pendingUpcomingCount})` : ''}` },
            { key: 'approved' as const, label: 'Geaccepteerd' },
            { key: 'denied' as const, label: 'Geweigerd' },
            { key: 'afgerond' as const, label: 'Afgerond' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              style={{
                ...filterBtnBase,
                ...(filterStatus === key
                  ? key === 'approved'  ? { background: 'var(--primary-color-600)', color: '#fff', borderColor: 'var(--primary-color-600)' }
                  : key === 'denied'    ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' }
                  : key === 'pending'   ? { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }
                  : key === 'afgerond'  ? { background: '#6366f1', color: '#fff', borderColor: '#6366f1' }
                  : filterBtnActive
                  : filterBtnInactive)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: '#e5e7eb', flexShrink: 0 }} />

        {/* Time filter */}
        <div style={{ display: 'flex', gap: 5 }}>
          {([
            { key: 'upcoming' as const, label: '📅 Aankomend' },
            { key: 'past'     as const, label: '🗓 Verleden' },
            { key: 'all'      as const, label: 'Alle' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterTime(key)}
              style={{ ...filterBtnBase, ...(filterTime === key ? filterBtnActive : filterBtnInactive) }}
            >
              {label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 13, color: '#9ca3af', marginLeft: 'auto' }}>
          {filteredBookings.length} resultaat{filteredBookings.length !== 1 ? 'en' : ''}
        </span>
      </div>
      </div>{/* end sticky toolbar */}

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af' }}>Laden…</div>
      ) : filteredBookings.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af', fontSize: 15 }}>
          Geen boekingen gevonden
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '10px 12px', borderBottom: '2px solid #e5e7eb', width: 36 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredBookings.length && filteredBookings.length > 0}
                  ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredBookings.length }}
                  onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredBookings.map(b => b.id)) : new Set())}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Datum</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tijd</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Naam</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Personen</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</th>
              <th style={{ padding: '10px 12px', borderBottom: '2px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((b, idx) => {
              const isPast = b.tour_date < todayStr
              const thisMonth = b.tour_date.slice(0, 7)
              const prevMonth = filteredBookings[idx - 1]?.tour_date.slice(0, 7)
              const showMonthSep = thisMonth !== prevMonth
              const monthLabel = new Intl.DateTimeFormat('nl-BE', { month: 'long', year: 'numeric' }).format(new Date(`${b.tour_date}T00:00:00`))
              return (
                <React.Fragment key={b.id}>
                  {showMonthSep && (
                    <tr>
                      <td colSpan={7} style={{ padding: '14px 12px 6px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                          — {monthLabel} —
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr style={{ opacity: isPast ? 0.55 : 1, background: selectedIds.has(b.id) ? '#fef2f2' : undefined }}>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6', width: 36 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(b.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds)
                          e.target.checked ? next.add(b.id) : next.delete(b.id)
                          setSelectedIds(next)
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6' }}>{formatNlDate(b.tour_date)}</td>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>{b.tour_time}</td>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 500 }}>{b.visitor_name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{b.visitor_email}</div>
                    </td>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span title="volwassenen">{b.total_people - (b.children_count ?? 0)}v</span>{' + '}
                      <span title="kinderen">{b.children_count ?? 0}k</span>{' = '}
                      <strong>{b.total_people}</strong>
                    </td>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ ...statusStyle(b.status), display: 'inline-block', borderRadius: 999, padding: '4px 12px', fontWeight: 600, fontSize: 12 }}>
                        {statusLabel(b.status)}
                      </span>
                    </td>
                    <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => window.open(`/booking/${b.edit_token}`, '_blank')} style={{ marginRight: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 17, color: '#9ca3af' }} title="Bekijk boeking">👁</button>
                      <button onClick={() => openModalFor(b)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 17, color: '#9ca3af' }} title="Bewerk boeking">✎</button>
                    </td>
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      )}

      {/* ── Edit modal ── */}
      {modalOpen && activeBooking && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', background: '#fff', borderRadius: 16, width: 820, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}
          >
            {/* Sticky header */}
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <button
                onClick={closeModal}
                aria-label="Sluiten"
                style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>{formName || 'Boeking'}</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
                Aangemaakt: {activeBooking.created_at ? new Date(activeBooking.created_at).toLocaleString('nl-BE') : '—'}
              </p>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', flexGrow: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                {/* Left: Klantgegevens */}
                <div style={{ paddingRight: 24, borderRight: '1px solid #f3f4f6' }}>
                  <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Klantgegevens</p>
                  <label style={{ display: 'block', marginTop: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Naam</span>
                    <input value={formName} onChange={(e) => setFormName(e.target.value)} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ display: 'block', marginTop: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>E-mailadres</span>
                    <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ display: 'block', marginTop: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Telefoonnummer</span>
                    <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ display: 'block', marginTop: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Opmerking bezoeker</span>
                    <textarea value={formVisitorMessage} onChange={(e) => setFormVisitorMessage(e.target.value)} rows={3} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </label>
                </div>

                {/* Right: Boekingsgegevens */}
                <div>
                  <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Boekingsgegevens</p>

                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Status</span>
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={{ ...statusStyle(formStatus), display: 'block', marginTop: 5, padding: '8px 12px', borderRadius: 999, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      <option value="pending">Afwachtend</option>
                      <option value="approved">Geaccepteerd</option>
                      <option value="denied">Geweigerd</option>
                      <option value="afgerond">Afgerond</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginTop: 14 }}>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Datum</span>
                      <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tijdslot</span>
                      <TimeInput
                        value={formTime}
                        onChange={setFormTime}
                        style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Volwassenen (+12j)</span>
                      <input type="number" min={1} value={formAdults} onChange={(e) => setFormAdults(Number(e.target.value || 1))} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Kinderen (-12j)</span>
                      <input type="number" min={0} value={formChildren} onChange={(e) => setFormChildren(Number(e.target.value || 0))} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
                    Totaal: <strong style={{ color: '#111827' }}>{formAdults + formChildren} personen</strong>
                  </p>

                  <label style={{ display: 'block', marginTop: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Pinguïns voeren</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={formPenguinFeeding}
                      onChange={(e) => setFormPenguinFeeding(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                      style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', color: '#374151' }}
                    />
                  </label>

                  <label style={{ display: 'block', marginTop: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Bericht aan bezoeker <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optioneel)</span></span>
                    <textarea value={formWorkerMessage} onChange={(e) => setFormWorkerMessage(e.target.value)} rows={3} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                  </label>

                </div>
              </div>
            </div>

            {/* Sticky footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff', borderRadius: '0 0 16px 16px' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={deleteActiveBooking}
                  disabled={deletingModal || savingModal || addingToCalendar}
                  style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', background: '#fee2e2', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                >
                  {deletingModal ? 'Verwijderen…' : '🗑 Verwijderen'}
                </button>
                <button
                  onClick={forceAddToCalendar}
                  disabled={addingToCalendar || savingModal || deletingModal}
                  title={formStatus !== 'approved' ? 'Wordt als onbevestigd (geel) in agenda gezet' : 'Voeg toe aan Google Agenda'}
                  style={{
                    padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid #fde68a', background: '#fef9c3', color: '#92400e',
                    opacity: addingToCalendar ? 0.7 : 1,
                  }}
                >
                  {addingToCalendar ? 'Toevoegen…' : formStatus !== 'approved' ? '📅 Zet in agenda ⚠️' : '📅 Zet in agenda'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#6b7280', userSelect: 'none' }}>
                  <input type="checkbox" checked={notifyVisitor} onChange={(e) => setNotifyVisitor(e.target.checked)} style={{ width: 14, height: 14 }} />
                  E-mail sturen
                </label>
                <button
                  onClick={closeModal}
                  style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                >
                  Annuleren
                </button>
                <button
                  onClick={saveModalEdits}
                  disabled={savingModal || deletingModal || addingToCalendar}
                  style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  {savingModal ? 'Opslaan…' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Export modal ── */}
      {exportOpen && (
        <div
          onClick={() => setExportOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: 500, maxWidth: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>📊 Export naar Excel</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>Selecteer periode en download direct</p>
              </div>
              <button onClick={() => setExportOpen(false)} style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>×</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Periode */}
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Periode</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Van</span>
                  <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                    style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                </label>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Tot</span>
                  <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                    style={{ display: 'block', marginTop: 4, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                </label>
              </div>

              {/* Shortcuts */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {([
                  { key: 'this_month' as const, label: 'Deze maand' },
                  { key: 'last_month' as const, label: 'Vorige maand' },
                  { key: 'this_year'  as const, label: 'Dit jaar' },
                  { key: 'all'        as const, label: 'Alles' },
                ]).map(({ key, label }) => (
                  <button key={key} onClick={() => applyExportShortcut(key)}
                    style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Status</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {([
                  { key: 'all' as const, label: 'Alle' },
                  { key: 'approved' as const, label: 'Geaccepteerd' },
                  { key: 'pending' as const, label: 'Afwachtend' },
                  { key: 'denied' as const, label: 'Geweigerd' },
                ]).map(({ key, label }) => (
                  <button key={key} onClick={() => setExportStatusFilter(key)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, border: '1px solid', fontSize: 13, cursor: 'pointer', fontWeight: exportStatusFilter === key ? 700 : 400,
                      background: exportStatusFilter === key ? '#111827' : '#fff',
                      color: exportStatusFilter === key ? '#fff' : '#6b7280',
                      borderColor: exportStatusFilter === key ? '#111827' : '#d1d5db',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Preview count + enabled columns */}
              <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>
                  <strong style={{ color: '#111827' }}>{exportPreviewCount}</strong> boeking{exportPreviewCount !== 1 ? 'en' : ''} worden geëxporteerd
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  Kolommen: {exportColumns.filter(c => c.enabled).map(c => c.label).join(', ')}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  Kolommen aanpassen? Ga naar <strong>Instellingen → Excel Export</strong>.
                </p>
              </div>

              <button
                onClick={exportToXLS}
                disabled={exportPreviewCount === 0}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none', fontSize: 15, fontWeight: 700, cursor: exportPreviewCount === 0 ? 'not-allowed' : 'pointer',
                  background: exportPreviewCount === 0 ? '#e5e7eb' : '#16a34a', color: exportPreviewCount === 0 ? '#9ca3af' : '#fff',
                  transition: 'background .15s',
                }}
              >
                ↓ Download Excel ({exportPreviewCount} rijen)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create booking modal ── */}
      {createOpen && (
        <div
          onClick={() => { if (!createSaving) setCreateOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', background: '#fff', borderRadius: 16, width: 640, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}
          >
            {/* Header */}
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <button
                onClick={() => { if (!createSaving) setCreateOpen(false) }}
                style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#111827' }}>+ Nieuwe boeking</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>Handmatig toevoegen — bv. voor telefonische boekingen. Ontbrekende info is oké.</p>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', flexGrow: 1 }}>

              {/* Datum & tijdslot */}
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Boekingsgegevens <span style={{ color: '#dc2626' }}>*</span></p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Datum <span style={{ color: '#dc2626' }}>*</span></span>
                  <input
                    type="date"
                    value={createDate}
                    onChange={(e) => setCreateDate(e.target.value)}
                    disabled={createSaving}
                    style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${!createDate ? '#f87171' : '#d1d5db'}`, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tijdslot <span style={{ color: '#dc2626' }}>*</span></span>
                  <TimeInput
                    value={createTime}
                    onChange={setCreateTime}
                    disabled={createSaving}
                    style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${!createTime ? '#f87171' : '#d1d5db'}`, fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
              </div>

              {/* Aantallen */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Volwassenen (+12j)</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="— onbekend"
                    value={createAdults === 0 && createAdults !== undefined ? createAdults : createAdults}
                    onChange={(e) => setCreateAdults(Math.max(0, Number(e.target.value || 0)))}
                    disabled={createSaving}
                    style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Kinderen (-12j)</span>
                  <input
                    type="number"
                    min={0}
                    value={createChildren}
                    onChange={(e) => setCreateChildren(Math.max(0, Number(e.target.value || 0)))}
                    disabled={createSaving}
                    style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
                Totaal: <strong style={{ color: '#111827' }}>{(createAdults || 0) + createChildren} personen</strong>
              </p>

              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Pinguïns voeren</span>
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={createPenguinFeeding}
                  onChange={(e) => setCreatePenguinFeeding(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                  disabled={createSaving}
                  style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', color: '#374151' }}
                />
              </label>

              {/* Status */}
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Status</span>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value)}
                  disabled={createSaving}
                  style={{ display: 'block', marginTop: 5, padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, cursor: 'pointer', background: '#fff', width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="approved">Geaccepteerd</option>
                  <option value="pending">Afwachtend</option>
                  <option value="denied">Geweigerd</option>
                  <option value="afgerond">Afgerond</option>
                </select>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid #f3f4f6', marginBottom: 20 }} />

              {/* Klantgegevens */}
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Klantgegevens <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optioneel)</span></p>

              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Naam</span>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Jan Janssens"
                  disabled={createSaving}
                  style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>E-mailadres</span>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="jan@voorbeeld.be"
                    disabled={createSaving}
                    style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ display: 'block' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Telefoonnummer</span>
                  <input
                    type="tel"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="+32 470 12 34 56"
                    disabled={createSaving}
                    style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </label>
              </div>

              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Opmerking <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optioneel)</span></span>
                <textarea
                  value={createMessage}
                  onChange={(e) => setCreateMessage(e.target.value)}
                  placeholder="Eventuele notities over deze boeking…"
                  rows={2}
                  disabled={createSaving}
                  style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </label>

              {/* Divider */}
              <div style={{ borderTop: '1px solid #f3f4f6', marginBottom: 16 }} />

              {/* Opties */}
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Opties</p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={createAddCal}
                  onChange={(e) => setCreateAddCal(e.target.checked)}
                  disabled={createSaving}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: '#374151' }}>
                  📅 Toevoegen aan Google Agenda
                  {createStatus !== 'approved' && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#92400e', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, padding: '1px 7px' }}>
                      ⚠️ wordt als onbevestigd toegevoegd
                    </span>
                  )}
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: createEmail.trim() ? 'pointer' : 'not-allowed', opacity: createEmail.trim() ? 1 : 0.5 }}>
                <input
                  type="checkbox"
                  checked={createNotify}
                  onChange={(e) => setCreateNotify(e.target.checked)}
                  disabled={createSaving || !createEmail.trim()}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: '#374151' }}>
                  ✉️ Bevestigingsmail sturen naar bezoeker
                  {!createEmail.trim() && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#9ca3af' }}>(e-mailadres vereist)</span>
                  )}
                </span>
              </label>

            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0, background: '#fff', borderRadius: '0 0 16px 16px' }}>
              <button
                onClick={() => { if (!createSaving) setCreateOpen(false) }}
                disabled={createSaving}
                style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
              >
                Annuleren
              </button>
              <button
                onClick={saveNewBooking}
                disabled={createSaving || !createDate || !createTime}
                style={{
                  padding: '9px 22px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: createSaving || !createDate || !createTime ? 'not-allowed' : 'pointer',
                  background: createSaving || !createDate || !createTime ? '#e5e7eb' : '#111827',
                  color: createSaving || !createDate || !createTime ? '#9ca3af' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {createSaving ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Bezig…
                  </>
                ) : '+ Boeking aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, background: messageType === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${messageType === 'error' ? '#fecaca' : '#bbf7d0'}`, color: messageType === 'error' ? '#dc2626' : '#16a34a', fontSize: 14 }}>
          {message}
        </div>
      )}
    </div>
  )
}

// ── Time input helpers ────────────────────────────────────────────────────────
/**
 * Formats raw keystroke input to HH:MM.
 * - Strips every non-digit character (including manual colons/dots/spaces)
 * - Auto-inserts the colon after the first 2 digits
 * - Clamps hours to 0-23 and minutes to 0-59
 */
function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  const hh = Math.min(23, parseInt(digits.slice(0, 2), 10)).toString().padStart(2, '0')
  const mm = digits.slice(2, 4)
  return mm.length > 0 ? `${hh}:${mm}` : hh
}

/** Single HH:MM masked input */
function TimeInput({
  value,
  onChange,
  disabled,
  style,
  placeholder = 'HH:MM',
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  style?: React.CSSProperties
  placeholder?: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={5}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(maskTime(e.target.value))}
      style={style}
    />
  )
}

/**
 * Comma-separated multi-slot input (e.g. "11:00,13:00,15:00").
 * Each segment is individually masked to HH:MM.
 */
function MultiTimeInput({
  value,
  onChange,
  style,
  placeholder = '11:00,13:00,15:00',
}: {
  value: string
  onChange: (v: string) => void
  style?: React.CSSProperties
  placeholder?: string
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Allow only digits and commas; rebuild each segment
    const segments = raw.split(',')
    const formatted = segments.map((seg) => {
      // Strip colons so maskTime processes raw digits
      const digits = seg.replace(/\D/g, '').slice(0, 4)
      return maskTime(digits)
    })
    onChange(formatted.join(','))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      style={style}
    />
  )
}

// ── Settings: shared helpers ──────────────────────────────────────────────────
function SettingsField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      {hint && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  )
}

const SF_INPUT: React.CSSProperties = { display: 'block', width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }
const SF_TEXTAREA: React.CSSProperties = { ...SF_INPUT, minHeight: 80, resize: 'vertical' }

// Placeholder chips that insert into a target ref
type PlaceholderDef = { key: string; label: string; example: string }

function PlaceholderChips({ placeholders, targetRef }: { placeholders: PlaceholderDef[]; targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null> }) {
  const [hovered, setHovered] = useState<string | null>(null)

  function insert(placeholder: string) {
    const el = targetRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newVal = el.value.slice(0, start) + placeholder + el.value.slice(end)
    // Trigger React synthetic change
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      ?? Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    nativeInputValueSetter?.call(el, newVal)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
    const pos = start + placeholder.length
    requestAnimationFrame(() => el.setSelectionRange(pos, pos))
  }

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Klik om in te voegen
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {placeholders.map(({ key, label, example }) => (
          <div key={key} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => insert(`{{${key}}}`)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #c7d2fe',
                background: hovered === key ? '#4f46e5' : '#eef2ff',
                fontSize: 12,
                cursor: 'pointer',
                color: hovered === key ? '#fff' : '#4f46e5',
                fontFamily: 'monospace',
                fontWeight: 500,
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
              }}
            >
              {`{{${key}}}`}
            </button>
            {hovered === key && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#1f2937',
                color: '#fff',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 11,
                whiteSpace: 'nowrap',
                zIndex: 50,
                pointerEvents: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                <div style={{ color: '#9ca3af', fontSize: 10 }}>Voorbeeld: <span style={{ color: '#d1fae5' }}>{example}</span></div>
                {/* Arrow */}
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0, height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '5px solid #1f2937',
                }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const COMMON_PLACEHOLDERS: PlaceholderDef[] = [
  { key: 'visitor_name',   label: 'Naam bezoeker',      example: 'Jan Janssen' },
  { key: 'tour_date',      label: 'Tourdatum',           example: 'zaterdag 24 mei 2025' },
  { key: 'tour_time',      label: 'Tijdslot',            example: '10:00' },
  { key: 'tour_time_start',label: 'Starttijd tour',      example: '10:00' },
  { key: 'tour_time_end',  label: 'Eindtijd tour',       example: '11:30' },
  { key: 'total_people',   label: 'Totaal personen',     example: '8' },
  { key: 'adults_count',   label: 'Aantal volwassenen',  example: '5' },
  { key: 'children_count', label: 'Aantal kinderen',     example: '3' },
  { key: 'site_name',      label: 'Sitenaam',            example: 'Bird Palace' },
]
const BOOKING_PLACEHOLDERS: PlaceholderDef[] = [
  ...COMMON_PLACEHOLDERS,
  { key: 'booking_url',    label: 'Boekingslink',        example: 'https://birdpalace.be/booking/abc123' },
  { key: 'contact_email',  label: 'Contactmail',         example: 'info@birdpalace.be' },
]
const WORKER_PLACEHOLDERS: PlaceholderDef[] = [
  ...COMMON_PLACEHOLDERS,
  { key: 'worker_name',    label: 'Naam medewerker',     example: 'Tanja' },
  { key: 'visitor_email',  label: 'E-mail bezoeker',     example: 'jan@email.be' },
  { key: 'visitor_phone',  label: 'Telefoon bezoeker',   example: '+32 470 12 34 56' },
]

const PAGE_COMMON_PLACEHOLDERS: PlaceholderDef[] = [
  { key: 'site_name',      label: 'Sitenaam',            example: 'Bird Palace' },
  { key: 'contact_email',  label: 'Contactmail',         example: 'info@birdpalace.be' },
]

const PAGE_BOOKING_PLACEHOLDERS: PlaceholderDef[] = [
  ...PAGE_COMMON_PLACEHOLDERS,
  { key: 'visitor_name',   label: 'Naam bezoeker',       example: 'Jan Janssen' },
  { key: 'tour_date',      label: 'Tourdatum',           example: 'Zaterdag 24 mei' },
  { key: 'tour_time',      label: 'Tijdslot',            example: '10:00' },
]

const PAGE_DATE_PLACEHOLDERS: PlaceholderDef[] = [
  { key: 'date',           label: 'Geselecteerde datum', example: 'Zaterdag 24 mei' },
  { key: 'tour_date',      label: 'Tourdatum',           example: 'Zaterdag 24 mei' },
]

type SettingsSection = 'algemeen' | 'emails' | 'paginas' | 'export' | 'geavanceerd'

function SettingsPanel({ password }: { password: string }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [section, setSection] = useState<SettingsSection>('algemeen')
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // ── Algemeen ──
  const [siteName, setSiteName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [tourDuration, setTourDuration] = useState('90')
  const [primaryColor, setPrimaryColor] = useState('#16a34a')

  // ── E-mails ──
  const [emailReceivedSubject, setEmailReceivedSubject] = useState('')
  const [emailReceivedIntro, setEmailReceivedIntro] = useState('')
  const [emailApprovedSubject, setEmailApprovedSubject] = useState('')
  const [emailApprovedIntro, setEmailApprovedIntro] = useState('')
  const [emailDeniedSubject, setEmailDeniedSubject] = useState('')
  const [emailDeniedIntro, setEmailDeniedIntro] = useState('')
  const [emailWorkerSubject, setEmailWorkerSubject] = useState('')
  const [emailWorkerIntro, setEmailWorkerIntro] = useState('')
  const [workerMsgDefault, setWorkerMsgDefault] = useState('')
  const [emailSlotTakenEnabled, setEmailSlotTakenEnabled] = useState(true)
  const [emailSlotTakenSubject, setEmailSlotTakenSubject] = useState('')
  const [emailSlotTakenIntro, setEmailSlotTakenIntro] = useState('')
  const [emailFinalizedSubject, setEmailFinalizedSubject] = useState('')
  const [emailFinalizedIntro, setEmailFinalizedIntro] = useState('')
  const [activeEmailTab, setActiveEmailTab] = useState<'received' | 'approved' | 'denied' | 'worker' | 'slot_taken' | 'finalized'>('received')

  // Refs for placeholder insertion
  const refReceivedSubject = useRef<HTMLInputElement>(null)
  const refReceivedIntro = useRef<HTMLTextAreaElement>(null)
  const refApprovedSubject = useRef<HTMLInputElement>(null)
  const refApprovedIntro = useRef<HTMLTextAreaElement>(null)
  const refDeniedSubject = useRef<HTMLInputElement>(null)
  const refDeniedIntro = useRef<HTMLTextAreaElement>(null)
  const refWorkerSubject = useRef<HTMLInputElement>(null)
  const refWorkerIntro = useRef<HTMLTextAreaElement>(null)
  const refWorkerMsgDefault = useRef<HTMLTextAreaElement>(null)
  const refSlotTakenSubject = useRef<HTMLInputElement>(null)
  const refSlotTakenIntro = useRef<HTMLTextAreaElement>(null)
  const refFinalizedSubject = useRef<HTMLInputElement>(null)
  const refFinalizedIntro = useRef<HTMLTextAreaElement>(null)
  const refCopyStep1 = useRef<HTMLInputElement>(null)
  const refCopyStep2 = useRef<HTMLInputElement>(null)
  const refCopyStep3 = useRef<HTMLInputElement>(null)
  const refCopyConfirmTitle = useRef<HTMLInputElement>(null)
  const refCopyConfirmBody = useRef<HTMLTextAreaElement>(null)
  const refCopyNoSlots = useRef<HTMLTextAreaElement>(null)

  // ── Pagina's ──
  const [copyStep1, setCopyStep1] = useState('')
  const [copyStep2, setCopyStep2] = useState('')
  const [copyStep3, setCopyStep3] = useState('')
  const [copyConfirmTitle, setCopyConfirmTitle] = useState('')
  const [copyConfirmBody, setCopyConfirmBody] = useState('')
  const [copyNoSlots, setCopyNoSlots] = useState('')

  // ── Geavanceerd ──
  const [bookingFormFields, setBookingFormFields] = useState('')

  // ── Export ──
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS)
  const [exportDragIdx, setExportDragIdx] = useState<number | null>(null)
  const [exportDragOverIdx, setExportDragOverIdx] = useState<number | null>(null)

  // Stored full settings (to merge on save)
  const [allSettings, setAllSettings] = useState<any>({})

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      const s = data.settings ?? {}
      setAllSettings(s)
      hydrate(s)
    } catch (err: any) {
      setSaveMsg({ text: err.message || 'Laden mislukt', ok: false })
    } finally {
      setLoading(false)
    }
  }

  function hydrate(s: any) {
    // Algemeen
    setSiteName(s.site_name ?? '')
    setContactEmail(s.contact_email ?? '')
    setTourDuration(s.tour_duration_minutes ? String(s.tour_duration_minutes) : '90')
    const rawColor = s.primary_color ?? '#16a34a'
    setPrimaryColor(rawColor.startsWith('#') ? rawColor : `#${rawColor}`)
    // E-mails
    setEmailReceivedSubject(s.email_received_subject ?? 'Aanvraag ontvangen – {{tour_date}} om {{tour_time}}')
    setEmailReceivedIntro(s.email_received_intro ?? 'We hebben jouw boekingsaanvraag goed ontvangen. Een medewerker zal deze zo snel mogelijk bevestigen.')
    setEmailApprovedSubject(s.email_approved_subject ?? 'Tour bevestigd! – {{tour_date}} om {{tour_time}}')
    setEmailApprovedIntro(s.email_approved_intro ?? 'Goed nieuws, {{visitor_name}}! Je aanvraag voor een rondleiding bij Bird Palace is goedgekeurd.')
    setEmailDeniedSubject(s.email_denied_subject ?? 'Helaas – {{tour_date}} om {{tour_time}} niet beschikbaar')
    setEmailDeniedIntro(s.email_denied_intro ?? 'We kunnen de tour op {{tour_date}} om {{tour_time}} niet bevestigen.')
    setEmailWorkerSubject(s.email_worker_subject ?? 'Nieuw boekingsverzoek – {{tour_date}} om {{tour_time}}')
    setEmailWorkerIntro(s.email_worker_intro ?? 'Er is een nieuwe touraanvraag binnengekomen. Kun jij de tour begeleiden?')
    setWorkerMsgDefault(s.worker_message_accepted_default ?? 'Alles in orde. Tot ziens!')
    setEmailSlotTakenEnabled(s.email_slot_taken_enabled !== false)
    setEmailSlotTakenSubject(s.email_slot_taken_subject ?? '')
    setEmailSlotTakenIntro(s.email_slot_taken_intro ?? '')
    setEmailFinalizedSubject(s.email_finalized_subject ?? '')
    setEmailFinalizedIntro(s.email_finalized_intro ?? '')
    // Pagina's
    setCopyStep1(s.copy_step1_subtitle ?? 'Kies een datum en tijdslot')
    setCopyStep2(s.copy_step2_subtitle ?? 'Vertel ons meer over jullie groep')
    setCopyStep3(s.copy_step3_subtitle ?? 'Jouw contactgegevens')
    setCopyConfirmTitle(s.copy_confirm_title ?? 'Aanvraag ontvangen!')
    setCopyConfirmBody(s.copy_confirm_body ?? "Wij checken bij de pinguïns en toerako's of dit past — dat kan tot 2 werkdagen duren.")
    setCopyNoSlots(s.copy_no_slots_text ?? 'Op {{date}} zijn we niet open, past enkel dan? Stel een moment voor en we kijken of het past!')
    // Geavanceerd
    setBookingFormFields(s.booking_form_fields ? JSON.stringify(s.booking_form_fields, null, 2) : '')
    // Export
    if (Array.isArray(s.export_columns) && s.export_columns.length > 0) {
      // Merge saved columns with defaults (adds new columns if we ever add them)
      const savedKeys = new Set(s.export_columns.map((c: ExportColumn) => c.key))
      const newDefaults = DEFAULT_EXPORT_COLUMNS.filter(c => !savedKeys.has(c.key))
      setExportColumns([...s.export_columns, ...newDefaults])
    } else {
      setExportColumns(DEFAULT_EXPORT_COLUMNS)
    }
  }

  useEffect(() => { fetchSettings() }, [])

  async function save() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const payload: any = {
        ...allSettings,
        // Algemeen
        site_name: siteName,
        contact_email: contactEmail,
        tour_duration_minutes: Number(tourDuration || 90),
        primary_color: primaryColor,
        // E-mails
        email_received_subject: emailReceivedSubject,
        email_received_intro: emailReceivedIntro,
        email_approved_subject: emailApprovedSubject,
        email_approved_intro: emailApprovedIntro,
        email_denied_subject: emailDeniedSubject,
        email_denied_intro: emailDeniedIntro,
        email_worker_subject: emailWorkerSubject,
        email_worker_intro: emailWorkerIntro,
        worker_message_accepted_default: workerMsgDefault,
        email_slot_taken_enabled: emailSlotTakenEnabled,
        email_slot_taken_subject: emailSlotTakenSubject,
        email_slot_taken_intro: emailSlotTakenIntro,
        email_finalized_subject: emailFinalizedSubject,
        email_finalized_intro: emailFinalizedIntro,
        // Export
        export_columns: exportColumns,
        // Pagina's
        copy_step1_subtitle: copyStep1,
        copy_step2_subtitle: copyStep2,
        copy_step3_subtitle: copyStep3,
        copy_confirm_title: copyConfirmTitle,
        copy_confirm_body: copyConfirmBody,
        copy_no_slots_text: copyNoSlots,
      }
      if (bookingFormFields.trim()) {
        try { payload.booking_form_fields = JSON.parse(bookingFormFields) } catch { payload.booking_form_fields = bookingFormFields }
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, settings: payload }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      const data = await res.json()
      setAllSettings(data.settings ?? payload)
      setSaveMsg({ text: 'Instellingen opgeslagen', ok: true })
      try { window.dispatchEvent(new CustomEvent('settings:updated', { detail: data.settings ?? payload })) } catch {}
      try { localStorage.setItem('settings:updated', JSON.stringify({ ts: Date.now(), settings: data.settings ?? payload })) } catch {}
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (err: any) {
      setSaveMsg({ text: err.message || 'Fout bij opslaan', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const SECTIONS: { id: SettingsSection; label: string; icon: string }[] = [
    { id: 'algemeen', label: 'Algemeen', icon: '🏠' },
    { id: 'emails', label: 'E-mails', icon: '📧' },
    { id: 'paginas', label: "Pagina's & Formulier", icon: '📝' },
    { id: 'export', label: 'Excel Export', icon: '📊' },
    { id: 'geavanceerd', label: 'Geavanceerd', icon: '⚙️' },
  ]

  const EMAIL_TABS: { id: typeof activeEmailTab; label: string; desc: string }[] = [
    { id: 'received',  label: 'Aanvraag ontvangen',  desc: 'Bezoeker ontvangt dit na het insturen van een boekingsaanvraag.' },
    { id: 'approved',  label: 'Tour bevestigd',       desc: 'Bezoeker ontvangt dit wanneer de boeking wordt goedgekeurd.' },
    { id: 'denied',    label: 'Tour geweigerd',       desc: 'Bezoeker ontvangt dit wanneer de boeking wordt afgewezen.' },
    { id: 'finalized', label: 'Boeking afgerond',     desc: 'Bezoeker ontvangt dit na het afronden van de tour — bedankmail.' },
    { id: 'worker',    label: 'Worker notificatie',   desc: 'Medewerker ontvangt dit bij een nieuwe aanvraag.' },
    { id: 'slot_taken', label: 'Boeking al ingenomen', desc: 'Medewerker ontvangt dit wanneer een collega de boeking al heeft overgenomen.' },
  ]

  if (loading) return <div style={{ padding: '48px 0', color: '#9ca3af' }}>Laden…</div>

  return (
    <div style={{ display: 'flex', gap: 0, maxWidth: 900 }}>
      {/* Section nav */}
      <div style={{ width: 200, flexShrink: 0, paddingRight: 24, borderRight: '1px solid #e5e7eb' }}>
        {SECTIONS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
              borderRadius: 8, border: 'none', background: section === id ? '#f3f4f6' : 'transparent',
              color: section === id ? '#111827' : '#6b7280', fontWeight: section === id ? 600 : 400,
              fontSize: 14, cursor: 'pointer', textAlign: 'left', marginBottom: 2,
            }}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div style={{ flex: 1, paddingLeft: 28 }}>

        {/* ── ALGEMEEN ── */}
        {section === 'algemeen' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>Algemeen</h2>
            <SettingsField label="Sitenaam" hint="Verschijnt als paginatitel en in e-mails.">
              <input value={siteName} onChange={e => setSiteName(e.target.value)} style={SF_INPUT} placeholder="Bird Palace" />
            </SettingsField>
            <SettingsField label="Contacte-mail" hint="Wordt getoond aan bezoekers als contactadres.">
              <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={SF_INPUT} placeholder="info@birdpalace.be" type="email" />
            </SettingsField>
            <SettingsField label="Tour duur (minuten)">
              <input value={tourDuration} onChange={e => setTourDuration(e.target.value)} style={{ ...SF_INPUT, width: 100 }} type="number" min={15} />
            </SettingsField>
            <SettingsField label="Primaire kleur" hint="Gebruikt voor knoppen, links en accenten.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="color" value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); document.documentElement.style.setProperty('--primary-color-600', e.target.value) }} style={{ width: 52, height: 40, padding: 2, cursor: 'pointer', borderRadius: 8, border: '1px solid #d1d5db' }} />
                <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ ...SF_INPUT, width: 120 }} placeholder="#16a34a" />
              </div>
            </SettingsField>
          </div>
        )}

        {/* ── E-MAILS ── */}
        {section === 'emails' && (
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>E-mail templates</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>Gebruik placeholders zoals <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{'{{visitor_name}}'}</code> — klik op een placeholder om hem in te voegen.</p>

            {/* Email sub-tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
              {EMAIL_TABS.map(({ id, label }) => (
                <button key={id} onClick={() => setActiveEmailTab(id)} style={{ padding: '8px 14px', border: 'none', background: 'transparent', fontSize: 13, fontWeight: activeEmailTab === id ? 700 : 400, color: activeEmailTab === id ? '#111827' : '#6b7280', borderBottom: activeEmailTab === id ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
                  {label}
                </button>
              ))}
            </div>

            {activeEmailTab === 'received' && (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>{EMAIL_TABS.find(t => t.id === 'received')!.desc}</p>
                <SettingsField label="Onderwerpregel">
                  <input ref={refReceivedSubject} value={emailReceivedSubject} onChange={e => setEmailReceivedSubject(e.target.value)} style={SF_INPUT} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refReceivedSubject} />
                </SettingsField>
                <SettingsField label="Introductietekst" hint="De hoofdparagraaf bovenaan de e-mail.">
                  <textarea ref={refReceivedIntro} value={emailReceivedIntro} onChange={e => setEmailReceivedIntro(e.target.value)} style={SF_TEXTAREA} rows={4} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refReceivedIntro} />
                </SettingsField>
              </div>
            )}

            {activeEmailTab === 'approved' && (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>{EMAIL_TABS.find(t => t.id === 'approved')!.desc}</p>
                <SettingsField label="Onderwerpregel">
                  <input ref={refApprovedSubject} value={emailApprovedSubject} onChange={e => setEmailApprovedSubject(e.target.value)} style={SF_INPUT} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refApprovedSubject} />
                </SettingsField>
                <SettingsField label="Introductietekst">
                  <textarea ref={refApprovedIntro} value={emailApprovedIntro} onChange={e => setEmailApprovedIntro(e.target.value)} style={SF_TEXTAREA} rows={4} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refApprovedIntro} />
                </SettingsField>
              </div>
            )}

            {activeEmailTab === 'denied' && (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>{EMAIL_TABS.find(t => t.id === 'denied')!.desc}</p>
                <SettingsField label="Onderwerpregel">
                  <input ref={refDeniedSubject} value={emailDeniedSubject} onChange={e => setEmailDeniedSubject(e.target.value)} style={SF_INPUT} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refDeniedSubject} />
                </SettingsField>
                <SettingsField label="Introductietekst">
                  <textarea ref={refDeniedIntro} value={emailDeniedIntro} onChange={e => setEmailDeniedIntro(e.target.value)} style={SF_TEXTAREA} rows={4} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refDeniedIntro} />
                </SettingsField>
              </div>
            )}

            {activeEmailTab === 'worker' && (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>{EMAIL_TABS.find(t => t.id === 'worker')!.desc}</p>
                <SettingsField label="Onderwerpregel">
                  <input ref={refWorkerSubject} value={emailWorkerSubject} onChange={e => setEmailWorkerSubject(e.target.value)} style={SF_INPUT} />
                  <PlaceholderChips placeholders={WORKER_PLACEHOLDERS} targetRef={refWorkerSubject} />
                </SettingsField>
                <SettingsField label="Introductietekst">
                  <textarea ref={refWorkerIntro} value={emailWorkerIntro} onChange={e => setEmailWorkerIntro(e.target.value)} style={SF_TEXTAREA} rows={3} />
                  <PlaceholderChips placeholders={WORKER_PLACEHOLDERS} targetRef={refWorkerIntro} />
                </SettingsField>
                <SettingsField label="Standaardbericht bij acceptatie" hint="Wordt vooraf ingevuld in het 'Bericht aan bezoeker'-veld wanneer een boeking wordt goedgekeurd.">
                  <textarea ref={refWorkerMsgDefault} value={workerMsgDefault} onChange={e => setWorkerMsgDefault(e.target.value)} style={SF_TEXTAREA} rows={3} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refWorkerMsgDefault} />
                </SettingsField>
              </div>
            )}

            {activeEmailTab === 'finalized' && (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>{EMAIL_TABS.find(t => t.id === 'finalized')!.desc}</p>
                <SettingsField label="Onderwerpregel" hint="Laat leeg voor de standaard. Placeholders zoals {{visitor_name}} werken.">
                  <input ref={refFinalizedSubject} value={emailFinalizedSubject} onChange={e => setEmailFinalizedSubject(e.target.value)} placeholder={`Bedankt voor jullie bezoek! – {{tour_date}}`} style={SF_INPUT} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refFinalizedSubject} />
                </SettingsField>
                <SettingsField label="Introductietekst">
                  <textarea ref={refFinalizedIntro} value={emailFinalizedIntro} onChange={e => setEmailFinalizedIntro(e.target.value)} placeholder={`Bedankt voor jullie bezoek aan Bird Palace op {{tour_date}}. We hopen dat jullie het fantastisch hebben gehad!`} style={SF_TEXTAREA} rows={4} />
                  <PlaceholderChips placeholders={BOOKING_PLACEHOLDERS} targetRef={refFinalizedIntro} />
                </SettingsField>
              </div>
            )}

            {activeEmailTab === 'slot_taken' && (
              <div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af' }}>{EMAIL_TABS.find(t => t.id === 'slot_taken')!.desc}</p>

                {/* Enable/disable toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: emailSlotTakenEnabled ? '#f0fdf4' : '#fef2f2', border: `1px solid ${emailSlotTakenEnabled ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, marginBottom: 20 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>E-mail verzenden</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Schakel uit als workers geen melding meer moeten krijgen.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailSlotTakenEnabled(v => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
                      background: emailSlotTakenEnabled ? '#16a34a' : '#d1d5db', transition: 'background .2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: emailSlotTakenEnabled ? 22 : 2, width: 20, height: 20,
                      borderRadius: 10, background: '#fff', transition: 'left .2s',
                    }} />
                  </button>
                </div>

                {emailSlotTakenEnabled && (
                  <>
                    <SettingsField label="Onderwerpregel">
                      <input ref={refSlotTakenSubject} value={emailSlotTakenSubject} onChange={e => setEmailSlotTakenSubject(e.target.value)} placeholder={`Boeking al ingenomen – {{tour_date}} om {{tour_time}}`} style={SF_INPUT} />
                      <PlaceholderChips placeholders={WORKER_PLACEHOLDERS} targetRef={refSlotTakenSubject} />
                    </SettingsField>
                    <SettingsField label="Introductietekst">
                      <textarea ref={refSlotTakenIntro} value={emailSlotTakenIntro} onChange={e => setEmailSlotTakenIntro(e.target.value)} placeholder={`De tour op {{tour_date}} om {{tour_time}} is al door een collega overgenomen. Geen actie nodig.`} style={SF_TEXTAREA} rows={3} />
                      <PlaceholderChips placeholders={WORKER_PLACEHOLDERS} targetRef={refSlotTakenIntro} />
                    </SettingsField>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PAGINA'S ── */}
        {section === 'paginas' && (
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>Pagina's & Formulier</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>Teksten die bezoekers zien op de boekingspagina.</p>

            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>Stap-ondertitels</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Kleine tekst onder de hoofdtitel op elke stap van het formulier.</p>
            </div>

            <SettingsField label="Stap 1 — Ondertitel">
              <input ref={refCopyStep1} value={copyStep1} onChange={e => setCopyStep1(e.target.value)} style={SF_INPUT} placeholder="Kies een datum en tijdslot" />
              <PlaceholderChips placeholders={PAGE_COMMON_PLACEHOLDERS} targetRef={refCopyStep1} />
            </SettingsField>
            <SettingsField label="Stap 2 — Ondertitel">
              <input ref={refCopyStep2} value={copyStep2} onChange={e => setCopyStep2(e.target.value)} style={SF_INPUT} placeholder="Vertel ons meer over jullie groep" />
              <PlaceholderChips placeholders={PAGE_COMMON_PLACEHOLDERS} targetRef={refCopyStep2} />
            </SettingsField>
            <SettingsField label="Stap 3 — Ondertitel">
              <input ref={refCopyStep3} value={copyStep3} onChange={e => setCopyStep3(e.target.value)} style={SF_INPUT} placeholder="Jouw contactgegevens" />
              <PlaceholderChips placeholders={PAGE_COMMON_PLACEHOLDERS} targetRef={refCopyStep3} />
            </SettingsField>

            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', margin: '8px 0 24px' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>Bevestigingspagina</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Getoond nadat een bezoeker zijn aanvraag heeft ingediend.</p>
            </div>

            <SettingsField label="Bevestiging — Titel">
              <input ref={refCopyConfirmTitle} value={copyConfirmTitle} onChange={e => setCopyConfirmTitle(e.target.value)} style={SF_INPUT} placeholder="Aanvraag ontvangen!" />
              <PlaceholderChips placeholders={PAGE_BOOKING_PLACEHOLDERS} targetRef={refCopyConfirmTitle} />
            </SettingsField>
            <SettingsField label="Bevestiging — Ondertekst">
              <textarea ref={refCopyConfirmBody} value={copyConfirmBody} onChange={e => setCopyConfirmBody(e.target.value)} style={SF_TEXTAREA} rows={3} />
              <PlaceholderChips placeholders={PAGE_BOOKING_PLACEHOLDERS} targetRef={refCopyConfirmBody} />
            </SettingsField>

            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', margin: '8px 0 24px' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>Geen tijdsloten beschikbaar</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Tekst die verschijnt als een bezoeker een dag selecteert zonder ingeplande tijdsloten. Gebruik <code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>{'{{date}}'}</code> of <code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>{'{{tour_date}}'}</code> voor de geselecteerde datum.</p>
            </div>

            <SettingsField label="Tekst bij geen tijdsloten">
              <textarea ref={refCopyNoSlots} value={copyNoSlots} onChange={e => setCopyNoSlots(e.target.value)} style={SF_TEXTAREA} rows={3} />
              <PlaceholderChips placeholders={PAGE_DATE_PLACEHOLDERS} targetRef={refCopyNoSlots} />
            </SettingsField>
          </div>
        )}

        {/* ── EXPORT ── */}
        {section === 'export' && (
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>Excel Export</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>Kies welke kolommen in de Excel-export verschijnen en in welke volgorde. Sleep rijen om de volgorde aan te passen.</p>

            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 180px 40px', gap: 0, padding: '8px 14px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                <span />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>Kolomnaam in Excel</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>Veld</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', textAlign: 'center' }}>Aan</span>
              </div>

              {exportColumns.map((col, i) => (
                <div
                  key={col.key}
                  draggable
                  onDragStart={() => setExportDragIdx(i)}
                  onDragOver={(e) => { e.preventDefault(); setExportDragOverIdx(i) }}
                  onDrop={() => {
                    if (exportDragIdx === null || exportDragIdx === i) return
                    const cols = [...exportColumns]
                    const [moved] = cols.splice(exportDragIdx, 1)
                    cols.splice(i, 0, moved)
                    setExportColumns(cols)
                    setExportDragIdx(null)
                    setExportDragOverIdx(null)
                  }}
                  onDragEnd={() => { setExportDragIdx(null); setExportDragOverIdx(null) }}
                  style={{
                    display: 'grid', gridTemplateColumns: '36px 1fr 180px 40px', gap: 0,
                    padding: '7px 14px', borderBottom: '1px solid #f3f4f6',
                    background: exportDragOverIdx === i ? '#e0f2fe' : exportDragIdx === i ? '#f0f9ff' : '#fff',
                    opacity: exportDragIdx === i ? 0.5 : 1,
                    cursor: 'grab', alignItems: 'center', transition: 'background .1s',
                  }}
                >
                  <span style={{ color: '#d1d5db', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>⠿</span>
                  <input
                    value={col.label}
                    onChange={(e) => {
                      const cols = [...exportColumns]
                      cols[i] = { ...cols[i], label: e.target.value }
                      setExportColumns(cols)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ border: 'none', background: 'transparent', fontSize: 14, color: '#111827', padding: '2px 4px', borderRadius: 4, outline: 'none', width: '100%' }}
                    onFocus={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.border = '1px solid #e5e7eb' }}
                    onBlur={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = 'none' }}
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{col.key}</span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const cols = [...exportColumns]
                        cols[i] = { ...cols[i], enabled: !cols[i].enabled }
                        setExportColumns(cols)
                      }}
                      style={{
                        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0, position: 'relative',
                        background: col.enabled ? 'var(--primary-color-600, #16a34a)' : '#d1d5db', transition: 'background .2s', flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 2, left: col.enabled ? 18 : 2, width: 16, height: 16,
                        borderRadius: 8, background: '#fff', transition: 'left .2s',
                      }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Tip: klik op een kolomnaam om die te hernoemen. Sleep de ⠿ handle om de volgorde aan te passen.
            </p>
          </div>
        )}

        {/* ── GEAVANCEERD ── */}
        {section === 'geavanceerd' && (
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>Geavanceerd</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>Technische configuratie voor gevorderde gebruikers.</p>

            <SettingsField
              label="Formuliervelden (JSON)"
              hint="Definieer extra of aangepaste velden voor het boekingsformulier als JSON-array. Laat leeg voor de standaardvelden."
            >
              <textarea
                value={bookingFormFields}
                onChange={e => setBookingFormFields(e.target.value)}
                style={{ ...SF_TEXTAREA, fontFamily: 'monospace', fontSize: 12, minHeight: 120 }}
                placeholder={'[\n  {"id": "children_count", "label": "Kinderen"}\n]'}
              />
            </SettingsField>
          </div>
        )}

        {/* Save button */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Opslaan…' : 'Instellingen opslaan'}
          </button>
          {saveMsg && (
            <span style={{ fontSize: 13, color: saveMsg.ok ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
              {saveMsg.ok ? '✓ ' : '✕ '}{saveMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Google Calendar Panel ──────────────────────────────────────────────────────

function CalendarPanel({ password }: { password: string }) {
  const [status, setStatus] = useState<{ connected: boolean; calendar_name?: string; calendar_id?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [allSettings, setAllSettings] = useState<any>({})
  const [savingRules, setSavingRules] = useState(false)
  const [tabs, setTabs] = useState<Array<{ id: string; name: string; keyword: string; weekly_schedule: Record<number, { enabled: boolean; times: string }> }>>([])
  const [activeTabId, setActiveTabId] = useState('default')

  const dayLabels = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

  function buildDefaultSchedule(baseTimes: string): Record<number, { enabled: boolean; times: string }> {
    return {
      0: { enabled: true, times: baseTimes },
      1: { enabled: false, times: baseTimes },
      2: { enabled: true, times: baseTimes },
      3: { enabled: true, times: baseTimes },
      4: { enabled: true, times: baseTimes },
      5: { enabled: true, times: baseTimes },
      6: { enabled: true, times: baseTimes },
    }
  }

  function makeDefaultTabs(baseTimes: string) {
    const defaultSchedule = buildDefaultSchedule(baseTimes)
    const openSchedule = buildDefaultSchedule(baseTimes)
    const closedSchedule = buildDefaultSchedule(baseTimes)
    for (let d = 0; d <= 6; d++) {
      openSchedule[d] = { enabled: true, times: baseTimes }
      closedSchedule[d] = { enabled: false, times: '' }
    }
    return [
      { id: 'default', name: 'Default', keyword: '', weekly_schedule: defaultSchedule },
      { id: 'open', name: 'Open', keyword: 'open', weekly_schedule: openSchedule },
      { id: 'gesloten', name: 'Gesloten', keyword: 'gesloten', weekly_schedule: closedSchedule },
    ]
  }

  async function fetchStatus() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/google/status?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      setStatus(await res.json())
    } catch (err: any) {
      setMessage(err.message || 'Kon status niet ophalen')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCalendarRules() {
    try {
      const res = await fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      const s = data.settings ?? {}
      setAllSettings(s)

      const baseTimes = Array.isArray(s.tour_times)
        ? s.tour_times.join(',')
        : (s.tour_times || '11:00,13:00,15:00')

      const defaults = makeDefaultTabs(baseTimes)
      const incoming = Array.isArray(s.planning_tabs) && s.planning_tabs.length > 0
        ? s.planning_tabs
        : defaults

      const normalized = incoming.map((tab: any, index: number) => {
        const base = index === 0 ? defaults[0] : {
          id: String(tab?.id || `tab-${index + 1}`),
          name: String(tab?.name || `Tab ${index + 1}`),
          keyword: String(tab?.keyword || '').toLowerCase(),
          weekly_schedule: buildDefaultSchedule(baseTimes),
        }

        const weekly = { ...base.weekly_schedule }
        const rawWeekly = tab?.weekly_schedule || {}
        for (let d = 0; d <= 6; d++) {
          const cfg = rawWeekly[String(d)] ?? rawWeekly[d]
          if (!cfg) continue
          weekly[d] = {
            enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : weekly[d].enabled,
            times: Array.isArray(cfg.times)
              ? cfg.times.join(',')
              : String(cfg.times ?? weekly[d].times),
          }
        }

        return {
          id: String(index === 0 ? 'default' : (tab?.id || base.id)),
          name: String(index === 0 ? 'Default' : (tab?.name || base.name)),
          keyword: String(index === 0 ? '' : (tab?.keyword || base.keyword || '')).toLowerCase(),
          weekly_schedule: weekly,
        }
      })

      setTabs(normalized)
      setActiveTabId(normalized[0]?.id || 'default')
    } catch (err: any) {
      setMessage(err.message || 'Kon kalenderregels niet ophalen')
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchCalendarRules()
  }, [])

  // Listen for the OAuth popup success message
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'google:calendar_connected') {
        fetchStatus()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [password])

  function openConnectPopup() {
    const width = 680
    const height = 720
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    const popup = window.open(
      '/api/auth/google/start',
      'google_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    )
    if (!popup) {
      setMessage('Popup geblokkeerd door de browser. Sta pop-ups toe voor deze pagina.')
      return
    }
    // Also poll in case postMessage doesn't arrive (popup blocker quirk)
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll)
        fetchStatus()
      }
    }, 800)
  }

  async function disconnect() {
    if (!confirm('Weet je zeker dat je de Google Calendar wil loskoppelen?')) return
    setMessage('')
    try {
      const res = await fetch('/api/admin/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) throw new Error('Disconnect mislukt')
      fetchStatus()
    } catch (err: any) {
      setMessage(err.message || 'Fout bij loskoppelen')
    }
  }

  async function saveCalendarRules() {
    setSavingRules(true)
    setMessage('')
    try {
      const normalizedTabs = tabs.map((tab, index) => {
        const weekly: Record<number, { enabled: boolean; times: string[] }> = {} as any
        for (let d = 0; d <= 6; d++) {
          const row = tab.weekly_schedule[d]
          weekly[d] = {
            enabled: !!row?.enabled,
            times: String(row?.times || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }
        }
        return {
          id: index === 0 ? 'default' : (tab.id || `tab-${index + 1}`),
          name: index === 0 ? 'Default' : tab.name,
          keyword: index === 0 ? '' : String(tab.keyword || '').trim().toLowerCase(),
          weekly_schedule: weekly,
        }
      })

      const payload = {
        ...allSettings,
        planning_tabs: normalizedTabs,
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, settings: payload }),
      })
      if (!res.ok) throw new Error('Opslaan mislukt')
      const data = await res.json()
      setAllSettings(data.settings ?? payload)
      setMessage('Kalenderregels opgeslagen')

      try { window.dispatchEvent(new CustomEvent('settings:updated', { detail: data.settings ?? payload })) } catch (e) {}
      try { localStorage.setItem('settings:updated', JSON.stringify({ ts: Date.now(), settings: data.settings ?? payload })) } catch (e) {}
    } catch (err: any) {
      setMessage(err.message || 'Fout bij opslaan')
    } finally {
      setSavingRules(false)
    }
  }

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]

  function updateActiveTab(patch: Partial<{ name: string; keyword: string }>) {
    if (!activeTab) return
    setTabs((prev) => prev.map((t) => t.id === activeTab.id ? { ...t, ...patch } : t))
  }

  function updateActiveDay(dayIndex: number, patch: Partial<{ enabled: boolean; times: string }>) {
    if (!activeTab) return
    setTabs((prev) => prev.map((t) => {
      if (t.id !== activeTab.id) return t
      return {
        ...t,
        weekly_schedule: {
          ...t.weekly_schedule,
          [dayIndex]: {
            ...t.weekly_schedule[dayIndex],
            ...patch,
          },
        },
      }
    }))
  }

  function addTab() {
    const id = `tab-${Date.now()}`
    const baseTimes = tabs[0]?.weekly_schedule?.[0]?.times || '11:00,13:00,15:00'
    const newTab = {
      id,
      name: `Tab ${tabs.length + 1}`,
      keyword: '',
      weekly_schedule: buildDefaultSchedule(baseTimes),
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(id)
  }

  function removeActiveTab() {
    if (!activeTab || activeTab.id === 'default') return
    setTabs((prev) => prev.filter((t) => t.id !== activeTab.id))
    setActiveTabId('default')
  }

  if (loading) return <p>Laden…</p>

  return (
    <div style={{ maxWidth: 640 }}>
      {status?.connected ? (
        <div style={{ padding: 16, background: 'color-mix(in srgb, var(--primary-color-600) 10%, white)', border: '1px solid color-mix(in srgb, var(--primary-color-600) 30%, white)', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary-color-700)' }}>✓ Google Calendar verbonden</p>
          <p style={{ margin: '8px 0 0', color: '#374151' }}>
            <strong>Agenda:</strong> {status.calendar_name ?? status.calendar_id}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            ID: {status.calendar_id}
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={openConnectPopup}
              style={{ padding: '8px 14px', background: 'var(--primary-color-600)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              Andere agenda koppelen
            </button>
            <button
              onClick={disconnect}
              style={{ padding: '8px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              Loskoppelen
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: 16, background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#854d0e' }}>Geen Google Calendar gekoppeld</p>
          <p style={{ margin: '8px 0 0', color: '#374151', fontSize: 14 }}>
            Koppel een Google Calendar zodat het boekingssysteem beschikbaarheid kan lezen en bevestigde tours kan inplannen.
          </p>
          <button
            onClick={openConnectPopup}
            style={{ marginTop: 14, padding: '10px 20px', background: 'var(--primary-color-600)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            Google Calendar koppelen
          </button>
        </div>
      )}

      {message && <p style={{ marginTop: 12, color: '#dc2626' }}>{message}</p>}

      <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
        <strong style={{ color: '#374151' }}>Hoe werkt het?</strong>
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7 }}>
          <li><strong>Default</strong> bepaalt wat de website standaard toont.</li>
          <li>Maak extra tabs met een keyword (bv. <em>open</em> of <em>gesloten</em>).</li>
          <li>Als een Google-event op die datum het keyword bevat, gebruikt de site die tab-planning voor die datum.</li>
          <li>Andere Google-events blokkeren overlappende tijdslots automatisch.</li>
        </ul>
      </div>

      <div style={{ marginTop: 24, padding: 16, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Weekplanning tabs</h3>
        <p style={{ marginTop: 0, color: '#6b7280', fontSize: 13 }}>
          Tab 1 is altijd <strong>Default</strong>. Extra tabs koppel je aan Google event-keywords.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: activeTabId === tab.id ? '#f3f4f6' : '#fff',
                fontWeight: 600,
              }}
            >
              {tab.name}
            </button>
          ))}
          <button onClick={addTab} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}>+</button>
        </div>

        {activeTab && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 16 }}>
              <label style={{ display: 'block' }}>
                Tab naam
                <input
                  value={activeTab.name}
                  disabled={activeTab.id === 'default'}
                  onChange={(e) => updateActiveTab({ name: e.target.value })}
                  style={{ display: 'block', marginTop: 6, width: '100%' }}
                />
              </label>
              <label style={{ display: 'block' }}>
                Google keyword
                <input
                  value={activeTab.keyword}
                  disabled={activeTab.id === 'default'}
                  onChange={(e) => updateActiveTab({ keyword: e.target.value.toLowerCase() })}
                  style={{ display: 'block', marginTop: 6, width: '100%' }}
                  placeholder={activeTab.id === 'default' ? 'Niet van toepassing' : 'bijv. open'}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={removeActiveTab}
                  disabled={activeTab.id === 'default'}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: activeTab.id === 'default' ? '#f3f4f6' : '#fff' }}
                >
                  Verwijder tab
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {dayLabels.map((label, dayIndex) => (
                <div key={dayIndex} style={{ display: 'grid', gridTemplateColumns: '140px 120px 1fr', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>{label}</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!activeTab.weekly_schedule?.[dayIndex]?.enabled}
                      onChange={(e) => updateActiveDay(dayIndex, { enabled: e.target.checked })}
                    />
                    Open
                  </label>
                  <MultiTimeInput
                    value={
                      Array.isArray(activeTab.weekly_schedule?.[dayIndex]?.times)
                        ? (activeTab.weekly_schedule[dayIndex].times as string[]).join(',')
                        : (activeTab.weekly_schedule?.[dayIndex]?.times as string ?? '')
                    }
                    onChange={(v) => updateActiveDay(dayIndex, { times: v })}
                    placeholder="11:00,13:00,15:00"
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 14 }}>
          <button
            onClick={saveCalendarRules}
            disabled={savingRules}
            style={{ padding: '10px 16px', background: 'var(--primary-color-600)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            {savingRules ? 'Opslaan…' : 'Kalenderregels opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  )
}
