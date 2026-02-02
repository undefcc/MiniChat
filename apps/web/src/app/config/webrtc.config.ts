/**
 * WebRTC 和应用性能配置
 * 集中管理内存、带宽等限制
 */

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

export const CLEANUP_CONFIG = {
  // 自动清理延迟（毫秒）
  hangupDelay: 1000,
  
  // 页面隐藏后自动挂断（毫秒，0 表示不自动）
  hiddenAutoHangup: 0,  // 可设置为 300000 (5分钟)
} as const
