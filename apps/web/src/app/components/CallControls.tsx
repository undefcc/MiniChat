import React from 'react'
import { Button } from '../../components/ui/button'
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'
import { Separator } from '../../components/ui/separator'
import { useVideoChatContext } from '../context/VideoChatContext'

export function CallControls() {
  const { 
    callStatus, 
    isVideoEnabled, 
    isAudioEnabled, 
    isConnected,
    toggleVideo, 
    toggleAudio, 
    hangUp 
  } = useVideoChatContext()

  if (callStatus === 'idle') return null

  return (
    <>
      <Separator />
      
      <div className="space-y-2">
        {/* <p className="text-sm font-medium mb-3">通话控制</p> */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={isVideoEnabled ? "default" : "destructive"}
            onClick={toggleVideo}
            className="w-full"
          >
            {isVideoEnabled ? (
              <Video className="h-4 w-4" />
            ) : (
              <VideoOff className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant={isAudioEnabled ? "default" : "destructive"}
            onClick={toggleAudio}
            className="w-full"
          >
            {isAudioEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          variant="destructive"
          onClick={hangUp}
          className="w-full"
        >
          <PhoneOff className="mr-2 h-4 w-4" />
          挂断
        </Button>
      </div>

      {isConnected && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400 text-center">
            ✓ 已连接
          </p>
        </div>
      )}
    </>
  )
}
