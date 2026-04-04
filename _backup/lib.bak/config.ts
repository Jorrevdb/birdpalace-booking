// ============================================================
// BIRD PALACE – BOOKING CONFIG
// Change values here to update tour logic across the whole app
// ============================================================

// Tour start times (24h format, HH:MM)
export const TOUR_TIMES = ['11:00', '13:00', '15:00'] as const
export type TourTime = (typeof TOUR_TIMES)[number]

// Duration of each tour in minutes – change this to adjust availability logic
export const TOUR_DURATION_MINUTES = 90 // 1.5 hours

// How far in advance a visitor can book (in days)
export const MAX_BOOKING_DAYS_AHEAD = 90

// Minimum advance booking (in hours)
export const MIN_BOOKING_HOURS_AHEAD = 24

// Site info used in emails
export const SITE_NAME = 'Bird Palace Pelt'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'info@birdpalace.be'
