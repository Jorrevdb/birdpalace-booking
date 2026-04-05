"use client"

import { useEffect } from 'react'

export default function SettingsClient() {
  useEffect(() => {
    function ensureStyleTag() {
      let el = document.getElementById('runtime-settings') as HTMLStyleElement | null
      if (!el) {
        el = document.createElement('style')
        el.id = 'runtime-settings'
        document.head.appendChild(el)
      }
      return el
    }

    function updateStyleWithColor(color: string) {
      const el = ensureStyleTag()
      document.documentElement.style.setProperty('--primary-color', color)
      document.documentElement.style.setProperty('--brand-600', color)
      el.textContent = `
        .bg-brand-600 { background-color: ${color} !important; }
        .bg-brand-700 { background-color: ${color} !important; }
        .text-brand-700 { color: ${color} !important; }
        .border-brand-600 { border-color: ${color} !important; }
        .rdp-day_available:not(.rdp-day_selected):not(.rdp-day_disabled) { color: ${color} !important; }
        .rdp-day_available:not(.rdp-day_selected):not(.rdp-day_disabled)::after { background: ${color} !important; }
      `
    }

    function onUpdate(e: any) {
      const s = (e && e.detail) || {}
      const rawColor = s.primary_color || null
      if (rawColor) {
        const color = typeof rawColor === 'string' ? (rawColor.startsWith('#') ? rawColor : `#${rawColor}`) : null
        if (color) updateStyleWithColor(color)
      }
    }

    window.addEventListener('settings:updated', onUpdate)

    function onStorage(e: StorageEvent) {
      if (e.key !== 'settings:updated') return
      try {
        const payload = JSON.parse(String(e.newValue))
        const s = payload?.settings || {}
        const rawColor = s.primary_color || null
        if (rawColor) {
          const color = typeof rawColor === 'string' ? (rawColor.startsWith('#') ? rawColor : `#${rawColor}`) : null
          if (color) updateStyleWithColor(color)
        }
        try { window.dispatchEvent(new CustomEvent('settings:updated', { detail: s })) } catch (e) {}
      } catch (err) {}
    }

    window.addEventListener('storage', onStorage)

    return () => { window.removeEventListener('settings:updated', onUpdate); window.removeEventListener('storage', onStorage) }
  }, [])

  return null
}
