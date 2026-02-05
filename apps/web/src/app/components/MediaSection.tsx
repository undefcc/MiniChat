import React from 'react'
import { useVideoChatContext } from '../context/VideoChatContext'
import { ChatPanel } from './ChatPanel'
import { VideoPlayer } from './VideoPlayer'
import { QualityControls } from './QualityControls'

export function MediaSection() {
  const { 
    localVideoRef, 
    remoteVideoRef, 
    localStream, 
    remoteStream 
  } = useVideoChatContext()

  return (
    <div className="space-y-4">
      {/* 视频区域 - 并排显示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 远程视频 */}
        <div className="relative">
          <VideoPlayer
            videoRef={remoteVideoRef}
            stream={remoteStream}
            title="远程视频"
          />
          <QualityControls />
        </div>

        {/* 本地视频 */}
        <VideoPlayer
          videoRef={localVideoRef}
          stream={localStream}
          title="本地视频"
          muted
          placeholder="未开启摄像头"
        />
      </div>

      {/* 消息聊天区 */}
      <ChatPanel />
    </div>
  )
}
