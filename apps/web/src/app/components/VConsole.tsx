"use client"

import { useEffect } from 'react'

export function VConsole() {
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PUBLIC_ENABLE_VCONSOLE === 'true'

    if (!enabled || typeof window === 'undefined') return

    let vConsole: any

    ;(async () => {
      const VConsoleLib = (await import('vconsole')).default
      vConsole = new VConsoleLib()
    })()

    return () => {
      if (vConsole && typeof vConsole.destroy === 'function') {
        vConsole.destroy()
      }
    }
  }, [])

  return null
}
