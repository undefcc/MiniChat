import React, { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { useVideoChatContext } from '../context/VideoChatContext'
import { MessageCircle, Send } from 'lucide-react'

interface MessageListProps {
  messages: Array<{ text: string; isSelf: boolean; time: string }>
  containerRef: React.RefObject<HTMLDivElement>
}

function MessageList({ messages, containerRef }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600">
        <MessageCircle className="w-12 h-12 mb-2 text-slate-300 dark:text-slate-700" />
        <p className="text-sm font-medium">暂无最新消息</p>
        <p className="text-xs">开始聊天吧~</p>
      </div>
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
            className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
              msg.isSelf
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100'
            }`}
          >
            <p className="text-sm break-words">{msg.text}</p>
            <p className={`text-xs mt-1 ${msg.isSelf ? 'text-indigo-200 dark:text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
              {msg.time}
            </p>
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

  const isConnected = dataChannel?.readyState === 'open'

  return (
    <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700">
      <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-indigo-500" />
            聊天面板
          </CardTitle>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
            <span className={isConnected ? 'text-emerald-600' : 'text-slate-400'}>
              {isConnected ? '已连接' : '等待连接...'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {/* 消息列表 */}
        <div 
          ref={messagesContainerRef}
          className="h-64 overflow-y-auto rounded-lg p-3 space-y-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700"
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
            placeholder="输入消息并回车发送..."
            disabled={!isConnected}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 focus-visible:ring-indigo-500"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isConnected}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
