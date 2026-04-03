export type BookingStatus = 'pending' | 'approved' | 'denied'

export interface Booking {
  id: string
  created_at: string
  updated_at: string

  // Slot
  tour_date: string        // YYYY-MM-DD
  tour_time: string        // '11:00' | '13:00' | '15:00'

  // Group
  total_people: number
  children_count: number
  penguin_feeding_count: number

  // Visitor
  visitor_name: string
  visitor_email: string
  visitor_phone: string

  // Status
  status: BookingStatus
  worker_id: string | null
  worker_message: string | null
  edit_token: string
}

export interface Worker {
  id: string
  name: string
  email: string
  google_calendar_id: string // the worker's Google Calendar email / calendar ID
}

export interface BookingResponse {
  id: string
  booking_id: string
  worker_id: string
  response: 'pending' | 'accepted' | 'declined'
  message: string | null
  response_token: string
  created_at: string
  // joined
  worker?: Worker
  booking?: Booking
}

export interface AvailableSlot {
  date: string    // YYYY-MM-DD
  time: string    // '11:00'
  available: boolean
}
