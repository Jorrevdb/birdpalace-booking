import { Resend } from 'resend'
import { Booking, Worker } from '@/types'
import { getSettings, getSiteName, getSiteUrl, getContactEmail, getTourDuration } from './settings'
import { format, parseISO, addMinutes } from 'date-fns'
import { nl } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

const MAPS_URL = 'https://maps.app.goo.gl/WXgroKXYJiGK95QLA'

function mapsButton(): string {
  const mapsSvg = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18" style="vertical-align:middle;flex-shrink:0" fill="#1a73e8"><path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z"/></svg>`
  return `<a href="${MAPS_URL}" style="display:inline-flex;align-items:center;gap:9px;padding:11px 20px;background:#fff;color:#1a73e8;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;border:2px solid #dadce0;box-shadow:0 1px 3px rgba(0,0,0,.08)">${mapsSvg} Bekijk op Google Maps</a>`
}

async function getFrom() {
  const s = await getSettings()
  const name = getSiteName(s.site_name)
  return `${name} <onboarding@birdpalace.be>`
}

/** Build the shared "people" table rows (adults / children / total) for email templates. */
function peopleRows(booking: Booking): string {
  const adults = booking.total_people - (booking.children_count ?? 0)
  return `
    <tr><td style="padding:8px 0;color:#666;width:160px">Volwassenen</td><td style="padding:8px 0;font-weight:600">${adults}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Kinderen (-12j)</td><td style="padding:8px 0;font-weight:600">${booking.children_count ?? 0}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Totaal</td><td style="padding:8px 0;font-weight:600">${booking.total_people}</td></tr>
  `
}

/** Optional visitor message block. */
function visitorMessageBlock(booking: Booking): string {
  if (!booking.visitor_message) return ''
  return `<tr><td style="padding:8px 0;color:#666;vertical-align:top">Opmerking</td><td style="padding:8px 0;font-weight:600">${booking.visitor_message}</td></tr>`
}

function getBrandColor(s: Awaited<ReturnType<typeof getSettings>>) {
  const raw = s?.primary_color ?? '2d6a4f'
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  return hex
}

function darken(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const d = (v: number) => Math.max(0, Math.floor(v * 0.82)).toString(16).padStart(2, '0')
  return `#${d(r)}${d(g)}${d(b)}`
}

function lighten(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const m = (v: number) => Math.min(255, Math.round(v * 0.1 + 255 * 0.9)).toString(16).padStart(2, '0')
  return `#${m(r)}${m(g)}${m(b)}`
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'EEEE d MMMM yyyy', { locale: nl })
}

/** Compute tour end time string from "HH:mm" start + duration in minutes. */
function computeEndTime(tourTime: string, durationMinutes: number): string {
  try {
    const [h, m] = tourTime.split(':').map(Number)
    const base = new Date(2000, 0, 1, h, m)
    const end = addMinutes(base, durationMinutes)
    return format(end, 'HH:mm')
  } catch {
    return tourTime
  }
}

// ── Template engine ───────────────────────────────────────────────────────────

/** Replace all {{key}} occurrences in a template string with the matching variable value. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/** Build the full set of template variables from a booking + optional worker + settings. */
export function buildTemplateVars(
  booking: Booking,
  s: Awaited<ReturnType<typeof getSettings>>,
  opts: { worker?: Worker; siteUrl?: string; bookingToken?: string } = {}
): Record<string, string> {
  const siteName = getSiteName(s.site_name)
  const siteUrl = opts.siteUrl ?? getSiteUrl((s as any).site_url)
  const contactEmail = getContactEmail(s.contact_email)
  const durationMins = getTourDuration(s.tour_duration_minutes)
  const adults = booking.total_people - (booking.children_count ?? 0)

  return {
    visitor_name:    booking.visitor_name ?? '',
    visitor_email:   booking.visitor_email ?? '',
    visitor_phone:   booking.visitor_phone ?? '',
    tour_date:       formatDate(booking.tour_date),
    tour_time:       booking.tour_time ?? '',
    tour_time_start: booking.tour_time ?? '',
    tour_time_end:   computeEndTime(booking.tour_time ?? '00:00', durationMins),
    total_people:    String(booking.total_people ?? 0),
    adults_count:    String(adults),
    children_count:  String(booking.children_count ?? 0),
    site_name:       siteName,
    contact_email:   contactEmail,
    booking_url:     booking.edit_token ? `${siteUrl}/booking/${booking.edit_token}` : '',
    worker_name:     opts.worker?.name ?? '',
  }
}

