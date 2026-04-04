export const dynamic = 'force-dynamic'

export default function BookingStatusPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-sm">
        <p className="text-gray-600">Boeking wordt geladen...</p>
      </div>
    </div>
  )
}
