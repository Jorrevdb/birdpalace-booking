// STUB – real Google Calendar integration will be enabled once env vars are set
import { Worker } from '@/types'

export async function getAvailableSlotsForDate(
  _workers: Worker[],
  _date: string
): Promise<string[]> {
  return []
}

export async function getWorkersForSlot(
  _workers: Worker[],
  _date: string,
  _time: string
): Promise<Worker[]> {
  return []
}