// ── Visitor: booking received ─────────────────────────────────────────────────
export async function sendBookingReceivedEmail(booking: Booking): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)
    const contact = getContactEmail(s.contact_email)
    const brand = getBrandColor(s)
    const vars = buildTemplateVars(booking, s, { siteUrl })

    const subject = s.email_received_subject
      ? fillTemplate(s.email_received_subject, vars)
      : `Aanvraag ontvangen – ${formatDate(booking.tour_date)} om ${booking.tour_time}`

    const introHtml = s.email_received_intro
      ? `<p>${fillTemplate(s.email_received_intro, vars).replace(/\n/g, '<br>')}</p>`
      : `<p>We hebben jouw boekingsaanvraag goed ontvangen. Een medewerker zal deze zo snel mogelijk bevestigen.</p>`

    const result = await resend.emails.send({
      from,
      to: booking.visitor_email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:${brand}">Hoi ${booking.visitor_name}!</h2>
          ${introHtml}
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            ${peopleRows(booking)}
            ${visitorMessageBlock(booking)}
          </table>
          <a href="${siteUrl}/booking/${booking.edit_token}" style="display:inline-block;padding:12px 24px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Bekijk boekingsstatus</a>
          <p style="margin-top:32px;color:#888;font-size:13px">Vragen? Mail ons op <a href="mailto:${contact}">${contact}</a></p>
        </div>
      `,
    })
    if (result.error) {
      console.error('[email] sendBookingReceivedEmail – Resend error:', result.error)
      return { ok: false, error: result.error }
    }
    console.log('[email] sendBookingReceivedEmail sent, id:', result.data?.id)
    return { ok: true }
  } catch (err) {
    console.error('[email] sendBookingReceivedEmail threw:', err)
    return { ok: false, error: err }
  }
}

// ── Worker: new booking notification ─────────────────────────────────────────
export async function sendWorkerNotificationEmail(
  booking: Booking,
  worker: Worker,
  responseToken: string
): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)
    const brand = getBrandColor(s)
    const respondUrl = `${siteUrl}/worker/respond/${responseToken}`
    const vars = buildTemplateVars(booking, s, { worker, siteUrl })

    const subject = s.email_worker_subject
      ? fillTemplate(s.email_worker_subject, vars)
      : `Nieuw boekingsverzoek – ${formatDate(booking.tour_date)} om ${booking.tour_time}`

    const introHtml = s.email_worker_intro
      ? `<p>${fillTemplate(s.email_worker_intro, vars).replace(/\n/g, '<br>')}</p>`
      : `<p>Er is een nieuwe touraanvraag binnengekomen. Kun jij de tour begeleiden?</p>`

    const result = await resend.emails.send({
      from,
      to: worker.email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:${brand}">Hoi ${worker.name}!</h2>
          ${introHtml}
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            ${peopleRows(booking)}
            <tr><td style="padding:8px 0;color:#666">Naam bezoeker</td><td style="padding:8px 0;font-weight:600">${booking.visitor_name}</td></tr>
            <tr><td style="padding:8px 0;color:#666">E-mail bezoeker</td><td style="padding:8px 0;font-weight:600">${booking.visitor_email}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Telefoon</td><td style="padding:8px 0;font-weight:600">${booking.visitor_phone}</td></tr>
            ${visitorMessageBlock(booking)}
          </table>
          <div style="margin:24px 0">
            <a href="${respondUrl}?action=accept" style="display:inline-block;padding:12px 28px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:16px;margin-bottom:8px">✓ Ik accepteer</a>
            <a href="${siteUrl}/admin?booking=${booking.id}" style="display:inline-block;padding:12px 28px;background:#f3f4f6;color:#374151;text-decoration:none;border-radius:8px;font-weight:600;border:1px solid #d1d5db">✎ Boeking wijzigen</a>
          </div>
        </div>
      `,
    })
    if (result.error) {
      console.error('[email] sendWorkerNotificationEmail – Resend error:', result.error)
      return { ok: false, error: result.error }
    }
    console.log('[email] sendWorkerNotificationEmail sent to', worker.email, 'id:', result.data?.id)
    return { ok: true }
  } catch (err) {
    console.error('[email] sendWorkerNotificationEmail threw:', err)
    return { ok: false, error: err }
  }
}

