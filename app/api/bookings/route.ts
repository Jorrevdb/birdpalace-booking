export const dynamic = 'force-dynamic'
export async function POST() {
  return Response.json({ booking: { id: 'stub', edit_token: 'stub' } }, { status: 201 })
}
