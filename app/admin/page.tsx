"use client"

import React, { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Worker = { id: string; name: string; email: string; google_calendar_id: string; created_at?: string }
type Tab = 'dashboard' | 'bookings' | 'workers' | 'calendar' | 'settings'

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'bookings',  label: 'Boekingen',  icon: '📋' },
  { id: 'workers',   label: 'Workers',    icon: '👥' },
  { id: 'calendar',  label: 'Kalender',   icon: '📅' },
  { id: 'settings',  label: 'Instellingen', icon: '⚙️' },
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#111827', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
          {NAV_ITEMS.map(({ id, label, icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  marginBottom: 2, textAlign: 'left', fontSize: 14, fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(255,255,255,.12)' : 'transparent',
                  color: active ? '#fff' : '#9ca3af',
                  transition: 'all .15s',
                }}
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

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '24px 32px 0', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
          <h1 style={{ margin: '0 0 18px', fontSize: 22, fontWeight: 800, color: '#111827' }}>{pageTitle}</h1>
          <div style={{ display: 'flex', gap: 0 }}>
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 14, fontWeight: tab === id ? 700 : 400,
                  color: tab === id ? '#111827' : '#6b7280',
                  borderBottom: tab === id ? '2px solid #111827' : '2px solid transparent',
                  marginBottom: -1, transition: 'all .15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px' }}>
          {tab === 'dashboard' && <DashboardPanel password={password} onNavigate={setTab} />}

          {tab === 'bookings' && <BookingsTable password={password} deepBookingId={deepBookingId} />}

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
function DashboardPanel({ password, onNavigate }: { password: string; onNavigate: (tab: Tab) => void }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')

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

  async function quickStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, updates: { status }, notify: true }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.message || 'Mislukt')
      setActionMsg(status === 'approved' ? '✓ Boeking bevestigd' : '✓ Boeking geweigerd')
      fetchBookings()
      setTimeout(() => setActionMsg(''), 3000)
    } catch (err: any) {
      setActionMsg(err.message || 'Fout')
    }
  }

  // Derived stats
  const pendingUpcoming = bookings.filter(b => b.status === 'pending' && b.tour_date >= todayStr)
  const upcomingApproved = bookings.filter(b => b.status === 'approved' && b.tour_date >= todayStr)
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

        {/* Left: Actie vereist */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>⏳ Actie vereist</h2>
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
                        onClick={() => quickStatus(b.id, 'approved')}
                        style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--primary-color-600)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => quickStatus(b.id, 'denied')}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                      >
                        ✕
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

        {/* Right: Aankomende tours */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>📅 Aankomende tours</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>Bevestigde tours, komende 14 dagen</p>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {next14.filter((b: any) => b.status === 'approved').length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                Geen tours gepland in de komende 14 dagen
              </div>
            ) : (
              next14.filter((b: any) => b.status === 'approved').map((b: any) => (
                <div key={b.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ textAlign: 'center', minWidth: 44, background: '#f9fafb', borderRadius: 10, padding: '6px 8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>
                      {new Intl.DateTimeFormat('nl-BE', { month: 'short' }).format(new Date(`${b.tour_date}T00:00:00`))}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
                      {new Date(`${b.tour_date}T00:00:00`).getDate()}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{b.visitor_name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                      {b.tour_time} · {b.total_people} {b.total_people === 1 ? 'persoon' : 'personen'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f3f4f6' }}>
            <button onClick={() => onNavigate('bookings')} style={{ fontSize: 13, color: 'var(--primary-color-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              Alle boekingen bekijken →
            </button>
          </div>
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
  const [notifyVisitor, setNotifyVisitor] = useState(true)

  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'denied'>('all')
  const [filterTime, setFilterTime] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')

  const [formStatus, setFormStatus] = useState('pending')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('')
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAdults, setFormAdults] = useState(1)
  const [formChildren, setFormChildren] = useState(0)
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
    return { border: '1px solid #d1d5db', color: '#374151', background: '#fff' }
  }

  async function fetchBookings() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/bookings/list?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      const sorted = (data.bookings ?? []).slice().sort((a: any, b: any) => {
        const aKey = `${a.tour_date} ${a.tour_time}`
        const bKey = `${b.tour_date} ${b.tour_time}`
        if (aKey < bKey) return -1
        if (aKey > bKey) return 1
        return 0
      })
      setBookings(sorted)
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
    setFormWorkerMessage(booking.worker_message || '')
    setFormVisitorMessage(booking.visitor_message || '')
    setNotifyVisitor(true)
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
      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <input
          type="search"
          placeholder="🔍  Zoek op naam, e-mail of datum…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, minWidth: 230, outline: 'none' }}
        />

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { key: 'all' as const, label: 'Alle' },
            { key: 'pending' as const, label: `Afwachtend${pendingUpcomingCount > 0 ? ` (${pendingUpcomingCount})` : ''}` },
            { key: 'approved' as const, label: 'Geaccepteerd' },
            { key: 'denied' as const, label: 'Geweigerd' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              style={{
                ...filterBtnBase,
                ...(filterStatus === key
                  ? key === 'approved' ? { background: 'var(--primary-color-600)', color: '#fff', borderColor: 'var(--primary-color-600)' }
                  : key === 'denied' ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' }
                  : key === 'pending' ? { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }
                  : filterBtnActive
                  : filterBtnInactive)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Time filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'upcoming' as const, label: '📅 Aankomend' },
            { key: 'past' as const, label: '🗓 Verleden' },
            { key: 'all' as const, label: 'Alle' },
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
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Datum</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tijd</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Naam</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Personen</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</th>
              <th style={{ padding: '10px 12px', borderBottom: '2px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((b) => {
              const isPast = b.tour_date < todayStr
              return (
                <tr key={b.id} style={{ opacity: isPast ? 0.55 : 1 }}>
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
                      {b.status === 'pending' ? 'Afwachtend' : b.status === 'approved' ? 'Geaccepteerd' : 'Geweigerd'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => window.open(`/booking/${b.edit_token}`, '_blank')} style={{ marginRight: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 17, color: '#9ca3af' }} title="Bekijk boeking">👁</button>
                    <button onClick={() => openModalFor(b)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 17, color: '#9ca3af' }} title="Bewerk boeking">✎</button>
                  </td>
                </tr>
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
                  {formVisitorMessage && (
                    <div style={{ marginTop: 16 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Opmerking bezoeker</span>
                      <p style={{ margin: '6px 0 0', padding: '9px 12px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: 14, color: '#374151' }}>{formVisitorMessage}</p>
                    </div>
                  )}
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
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginTop: 14 }}>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Datum</span>
                      <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ display: 'block' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Tijdslot</span>
                      <input value={formTime} onChange={(e) => setFormTime(e.target.value)} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
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
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Bericht aan bezoeker <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optioneel)</span></span>
                    <textarea value={formWorkerMessage} onChange={(e) => setFormWorkerMessage(e.target.value)} rows={3} style={{ display: 'block', marginTop: 5, width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={notifyVisitor} onChange={(e) => setNotifyVisitor(e.target.checked)} />
                    <span style={{ fontSize: 14, color: '#374151' }}>E-mail klant over wijziging</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Sticky footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff', borderRadius: '0 0 16px 16px' }}>
              <button
                onClick={deleteActiveBooking}
                disabled={deletingModal || savingModal}
                style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', background: '#fee2e2', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                {deletingModal ? 'Verwijderen…' : '🗑 Verwijderen'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={closeModal}
                  style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                >
                  Annuleren
                </button>
                <button
                  onClick={saveModalEdits}
                  disabled={savingModal || deletingModal}
                  style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#111827', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                >
                  {savingModal ? 'Opslaan…' : 'Opslaan'}
                </button>
              </div>
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

function SettingsPanel({ password }: { password: string }) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<any>({})
  const [siteName, setSiteName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [tourDuration, setTourDuration] = useState('90')
  const [tourTimes, setTourTimes] = useState('11:00,13:00,15:00')
  const [primaryColor, setPrimaryColor] = useState('var(--primary-color-600)')
  const [bookingFormFields, setBookingFormFields] = useState('')
  const [workerMessageAcceptedDefault, setWorkerMessageAcceptedDefault] = useState('Alles in orde. Tot ziens!')
  const [workerMessageDeniedDefault, setWorkerMessageDeniedDefault] = useState('Helaas kan ik niet beschikbaar zijn.')
  const [message, setMessage] = useState('')

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/settings?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      const s = data.settings ?? {}
      setSettings(s)
      setSiteName(s.site_name ?? '')
      setContactEmail(s.contact_email ?? '')
      setTourDuration(s.tour_duration_minutes ? String(s.tour_duration_minutes) : '90')
      setTourTimes(s.tour_times ?? '11:00,13:00,15:00')
      setPrimaryColor(s.primary_color ?? 'var(--primary-color-600)')
      setBookingFormFields(s.booking_form_fields ? JSON.stringify(s.booking_form_fields) : '')
      setWorkerMessageAcceptedDefault(s.worker_message_accepted_default ?? 'Alles in orde. Tot ziens!')
      setWorkerMessageDeniedDefault(s.worker_message_denied_default ?? 'Helaas kan ik niet beschikbaar zijn.')
    } catch (err: any) {
      setMessage(err.message || 'Failed to fetch settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSettings() }, [])

  async function save() {
    setMessage('')
    try {
      const payload: any = {
        site_name: siteName,
        contact_email: contactEmail,
        tour_duration_minutes: Number(tourDuration || 90),
        tour_times: tourTimes,
        primary_color: primaryColor,
        worker_message_accepted_default: workerMessageAcceptedDefault,
        worker_message_denied_default: workerMessageDeniedDefault,
      }
      if (bookingFormFields) {
        try { payload.booking_form_fields = JSON.parse(bookingFormFields) } catch (e) { payload.booking_form_fields = bookingFormFields }
      }

      const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, settings: payload }) })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      setMessage('Saved')
      setSettings(data.settings ?? {})
      try {
        window.dispatchEvent(new CustomEvent('settings:updated', { detail: data.settings ?? {} }))
      } catch (e) {
        // ignore in non-browser environments
      }
      try {
        localStorage.setItem('settings:updated', JSON.stringify({ ts: Date.now(), settings: data.settings ?? {} }))
      } catch (e) {}
    } catch (err: any) {
      setMessage(err.message || 'Error saving')
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {loading ? <p>Loading…</p> : (
        <>
          <label style={{ display: 'block', marginTop: 8 }}>Site name
            <input value={siteName} onChange={(e) => setSiteName(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }} />
          </label>
          <label style={{ display: 'block', marginTop: 8 }}>Contact email
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }} />
          </label>
          <label style={{ display: 'block', marginTop: 8 }}>Tour duration (minutes)
            <input value={tourDuration} onChange={(e) => setTourDuration(e.target.value)} style={{ display: 'block', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 8 }}>Primary color
            <input type="color" value={primaryColor.startsWith('#') ? primaryColor : '#6366f1'} onChange={(e) => setPrimaryColor(e.target.value)} style={{ display: 'block', marginTop: 6, width: 48, height: 36, padding: 2, cursor: 'pointer' }} />
          </label>
          <label style={{ display: 'block', marginTop: 8 }}>Booking form fields (JSON)
            <textarea value={bookingFormFields} onChange={(e) => setBookingFormFields(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }} placeholder='e.g. [{"id":"children_count","label":"Children"}]' />
          </label>
          <h3 style={{ marginTop: 20, marginBottom: 8 }}>Default worker messages</h3>
          <label style={{ display: 'block', marginTop: 8 }}>Default message when accepting
            <textarea value={workerMessageAcceptedDefault} onChange={(e) => setWorkerMessageAcceptedDefault(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%', minHeight: 60 }} placeholder='Default message for accepted bookings' />
          </label>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={save} style={{ padding: '8px 12px' }}>Save settings</button>
          </div>
          {message && <p style={{ marginTop: 8 }}>{message}</p>}
        </>
      )}
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
                  <input
                    value={activeTab.weekly_schedule?.[dayIndex]?.times ?? ''}
                    onChange={(e) => updateActiveDay(dayIndex, { times: e.target.value })}
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
