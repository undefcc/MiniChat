import React, { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { useVideoChatContext } from '../context/VideoChatContext'

interface MessageListProps {
  messages: Array<{ text: string; isSelf: boolean; time: string }>
  containerRef: React.RefObject<HTMLDivElement>
}

function MessageList({ messages, containerRef }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        暂无消息
      </p>
    )
  }

  return (
    <>
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] rounded-lg px-3 py-2 ${
              msg.isSelf
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
          >
            <p className="text-sm break-words">{msg.text}</p>
            <p className="text-xs opacity-70 mt-1">{msg.time}</p>
          </div>
        </div>
      ))}
    </>
  )
}

export function ChatPanel() {
  const { dataChannel, messages, messagesContainerRef, sendMessage } = useVideoChatContext()
  const [messageInput, setMessageInput] = useState('')

  const handleSendMessage = () => {
    if (sendMessage(messageInput)) {
      setMessageInput('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">消息</CardTitle>
        <CardDescription>
          {dataChannel?.readyState === 'open' ? '✓ 数据通道已连接' : '等待数据通道连接...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 消息列表 */}
        <div 
          ref={messagesContainerRef}
          className="h-48 overflow-y-auto border rounded-lg p-3 space-y-2 bg-muted/30"
        >
          <MessageList messages={messages} containerRef={messagesContainerRef} />
        </div>

        {/* 发送消息 */}
        <div className="flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="输入消息..."
            disabled={!dataChannel || dataChannel.readyState !== 'open'}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !dataChannel || dataChannel.readyState !== 'open'}
          >
            发送
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
