import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? 'T.anja2001BirdPalace'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await req.json()
    const { password, name, email, google_calendar_id } = body
    if (password !== getAdminPassword()) return new NextResponse('Unauthorized', { status: 401 })

    const updates: any = {}
    if (name) updates.name = name
    if (email) updates.email = email
    if (google_calendar_id) updates.google_calendar_id = google_calendar_id

    const { data, error } = await supabaseAdmin.from('workers').update(updates).eq('id', id).select().single()
    if (error) {
      console.error('supabase update error', error)
      return new NextResponse(error.message || 'Update failed', { status: 500 })
    }

    return NextResponse.json({ worker: data })
  } catch (err: any) {
    console.error('admin worker PATCH failed', err)
    return new NextResponse('Server error', { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const url = new URL(req.url)
    const password = url.searchParams.get('password')
    if (password !== getAdminPassword()) return new NextResponse('Unauthorized', { status: 401 })

    // 1. Ontkoppel de worker van bookings (assigned_worker_id → null)
    const { error: bookingsErr } = await supabaseAdmin
      .from('bookings')
      .update({ assigned_worker_id: null })
      .eq('assigned_worker_id', id)
    if (bookingsErr) {
      console.error('supabase unlink bookings error', bookingsErr)
      return new NextResponse(bookingsErr.message || 'Kon worker niet ontkoppelen van boekingen', { status: 500 })
    }

    // 2. Verwijder booking_responses van deze worker
    const { error: responsesErr } = await supabaseAdmin
      .from('booking_responses')
      .delete()
      .eq('worker_id', id)
    if (responsesErr) {
      console.error('supabase delete booking_responses error', responsesErr)
      return new NextResponse(responsesErr.message || 'Kon worker-responses niet verwijderen', { status: 500 })
    }

    // 3. Verwijder de worker zelf
    const { error } = await supabaseAdmin.from('workers').delete().eq('id', id)
    if (error) {
      console.error('supabase delete worker error', error)
      return new NextResponse(error.message || 'Verwijderen mislukt', { status: 500 })
    }

    return new NextResponse('Deleted', { status: 200 })
  } catch (err: any) {
    console.error('admin worker DELETE failed', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
