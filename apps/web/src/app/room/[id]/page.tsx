"use client"

import { useRef, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { VideoChatProvider, useVideoChatContext } from '@/app/context/VideoChatContext'
import { ControlPanel } from '@/app/components/ControlPanel'
import { MediaSection } from '@/app/components/MediaSection'
import { ConnectionStatusModal } from '@/app/components/ConnectionStatusModal'
import { request } from '@/app/utils/request'
import { Video, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

function RoomContent() {
  const { callStatus, joinRoom, remoteStream } = useVideoChatContext()
  const params = useParams()
  const router = useRouter()
  const roomId = params?.id as string
  const hasJoinedRef = useRef(false)
  const previousCallStatusRef = useRef<string>('idle')
  const [roomExists, setRoomExists] = useState<boolean | null>(null)
  const [checkingRoom, setCheckingRoom] = useState(true)

  // 验证房间是否存在
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const checkRoomExists = async () => {
      if (!roomId || cancelled) return

      attempts += 1
      try {
        // 调用后端接口检查房间是否存在
        const data = await request.get<{ exists: boolean }>( `/rooms/${roomId}/exists` )
        const exists = Boolean(data.exists)

        if (cancelled) return

        if (exists) {
          setRoomExists(true)
          setCheckingRoom(false)
        } else {
          console.error('房间不存在')
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
  }, [roomId, router])

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">正在验证房间...</p>
        </div>
      </div>
    )
  }

  // 房间不存在
  if (!roomExists) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">房间不存在</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">该房间可能已关闭或房间号有误</p>
          <p className="text-sm text-slate-500 dark:text-slate-500">即将返回首页...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-8 z-50 shadow-sm">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-800 dark:text-white">
          <div className="bg-indigo-600 dark:bg-indigo-500 rounded-lg p-1.5 shadow-lg shadow-indigo-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            MiniChat
          </span>
          <span className="text-xs align-top bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded ml-1 font-medium">PRO</span>
        </div>
        
        <div className="ml-auto flex items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            {callStatus === 'connected' && remoteStream ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">已连接</span>
              </>
            ) : callStatus === 'calling' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-amber-600 dark:text-amber-400">等待对方...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-blue-600 dark:text-blue-400">在线</span>
              </>
            )}
          </div>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
          <div className="text-slate-700 dark:text-slate-300"><span className="font-mono text-indigo-600 dark:text-indigo-400">{roomId}</span></div>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
          <ThemeToggle />
        </div>
      </header>

      {/* 主内容区 */}
      <div className="pt-24 max-w-[1600px] mx-auto grid grid-cols-12 gap-6 px-6 pb-6">
        {/* 左侧控制面板 */}
        <div className="col-span-12 lg:col-span-3 animate-in slide-in-from-left duration-500">
          <ControlPanel isInCall={true} />
        </div>
        
        {/* 右侧视频和聊天 */}
        <div className="col-span-12 lg:col-span-9 animate-in fade-in duration-500">
          <MediaSection />
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
