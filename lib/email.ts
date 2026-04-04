// STUB – real Resend email integration will be enabled once env vars are set
import { Booking, Worker } from '@/types'

export async function sendBookingReceivedEmail(_booking: Booking): Promise<void> {
  console.log('[email stub] sendBookingReceivedEmail – skipped (no API key yet)')
}

export async function sendWorkerNotificationEmail(
  _booking: Booking,
  _worker: Worker,
  _responseToken: string
): Promise<void> {
  console.log('[email stub] sendWorkerNotificationEmail – skipped (no API key yet)')
}

export async function sendBookingApprovedEmail(
  _booking: Booking,
  _workerName: string
): Promise<void> {
  console.log('[email stub] sendBookingApprovedEmail – skipped (no API key yet)')
}

export async function sendBookingDeniedEmail(
  _booking: Booking,
  _workerMessage?: string
): Promise<void> {
  console.log('[email stub] sendBookingDeniedEmail – skipped (no API key yet)')
}

export async function sendSlotTakenEmail(
  _worker: Worker,
  _booking: Booking
): Promise<void> {
  console.log('[email stub] sendSlotTakenEmail – skipped (no API key yet)')
}
