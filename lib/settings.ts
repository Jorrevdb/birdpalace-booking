import { supabaseAdmin } from './supabase'
import { TOUR_TIMES as DEFAULT_TOUR_TIMES, TOUR_DURATION_MINUTES as DEFAULT_DURATION, SITE_NAME as DEFAULT_SITE_NAME, SITE_URL as DEFAULT_SITE_URL, CONTACT_EMAIL as DEFAULT_CONTACT_EMAIL } from './config'
import { unstable_noStore as noStore } from 'next/cache'

export type Settings = {
  // ── Algemeen ──────────────────────────────────────────────────────────────
  site_name?: string
  contact_email?: string
  tour_duration_minutes?: number
  tour_times?: string | string[]
  primary_color?: string
  booking_form_fields?: any
  weekly_schedule?: any
  calendar_override_open_keyword?: string
  calendar_override_closed_keyword?: string
  planning_tabs?: any
  worker_message_accepted_default?: string
  worker_message_denied_default?: string

  // ── E-mail templates ──────────────────────────────────────────────────────
  // Visitor: booking received
  email_received_subject?: string
  email_received_intro?: string
  // Visitor: booking approved
  email_approved_subject?: string
  email_approved_intro?: string
  // Visitor: booking denied
  email_denied_subject?: string
  email_denied_intro?: string
  // Worker: new booking notification
  email_worker_subject?: string
  email_worker_intro?: string
  // Worker: slot already taken by another worker
  email_slot_taken_enabled?: boolean
  email_slot_taken_subject?: string
  email_slot_taken_intro?: string

  // ── Pagina copy ───────────────────────────────────────────────────────────
  copy_step1_subtitle?: string   // "Kies een datum en tijdslot"
  copy_step2_subtitle?: string   // "Vertel ons meer over jullie groep"
  copy_step3_subtitle?: string   // "Jouw contactgegevens"
  copy_confirm_title?: string    // "Aanvraag ontvangen!"
  copy_confirm_body?: string     // "Wij checken bij de pinguïns..."
  copy_no_slots_text?: string    // shown when selected date has no available slots

  // ── Excel export ───────────────────────────────────────────────────────────
  export_columns?: ExportColumn[]
}

export type ExportColumn = {
  key: string
  label: string
  enabled: boolean
}

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'tour_date',             label: 'Datum',              enabled: true  },
  { key: 'tour_time',             label: 'Tijdslot',           enabled: true  },
  { key: 'visitor_name',          label: 'Naam',               enabled: true  },
  { key: 'visitor_email',         label: 'E-mail',             enabled: true  },
  { key: 'visitor_phone',         label: 'Telefoon',           enabled: true  },
  { key: 'adults',                label: 'Volwassenen (+12j)', enabled: true  },
  { key: 'children_count',        label: 'Kinderen (-12j)',    enabled: true  },
  { key: 'total_people',          label: 'Totaal personen',    enabled: true  },
  { key: 'penguin_feeding_count', label: 'Pinguïns voeren',   enabled: false },
  { key: 'status',                label: 'Status',             enabled: true  },
  { key: 'visitor_message',       label: 'Opmerking bezoeker', enabled: false },
  { key: 'worker_message',        label: 'Bericht worker',     enabled: false },
  { key: 'created_at',            label: 'Aangemaakt op',      enabled: false },
]

export type WeeklyDayConfig = {
  enabled: boolean
  times: string[]
}

export type WeeklySchedule = Record<number, WeeklyDayConfig>

export type PlanningTab = {
  id: string
  name: string
  keyword?: string
  weekly_schedule: WeeklySchedule
}

export async function getSettings(): Promise<Settings> {
  // Critical: prevent Next.js Server Component fetch caching from serving stale settings on reload.
  // This must be dynamic because settings change at runtime from the admin panel.
  noStore()

  try {
    // Prefer keyed 'site' row if present.
    // Use array response (not `.single()`) to avoid edge cases causing fallback to an older row.
    const { data: keyed, error: keyedError } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('key', 'site')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!keyedError && keyed && keyed.length > 0) {
      const row = keyed[0] as any
      const s = row && row.value ? row.value : row
      return s
    }

    // fallback: return newest row
    const { data, error } = await supabaseAdmin.from('settings').select('*').order('updated_at', { ascending: false }).limit(1)
    if (error || !data || data.length === 0) return {}

    const row = data[0] as any
    const s = row && row.value ? row.value : row

    // normalize tour_times to CSV string or array
    if (s && s.tour_times && Array.isArray(s.tour_times)) {
      s.tour_times = s.tour_times
    }

    return s
  } catch (err) {
    console.error('getSettings failed', err)
    return {}
  }
}

export function clearSettingsCache() {
  // no-op (settings are dynamically read with `noStore()`)
}

export function parseTourTimes(raw?: string | string[]) {
  if (!raw) return DEFAULT_TOUR_TIMES
  if (Array.isArray(raw)) return raw
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean)
}

