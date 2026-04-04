export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// MOCK – always returns success
// Replace with real Supabase logic once API keys are set
export async function POST(
  req: NextRequest,
  { params: _params }: { params: { token: string } }
) {
  try {
    const { action } = await req.json()

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
    }

    return NextResponse.json({ success: true, action })
  } catch (err) {
    console.error('[worker respond]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
