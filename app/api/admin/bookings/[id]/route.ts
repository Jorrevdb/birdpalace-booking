import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendBookingUpdatedEmail } from '@/lib/email'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { password, updates, notify } = body || {}

    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const allowedStatus = ['pending', 'approved', 'denied']
    const patch: any = {}

    if (updates && typeof updates === 'object') {
      if (typeof updates.status === 'string' && allowedStatus.includes(updates.status)) patch.status = updates.status
      if (typeof updates.tour_date === 'string') patch.tour_date = updates.tour_date
      if (typeof updates.tour_time === 'string') patch.tour_time = updates.tour_time
      if (typeof updates.visitor_name === 'string') patch.visitor_name = updates.visitor_name
      if (typeof updates.visitor_email === 'string') patch.visitor_email = updates.visitor_email
      if (typeof updates.visitor_phone === 'string') patch.visitor_phone = updates.visitor_phone
      if (typeof updates.total_people === 'number') patch.total_people = updates.total_people
      if (typeof updates.children_count === 'number') patch.children_count = updates.children_count
      if (typeof updates.penguin_feeding_count === 'number') patch.penguin_feeding_count = updates.penguin_feeding_count
      if (updates.worker_message === null || typeof updates.worker_message === 'string') patch.worker_message = updates.worker_message
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, message: 'No valid updates provided' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('bookings')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error || !updated) {
      return NextResponse.json({ ok: false, message: error?.message || 'Update failed' }, { status: 500 })
    }

    if (notify) {
      await sendBookingUpdatedEmail(updated as any)
    }

    return NextResponse.json({ ok: true, booking: updated })
  } catch (err: any) {
    console.error('[admin/bookings PATCH] failed', err)
    return NextResponse.json({ ok: false, message: err?.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url)
    let password = url.searchParams.get('password') || ''

    if (!password) {
      try {
        const body = await req.json()
        password = body?.password || ''
      } catch {
        // ignore body parsing errors
      }
    }

    if (password !== getAdminPassword()) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { error } = await supabaseAdmin.from('bookings').delete().eq('id', params.id)
    if (error) {
      return NextResponse.json({ ok: false, message: error.message || 'Delete failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[admin/bookings DELETE] failed', err)
    return NextResponse.json({ ok: false, message: err?.message || 'Server error' }, { status: 500 })
  }
}
