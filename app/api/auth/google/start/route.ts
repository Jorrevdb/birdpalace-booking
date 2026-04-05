export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createOAuth2Client, signState } from '@/lib/googleOAuth'

export async function GET() {
  try {
    const oauth2 = createOAuth2Client()
    const state = signState({ purpose: 'calendar_connect', ts: Date.now() })
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // always ask so we always get a refresh_token
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      state,
    })
    return NextResponse.redirect(authUrl)
  } catch (err) {
    console.error('[google/start]', err)
    return NextResponse.json({ ok: false, error: 'Failed to start OAuth' }, { status: 500 })
  }
}
