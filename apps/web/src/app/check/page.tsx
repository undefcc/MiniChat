"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function CheckPage() {
  const [checks, setChecks] = useState({
    https: false,
    signalingReachable: false,
    socketConnect: false,
  })
  const [loading, setLoading] = useState(true)
  const [signalingUrl, setSignalingUrl] = useState('')

  useEffect(() => {
    runChecks()
  }, [])

  const runChecks = async () => {
    setLoading(true)
    const isHttps = window.location.protocol === 'https:'
    const hostname = window.location.hostname
    const url = `${isHttps ? 'https' : 'http'}://${hostname}:3101`
    setSignalingUrl(url)

    const newChecks = {
      https: isHttps,
      signalingReachable: false,
      socketConnect: false,
    }

    // 检查信令服务是否可达
    try {
      const response = await fetch(`${url}/socket.io/`, { 
        method: 'GET',
        mode: 'no-cors',
      })
      newChecks.signalingReachable = true
    } catch (err) {
      console.error('信令服务不可达:', err)
    }

    // 检查 Socket.IO 连接
    try {
      const { io } = await import('socket.io-client')
      const socket = io(url, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        secure: isHttps,
        rejectUnauthorized: false,
        timeout: 5000,
      })

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect()
          reject(new Error('连接超时'))
        }, 5000)

        socket.on('connect', () => {
          clearTimeout(timeout)
          newChecks.socketConnect = true
          socket.disconnect()
          resolve(true)
        })

        socket.on('connect_error', (err) => {
          clearTimeout(timeout)
          socket.disconnect()
          reject(err)
        })
      })
    } catch (err) {
      console.error('Socket 连接失败:', err)
    }

    setChecks(newChecks)
    setLoading(false)
  }

  const CheckItem = ({ label, status }: { label: string; status: boolean | null }) => (
    <div className="flex items-center justify-between py-2">
      <span>{label}</span>
      {status === null ? (
        <AlertCircle className="h-5 w-5 text-yellow-500" />
      ) : status ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500" />
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>连接诊断</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <CheckItem label="HTTPS 连接" status={checks.https} />
            <CheckItem 
              label="信令服务可达" 
              status={loading ? null : checks.signalingReachable} 
            />
            <CheckItem 
              label="Socket.IO 连接" 
              status={loading ? null : checks.socketConnect} 
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>信令地址:</strong> {signalingUrl}</p>
            {!checks.https && (
              <p className="text-yellow-600">⚠️ 当前使用 HTTP，建议使用 HTTPS</p>
            )}
            {checks.https && !checks.socketConnect && (
              <div className="text-red-600 space-y-1">
                <p>❌ Socket 连接失败，可能原因：</p>
                <ol className="list-decimal list-inside ml-2 text-xs">
                  <li>证书未安装或未启用完全信任</li>
                  <li>需要先访问 <a href={signalingUrl} target="_blank" className="underline">{signalingUrl}</a> 接受证书</li>
                  <li>浏览器/微信未重启</li>
                </ol>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={runChecks} disabled={loading} className="flex-1">
              {loading ? '检测中...' : '重新检测'}
            </Button>
            <Button onClick={() => window.location.href = '/'} variant="outline" className="flex-1">
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
