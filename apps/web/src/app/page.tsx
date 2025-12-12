"use client"

import React, { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { VideoChatProvider, useVideoChatContext } from './context/VideoChatContext'
import { ControlPanel } from './components/ControlPanel'
import { MediaSection } from './components/MediaSection'

function VideoChatContent() {
  const { callStatus, joinRoom } = useVideoChatContext()
  const searchParams = useSearchParams()
  const isInCall = callStatus !== 'idle'

  // 检查 URL 参数，自动加入房间
  useEffect(() => {
    const roomParam = searchParams?.get('room')
    if (roomParam && callStatus === 'idle') {
      // 延迟一点执行，确保组件完全初始化
      const timer = setTimeout(() => {
        joinRoom(roomParam)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, callStatus, joinRoom])

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
