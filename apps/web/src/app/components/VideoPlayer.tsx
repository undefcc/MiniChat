import React, { useEffect } from 'react'
import { VideoOff } from 'lucide-react'

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  title: string
  muted?: boolean
  placeholder?: string
  isPrimary?: boolean
}

export function VideoPlayer({ 
  videoRef, 
  stream, 
  title, 
  muted = false, 
  placeholder = '等待连接...', 
  isPrimary = false 
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
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm ring-1 ring-slate-100 dark:ring-slate-700">
      {/* 视频标题栏 */}
      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-200">{title}</span>
          {stream && (
            <div className="flex items-center gap-1.5">
              {hasVideo && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">VIDEO</span>}
              {hasAudio && <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">AUDIO</span>}
            </div>
          )}
        </div>
        {isPrimary && stream && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            LIVE
          </span>
        )}
      </div>

      {/* 视频内容区 */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-contain"
        />
        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 dark:bg-black text-slate-300 dark:text-slate-600">
            <VideoOff className="w-12 h-12 mb-3 text-slate-500 dark:text-slate-700" />
            <p className="text-sm font-medium">{placeholder}</p>
          </div>
        )}

        {/* 叠加层 - 状态指示 */}
        {stream && (
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white/90 px-2.5 py-1 rounded-md text-xs font-mono font-medium border border-white/10">
            {hasVideo ? `${stream.getVideoTracks()[0]?.label || 'Camera'}` : 'Audio Only'}
          </div>
        )}
      </div>
    </div>
  )
}
