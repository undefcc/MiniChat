import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  title: string
  muted?: boolean
  placeholder?: string
}

export function VideoPlayer({ 
  videoRef, 
  stream, 
  title, 
  muted = false, 
  placeholder = '等待连接...' 
}: VideoPlayerProps) {
  // 当 stream 变化或组件挂载时，自动设置 video.srcObject
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    console.log(`🎬 [VideoPlayer] ${title} - Stream update:`, {
      hasStream: !!stream,
      tracks: stream?.getTracks().map(t => `${t.kind}:${t.readyState}`) || [],
      active: stream?.active
    })

    if (stream && stream.getTracks().length > 0) {
      videoElement.srcObject = stream
      
      // 确保视频播放
      videoElement.play().catch(err => {
        console.warn(`⚠️ [VideoPlayer] ${title} - Auto-play failed:`, err)
      })
    } else {
      videoElement.srcObject = null
    }
  }, [videoRef, stream, title])

  const hasVideo = stream?.getVideoTracks().some(t => t.readyState === 'live')
  const hasAudio = stream?.getAudioTracks().some(t => t.readyState === 'live')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {title}
          {stream && (
            <span className="ml-2 text-xs text-muted-foreground">
              {hasVideo && '📹'} {hasAudio && '🎤'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className="w-full h-full object-cover"
          />
          {!stream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">{placeholder}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
