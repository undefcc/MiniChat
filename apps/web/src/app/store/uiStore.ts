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
  authEpoch: number
  authResume: (() => Promise<unknown>) | null
  authResumeReject: ((reason?: unknown) => void) | null
  loginOnSuccess: (() => void | Promise<void>) | null
  loginOnCancel: (() => void) | null
  wsErrorOpen: boolean
  wsErrorMessage: string | null
  wsRetry: (() => void | Promise<void>) | null
  showToast: (message: string, type?: ToastType, durationMs?: number) => void
  dismissToast: (id: string) => void
  setLoginOpen: (open: boolean) => void
  openLogin: (onSuccess?: () => void | Promise<void>, onCancel?: () => void) => void
  closeLogin: () => void
  runLoginSuccess: () => Promise<void>
  setAuthResume: (resume: (() => Promise<unknown>) | null, reject?: ((reason?: unknown) => void) | null) => void
  runAuthResume: () => Promise<boolean>
  invalidateAuth: () => void
  showWsError: (message: string, onRetry?: () => void | Promise<void>) => void
  closeWsError: () => void
  retryWs: () => void
}

const defaultToastDurationMs = 4000

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  loginOpen: false,
  authEpoch: 0,
  authResume: null,
  authResumeReject: null,
  loginOnSuccess: null,
  loginOnCancel: null,
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

  openLogin: (onSuccess, onCancel) => set({
    loginOpen: true,
    loginOnSuccess: onSuccess || null,
    loginOnCancel: onCancel || null,
  }),

  closeLogin: () => {
    const { loginOnCancel, authResumeReject } = get()
    set({
      loginOpen: false,
      loginOnSuccess: null,
      loginOnCancel: null,
      authResume: null,
      authResumeReject: null,
    })
    if (loginOnCancel) {
      loginOnCancel()
    }
    if (authResumeReject) {
      authResumeReject(new Error('Login cancelled'))
    }
  },

  runLoginSuccess: async () => {
    const { loginOnSuccess } = get()
    set({ loginOpen: false, loginOnSuccess: null, loginOnCancel: null })
    if (loginOnSuccess) {
      await loginOnSuccess()
    } else {
      await get().runAuthResume()
    }
  },

  setAuthResume: (resume, reject = null) => {
    const { authResumeReject } = get()
    if (authResumeReject && authResumeReject !== reject) {
      authResumeReject(new Error('Superseded by a newer auth resume action'))
    }
    set({ authResume: resume, authResumeReject: reject })
  },

  runAuthResume: async () => {
    const { authResume } = get()
    if (!authResume) return false
    set({ authResume: null, authResumeReject: null })
    try {
      await authResume()
    } catch {
      return true
    }
    return true
  },

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
