type ApiService = 'gateway' | 'signaling'

type ResolveOptions = {
  forceProtocol?: 'http' | 'https'
}

const resolveBaseUrl = (envKey: string, fallbackPort: number, options?: ResolveOptions) => {
  const envUrl = process.env[envKey]
  if (envUrl) {
    return envUrl
  }

  if (typeof window === 'undefined') {
    return ''
  }

  const protocol = options?.forceProtocol ? `${options.forceProtocol}:` : window.location.protocol
  const hostname = window.location.hostname
  return `${protocol}//${hostname}:${fallbackPort}`
}

export const resolveGatewayUrl = (options?: ResolveOptions) =>
  resolveBaseUrl('NEXT_PUBLIC_GATEWAY_URL', 4000, options)

export const resolveSignalingUrl = (options?: ResolveOptions) =>
  resolveBaseUrl('NEXT_PUBLIC_SIGNALING_URL', 3101, options)

export const resolveServiceBaseUrl = (service: ApiService, options?: ResolveOptions) =>
  service === 'signaling' ? resolveSignalingUrl(options) : resolveGatewayUrl(options)
