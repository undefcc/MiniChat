import { create } from 'zustand'

export type ToastType = 'error' | 'info' | 'success'

export type ToastMessage = {
  id: string
  message: string
  type: ToastType
}

interface UiState {
  toasts: ToastMessage[]
  loginOpen: boolean
  refreshAfterLogin: boolean
  authEpoch: number
  wsErrorOpen: boolean
  wsErrorMessage: string | null
  wsRetry: (() => void | Promise<void>) | null
  showToast: (message: string, type?: ToastType, durationMs?: number) => void
  dismissToast: (id: string) => void
  setLoginOpen: (open: boolean) => void
  openLogin: (refreshAfterLogin?: boolean) => void
  clearRefreshAfterLogin: () => void
  invalidateAuth: () => void
  showWsError: (message: string, onRetry?: () => void | Promise<void>) => void
  closeWsError: () => void
  retryWs: () => void
}

const defaultToastDurationMs = 4000

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  loginOpen: false,
  refreshAfterLogin: false,
  authEpoch: 0,
  wsErrorOpen: false,
  wsErrorMessage: null,
  wsRetry: null,

  showToast: (message, type = 'error', durationMs = defaultToastDurationMs) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    set(state => ({
      toasts: [...state.toasts, { id, message, type }],
    }))

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        get().dismissToast(id)
      }, durationMs)
    }
  },

  dismissToast: (id) => set(state => ({
    toasts: state.toasts.filter(toast => toast.id !== id),
  })),

  setLoginOpen: (open) => set({ loginOpen: open }),

  openLogin: (refreshAfterLogin = false) => set(state => ({
    loginOpen: true,
    refreshAfterLogin: refreshAfterLogin || state.refreshAfterLogin,
  })),

  clearRefreshAfterLogin: () => set({ refreshAfterLogin: false }),

  invalidateAuth: () => set(state => ({ authEpoch: state.authEpoch + 1 })),

  showWsError: (message, onRetry) => set({
    wsErrorOpen: true,
    wsErrorMessage: message,
    wsRetry: onRetry || null,
  }),

  closeWsError: () => set({
    wsErrorOpen: false,
    wsErrorMessage: null,
    wsRetry: null,
  }),

  retryWs: () => {
    const { wsRetry } = get()
    if (wsRetry) {
      Promise.resolve(wsRetry()).catch(() => {})
    }
    set({
      wsErrorOpen: false,
      wsErrorMessage: null,
      wsRetry: null,
    })
  },
}))
