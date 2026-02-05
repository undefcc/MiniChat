import React, { useState } from 'react'
import { Settings, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "../../components/ui/button"
import { useVideoChatContext } from '../context/VideoChatContext'
import { VideoQualityProfile, VIDEO_QUALITY_PROFILES } from '../config/webrtc.config'

export function QualityControls() {
  const { requestRemoteVideoQuality, isConnected } = useVideoChatContext()
  const [currentQuality, setCurrentQuality] = useState<VideoQualityProfile>('standard')

  const handleQualityChange = (quality: VideoQualityProfile) => {
    setCurrentQuality(quality)
    requestRemoteVideoQuality(quality)
  }

  if (!isConnected) return null

  return (
    <div className="absolute top-4 right-4 z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleQualityChange('high')} className="justify-between">
            <span>高清 (720p 30fps)</span>
            {currentQuality === 'high' && <Check className="h-4 w-4 ml-2" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQualityChange('standard')} className="justify-between">
            <span>标准 (480p 24fps)</span>
            {currentQuality === 'standard' && <Check className="h-4 w-4 ml-2" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQualityChange('low')} className="justify-between">
            <span>省流 (240p 15fps)</span>
            {currentQuality === 'low' && <Check className="h-4 w-4 ml-2" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
