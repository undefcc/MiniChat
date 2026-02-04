import React, { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Phone, Copy, Check, QrCode } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Separator } from '../../components/ui/separator'
import { useVideoChatContext } from '../context/VideoChatContext'
import { QRCodeSVG } from 'qrcode.react'

export function RoomControls() {
  const { roomId, callStatus, createRoom, joinRoom } = useVideoChatContext()
  const [isCopied, setIsCopied] = useState(false)
  const [joinRoomId, setJoinRoomId] = useState('')
  const [showQR, setShowQR] = useState(false)

  // 生成加入房间的 URL
  const getRoomUrl = () => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/room/${roomId}`
  }

  const copyRoomId = async () => {
    if (roomId) {
      await navigator.clipboard.writeText(roomId)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleJoinRoom = () => {
    if (joinRoomId.trim()) {
      joinRoom(joinRoomId.trim())
    }
  }

  // 扫码界面
  if (callStatus === 'idle') {
    return (
      <>
        <Button 
          onClick={createRoom} 
          className="w-full"
          size="lg"
        >
          <Phone className="mr-2 h-4 w-4" />
          创建房间
        </Button>
        
        <Separator />
        
        <div className="space-y-2">
          <label className="text-sm font-medium">加入房间</label>
          <div className="flex gap-2">
            <Input
              placeholder="输入房间 ID"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <Button 
              onClick={handleJoinRoom}
              disabled={!joinRoomId}
            >
              加入
            </Button>
          </div>
        </div>
      </>
    )
  }

  if (callStatus === 'calling' && roomId) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-medium">房间 ID</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-background rounded text-sm">
              {roomId}
            </code>
            <Button
              size="icon"
              variant="outline"
              onClick={copyRoomId}
            >
              {isCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setShowQR(!showQR)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </div>
          
          {/* 二维码显示 */}
          {showQR && (
            <div className="flex flex-col items-center py-4 space-y-2">
              <div className="p-3 bg-white rounded-lg">
                <QRCodeSVG 
                  value={getRoomUrl()} 
                  size={160}
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                扫码加入房间
              </p>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            分享此 ID 或二维码给对方以加入通话
          </p>
        </div>
        
        <div className="flex items-center justify-center py-4">
          <div className="animate-pulse text-center">
            <Phone className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm">等待对方加入...</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
