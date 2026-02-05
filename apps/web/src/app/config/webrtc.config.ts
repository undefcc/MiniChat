/**
 * WebRTC 和应用性能配置
 * 集中管理内存、带宽、ICE 服务器等设置
 */

// ICE 服务器配置（从环境变量读取，Next.js 构建时内联）
export const getIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    // STUN 服务器（免费公共服务，用于获取公网 IP）
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  // TURN 服务器配置（从环境变量读取，用于 NAT 穿透失败时的中继）
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL

  if (turnUsername && turnCredential) {
    servers.push(
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: turnUsername,
        credential: turnCredential,
      }
    )
  }

  return servers
}

export const MEDIA_CONSTRAINTS = {
  // 视频约束（内存优化）
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 24, max: 30 },  // 降低帧率节省带宽和CPU
    facingMode: 'user',                 // 前置摄像头
  },
  
  // 音频约束
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },         // 单声道节省带宽
  },
} as const

export const RTC_CONFIGURATION = {
  // ICE 候选缓冲（内存优化）
  iceCandidatePoolSize: 5,              // 减少预收集候选数量
  
  // 带宽和传输优化
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,   // 多路复用减少端口
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,    // RTCP 和 RTP 同端口
  
  // ICE 传输策略
  iceTransportPolicy: 'all' as RTCIceTransportPolicy,
} as const

export const MEMORY_LIMITS = {
  // 内存警告阈值（MB）
  warningThreshold: 200,
  
  // 内存严重阈值（MB）
  criticalThreshold: 400,
  
  // 自动清理阈值（百分比）
  autoCleanupPercentage: 95,
  
  // 检查间隔（毫秒）
  checkInterval: 30000,
} as const

export const STREAM_LIMITS = {
  // 最大同时连接数
  maxPeers: 1,  // 目前只支持 1v1
  
  // 连接超时（毫秒）
  connectionTimeout: 30000,
  
  // ICE 收集超时（毫秒）
  iceGatheringTimeout: 5000,
} as const

export const VIDEO_QUALITY_PROFILES = {
  high: { 
    width: { ideal: 1280, max: 1920 }, 
    height: { ideal: 720, max: 1080 }, 
    frameRate: { ideal: 30, max: 30 } 
  },
  standard: { 
    width: { ideal: 640, max: 800 }, 
    height: { ideal: 480, max: 600 }, 
    frameRate: { ideal: 24, max: 30 } 
  },
  low: { 
    width: { ideal: 320, max: 480 }, 
    height: { ideal: 240, max: 360 }, 
    frameRate: { ideal: 15, max: 15 } 
  },
} as const

export type VideoQualityProfile = keyof typeof VIDEO_QUALITY_PROFILES

export const CLEANUP_CONFIG = {
  // 自动清理延迟（毫秒）
  hangupDelay: 1000,
  
  // 页面隐藏后自动挂断（毫秒，0 表示不自动）
  hiddenAutoHangup: 0,  // 可设置为 300000 (5分钟)
} as const
