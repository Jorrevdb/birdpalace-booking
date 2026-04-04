export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  // STUB
  return NextResponse.json({ success: true })
}
