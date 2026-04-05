import crypto from 'crypto'
import { google } from 'googleapis'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = (process.env.NEXT_PUBLIC_BASE_URL || '') + '/api/auth/google/callback'
const HMAC_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SECRET || ''

export function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export function signState(payload: object) {
  const json = JSON.stringify(payload)
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(json).digest('hex')
  const token = Buffer.from(json).toString('base64') + '.' + sig
  return token
}

export function verifyState(token: string) {
  try {
    const [b64, sig] = token.split('.')
    const json = Buffer.from(b64, 'base64').toString('utf8')
    const expected = crypto.createHmac('sha256', HMAC_SECRET).update(json).digest('hex')
    if (!sig || expected !== sig) return null
    return JSON.parse(json)
  } catch (err) {
    return null
  }
}
