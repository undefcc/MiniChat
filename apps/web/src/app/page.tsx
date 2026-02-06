"use client"

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSocketSignaling } from './hooks/useSocketSignaling'
import { Camera, X, ShieldAlert, Download } from 'lucide-react'

export default function HomePage() {
  const [roomId, setRoomId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showCertWarning, setShowCertWarning] = useState(false)
  const router = useRouter()
  const signaling = useSocketSignaling()
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrCodeRef = useRef<any>(null)

  // 检查是否需要显示证书安装提示（仅开发环境）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:'
      const isDev = process.env.NODE_ENV === 'development'
      // 只在开发环境的 HTTPS 访问时显示证书提示
      setShowCertWarning(isHttps && isDev)
    }
  }, [])

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true)
      await signaling.connect()
      const newRoomId = await signaling.createRoom()
      router.push(`/room/${newRoomId}`)
    } catch (error: any) {
      console.error('创建房间失败:', error)
      const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
      const signalingUrl = `${isSecure ? 'https' : 'http'}://${typeof window !== 'undefined' ? window.location.hostname : ''}:3101`
      
      let errorMsg = '创建房间失败！\n\n'
      if (error.message?.includes('timeout') || error.message?.includes('connect')) {
        errorMsg += `无法连接到信令服务器。\n\n`
        if (isSecure) {
          errorMsg += `请确保：\n1. 已安装根证书\n2. iOS 用户在"证书信任设置"中启用完全信任\n3. 访问 ${signalingUrl} 并接受证书\n4. 重启浏览器/微信后重试`
        }
      } else {
        errorMsg += error.message || '未知错误'
      }
      alert(errorMsg)
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
              qrbox: 250,
            },
            (decodedText) => {
              let extractedRoomId = decodedText
              try {
                const url = new URL(decodedText)
                // 从路径中提取房间 ID，例如 /room/abc123 -> abc123
                const pathMatch = url.pathname.match(/\/room\/([^\/]+)/)
                if (pathMatch && pathMatch[1]) {
                  extractedRoomId = pathMatch[1]
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

        {/* 证书安装提示 */}
        {showCertWarning && (
          <Card className="animate-in fade-in duration-500 border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <ShieldAlert className="h-5 w-5" />
                首次访问需安装证书
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                为确保安全连接，请下载并安装根证书后使用：
              </p>
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = '/rootCA.pem'
                  link.download = 'MiniChat-RootCA.pem'
                  link.click()
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                下载根证书
              </Button>
              <div className="text-xs text-muted-foreground space-y-1 bg-background/50 p-2 rounded">
                <p className="font-semibold text-red-600 dark:text-red-400">📱 iOS/Safari/微信 必须完成以下步骤：</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li><strong>下载证书</strong>后打开文件安装</li>
                  <li>设置 → 通用 → <strong>VPN与设备管理</strong> → 点击安装的配置描述文件 → 安装</li>
                  <li className="text-red-600 dark:text-red-400 font-bold">❗ 关键步骤：设置 → 通用 → 关于本机 → <strong>证书信任设置</strong></li>
                  <li className="text-red-600 dark:text-red-400 font-bold">找到 "mkcert" 证书并<strong>启用完全信任</strong>（开关必须打开）</li>
                  <li>完成后<strong>关闭并重启浏览器/微信</strong></li>
                </ol>
                <p className="font-semibold mt-2">🤖 Android 安装步骤：</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>设置 → 安全 → 加密与凭据</li>
                  <li>从存储设备安装 → 选择下载的证书</li>
                  <li>为证书命名并确认安装</li>
                </ol>
                <p className="font-semibold mt-2 text-orange-600 dark:text-orange-400">⚠️ 重要：</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>安装证书后需要<strong>重启浏览器</strong></li>
                  <li>访问 <a href={`https://${typeof window !== 'undefined' ? window.location.hostname : ''}:3101`} target="_blank" className="underline">信令服务</a> 并接受证书</li>
                </ol>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setShowCertWarning(false)}
              >
                我已安装，不再提示
              </Button>
            </CardContent>
          </Card>
        )}

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
          {showCertWarning && (
            <a href="/check" className="text-primary underline mt-2 block">
              连接问题？点击诊断
            </a>
          )}
        </footer>
      </div>
    </div>
  )
}
