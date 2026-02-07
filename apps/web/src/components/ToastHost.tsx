"use client"

import React from 'react'
import { X } from 'lucide-react'
import { useUiStore } from '@/app/store/uiStore'

const toastStyles: Record<string, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

export function ToastHost() {
  const toasts = useUiStore(s => s.toasts)
  const dismissToast = useUiStore(s => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[90] w-[320px] space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-sm ${toastStyles[toast.type]}`}
        >
          <span className="flex-1 leading-5">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="-mt-0.5 rounded p-1 text-current/70 hover:text-current"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
