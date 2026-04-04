export const dynamic = 'force-dynamic'
export async function GET() {
  return Response.json({ error: 'not found' }, { status: 404 })
}
