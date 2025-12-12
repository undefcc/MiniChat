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
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [videoRef, stream])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
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
