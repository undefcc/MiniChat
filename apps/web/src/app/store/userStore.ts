import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { request } from '../utils/request'

export type AuthUser = {
  id?: string
  email?: string
  nickname?: string
  type?: string
}

export type AuthResponse = {
  accessToken: string
  user?: AuthUser
  message?: string
}

interface UserState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user?: AuthUser | null) => void
  clearAuth: () => void
  login: (email: string, password: string) => Promise<AuthResponse>
  guestLogin: (nickname?: string) => Promise<AuthResponse>
  register: (payload: { email: string; password: string; nickname?: string }) => Promise<AuthResponse>
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

type PersistedUserState = Pick<UserState, 'token' | 'user'>

export const useUserStore = create<UserState>()(
  persist<UserState, [], [], PersistedUserState>(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token: string, user: AuthUser | null = null) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
      login: async (email: string, password: string): Promise<AuthResponse> => {
        const data = await request.post<Partial<AuthResponse>>(
          '/auth/login',
          { email, password },
          { showToast: false, service: 'gateway' }
        )

        if (!data.accessToken) {
          throw new Error(data.message || '登录失败，请检查账号或服务状态')
        }

        set({ token: data.accessToken, user: data.user || null })
        return data as AuthResponse
      },
      guestLogin: async (nickname?: string): Promise<AuthResponse> => {
        const data = await request.post<Partial<AuthResponse>>(
          '/auth/guest',
          nickname ? { nickname } : undefined,
          { showToast: false, service: 'gateway' }
        )

        if (!data.accessToken) {
          throw new Error(data.message || '游客登录失败，请检查服务状态')
        }

        set({ token: data.accessToken, user: data.user || null })
        return data as AuthResponse
      },
      register: async (payload: { email: string; password: string; nickname?: string }): Promise<AuthResponse> => {
        const data = await request.post<Partial<AuthResponse>>(
          '/auth/register',
          payload,
          { showToast: false, service: 'gateway' }
        )

        if (data.accessToken) {
          set({ token: data.accessToken, user: data.user || null })
        }

        return data as AuthResponse
      },
    }),
    {
      name: 'minichat.auth',
      storage: createJSONStorage<PersistedUserState>(() => (typeof window === 'undefined' ? noopStorage : localStorage)),
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
