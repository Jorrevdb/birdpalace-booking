export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  // STUB
  return NextResponse.json({ error: 'Boeking niet gevonden' }, { status: 404 })
}
