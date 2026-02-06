"use client"
import { useState, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'

/**
 * 测量与 Socket.IO 服务器的延迟（往返时间）
 * 自动轮询等待 socket 连接，连接后每 3 秒发送一次 ping
 */
export function useLatency() {
  const [latency, setLatency] = useState<number>(0)
  const mountedRef = useRef(true)

  const startMeasuring = useCallback((getSocket: () => Socket | null) => {
    const measure = () => {
      const socket = getSocket()
      if (!socket?.connected) {
        // socket 未连接，100ms 后重试
        if (mountedRef.current) {
          setTimeout(measure, 100)
        }
        return
      }

      // socket 已连接，发送 ping
      const startTime = Date.now()
      socket.emit('ping', {}, () => {
        if (mountedRef.current) {
          const latencyMs = Date.now() - startTime
          setLatency(latencyMs)
        }
      })
    }

    // 立即开始轮询
    measure()

    // 连接后，每 3 秒 ping 一次
    const interval = setInterval(() => {
      const socket = getSocket()
      if (socket?.connected) {
        const startTime = Date.now()
        socket.emit('ping', {}, () => {
          if (mountedRef.current) {
            setLatency(Date.now() - startTime)
          }
        })
      }
    }, 3000)

    // 返回清理函数
    return () => {
      clearInterval(interval)
    }
  }, [])

  // 在 unmount 时标记
  const cleanup = useCallback(() => {
    mountedRef.current = false
  }, [])

  return { latency, startMeasuring, cleanup }
}
