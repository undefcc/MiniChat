import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { resolveServiceBaseUrl } from './endpoints'
import { useUiStore } from '../store/uiStore'
import { useUserStore } from '../store/userStore'

export type ApiService = 'gateway' | 'signaling'

export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export type RequestOptions = AxiosRequestConfig & {
  service?: ApiService
  showToast?: boolean
}

const client = axios.create({
  timeout: 15000,
})

const getErrorMessage = (data: unknown, status?: number, fallback?: string) => {
  if (data && typeof data === 'object' && 'message' in data) {
    const messageValue = (data as { message?: unknown }).message
    if (typeof messageValue === 'string' && messageValue.trim()) {
      return messageValue
    }
  }

  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (fallback && fallback.trim()) {
    return fallback
  }

  return `请求失败${status ? ` (${status})` : ''}`
}

const createDeferred = <T>() => {
  let resolve: (value: T) => void
  let reject: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve: resolve!, reject: reject! }
}

const handleError = <T>(error: AxiosError, options: RequestOptions | undefined, retry: () => Promise<T>): Promise<T> => {
  const status = error.response?.status ?? 0
  const data = error.response?.data
  const message = getErrorMessage(data, status, error.message)

  if (status === 401) {
    const deferred = createDeferred<T>()
    useUiStore.getState().setAuthResume(
      () => retry().then(deferred.resolve).catch(deferred.reject),
      deferred.reject
    )
    useUserStore.getState().clearAuth()
    useUiStore.getState().invalidateAuth()
    useUiStore.getState().openLogin(() => useUiStore.getState().runAuthResume())
    return deferred.promise
  } else if (options?.showToast !== false) {
    useUiStore.getState().showToast(message, 'error')
  }

  throw new ApiError(message, status, data)
}

const buildAuthHeaders = (): AxiosRequestConfig['headers'] => {
  const token = useUserStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

const withDefaults = (options: RequestOptions = {}): RequestOptions & { baseURL: string } => {
  const { service = 'signaling', showToast, headers, ...rest } = options
  const baseURL = resolveServiceBaseUrl(service)
  const authHeaders = buildAuthHeaders()
  return {
    baseURL,
    showToast,
    headers: {
      ...(authHeaders || {}),
      ...(headers || {}),
    },
    ...rest,
  }
}

const requestCore = async <T>(
  config: RequestOptions & { url: string; method: AxiosRequestConfig['method'] }
): Promise<T> => {
  const merged = withDefaults(config)
  const { showToast, ...axiosConfig } = merged

  try {
    const response = await client.request<T>({
      ...axiosConfig,
      url: config.url,
      method: config.method,
    })
    return response.data
  } catch (err) {
    return handleError<T>(err as AxiosError, merged, () => requestCore<T>(config))
  }
}

export const request = {
  get: <T>(url: string, options?: RequestOptions) =>
    requestCore<T>({ url, method: 'GET', ...options }),
  post: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    requestCore<T>({ url, method: 'POST', data, ...options }),
  put: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    requestCore<T>({ url, method: 'PUT', data, ...options }),
  patch: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    requestCore<T>({ url, method: 'PATCH', data, ...options }),
  delete: <T>(url: string, options?: RequestOptions) =>
    requestCore<T>({ url, method: 'DELETE', ...options }),
}

