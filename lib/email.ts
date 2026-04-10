import { Resend } from 'resend'
import { Booking, Worker } from '@/types'
import { getSettings, getSiteName, getSiteUrl, getContactEmail } from './settings'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

// Temporary sender: use onboarding@resend.dev until birdpalace.be DNS is verified in Resend

async function getFrom() {
  const s = await getSettings()
  const name = getSiteName(s.site_name)
  return `${name} <onboarding@birdpalace.be>`
}

function getBrandColor(s: Awaited<ReturnType<typeof getSettings>>) {
  const raw = s?.primary_color ?? '2d6a4f'
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  return hex
}

function darken(hex: string): string {
  // Simple darkening: reduce each channel by ~15%
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const d = (v: number) => Math.max(0, Math.floor(v * 0.82)).toString(16).padStart(2, '0')
  return `#${d(r)}${d(g)}${d(b)}`
}

function lighten(hex: string): string {
  // ~10% brand color mixed with white for subtle background
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const m = (v: number) => Math.min(255, Math.round(v * 0.1 + 255 * 0.9)).toString(16).padStart(2, '0')
  return `#${m(r)}${m(g)}${m(b)}`
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'EEEE d MMMM yyyy', { locale: nl })
}

// ── Visitor: booking received ────────────────────©─────────────────────────────
export async function sendBookingReceivedEmail(booking: Booking): Promise<void> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)
    const contact = getContactEmail(s.contact_email)
    const brand = getBrandColor(s)
    await resend.emails.send({
      from,
      to: booking.visitor_email,
      subject: `Aanvraag ontvangen – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:${brand}">Hoi ${booking.visitor_name}!</h2>
          <p>We hebben jouw boekingsaanvraag goed ontvangen. Een medewerker zal deze zo snel mogelijk bevestigen.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Personen</td><td style="padding:8px 0;font-weight:600">${booking.total_people} (${booking.children_count} kinderen)</td></tr>
          </table>
          <a href="${siteUrl}/booking/${booking.edit_token}" style="display:inline-block;padding:12px 24px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Bekijk boekingsstatus</a>
          <p style="margin-top:32px;color:#888;font-size:13px">Vragen? Mail ons op <a href="mailto:${contact}">${contact}</a></p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendBookingReceivedEmail failed', err)
  }
}

// ── Worker: new booking notification ─────────────────────────────────────────
export async function sendWorkerNotificationEmail(
  booking: Booking,
  worker: Worker,
  responseToken: string
): Promise<void> {
  try {
    const from = await getFrom()
    const s = await getSettings()
    const siteUrl = getSiteUrl((s as any).site_url)
    const brand = getBrandColor(s)
    const respondUrl = `${siteUrl}/worker/respond/${responseToken}`
    await resend.emails.send({
      from,
      to: worker.email,
      subject: `Nieuw boekingsverzoek – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:${brand}">Hoi ${worker.name}!</h2>
          <p>Er is een nieuwe touraanvraag binnengekomen. Kun jij de tour begeleiden?</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Personen</td><td style="padding:8px 0;font-weight:600">${booking.total_people} (${booking.children_count} kinderen)</td></tr>
            <tr><td style="padding:8px 0;color:#666">Naam bezoeker</td><td style="padding:8px 0;font-weight:600">${booking.visitor_name}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Telefoon</td><td style="padding:8px 0;font-weight:600">${booking.visitor_phone}</td></tr>
          </table>
          <div style="margin:24px 0">
            <a href="${respondUrl}?action=accept" style="display:inline-block;padding:12px 28px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:16px;margin-bottom:8px">✓ Ik accepteer</a>
            <a href="${siteUrl}/admin?booking=${booking.id}" style="display:inline-block;padding:12px 28px;background:#f3f4f6;color:#374151;text-decoration:none;border-radius:8px;font-weight:600;border:1px solid #d1d5db">✎ Boeking wijzigen</a>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendWorkerNotificationEmail failed', err)
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
    await resend.emails.send({
      from,
      to: booking.visitor_email,
      subject: `Tour bevestigd! – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:${brand}">Jullie tour is bevestigd! 🎉</h2>
          <p>Goed nieuws, ${booking.visitor_name}! <strong>${workerName}</strong> zal jullie tour begeleiden.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Personen</td><td style="padding:8px 0;font-weight:600">${booking.total_people} (${booking.children_count} kinderen)</td></tr>
          </table>
          ${booking.worker_message ? `<blockquote style="border-left:4px solid ${brand};margin:0;padding:12px 16px;background:${brandLight};border-radius:0 8px 8px 0">${booking.worker_message}</blockquote>` : ''}
          <a href="${siteUrl}/booking/${booking.edit_token}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Bekijk boeking</a>
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
    await resend.emails.send({
      from,
      to: booking.visitor_email,
      subject: `Helaas – ${formatDate(booking.tour_date)} om ${booking.tour_time} niet beschikbaar`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#dc2626">Helaas...</h2>
          <p>We kunnen de tour op ${formatDate(booking.tour_date)} om ${booking.tour_time} niet bevestigen.</p>
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
            <tr><td style="padding:8px 0;color:#666">Personen</td><td style="padding:8px 0;font-weight:600">${booking.total_people} (${booking.children_count} kinderen)</td></tr>
          </table>
          ${booking.worker_message ? `<blockquote style="border-left:4px solid ${brand};margin:0;padding:12px 16px;background:${brandLight};border-radius:0 8px 8px 0">${booking.worker_message}</blockquote>` : ''}
          <a href="${siteUrl}/booking/${booking.edit_token}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:${brand};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Bekijk boeking</a>
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
