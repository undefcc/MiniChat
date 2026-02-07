"use client"

import React, { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUserStore } from '../store/userStore'

interface RoomInfo {
  roomId: string
  users: string[]
  createdAt: number
  userCount: number
}

interface SystemStats {
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
    cores: number
  }
  disk: {
    readPerSec: number
    writePerSec: number
    activePercent: number
  }
  uptime: number
}

interface MonitorData {
  timestamp: number
  rooms: RoomInfo[]
  stats: SystemStats
  onlineUsers: number
  roomCount: number
}

export default function AdminPage() {
  const [data, setData] = useState<MonitorData | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const token = useUserStore(s => s.token)

  useEffect(() => {
    // 连接到管理后台 WebSocket
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_SIGNALING_URL ||
      'http://localhost:3101'
    const adminSocket = io(`${socketUrl}/admin`, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    })

    adminSocket.on('connect', () => {
      console.log('[Admin] Connected to monitor')
      setConnected(true)
    })

    adminSocket.on('disconnect', () => {
      console.log('[Admin] Disconnected from monitor')
      setConnected(false)
    })

    adminSocket.on('monitor-update', (update: MonitorData) => {
      setData(update)
    })

    setSocket(adminSocket)

    return () => {
      adminSocket.disconnect()
    }
  }, [token])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN')
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">MiniChat 监控后台</h1>
            <p className="text-muted-foreground mt-1">
              实时监控房间和系统状态
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {connected ? '已连接' : '未连接'}
            </span>
          </div>
        </div>

        {data && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>在线房间</CardDescription>
                  <CardTitle className="text-3xl">{data.roomCount}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>在线用户</CardDescription>
                  <CardTitle className="text-3xl">{data.onlineUsers}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>内存使用</CardDescription>
                  <CardTitle className="text-3xl">
                    {data.stats.memory.percentage.toFixed(1)}%
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatBytes(data.stats.memory.used)} / {formatBytes(data.stats.memory.total)}
                  </p>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>CPU 使用</CardDescription>
                  <CardTitle className="text-3xl">
                    {data.stats.cpu.usage.toFixed(1)}%
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.stats.cpu.cores} 核心
                  </p>
                </CardHeader>
              </Card>
            </div>

            {/* 磁盘 I/O 卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>磁盘读取</CardDescription>
                  <CardTitle className="text-2xl">
                    {data.stats.disk.readPerSec.toFixed(1)} /s
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>磁盘写入</CardDescription>
                  <CardTitle className="text-2xl">
                    {data.stats.disk.writePerSec.toFixed(1)} /s
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>磁盘活跃度</CardDescription>
                  <CardTitle className="text-2xl">
                    {data.stats.disk.activePercent.toFixed(1)} /s
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* 系统信息 */}
            <Card>
              <CardHeader>
                <CardTitle>系统信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">运行时间</span>
                  <span className="font-mono">{formatUptime(data.stats.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最后更新</span>
                  <span className="font-mono">{formatTime(data.timestamp)}</span>
                </div>
              </CardContent>
            </Card>

            {/* 房间列表 */}
            <Card>
              <CardHeader>
                <CardTitle>活跃房间</CardTitle>
                <CardDescription>
                  共 {data.rooms.length} 个房间
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    暂无活跃房间
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.rooms.map((room) => (
                      <div
                        key={room.roomId}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">
                              {room.roomId}
                            </span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {room.userCount} 人
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            创建于 {formatTime(room.createdAt)}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>用户ID:</div>
                          {room.users.map((userId, idx) => (
                            <div key={idx} className="font-mono">{userId.slice(0, 8)}...</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!data && connected && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">正在加载监控数据...</p>
            </CardContent>
          </Card>
        )}

        {!connected && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                正在连接监控服务器...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
