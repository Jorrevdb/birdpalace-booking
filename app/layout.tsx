import './globals.css'
import SettingsClient from './SettingsClient'
import { getSettings } from '@/lib/settings'
import type { Metadata } from 'next'

const DEFAULT_TITLE = 'Boek een tour – Bird Palace Pelt'
const DEFAULT_DESCRIPTION = 'Reserveer jouw rondleiding bij Bird Palace Pelt'

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  return {
    title: s?.site_name || DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings()
  const rawColor = s?.primary_color ? String(s.primary_color) : '16a34a'
  const color = rawColor.startsWith('#') ? rawColor : `#${rawColor}`

  // Only set --primary-color-600; globals.css derives all other variants (700, 50, 100)
  // via color-mix() from this single variable. Do NOT set --primary-color-700 here —
  // that would override the color-mix computation in globals.css.
  const runtimeCSS = `:root { --primary-color-600: ${color}; }`

  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style id="runtime-settings">{runtimeCSS}</style>
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <SettingsClient />
        {children}
      </body>
    </html>
  )
}
