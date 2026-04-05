import BookingClient from './BookingClient'
import { getSettings } from '@/lib/settings'

export default async function Page() {
  const s = await getSettings()

  return <BookingClient initialSettings={s} />
}
