export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

/**
 * Diagnostic endpoint – visit /api/test-email?to=your@email.com to send a
 * test email and see the full Resend response (including any error details).
 * Remove or protect this route once emails are confirmed working.
 */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to')
  if (!to) {
    return NextResponse.json({ error: 'Pass ?to=your@email.com in the URL' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY env var is not set' }, { status: 500 })
  }

  const resend = new Resend(apiKey)

  let result: unknown
  try {
    result = await resend.emails.send({
      from: 'Bird Palace Test <onboarding@birdpalace.be>',
      to,
      subject: '[Test] Email diagnostiek Bird Palace',
      html: '<p>Als je dit ziet werkt het verzenden van emails!</p>',
    })
  } catch (err: any) {
    result = { threw: true, message: err?.message ?? String(err), stack: err?.stack }
  }

  return NextResponse.json({
    api_key_prefix: apiKey.slice(0, 8) + '…',
    to,
    resend_response: result,
  })
}
