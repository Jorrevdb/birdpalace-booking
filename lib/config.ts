export const TOUR_TIMES = ['11:00', '13:00', '15:00'] as const
export type TourTime = (typeof TOUR_TIMES)[number]
export const TOUR_DURATION_MINUTES = 90
export const MAX_BOOKING_DAYS_AHEAD = 90
export const MIN_BOOKING_HOURS_AHEAD = 24
export const SITE_NAME = 'Bird Palace Pelt'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'info@birdpalace.be'