export function getDefaultWeeklySchedule(baseSlots?: string[]): WeeklySchedule {
  const slots = baseSlots && baseSlots.length > 0 ? baseSlots : DEFAULT_TOUR_TIMES
  // Keep existing behavior as default: Monday closed.
  return {
    0: { enabled: true, times: [...slots] },
    1: { enabled: false, times: [...slots] },
    2: { enabled: true, times: [...slots] },
    3: { enabled: true, times: [...slots] },
    4: { enabled: true, times: [...slots] },
    5: { enabled: true, times: [...slots] },
    6: { enabled: true, times: [...slots] },
  }
}

export function parseWeeklySchedule(raw: any, baseSlots?: string[]): WeeklySchedule {
  const defaults = getDefaultWeeklySchedule(baseSlots)
  if (!raw || typeof raw !== 'object') return defaults

  const out: WeeklySchedule = { ...defaults }
  for (let day = 0; day <= 6; day++) {
    const candidate = raw[String(day)] ?? raw[day]
    if (!candidate || typeof candidate !== 'object') continue

    const enabled =
      typeof candidate.enabled === 'boolean' ? candidate.enabled : defaults[day].enabled
    const times = Array.from(parseTourTimes(candidate.times ?? defaults[day].times))
    out[day] = { enabled, times }
  }

  return out
}

export function getCalendarOpenKeyword(raw?: string) {
  return (raw || 'open').trim().toLowerCase()
}

export function getCalendarClosedKeyword(raw?: string) {
  return (raw || 'gesloten').trim().toLowerCase()
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 40) || 'tab'
}

export function getPlanningTabs(settings: Settings): PlanningTab[] {
  const baseSlots = Array.from(parseTourTimes(settings.tour_times))

  // New schema (preferred)
  if (Array.isArray(settings.planning_tabs) && settings.planning_tabs.length > 0) {
    const normalized = settings.planning_tabs.map((raw: any, i: number) => {
      const name = String(raw?.name || (i === 0 ? 'Default' : `Tab ${i + 1}`))
      return {
        id: String(raw?.id || slugify(name) || `tab-${i + 1}`),
        name,
        keyword: raw?.keyword ? String(raw.keyword).trim().toLowerCase() : '',
        weekly_schedule: parseWeeklySchedule(raw?.weekly_schedule, baseSlots),
      } as PlanningTab
    })

    // Ensure first tab is default-like (no keyword)
    if (normalized.length > 0) {
      normalized[0].id = normalized[0].id || 'default'
      normalized[0].name = normalized[0].name || 'Default'
      normalized[0].keyword = ''
    }
    return normalized
  }

  // Backward compatibility from old schema.
  const defaultSchedule = parseWeeklySchedule(settings.weekly_schedule, baseSlots)
  const openKeyword = getCalendarOpenKeyword(settings.calendar_override_open_keyword)
  const closedKeyword = getCalendarClosedKeyword(settings.calendar_override_closed_keyword)

  const fullyOpen = getDefaultWeeklySchedule(baseSlots)
  const fullyClosed = getDefaultWeeklySchedule(baseSlots)
  for (let d = 0; d <= 6; d++) {
    fullyOpen[d] = { enabled: true, times: [...baseSlots] }
    fullyClosed[d] = { enabled: false, times: [] }
  }

  return [
    { id: 'default', name: 'Default', keyword: '', weekly_schedule: defaultSchedule },
    { id: 'open', name: 'Open', keyword: openKeyword, weekly_schedule: fullyOpen },
    { id: 'gesloten', name: 'Gesloten', keyword: closedKeyword, weekly_schedule: fullyClosed },
  ]
}

export function getTourDuration(raw?: number) {
  if (!raw) return DEFAULT_DURATION
  return Number(raw) || DEFAULT_DURATION
}

export function getSiteName(raw?: string) {
  return raw || DEFAULT_SITE_NAME
}

export function getSiteUrl(raw?: string) {
  const normalizedRaw = raw && String(raw).trim().length > 0 ? String(raw).trim() : ''
  const isPreviewUrl = normalizedRaw.includes('-git-main-') || normalizedRaw.includes('.vercel.app') && normalizedRaw.includes('-git-')
  const isProduction = process.env.VERCEL_ENV === 'production'

  if (normalizedRaw && !(isProduction && isPreviewUrl)) return normalizedRaw

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl && String(envUrl).trim().length > 0) return envUrl

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl && String(vercelUrl).trim().length > 0) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
  }

  return DEFAULT_SITE_URL
}

export function getContactEmail(raw?: string) {
  return raw || DEFAULT_CONTACT_EMAIL
}
export function getWorkerMessageAcceptedDefault(raw?: string) {
  return raw || 'Alles in orde. Tot ziens!'
}

export function getWorkerMessageDeniedDefault(raw?: string) {
  return raw || 'Helaas kan ik niet beschikbaar zijn.'
}