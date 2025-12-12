import React, { useState, useEffect, useRef } from 'react'
import { Button } from '../../components/ui/button'
import { Phone, Copy, Check, QrCode, Camera, X } from 'lucide-react'
import { Input } from '../../components/ui/input'
import { Separator } from '../../components/ui/separator'
import { useVideoChatContext } from '../context/VideoChatContext'
import { QRCodeSVG } from 'qrcode.react'

export function RoomControls() {
  const { roomId, callStatus, createRoom, joinRoom } = useVideoChatContext()
  const [isCopied, setIsCopied] = useState(false)
  const [joinRoomId, setJoinRoomId] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrCodeRef = useRef<any>(null)

  // 生成加入房间的 URL
  const getRoomUrl = () => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/?room=${roomId}`
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

  // 启动扫码
  const startScanner = async () => {
    setShowScanner(true)
    
    // 动态导入 html5-qrcode
    const { Html5Qrcode } = await import('html5-qrcode')
    
    // 等待 DOM 渲染
    setTimeout(async () => {
      if (!scannerRef.current) return
      
      try {
        const html5QrCode = new Html5Qrcode('qr-reader')
        html5QrCodeRef.current = html5QrCode
        
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // 解析 URL 或房间 ID
            let extractedRoomId = decodedText
            try {
              const url = new URL(decodedText)
              const roomParam = url.searchParams.get('room')
              if (roomParam) {
                extractedRoomId = roomParam
              }
            } catch {
              // 不是 URL，直接使用作为房间 ID
            }
            
            // 停止扫描并加入房间
            stopScanner()
            joinRoom(extractedRoomId)
          },
          () => {} // 忽略扫描错误
        )
      } catch (err) {
        console.error('Failed to start scanner:', err)
        alert('无法启动摄像头，请检查权限设置')
        setShowScanner(false)
      }
    }, 100)
  }

  // 停止扫码
  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {})
      html5QrCodeRef.current = null
    }
    setShowScanner(false)
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  // 扫码界面
  if (showScanner) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">扫描二维码加入房间</p>
          <Button size="icon" variant="ghost" onClick={stopScanner}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div 
          id="qr-reader" 
          ref={scannerRef}
          className="w-full aspect-square rounded-lg overflow-hidden bg-muted"
        />
        <p className="text-xs text-muted-foreground text-center">
          将二维码对准框内即可自动识别
        </p>
      </div>
    )
  }

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
          <Button 
            variant="outline" 
            className="w-full"
            onClick={startScanner}
          >
            <Camera className="mr-2 h-4 w-4" />
            扫码加入
          </Button>
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
