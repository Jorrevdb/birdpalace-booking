export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest) {
  // STUB – returns mock booking until Supabase is connected
  return NextResponse.json({
    booking: { id: 'stub', edit_token: 'stub-token' }
  }, { status: 201 })
}
