import { supabaseAdmin } from './supabase'
import { TOUR_TIMES as DEFAULT_TOUR_TIMES, TOUR_DURATION_MINUTES as DEFAULT_DURATION, SITE_NAME as DEFAULT_SITE_NAME, SITE_URL as DEFAULT_SITE_URL, CONTACT_EMAIL as DEFAULT_CONTACT_EMAIL } from './config'
import { unstable_noStore as noStore } from 'next/cache'

export type Settings = {
  site_name?: string
  contact_email?: string
  tour_duration_minutes?: number
  tour_times?: string | string[]
  primary_color?: string
  booking_form_fields?: any
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

export function getTourDuration(raw?: number) {
  if (!raw) return DEFAULT_DURATION
  return Number(raw) || DEFAULT_DURATION
}

export function getSiteName(raw?: string) {
  return raw || DEFAULT_SITE_NAME
}

export function getSiteUrl(raw?: string) {
  return raw || DEFAULT_SITE_URL
}

export function getContactEmail(raw?: string) {
  return raw || DEFAULT_CONTACT_EMAIL
}
