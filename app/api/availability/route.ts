export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET() {
  // STUB – returns empty availability until Supabase + Google Calendar are connected
  return NextResponse.json({ availability: {} })
}
