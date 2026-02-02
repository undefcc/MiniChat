"use client"

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSocketSignaling } from './hooks/useSocketSignaling'
import { Camera, X } from 'lucide-react'

export default function HomePage() {
  const [roomId, setRoomId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const router = useRouter()
  const signaling = useSocketSignaling()
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrCodeRef = useRef<any>(null)

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true)
      await signaling.connect()
      const newRoomId = await signaling.createRoom()
      router.push(`/room/${newRoomId}`)
    } catch (error) {
      console.error('创建房间失败:', error)
      alert('创建房间失败，请重试')
      signaling.disconnect()
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      alert('请输入房间号')
      return
    }
    router.push(`/room/${roomId}`)
  }

  // 启动扫码
  const startScanner = async () => {
    setShowScanner(true)

    try {
      // 先请求摄像头权限，避免启动扫码时直接失败
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      permissionStream.getTracks().forEach(track => track.stop())

      const { Html5Qrcode } = await import('html5-qrcode')

      setTimeout(async () => {
        if (!scannerRef.current) return
        
        try {
          const html5QrCode = new Html5Qrcode('qr-reader-home')
          html5QrCodeRef.current = html5QrCode
          
          await html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
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
              
              stopScanner()
              router.push(`/room/${extractedRoomId}`)
            },
            () => {}
          )
        } catch (err) {
          console.error('Failed to start scanner:', err)
          alert('无法启动摄像头，请检查权限设置')
          setShowScanner(false)
        }
      }, 100)
    } catch (err) {
      console.error('Failed to request camera permission:', err)
      alert('无法获取摄像头权限，请检查浏览器权限设置')
      setShowScanner(false)
    }
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">扫描二维码加入房间</h2>
            <Button size="icon" variant="ghost" onClick={stopScanner}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div 
            id="qr-reader-home" 
            ref={scannerRef}
            className="w-full aspect-square rounded-lg overflow-hidden bg-muted"
          />
          <p className="text-xs text-muted-foreground text-center">
            将二维码对准框内即可自动识别
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* 头部 */}
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
            MiniChat
          </h1>
          <p className="text-muted-foreground">
            🎥 WebRTC 点对点视频通话平台
          </p>
        </div>

        {/* 创建房间 */}
        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle>创建房间</CardTitle>
            <CardDescription>创建一个新的视频聊天房间</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleCreateRoom}
              className="w-full"
              size="lg"
              disabled={isCreating}
            >
              {isCreating ? '创建中...' : '创建新房间'}
            </Button>
          </CardContent>
        </Card>

        {/* 加入房间 */}
        <Card className="animate-in fade-in duration-500 delay-100">
          <CardHeader>
            <CardTitle>加入房间</CardTitle>
            <CardDescription>输入房间号或扫码加入</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="请输入房间号"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <Button 
              onClick={handleJoinRoom}
              className="w-full"
              variant="outline"
              size="lg"
            >
              加入房间
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={startScanner}
            >
              <Camera className="mr-2 h-4 w-4" />
              扫码加入
            </Button>
          </CardContent>
        </Card>

        {/* 页脚 */}
        <footer className="text-center text-sm text-muted-foreground animate-in fade-in duration-500 delay-200">
          <p>基于 WebRTC + Socket.IO + NestJS 构建</p>
        </footer>
      </div>
    </div>
  )
}
