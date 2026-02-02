"use client"

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { VideoChatProvider, useVideoChatContext } from '@/app/context/VideoChatContext'
import { ControlPanel } from '@/app/components/ControlPanel'
import { MediaSection } from '@/app/components/MediaSection'

function RoomContent() {
  const { callStatus, joinRoom } = useVideoChatContext()
  const params = useParams()
  const router = useRouter()
  const roomId = params?.id as string
  const hasJoinedRef = React.useRef(false)
  const previousCallStatusRef = React.useRef<string>('idle')

  // 页面加载时自动加入房间（创建者和加入者都调用 joinRoom）
  useEffect(() => {
    if (!roomId || callStatus !== 'idle' || hasJoinedRef.current) return

    hasJoinedRef.current = true
    joinRoom(roomId, { silent: true })
  }, [roomId, callStatus, joinRoom])

  // 挂断后自动跳转回首页
  useEffect(() => {
    const wasInCall = previousCallStatusRef.current !== 'idle'
    const nowIdle = callStatus === 'idle'
    
    // 更新状态记录
    previousCallStatusRef.current = callStatus
    
    // 只在"从通话中回到 idle"时跳转（不是初始加载时）
    if (wasInCall && nowIdle) {
      console.log('🚪 [Room] Call ended, redirecting to home...')
      const timer = setTimeout(() => {
        router.push('/')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [callStatus, router])

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
              🎥 房间: {roomId}
            </p>
          </div>
        </header>

        {/* 通话界面 */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          {/* 左侧控制面板 */}
          <div className="animate-in slide-in-from-left duration-500">
            <ControlPanel isInCall={true} />
          </div>
          
          {/* 右侧视频和聊天 */}
          <div className="animate-in fade-in duration-500">
            <MediaSection />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RoomPage() {
  return (
    <VideoChatProvider>
      <RoomContent />
    </VideoChatProvider>
  )
}
