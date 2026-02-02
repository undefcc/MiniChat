import { useEffect, useRef } from 'react'
import { MEMORY_LIMITS } from '../config/webrtc.config'

/**
 * 内存监控 Hook
 * 监控应用内存使用情况，超过阈值时发出警告
 */
export function useMemoryMonitor(options?: {
  enabled?: boolean
  warningThresholdMB?: number
  criticalThresholdMB?: number
  checkIntervalMs?: number
  onWarning?: (usage: MemoryUsage) => void
  onCritical?: (usage: MemoryUsage) => void
}) {
  const {
    enabled = true,
    warningThresholdMB = MEMORY_LIMITS.warningThreshold,
    criticalThresholdMB = MEMORY_LIMITS.criticalThreshold,
    checkIntervalMs = MEMORY_LIMITS.checkInterval,
    onWarning,
    onCritical,
  } = options || {}

  const lastWarningRef = useRef(0)
  const lastCriticalRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    // 检查浏览器是否支持 performance.memory
    if (!('memory' in performance)) {
      console.warn('⚠️ [Memory] performance.memory not supported in this browser')
      return
    }

    const checkMemory = () => {
      const memory = (performance as any).memory
      if (!memory) return

      const usedMB = memory.usedJSHeapSize / 1024 / 1024
      const totalMB = memory.totalJSHeapSize / 1024 / 1024
      const limitMB = memory.jsHeapSizeLimit / 1024 / 1024

      const usage: MemoryUsage = {
        usedMB: Math.round(usedMB),
        totalMB: Math.round(totalMB),
        limitMB: Math.round(limitMB),
        percentage: Math.round((usedMB / limitMB) * 100),
      }

      // 每5分钟输出一次内存信息（避免日志过多）
      const now = Date.now()
      if (now - lastWarningRef.current > 300000) {
        console.log(`📊 [Memory] Usage: ${usage.usedMB}MB / ${usage.limitMB}MB (${usage.percentage}%)`)
      }

      // 检查警告阈值
      if (usedMB > warningThresholdMB && now - lastWarningRef.current > 60000) {
        console.warn(`⚠️ [Memory] Warning: ${usage.usedMB}MB used (threshold: ${warningThresholdMB}MB)`)
        lastWarningRef.current = now
        onWarning?.(usage)
      }

      // 检查严重阈值
      if (usedMB > criticalThresholdMB && now - lastCriticalRef.current > 60000) {
        console.error(`🚨 [Memory] Critical: ${usage.usedMB}MB used (threshold: ${criticalThresholdMB}MB)`)
        lastCriticalRef.current = now
        onCritical?.(usage)
        
        // 建议用户刷新页面
        if (usage.percentage > 90) {
          console.error('🚨 [Memory] Memory usage > 90%, consider refreshing page')
        }
      }
    }

    // 立即检查一次
    checkMemory()

    // 定期检查
    const interval = setInterval(checkMemory, checkIntervalMs)

    return () => {
      clearInterval(interval)
    }
  }, [enabled, warningThresholdMB, criticalThresholdMB, checkIntervalMs, onWarning, onCritical])
}

interface MemoryUsage {
  usedMB: number
  totalMB: number
  limitMB: number
  percentage: number
}
