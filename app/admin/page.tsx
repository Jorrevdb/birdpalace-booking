"use client"

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Worker = { id: string; name: string; email: string; google_calendar_id: string; created_at?: string }

// Inner component so useSearchParams() is inside a Suspense boundary (Next.js 14 requirement)
function AdminPageInner() {
  const searchParams = useSearchParams()
  const deepBookingId = searchParams.get('booking') // e.g. /admin?booking=<id>

  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [clientEmail, setClientEmail] = useState<string | null>(null)
  const [tab, setTab] = useState<'workers' | 'bookings' | 'settings' | 'calendar'>('workers')

  const [workers, setWorkers] = useState<Worker[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [message, setMessage] = useState('')

  // On mount: restore saved password and auto-login if available
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_pw') : null
    if (!saved) return
    setPassword(saved)
    // Auto-login with the saved password
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
      localStorage.setItem('admin_pw', password) // remember for next visit
      fetchWorkers(password)
      // If ?booking=<id> in URL, switch to bookings tab and open that booking
      if (deepBookingId) setTab('bookings')
    } catch (err) {
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

  useEffect(() => {
    if (authenticated) fetchWorkers()
  }, [authenticated])

  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: 20 }}>
      <h1>Admin Panel</h1>

      {!authenticated ? (
        <form onSubmit={handleLogin} style={{ marginTop: 24 }}>
          <label>
            Admin password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ display: 'block', marginTop: 8, padding: 8, width: '100%' }} />
          </label>
          <button style={{ marginTop: 12, padding: '8px 12px' }} type="submit">Log in</button>
          {message && <p style={{ color: 'red' }}>{message}</p>}
        </form>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setTab('workers')} style={{ padding: '8px 12px', background: tab === 'workers' ? 'var(--primary-color-600)' : undefined, color: tab === 'workers' ? '#fff' : undefined }}>Workers</button>
            <button onClick={() => setTab('bookings')} style={{ padding: '8px 12px', background: tab === 'bookings' ? 'var(--primary-color-600)' : undefined, color: tab === 'bookings' ? '#fff' : undefined }}>Bookings</button>
            <button onClick={() => setTab('settings')} style={{ padding: '8px 12px', background: tab === 'settings' ? 'var(--primary-color-600)' : undefined, color: tab === 'settings' ? '#fff' : undefined }}>Settings</button>
            <button onClick={() => setTab('calendar')} style={{ padding: '8px 12px', background: tab === 'calendar' ? 'var(--primary-color-600)' : undefined, color: tab === 'calendar' ? '#fff' : undefined }}>Calendar</button>
          </div>

          <p>Service account email (share worker calendars with this): <strong>{clientEmail ?? '—'}</strong></p>
          {tab === 'workers' && (
            <div style={{ marginTop: 12 }}>
              <h2>Workers</h2>
              {loadingWorkers ? (
                <p>Loading…</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Google calendar id</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w) => (
                      <WorkerRow key={w.id} worker={w} password={password} onDeleted={() => fetchWorkers()} onUpdated={() => fetchWorkers()} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'bookings' && (
            <div style={{ marginTop: 12 }}>
              <h2>Bookings</h2>
              <BookingsTable password={password} deepBookingId={deepBookingId} />
            </div>
          )}

          {tab === 'settings' && (
            <div style={{ marginTop: 12 }}>
              <h2>Settings</h2>
              <SettingsPanel password={password} />
            </div>
          )}

          {tab === 'calendar' && (
            <div style={{ marginTop: 12 }}>
              <h2>Google Calendar</h2>
              <CalendarPanel password={password} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WorkerRow({ worker, password, onDeleted, onUpdated }: { worker: any; password: string; onDeleted?: () => void; onUpdated?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(worker.name)
  const [email, setEmail] = useState(worker.email)
  const [gid, setGid] = useState(worker.google_calendar_id)
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name, email, google_calendar_id: gid }),
      })
      if (!res.ok) throw new Error('Update failed')
      setEditing(false)
      onUpdated && onUpdated()
    } catch (err: any) {
      setStatus(err.message || 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm('Delete this worker?')) return
    try {
      const res = await fetch(`/api/admin/workers/${worker.id}?password=${encodeURIComponent(password)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      onDeleted && onDeleted()
    } catch (err: any) {
      setStatus(err.message || 'Error')
    }
  }

  async function checkCalendar() {
    setStatus('Checking...')
    try {
      const res = await fetch('/api/admin/workers/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, google_calendar_id: gid }),
      })
      const text = await res.text()
      let data: any
      try {
        data = JSON.parse(text)
      } catch (e) {
        data = { ok: false, message: text }
      }
      if (data.ok) setStatus('Accessible')
      else setStatus(data.message || 'Not accessible')
    } catch (err: any) {
      setStatus(err.message || 'Error')
    }
  }

  return (
    <tr>
      <td style={{ padding: 8 }}>
        {editing ? <input value={name} onChange={(e) => setName(e.target.value)} /> : name}
      </td>
      <td style={{ padding: 8 }}>{editing ? <input value={email} onChange={(e) => setEmail(e.target.value)} /> : email}</td>
      <td style={{ padding: 8 }}>{editing ? <input value={gid} onChange={(e) => setGid(e.target.value)} /> : gid}</td>
      <td style={{ padding: 8 }}>{worker.created_at ? new Date(worker.created_at).toLocaleString() : '—'}</td>
      <td style={{ padding: 8 }}>
        {editing ? (
          <>
            <button onClick={save} disabled={saving} style={{ marginRight: 8 }}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} style={{ marginRight: 8 }}>Edit</button>
            <button onClick={remove} style={{ marginRight: 8 }}>Delete</button>
            <button onClick={checkCalendar}>Check calendar</button>
          </>
        )}
        {status && <div style={{ marginTop: 6 }}>{status}</div>}
      </td>
    </tr>
  )
}

function BookingsTable({ password, deepBookingId }: { password: string; deepBookingId?: string | null }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const deepLinkOpenedRef = useRef(false) // prevents re-opening after save
  const [activeBooking, setActiveBooking] = useState<any | null>(null)
  const [savingModal, setSavingModal] = useState(false)
  const [deletingModal, setDeletingModal] = useState(false)
  const [notifyVisitor, setNotifyVisitor] = useState(true)

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
    } catch (err: any) {
      setMessage(err.message || 'Error saving booking')
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
    } catch (err: any) {
      setMessage(err.message || 'Error deleting booking')
    } finally {
      setDeletingModal(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setActiveBooking(null)
  }

  return (
    <div>
      {loading ? <p>Loading…</p> : (
        <>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 18 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '1px solid #e5e7eb' }}>Datum</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '1px solid #e5e7eb' }}>Tijd</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '1px solid #e5e7eb' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '1px solid #e5e7eb' }}>Personen</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', borderBottom: '1px solid #e5e7eb' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '12px 8px', borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td style={{ padding: '16px 8px', borderBottom: '1px solid #f3f4f6' }}>{formatNlDate(b.tour_date)}</td>
                <td style={{ padding: '16px 8px', borderBottom: '1px solid #f3f4f6' }}>{b.tour_time}</td>
                <td style={{ padding: '16px 8px', borderBottom: '1px solid #f3f4f6' }}>{b.visitor_name}</td>
                <td style={{ padding: '16px 8px', borderBottom: '1px solid #f3f4f6', fontSize: 14 }}>
                  <span title="volwassenen">{b.total_people - (b.children_count ?? 0)}v</span>
                  {' + '}
                  <span title="kinderen">{b.children_count ?? 0}k</span>
                  {' = '}
                  <strong>{b.total_people}</strong>
                </td>
                <td style={{ padding: '16px 8px', borderBottom: '1px solid #f3f4f6' }}>
                  <span
                    style={{
                      ...statusStyle(b.status),
                      display: 'inline-block',
                      borderRadius: 999,
                      padding: '6px 14px',
                      fontWeight: 600,
                    }}
                  >
                    {b.status === 'pending' ? 'Afwachtend' : b.status === 'approved' ? 'Geaccepteerd' : 'Geweigerd'}
                  </span>
                </td>
                <td style={{ padding: '16px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                  <button
                    onClick={() => window.open(`/booking/${b.edit_token}`, '_blank')}
                    style={{ marginRight: 10, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20 }}
                    title="Bekijk boeking"
                  >
                    👁
                  </button>
                  <button
                    onClick={() => openModalFor(b)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20 }}
                    title="Bewerk boeking"
                  >
                    ✎
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {modalOpen && activeBooking && (
          <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', background: '#fff', borderRadius: 16, width: 980, maxWidth: '96%', padding: 24 }}>
              <button
                onClick={closeModal}
                aria-label="Modal sluiten"
                style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
              >
                ×
              </button>
              <h2 style={{ margin: 0, fontSize: 42, lineHeight: 1.05 }}>{formName || 'Boeking voornaam achternaam'}</h2>
              <p style={{ color: '#6b7280', marginTop: 10 }}>Laatst gewijzigd: {new Date().toLocaleString('nl-BE')}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 20 }}>
                <div style={{ paddingRight: 20, borderRight: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: 28, marginTop: 0 }}>Klant gegevens</h3>
                  <label style={{ display: 'block', marginTop: 10 }}>
                    Naam
                    <input value={formName} onChange={(e) => setFormName(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                  </label>
                  <label style={{ display: 'block', marginTop: 12 }}>
                    E-mailadres
                    <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                  </label>
                  <label style={{ display: 'block', marginTop: 12 }}>
                    Telefoon nummer
                    <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                  </label>
                </div>

                <div>
                  <h3 style={{ fontSize: 28, marginTop: 0 }}>Boekingsgegevens</h3>
                  <label style={{ display: 'block', marginTop: 10 }}>
                    Status
                    <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={{ ...statusStyle(formStatus), display: 'block', marginTop: 6, padding: '10px 14px', borderRadius: 999, fontWeight: 700 }}>
                      <option value="pending">Afwachtend</option>
                      <option value="approved">Geaccepteerd</option>
                      <option value="denied">Geweigerd</option>
                    </select>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12, marginTop: 12 }}>
                    <label style={{ display: 'block' }}>
                      Datum
                      <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                    </label>
                    <label style={{ display: 'block' }}>
                      Tijdslot
                      <input value={formTime} onChange={(e) => setFormTime(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <label style={{ display: 'block' }}>
                      Volwassenen (+12j)
                      <input type="number" min={1} value={formAdults} onChange={(e) => setFormAdults(Number(e.target.value || 1))} style={{ display: 'block', marginTop: 6, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                    </label>
                    <label style={{ display: 'block' }}>
                      Kinderen (-12j)
                      <input type="number" min={0} value={formChildren} onChange={(e) => setFormChildren(Number(e.target.value || 0))} style={{ display: 'block', marginTop: 6, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                    </label>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
                    Totaal: <strong>{formAdults + formChildren} personen</strong>
                  </p>

                  {formVisitorMessage && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Opmerking bezoeker</p>
                      <p style={{ margin: '6px 0 0', padding: 12, borderRadius: 12, background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: 14 }}>{formVisitorMessage}</p>
                    </div>
                  )}

                  <label style={{ display: 'block', marginTop: 12 }}>
                    Bericht aan bezoeker (optioneel)
                    <textarea value={formWorkerMessage} onChange={(e) => setFormWorkerMessage(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%', minHeight: 80, padding: 12, borderRadius: 12, border: '1px solid #d1d5db' }} />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input type="checkbox" checked={notifyVisitor} onChange={(e) => setNotifyVisitor(e.target.checked)} />
                    Mail klant over wijziging
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button onClick={deleteActiveBooking} disabled={deletingModal || savingModal} style={{ padding: '12px 20px', borderRadius: 12, border: '1px solid #fecaca', color: '#dc2626', background: '#fee2e2' }}>{deletingModal ? 'Verwijderen…' : 'Verwijderen'}</button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveModalEdits} disabled={savingModal || deletingModal} style={{ padding: '12px 22px', borderRadius: 12, border: 'none', background: '#111827', color: '#fff', fontWeight: 700 }}>
                    {savingModal ? 'Opslaan…' : 'Opslaan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
      )}
      {message && <p style={{ color: 'red' }}>{message}</p>}
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