// ── Visitor: booking approved ─────────────────────────────────────────────────
export async function sendBookingApprovedEmail(
  booking: Booking,
  workerName: string
): Promise<void> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)
    const brand = getBrandColor(s)
    const brandLight = lighten(brand)
    const vars = buildTemplateVars(booking, s, { siteUrl })

    const subject = s.email_approved_subject
      ? fillTemplate(s.email_approved_subject, vars)
      : `Tour bevestigd! – ${formatDate(booking.tour_date)} om ${booking.tour_time}`

    const introHtml = s.email_approved_intro
      ? `<p>${fillTemplate(s.email_approved_intro, vars).replace(/\n/g, '<br>')}</p>`
      : `<p>Goed nieuws, ${booking.visitor_name}! Je aanvraag voor een rondleiding bij Bird Palace is goedgekeurd.</p>`

    await resend.emails.send({
      from,
      to: booking.visitor_email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:${brand}">Jullie tour is bevestigd! 🎉</h2>
          ${introHtml}
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            ${peopleRows(booking)}
          </table>
          ${booking.worker_message ? `<blockquote style="border-left:4px solid ${brand};margin:0;padding:12px 16px;background:${brandLight};border-radius:0 8px 8px 0">${booking.worker_message}</blockquote>` : ''}
          <div style="margin-top:24px">
            <a href="${siteUrl}/booking/${booking.edit_token}" style="display:inline-block;padding:12px 24px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:16px;margin-bottom:10px">Bekijk boeking</a>
            ${mapsButton()}
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendBookingApprovedEmail failed', err)
  }
}

// ── Visitor: booking denied ───────────────────────────────────────────────────
export async function sendBookingDeniedEmail(
  booking: Booking,
  workerMessage?: string
): Promise<void> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)
    const contact = getContactEmail(s.contact_email)
    const brand = getBrandColor(s)
    const vars = buildTemplateVars(booking, s, { siteUrl })

    const subject = s.email_denied_subject
      ? fillTemplate(s.email_denied_subject, vars)
      : `Helaas – ${formatDate(booking.tour_date)} om ${booking.tour_time} niet beschikbaar`

    const introHtml = s.email_denied_intro
      ? `<p>${fillTemplate(s.email_denied_intro, vars).replace(/\n/g, '<br>')}</p>`
      : `<p>We kunnen de tour op ${formatDate(booking.tour_date)} om ${booking.tour_time} niet bevestigen.</p>`

    await resend.emails.send({
      from,
      to: booking.visitor_email,
      subject,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#dc2626">Helaas...</h2>
          ${introHtml}
          ${workerMessage ? `<blockquote style="border-left:4px solid #dc2626;margin:0;padding:12px 16px;background:#fef2f2">${workerMessage}</blockquote>` : ''}
          <div style="margin-top:24px">
            <a href="${siteUrl}/booking/${booking.edit_token}" style="display:inline-block;margin-right:12px;padding:12px 24px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Bekijk boekingsstatus</a>
            <a href="${siteUrl}" style="display:inline-block;padding:12px 24px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Kies een andere datum</a>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendBookingDeniedEmail failed', err)
  }
}

// ── Visitor: booking updated by admin ─────────────────────────────────────────
export async function sendBookingUpdatedEmail(booking: Booking): Promise<void> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)

    const statusLabel =
      booking.status === 'approved'
        ? 'Geaccepteerd'
        : booking.status === 'denied'
          ? 'Geweigerd'
          : 'Afwachtend'

    const brand = getBrandColor(s)
    const brandLight = lighten(brand)
    await resend.emails.send({
      from,
      to: booking.visitor_email,
      subject: `Je boeking is bijgewerkt – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:${brand}">Je boeking werd aangepast</h2>
          <p>Hoi ${booking.visitor_name}, er zijn wijzigingen doorgevoerd aan je boeking.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Status</td><td style="padding:8px 0;font-weight:600">${statusLabel}</td></tr>
            ${peopleRows(booking)}
          </table>
          ${booking.worker_message ? `<blockquote style="border-left:4px solid ${brand};margin:0;padding:12px 16px;background:${brandLight};border-radius:0 8px 8px 0">${booking.worker_message}</blockquote>` : ''}
          <div style="margin-top:24px">
            <a href="${siteUrl}/booking/${booking.edit_token}" style="display:inline-block;padding:12px 24px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:16px;margin-bottom:10px">Bekijk boeking</a>
            ${booking.status === 'approved' ? mapsButton() : ''}
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendBookingUpdatedEmail failed', err)
  }
}

// ── Worker: slot already taken ────────────────────────────────────────────────
export async function sendSlotTakenEmail(
  worker: Worker,
  booking: Booking
): Promise<void> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)
    await resend.emails.send({
      from,
      to: worker.email,
      subject: `Boeking al ingenomen – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#d97706">Hoi ${worker.name},</h2>
          <p>De tour op <strong>${formatDate(booking.tour_date)} om ${booking.tour_time}</strong> is al door een collega overgenomen. Geen actie nodig.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendSlotTakenEmail failed', err)
  }
}
