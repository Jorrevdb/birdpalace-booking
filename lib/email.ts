import { Resend } from 'resend'
import { format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Booking, Worker } from '@/types'
import { SITE_NAME, SITE_URL, CONTACT_EMAIL, TOUR_DURATION_MINUTES } from './config'

const resend = new Resend(process.env.RESEND_API_KEY)

// Format a tour date nicely in Dutch: "zaterdag 12 april 2025"
function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'EEEE d MMMM yyyy', { locale: nl })
}

// Format tour time with end time: "11:00 – 12:30"
function formatSlot(time: string) {
  const [h, m] = time.split(':').map(Number)
  const endH = Math.floor((h * 60 + m + TOUR_DURATION_MINUTES) / 60)
  const endM = (h * 60 + m + TOUR_DURATION_MINUTES) % 60
  return `${time} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

// ─────────────────────────────────────────
// 1. Visitor: booking received (pending)
// ─────────────────────────────────────────
export async function sendBookingReceivedEmail(booking: Booking) {
  const statusUrl = `${SITE_URL}/booking/${booking.edit_token}`

  await resend.emails.send({
    from: `${SITE_NAME} <noreply@birdpalace.be>`,
    to: booking.visitor_email,
    subject: `Boeking ontvangen – ${formatDate(booking.tour_date)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #15803d;">Bedankt voor je boeking, ${booking.visitor_name.split(' ')[0]}!</h2>
        <p>We hebben je aanvraag goed ontvangen. Een van onze medewerkers zal je boeking zo snel mogelijk bevestigen.</p>

        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin: 24px 0;">
          <strong>Jouw boeking</strong><br/>
          📅 ${formatDate(booking.tour_date)}<br/>
          🕐 ${formatSlot(booking.tour_time)}<br/>
          👥 ${booking.total_people} personen (waarvan ${booking.children_count} kinderen)<br/>
          🐧 ${booking.penguin_feeding_count} personen voeren pinguïns
        </div>

        <p>Je ontvangt een bevestiging zodra een medewerker je boeking heeft goedgekeurd.</p>
        <p>
          <a href="${statusUrl}" style="background: #15803d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Bekijk je boeking
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Vragen? Stuur een mail naar <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
        </p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────
// 2. Workers: new booking to approve
// ─────────────────────────────────────────
export async function sendWorkerNotificationEmail(
  booking: Booking,
  worker: Worker,
  responseToken: string
) {
  const acceptUrl = `${SITE_URL}/worker/respond/${responseToken}?action=accept`
  const declineUrl = `${SITE_URL}/worker/respond/${responseToken}?action=decline`

  await resend.emails.send({
    from: `${SITE_NAME} <noreply@birdpalace.be>`,
    to: worker.email,
    subject: `Nieuwe boeking – ${formatDate(booking.tour_date)} ${booking.tour_time}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #15803d;">Nieuwe boekingsaanvraag</h2>
        <p>Hallo ${worker.name}, er is een nieuwe aanvraag binnengekomen voor een tour.</p>

        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin: 24px 0;">
          <strong>Boekingsdetails</strong><br/><br/>
          📅 ${formatDate(booking.tour_date)}<br/>
          🕐 ${formatSlot(booking.tour_time)}<br/>
          👥 ${booking.total_people} personen (waarvan ${booking.children_count} kinderen)<br/>
          🐧 ${booking.penguin_feeding_count} personen voeren pinguïns<br/><br/>
          <strong>Bezoeker</strong><br/>
          ${booking.visitor_name}<br/>
          ${booking.visitor_email}<br/>
          ${booking.visitor_phone}
        </div>

        <p>Kan jij deze tour begeleiden? Reageer hieronder:</p>

        <div style="margin: 24px 0;">
          <a href="${acceptUrl}" style="background: #15803d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-right: 12px;">
            ✓ Ik accepteer
          </a>
          <a href="${declineUrl}" style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            ✗ Ik kan niet
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Als een collega al heeft geaccepteerd, is deze link niet meer geldig.
        </p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────
// 3. Visitor: booking approved
// ─────────────────────────────────────────
export async function sendBookingApprovedEmail(booking: Booking, workerName: string) {
  const statusUrl = `${SITE_URL}/booking/${booking.edit_token}`

  await resend.emails.send({
    from: `${SITE_NAME} <noreply@birdpalace.be>`,
    to: booking.visitor_email,
    subject: `✓ Boeking bevestigd – ${formatDate(booking.tour_date)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #15803d;">Je boeking is bevestigd!</h2>
        <p>Goed nieuws, ${booking.visitor_name.split(' ')[0]}! Je tour is bevestigd door ${workerName}.</p>

        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 4px; margin: 24px 0;">
          <strong>Jouw bevestigde boeking</strong><br/><br/>
          📅 ${formatDate(booking.tour_date)}<br/>
          🕐 ${formatSlot(booking.tour_time)}<br/>
          👥 ${booking.total_people} personen (waarvan ${booking.children_count} kinderen)<br/>
          🐧 ${booking.penguin_feeding_count} personen voeren pinguïns
        </div>

        ${booking.worker_message ? `<p><em>"${booking.worker_message}"</em><br/>— ${workerName}</p>` : ''}

        <p>We kijken ernaar uit jullie te verwelkomen bij ${SITE_NAME}!</p>
        <p>
          <a href="${statusUrl}" style="background: #15803d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Bekijk je boeking
          </a>
        </p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────
// 4. Visitor: booking denied
// ─────────────────────────────────────────
export async function sendBookingDeniedEmail(booking: Booking, workerMessage?: string) {
  const rescheduleUrl = `${SITE_URL}/?reschedule=1`

  await resend.emails.send({
    from: `${SITE_NAME} <noreply@birdpalace.be>`,
    to: booking.visitor_email,
    subject: `Boeking niet beschikbaar – ${formatDate(booking.tour_date)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #dc2626;">Helaas, deze datum is niet beschikbaar</h2>
        <p>Beste ${booking.visitor_name.split(' ')[0]},</p>
        <p>We kunnen je boeking op ${formatDate(booking.tour_date)} om ${booking.tour_time} helaas niet bevestigen.</p>

        ${workerMessage ? `<p><em>"${workerMessage}"</em></p>` : ''}

        <p>Maar geen zorgen — je kan eenvoudig een nieuwe datum kiezen:</p>
        <p>
          <a href="${rescheduleUrl}" style="background: #15803d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Kies een nieuwe datum
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Vragen? Neem contact op via <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
        </p>
      </div>
    `,
  })
}

// ─────────────────────────────────────────
// 5. Other workers: slot already taken
// ─────────────────────────────────────────
export async function sendSlotTakenEmail(worker: Worker, booking: Booking) {
  await resend.emails.send({
    from: `${SITE_NAME} <noreply@birdpalace.be>`,
    to: worker.email,
    subject: `Boeking ingevuld – ${formatDate(booking.tour_date)} ${booking.tour_time}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2>Tour al ingevuld</h2>
        <p>Hallo ${worker.name}, de boeking voor <strong>${formatDate(booking.tour_date)} om ${booking.tour_time}</strong> is al door een collega overgenomen. Je hoeft niets te doen.</p>
      </div>
    `,
  })
}
