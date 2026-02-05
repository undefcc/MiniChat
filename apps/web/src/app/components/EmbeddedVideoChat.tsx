"use client"
import React, { useEffect, useRef } from 'react'
import { VideoChatProvider, useVideoChatContext } from '@/app/context/VideoChatContext'
import { MediaSection } from '@/app/components/MediaSection'

interface EmbeddedRoomContentProps {
  roomId: string
}

function EmbeddedRoomContent({ roomId }: EmbeddedRoomContentProps) {
  const { joinRoom, localStream } = useVideoChatContext()
  const hasJoined = useRef(false)

  useEffect(() => {
    if (roomId && !hasJoined.current) {
        console.log('[Embedded] Auto joining room:', roomId)
        hasJoined.current = true
        // 无声加入（不播放入场音效等，如果支持配置的话），确保快速连接
        joinRoom(roomId)
    }
  }, [roomId, joinRoom])

  return (
    <div className="h-full w-full flex flex-col p-4 overflow-y-auto custom-scrollbar">
       {/* 复用核心媒体区 */}
       <MediaSection />
       
       {/* 可以在这里添加迷你控制栏，如果 MediaSection 不包含控制按钮 */}
    </div>
  )
}

/**
 * 嵌入式视频通话组件
 * 作为一个独立的、自包含的视频单元，可以在 Modal、Drawer 或普通 Div 中使用
 */
export function EmbeddedVideoChat({ roomId }: { roomId: string }) {
    if (!roomId) return null
    
    return (
        <VideoChatProvider>
            {/* 适配父容器主题，移除强制暗色 */}
            <div className="h-full w-full">
                <EmbeddedRoomContent roomId={roomId} />
            </div>
        </VideoChatProvider>
    )
}
