export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createOAuth2Client, verifyState } from '@/lib/googleOAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { google } from 'googleapis'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return htmlResponse(`<p style="color:red">Google gaf een fout: ${errorParam}</p><a href="/admin">Terug naar admin</a>`)
  }

  if (!code || !state) {
    return htmlResponse('<p style="color:red">Ontbrekende parameters.</p><a href="/admin">Terug naar admin</a>')
  }

  const parsed = verifyState(state)
  if (!parsed || parsed.purpose !== 'calendar_connect') {
    return htmlResponse('<p style="color:red">Ongeldige of verlopen state. Probeer opnieuw.</p><a href="/admin">Terug naar admin</a>')
  }

  try {
    const oauth2 = createOAuth2Client()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.refresh_token) {
      // This happens when the user has authorized before and Google didn't re-issue a refresh token.
      // The 'prompt: consent' in the start route prevents this, but handle gracefully.
      return htmlResponse('<p style="color:red">Geen refresh token ontvangen. Verwijder de app-toegang in je Google-account en probeer opnieuw.</p><a href="/admin">Terug naar admin</a>')
    }

    // Fetch the primary calendar to get name and id
    const tmpClient = new google.auth.OAuth2()
    tmpClient.setCredentials(tokens)
    const calendar = google.calendar({ version: 'v3', auth: tmpClient })

    let calendarId = 'primary'
    let calendarName = 'Primaire agenda'

    try {
      const list = await calendar.calendarList.list({ maxResults: 50 })
      const items = list.data.items ?? []
      const primary = items.find((i) => i.primary) ?? items[0]
      if (primary) {
        calendarId = primary.id ?? 'primary'
        calendarName = primary.summary ?? primary.id ?? 'Primaire agenda'
      }
    } catch (err) {
      console.warn('[google/callback] calendarList.list failed, defaulting to primary', err)
    }

    // Store in settings table
    const connection = {
      calendar_id: calendarId,
      calendar_name: calendarName,
      access_token: tokens.access_token ?? '',
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    }

    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({ key: 'google_calendar_connection', value: connection }, { onConflict: 'key' })

    if (error) {
      console.error('[google/callback] failed to save connection', error)
      return htmlResponse('<p style="color:red">Kon verbinding niet opslaan. Controleer de Supabase instellingen.</p><a href="/admin">Terug naar admin</a>')
    }

    // Success: notify opener window and close popup
    return htmlResponse(`
      <p style="color:green;font-weight:bold">✓ Google Calendar verbonden: <em>${calendarName}</em></p>
      <p>Dit venster sluit automatisch…</p>
      <script>
        try {
          window.opener && window.opener.postMessage({ type: 'google:calendar_connected', calendarName: ${JSON.stringify(calendarName)} }, window.location.origin)
        } catch (e) {}
        setTimeout(() => window.close(), 1500)
      </script>
    `)
  } catch (err: any) {
    console.error('[google/callback]', err)
    return htmlResponse(`<p style="color:red">Fout: ${err?.message ?? 'Onbekende fout'}</p><a href="/admin">Terug naar admin</a>`)
  }
}

function htmlResponse(body: string) {
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Google Calendar</title>
<style>body{font-family:sans-serif;max-width:480px;margin:60px auto;padding:20px}</style>
</head>
<body>${body}</body>
</html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
