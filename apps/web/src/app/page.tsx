"use client"

import React, { useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { VideoChatProvider, useVideoChatContext } from './context/VideoChatContext'
import { ControlPanel } from './components/ControlPanel'
import { MediaSection } from './components/MediaSection'

function VideoChatContent() {
  const { callStatus, joinRoom } = useVideoChatContext()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isInCall = callStatus !== 'idle'
  const hasAttemptedJoinRef = useRef(false) // 防止重复加入
  const previousCallStatusRef = useRef<string>('idle') // 跟踪之前的通话状态

  // 检查 URL 参数，自动加入房间
  useEffect(() => {
    const roomParam = searchParams?.get('room')
    if (roomParam && callStatus === 'idle' && !hasAttemptedJoinRef.current) {
      // 标记已尝试加入，防止挂断后重复加入
      hasAttemptedJoinRef.current = true
      
      // 延迟一点执行，确保组件完全初始化
      const timer = setTimeout(() => {
        // 自动加入时使用静默模式，避免挂断后重复提示
        joinRoom(roomParam, { silent: true })
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, callStatus, joinRoom])
  
  // 挂断后清除 URL 参数（只在从通话状态变回 idle 时清除）
  useEffect(() => {
    const wasInCall = previousCallStatusRef.current !== 'idle'
    const nowIdle = callStatus === 'idle'
    
    // 更新状态记录
    previousCallStatusRef.current = callStatus
    
    // 只在"从通话中回到 idle"的场景下清除 URL
    if (wasInCall && nowIdle && searchParams?.get('room')) {
      // 清除 URL 中的 room 参数
      router.replace('/', { scroll: false })
      // 重置标记，允许下次手动加入
      hasAttemptedJoinRef.current = false
    }
  }, [callStatus, searchParams, router])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* 头部 */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-1">
              MiniChat
            </h1>
            <p className="text-sm text-muted-foreground">
              🎥 WebRTC 点对点视频通话平台
            </p>
          </div>
        </header>

        {/* 主体内容 */}
        {isInCall ? (
          /* 通话中：左侧控制面板 + 右侧视频聊天 */
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            {/* 左侧控制面板 */}
            <div className="animate-in slide-in-from-left duration-500">
              <ControlPanel isInCall={isInCall} />
            </div>
            
            {/* 右侧视频和聊天 */}
            <div className="animate-in fade-in duration-500">
              <MediaSection />
            </div>
          </div>
        ) : (
          /* 未创建房间：居中显示控制面板 */
          <div className="max-w-md mx-auto space-y-6">
            <div className="animate-in slide-in-from-bottom duration-500">
              <ControlPanel isInCall={isInCall} />
            </div>
            
            <footer className="text-center text-sm text-muted-foreground">
              <p>基于 WebRTC + Socket.IO + NestJS 构建</p>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VideoChat() {
  return (
    <VideoChatProvider>
      <VideoChatContent />
    </VideoChatProvider>
  )
}
