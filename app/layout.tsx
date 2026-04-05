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

  // Keep runtime styling minimal and consistent with `app/globals.css` overrides.
  // We only set CSS variables here; utility class overrides already reference these variables.
  const runtimeCSS = `:root { --primary-color: ${color}; --primary-color-600: ${color}; --primary-color-700: ${color}; }`

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
