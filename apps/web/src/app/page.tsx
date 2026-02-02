"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSocketSignaling } from './hooks/useSocketSignaling'

export default function HomePage() {
  const [roomId, setRoomId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  const signaling = useSocketSignaling()

  const handleCreateRoom = async () => {
    try {
      setIsCreating(true)
      // 连接 Socket 并调用后端创建房间
      await signaling.connect()
      const newRoomId = await signaling.createRoom()
      // 不要断开连接！房间页面会复用这个连接
      // 跳转到房间页面
      router.push(`/room/${newRoomId}`)
    } catch (error) {
      console.error('创建房间失败:', error)
      alert('创建房间失败，请重试')
      signaling.disconnect() // 只有出错时才断开
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
            <CardDescription>输入房间号加入现有房间</CardDescription>
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
