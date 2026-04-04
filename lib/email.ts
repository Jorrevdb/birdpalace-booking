// STUB – will be filled in after Vercel build is confirmed working
import type { Booking, Worker } from '@/types'
export async function sendBookingReceivedEmail(_booking: Booking) {}
export async function sendWorkerNotificationEmail(_booking: Booking, _worker: Worker, _token: string) {}
export async function sendBookingApprovedEmail(_booking: Booking, _workerName: string) {}
export async function sendBookingDeniedEmail(_booking: Booking, _message?: string) {}
export async function sendSlotTakenEmail(_worker: Worker, _booking: Booking) {}
