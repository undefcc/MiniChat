"use client"

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { VideoChatProvider, useVideoChatContext } from '@/app/context/VideoChatContext'
import { ControlPanel } from '@/app/components/ControlPanel'
import { MediaSection } from '@/app/components/MediaSection'
import { ConnectionStatusModal } from '@/app/components/ConnectionStatusModal'
import { useSocketSignaling } from '@/app/hooks/useSocketSignaling'

function RoomContent() {
  const { callStatus, joinRoom } = useVideoChatContext()
  const params = useParams()
  const router = useRouter()
  const signaling = useSocketSignaling()
  const roomId = params?.id as string
  const hasJoinedRef = React.useRef(false)
  const previousCallStatusRef = React.useRef<string>('idle')
  const [roomExists, setRoomExists] = React.useState<boolean | null>(null)
  const [checkingRoom, setCheckingRoom] = React.useState(true)

  // 验证房间是否存在
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const checkRoomExists = async () => {
      if (!roomId || cancelled) return

      attempts += 1
      try {
        await signaling.connect()

        // 调用后端接口检查房间是否存在
        const exists = await signaling.checkRoom(roomId)

        if (cancelled) return

        if (exists) {
          setRoomExists(true)
          setCheckingRoom(false)
        } else {
          console.error('房间不存在')
          signaling.disconnect()
          setRoomExists(false)
          setCheckingRoom(false)
          // 3 秒后重定向回首页
          setTimeout(() => {
            router.push('/')
          }, 3000)
        }
      } catch (err) {
        if (cancelled) return

        // 连接失败不直接判定房间不存在，尝试重试
        if (attempts < 3) {
          setTimeout(checkRoomExists, 1500)
          return
        }

        console.error('检查房间时出错:', err)
        signaling.disconnect()
        setRoomExists(false)
        setCheckingRoom(false)
        setTimeout(() => {
          router.push('/')
        }, 3000)
      }
    }

    checkRoomExists()
    return () => {
      cancelled = true
    }
  }, [roomId, router, signaling])

  // 页面加载时自动加入房间
  useEffect(() => {
    if (!roomId || callStatus !== 'idle' || hasJoinedRef.current || !roomExists) return

    hasJoinedRef.current = true
    joinRoom(roomId, { silent: true })
  }, [roomId, callStatus, joinRoom, roomExists])

  // 挂断后自动跳转回首页
  useEffect(() => {
    const wasInCall = previousCallStatusRef.current !== 'idle'
    const nowIdle = callStatus === 'idle'
    
    previousCallStatusRef.current = callStatus
    
    if (wasInCall && nowIdle) {
      console.log('🚪 [Room] Call ended, redirecting to home...')
      const timer = setTimeout(() => {
        router.push('/')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [callStatus, router])

  // 房间检查中
  if (checkingRoom) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在验证房间...</p>
        </div>
      </div>
    )
  }

  // 房间不存在
  if (!roomExists) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">房间不存在</h2>
          <p className="text-muted-foreground mb-4">该房间可能已关闭或房间号有误</p>
          <p className="text-sm text-muted-foreground">即将返回首页...</p>
        </div>
      </div>
    )
  }

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

      <ConnectionStatusModal />
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
