import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Boek een tour – Bird Palace Pelt',
  description: 'Reserveer jouw tour bij Bird Palace Pelt',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  )
}
