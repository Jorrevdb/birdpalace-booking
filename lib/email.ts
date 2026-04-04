import { Resend } from 'resend'
import { Booking, Worker } from '@/types'
import { SITE_NAME, SITE_URL, CONTACT_EMAIL } from './config'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

const resend = new Resend(process.env.RESEND_API_KEY)

// Temporary sender: use onboarding@resend.dev until birdpalace.be DNS is verified in Resend
const FROM = `${SITE_NAME} <onboarding@resend.dev>`

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'EEEE d MMMM yyyy', { locale: nl })
}

// ── Visitor: booking received ─────────────────────────────────────────────────
export async function sendBookingReceivedEmail(booking: Booking): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: booking.visitor_email,
      subject: `Aanvraag ontvangen – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#2d6a4f">Hoi ${booking.visitor_name}!</h2>
          <p>We hebben jouw boekingsaanvraag goed ontvangen. Een medewerker zal deze zo snel mogelijk bevestigen.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Personen</td><td style="padding:8px 0;font-weight:600">${booking.total_people} (${booking.children_count} kinderen)</td></tr>
            <tr><td style="padding:8px 0;color:#666">Pinguïns voeren</td><td style="padding:8px 0;font-weight:600">${booking.penguin_feeding_count} persoon${booking.penguin_feeding_count !== 1 ? 'en' : ''}</td></tr>
          </table>
          <a href="${SITE_URL}/booking/${booking.edit_token}" style="display:inline-block;padding:12px 24px;background:#2d6a4f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Bekijk boekingsstatus</a>
          <p style="margin-top:32px;color:#888;font-size:13px">Vragen? Mail ons op <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
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
  const acceptUrl = `${SITE_URL}/worker/respond/${responseToken}?action=accept`
  const declineUrl = `${SITE_URL}/worker/respond/${responseToken}?action=decline`

  try {
    await resend.emails.send({
      from: FROM,
      to: worker.email,
      subject: `Nieuw boekingsverzoek – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#2d6a4f">Hoi ${worker.name}!</h2>
          <p>Er is een nieuwe touraanvraag binnengekomen. Kun jij de tour begeleiden?</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Personen</td><td style="padding:8px 0;font-weight:600">${booking.total_people} (${booking.children_count} kinderen)</td></tr>
            <tr><td style="padding:8px 0;color:#666">Pinguïns voeren</td><td style="padding:8px 0;font-weight:600">${booking.penguin_feeding_count} persoon${booking.penguin_feeding_count !== 1 ? 'en' : ''}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Naam bezoeker</td><td style="padding:8px 0;font-weight:600">${booking.visitor_name}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Telefoon</td><td style="padding:8px 0;font-weight:600">${booking.visitor_phone}</td></tr>
          </table>
          <div style="margin:24px 0">
            <a href="${acceptUrl}" style="display:inline-block;padding:12px 28px;background:#2d6a4f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-right:12px">✓ Ik accepteer</a>
            <a href="${declineUrl}" style="display:inline-block;padding:12px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">✗ Ik kan niet</a>
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
    await resend.emails.send({
      from: FROM,
      to: booking.visitor_email,
      subject: `Tour bevestigd! – ${formatDate(booking.tour_date)} om ${booking.tour_time}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#2d6a4f">Jullie tour is bevestigd! 🎉</h2>
          <p>Goed nieuws, ${booking.visitor_name}! <strong>${workerName}</strong> zal jullie tour begeleiden.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#666;width:160px">Datum</td><td style="padding:8px 0;font-weight:600">${formatDate(booking.tour_date)}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tijdslot</td><td style="padding:8px 0;font-weight:600">${booking.tour_time}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Personen</td><td style="padding:8px 0;font-weight:600">${booking.total_people} (${booking.children_count} kinderen)</td></tr>
          </table>
          ${booking.worker_message ? `<blockquote style="border-left:4px solid #2d6a4f;margin:0;padding:12px 16px;background:#f0fdf4;border-radius:0 8px 8px 0">${booking.worker_message}</blockquote>` : ''}
          <a href="${SITE_URL}/booking/${booking.edit_token}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#2d6a4f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Bekijk boeking</a>
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
    await resend.emails.send({
      from: FROM,
      to: booking.visitor_email,
      subject: `Helaas – ${formatDate(booking.tour_date)} om ${booking.tour_time} niet beschikbaar`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#dc2626">Helaas...</h2>
          <p>We kunnen de tour op ${formatDate(booking.tour_date)} om ${booking.tour_time} niet bevestigen.</p>
          ${workerMessage ? `<blockquote style="border-left:4px solid #dc2626;margin:0;padding:12px 16px;background:#fef2f2">${workerMessage}</blockquote>` : ''}
          <a href="${SITE_URL}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#2d6a4f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Kies een andere datum</a>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendBookingDeniedEmail failed', err)
  }
}

// ── Worker: slot already taken ────────────────────────────────────────────────
export async function sendSlotTakenEmail(
  worker: Worker,
  booking: Booking
): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
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
