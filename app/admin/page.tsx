"use client"

import { useEffect, useState } from 'react'

type Worker = { id: string; name: string; email: string; google_calendar_id: string; created_at?: string }

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [clientEmail, setClientEmail] = useState<string | null>(null)
  const [tab, setTab] = useState<'workers' | 'bookings' | 'settings' | 'calendar'>('workers')

  const [workers, setWorkers] = useState<Worker[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      const res = await fetch(`/api/admin/workers?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      setClientEmail(data.client_email ?? null)
      setAuthenticated(true)
      // load workers immediately
      fetchWorkers(password)
    } catch (err) {
      setMessage('Invalid password')
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
            <button onClick={() => setTab('workers')} style={{ padding: '8px 12px', background: tab === 'workers' ? '#2d6a4f' : undefined, color: tab === 'workers' ? '#fff' : undefined }}>Workers</button>
            <button onClick={() => setTab('bookings')} style={{ padding: '8px 12px', background: tab === 'bookings' ? '#2d6a4f' : undefined, color: tab === 'bookings' ? '#fff' : undefined }}>Bookings</button>
            <button onClick={() => setTab('settings')} style={{ padding: '8px 12px', background: tab === 'settings' ? '#2d6a4f' : undefined, color: tab === 'settings' ? '#fff' : undefined }}>Settings</button>
            <button onClick={() => setTab('calendar')} style={{ padding: '8px 12px', background: tab === 'calendar' ? '#2d6a4f' : undefined, color: tab === 'calendar' ? '#fff' : undefined }}>Calendar</button>
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
              <BookingsTable password={password} />
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

function BookingsTable({ password }: { password: string }) {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [workers, setWorkers] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [activeBooking, setActiveBooking] = useState<any | null>(null)
  const [actionType, setActionType] = useState<'accept' | 'deny' | 'reschedule'>('accept')
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  async function fetchBookings() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/bookings/list?password=${encodeURIComponent(password)}`)
      if (!res.ok) throw new Error('Unauthorized')
      const data = await res.json()
      setBookings(data.bookings ?? [])
    } catch (err: any) {
      setMessage(err.message || 'Failed to fetch bookings')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchBookings(); fetchWorkers(); }, [])

  async function fetchWorkers() {
    try {
      const res = await fetch(`/api/admin/workers/list?password=${encodeURIComponent(password)}`)
      if (!res.ok) return
      const data = await res.json()
      setWorkers(data.workers ?? [])
    } catch (err) {
      // ignore
    }
  }

  function openModalFor(booking: any, type: 'accept'|'deny'|'reschedule') {
    setActiveBooking(booking)
    setActionType(type)
    setSelectedWorkerId(null)
    setActionMessage('')
    setNewDate('')
    setNewTime('')
    setModalOpen(true)
  }

  async function submitAction() {
    if (!activeBooking) return
    const body: any = { password, action: actionType }
    if (actionType === 'accept') {
      if (!selectedWorkerId) { alert('Choose a worker'); return }
      body.worker_id = selectedWorkerId
      body.message = actionMessage
    }
    if (actionType === 'deny') {
      body.message = actionMessage
    }
    if (actionType === 'reschedule') {
      if (!newDate || !newTime) { alert('Provide new date and time'); return }
      body.new_date = newDate
      body.new_time = newTime
    }

    try {
      const res = await fetch(`/api/admin/bookings/${activeBooking.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!data.ok) throw new Error(data.message || 'Action failed')
      setModalOpen(false)
      fetchBookings()
      alert('Action completed')
    } catch (err: any) {
      alert(err.message || 'Error')
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
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Visitor</th>
              <th style={{ textAlign: 'left', padding: 8 }}>People</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td style={{ padding: 8 }}>{b.tour_date}</td>
                <td style={{ padding: 8 }}>{b.tour_time}</td>
                <td style={{ padding: 8 }}>{b.visitor_name} ({b.visitor_email})</td>
                <td style={{ padding: 8 }}>{b.total_people}</td>
                <td style={{ padding: 8 }}>{b.status}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => openModalFor(b, 'accept')} style={{ marginRight: 8 }}>Accept</button>
                  <button onClick={() => openModalFor(b, 'deny')} style={{ marginRight: 8 }}>Deny</button>
                  <button onClick={() => openModalFor(b, 'reschedule')}>Reschedule</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {modalOpen && activeBooking && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 640, maxWidth: '95%' }}>
              <h3>Booking: {activeBooking.visitor_name} — {activeBooking.tour_date} {activeBooking.tour_time}</h3>
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', marginBottom: 8 }}>Action
                  <select value={actionType} onChange={(e) => setActionType(e.target.value as any)} style={{ display: 'block', marginTop: 6 }}>
                    <option value="accept">Accept</option>
                    <option value="deny">Deny</option>
                    <option value="reschedule">Reschedule</option>
                  </select>
                </label>

                {actionType === 'accept' && (
                  <>
                    <label style={{ display: 'block', marginTop: 8 }}>Assign worker
                      <select value={selectedWorkerId ?? ''} onChange={(e) => setSelectedWorkerId(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }}>
                        <option value="">Select worker</option>
                        {workers.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.email}</option>)}
                      </select>
                    </label>
                    <label style={{ display: 'block', marginTop: 8 }}>Message to visitor
                      <textarea value={actionMessage} onChange={(e) => setActionMessage(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }} />
                    </label>
                  </>
                )}

                {actionType === 'deny' && (
                  <label style={{ display: 'block', marginTop: 8 }}>Message to visitor
                    <textarea value={actionMessage} onChange={(e) => setActionMessage(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }} />
                  </label>
                )}

                {actionType === 'reschedule' && (
                  <>
                    <label style={{ display: 'block', marginTop: 8 }}>New date
                      <input value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="YYYY-MM-DD" style={{ display: 'block', marginTop: 6 }} />
                    </label>
                    <label style={{ display: 'block', marginTop: 8 }}>New time
                      <input value={newTime} onChange={(e) => setNewTime(e.target.value)} placeholder="HH:MM" style={{ display: 'block', marginTop: 6 }} />
                    </label>
                  </>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={submitAction} style={{ padding: '8px 12px' }}>Submit</button>
                  <button onClick={closeModal} style={{ padding: '8px 12px' }}>Cancel</button>
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
  const [primaryColor, setPrimaryColor] = useState('#2d6a4f')
  const [bookingFormFields, setBookingFormFields] = useState('')
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
      setPrimaryColor(s.primary_color ?? '#2d6a4f')
      setBookingFormFields(s.booking_form_fields ? JSON.stringify(s.booking_form_fields) : '')
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
          <label style={{ display: 'block', marginTop: 8 }}>Tour times (comma-separated)
            <input value={tourTimes} onChange={(e) => setTourTimes(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }} />
          </label>
          <label style={{ display: 'block', marginTop: 8 }}>Primary color
            <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ display: 'block', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 8 }}>Booking form fields (JSON)
            <textarea value={bookingFormFields} onChange={(e) => setBookingFormFields(e.target.value)} style={{ display: 'block', marginTop: 6, width: '100%' }} placeholder='e.g. [{"id":"children_count","label":"Children"}]' />
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
  const [openKeyword, setOpenKeyword] = useState('open')
  const [closedKeyword, setClosedKeyword] = useState('gesloten')
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, { enabled: boolean; times: string }>>({
    0: { enabled: true, times: '11:00,13:00,15:00' },
    1: { enabled: false, times: '11:00,13:00,15:00' },
    2: { enabled: true, times: '11:00,13:00,15:00' },
    3: { enabled: true, times: '11:00,13:00,15:00' },
    4: { enabled: true, times: '11:00,13:00,15:00' },
    5: { enabled: true, times: '11:00,13:00,15:00' },
    6: { enabled: true, times: '11:00,13:00,15:00' },
  })

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

      const defaults = buildDefaultSchedule(baseTimes)
      const rawWeekly = s.weekly_schedule ?? {}
      const nextWeekly: Record<number, { enabled: boolean; times: string }> = { ...defaults }

      for (let d = 0; d <= 6; d++) {
        const cfg = rawWeekly[String(d)] ?? rawWeekly[d]
        if (!cfg) continue
        nextWeekly[d] = {
          enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : defaults[d].enabled,
          times: Array.isArray(cfg.times)
            ? cfg.times.join(',')
            : String(cfg.times ?? defaults[d].times),
        }
      }

      setWeeklySchedule(nextWeekly)
      setOpenKeyword(s.calendar_override_open_keyword || 'open')
      setClosedKeyword(s.calendar_override_closed_keyword || 'gesloten')
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
      const normalizedWeekly: Record<number, { enabled: boolean; times: string[] }> = {} as any
      for (let d = 0; d <= 6; d++) {
        const row = weeklySchedule[d]
        normalizedWeekly[d] = {
          enabled: !!row.enabled,
          times: String(row.times || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
      }

      const payload = {
        ...allSettings,
        weekly_schedule: normalizedWeekly,
        calendar_override_open_keyword: openKeyword.trim() || 'open',
        calendar_override_closed_keyword: closedKeyword.trim() || 'gesloten',
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

  if (loading) return <p>Laden…</p>

  return (
    <div style={{ maxWidth: 640 }}>
      {status?.connected ? (
        <div style={{ padding: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#15803d' }}>✓ Google Calendar verbonden</p>
          <p style={{ margin: '8px 0 0', color: '#374151' }}>
            <strong>Agenda:</strong> {status.calendar_name ?? status.calendar_id}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            ID: {status.calendar_id}
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={openConnectPopup}
              style={{ padding: '8px 14px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
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
            style={{ marginTop: 14, padding: '10px 20px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            Google Calendar koppelen
          </button>
        </div>
      )}

      {message && <p style={{ marginTop: 12, color: '#dc2626' }}>{message}</p>}

      <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
        <strong style={{ color: '#374151' }}>Hoe werkt het?</strong>
        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Stel hieronder per weekdag in of boekingen openstaan en welke uren standaard zichtbaar zijn.</li>
          <li>Maak in Google Calendar een event met het woord <strong>{openKeyword || 'open'}</strong> om die specifieke datum open te forceren.</li>
          <li>Maak een event met <strong>{closedKeyword || 'gesloten'}</strong> om die datum te sluiten, zelfs als de weekdag standaard open is.</li>
          <li>Andere events in Google blokkeren overlappende tijdslots automatisch.</li>
        </ul>
      </div>

      <div style={{ marginTop: 24, padding: 16, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Standaard weekplanning</h3>
        <p style={{ marginTop: 0, color: '#6b7280', fontSize: 13 }}>
          Deze planning geldt standaard. Met Google-events op datum-niveau kan je uitzonderingen maken.
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {dayLabels.map((label, dayIndex) => (
            <div key={dayIndex} style={{ display: 'grid', gridTemplateColumns: '140px 120px 1fr', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>{label}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={!!weeklySchedule[dayIndex]?.enabled}
                  onChange={(e) => setWeeklySchedule((prev) => ({
                    ...prev,
                    [dayIndex]: { ...prev[dayIndex], enabled: e.target.checked },
                  }))}
                />
                Open
              </label>
              <input
                value={weeklySchedule[dayIndex]?.times ?? ''}
                onChange={(e) => setWeeklySchedule((prev) => ({
                  ...prev,
                  [dayIndex]: { ...prev[dayIndex], times: e.target.value },
                }))}
                placeholder="11:00,13:00,15:00"
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <label style={{ display: 'block' }}>
            Keyword voor open override
            <input
              value={openKeyword}
              onChange={(e) => setOpenKeyword(e.target.value)}
              style={{ display: 'block', marginTop: 6, width: '100%' }}
              placeholder="open"
            />
          </label>
          <label style={{ display: 'block' }}>
            Keyword voor gesloten override
            <input
              value={closedKeyword}
              onChange={(e) => setClosedKeyword(e.target.value)}
              style={{ display: 'block', marginTop: 6, width: '100%' }}
              placeholder="gesloten"
            />
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            onClick={saveCalendarRules}
            disabled={savingRules}
            style={{ padding: '10px 16px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            {savingRules ? 'Opslaan…' : 'Kalenderregels opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
