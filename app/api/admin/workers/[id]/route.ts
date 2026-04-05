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

    const { error } = await supabaseAdmin.from('workers').delete().eq('id', id)
    if (error) {
      console.error('supabase delete error', error)
      return new NextResponse(error.message || 'Delete failed', { status: 500 })
    }

    return new NextResponse('Deleted', { status: 200 })
  } catch (err: any) {
    console.error('admin worker DELETE failed', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
