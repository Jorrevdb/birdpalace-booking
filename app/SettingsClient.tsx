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
      // Setting --primary-color-600 is enough: globals.css derives all brand-* variants
      // via color-mix() from this single variable (50, 100, 600, 700, rings, borders…)
      document.documentElement.style.setProperty('--primary-color-600', color)
      // Also patch the DayPicker accent variable directly so the calendar updates too
      const el = ensureStyleTag()
      el.textContent = `
        .rdp { --rdp-accent-color: ${color}; }
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
