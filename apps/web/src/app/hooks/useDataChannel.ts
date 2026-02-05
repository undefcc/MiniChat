import { useState, useRef, useEffect, useCallback } from 'react'
import { VideoQualityProfile } from '../config/webrtc.config'

type Message = {
  text: string
  isSelf: boolean
  time: string
}

type DataChannelMessage = {
  type: 'chat' | 'control'
  payload: any
}

export function useDataChannel(props?: { onControlMessage?: (type: string, payload: any) => void }) {
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isSetupRef = useRef(false)
  const onControlMessage = props?.onControlMessage

  // 添加消息
  const addMessage = useCallback((text: string, isSelf: boolean) => {
    setMessages(prev => [...prev, {
      text,
      isSelf,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }])
  }, [])

  // 添加系统消息
  const addSystemMessage = useCallback((text: string) => {
    addMessage(text, false)
  }, [addMessage])

  // 设置数据通道
  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    // 防止重复设置 - 使用标志位而不是对象引用
    if (isSetupRef.current) {
      return
    }

    isSetupRef.current = true
    
    let isOpen = channel.readyState === 'open'
    
    channel.onopen = () => {
      if (!isOpen) {
        isOpen = true
        addSystemMessage('✓ 数据通道已连接')
      }
    }

    channel.onclose = () => {
      if (isOpen) {
        isOpen = false
        addSystemMessage('✗ 数据通道已断开')
      }
      isSetupRef.current = false
    }

    channel.onerror = (error) => {
      console.error('Data channel error:', error)
    }

    channel.onmessage = (event) => {
      console.log('[DataChannel] 收到消息:', event.data)
      try {
        const data = JSON.parse(event.data) as DataChannelMessage
        if (data.type === 'control' && onControlMessage) {
          onControlMessage('quality', data.payload)
          return
        }
        if (data.type === 'chat') {
          addMessage(data.payload, false)
          return
        }
        // Fallback or unknown type
        addMessage(String(event.data), false)
      } catch (e) {
        // Not JSON, treat as legacy chat message
        addMessage(String(event.data), false)
      }
    }

    if (isOpen) {
      addSystemMessage('✓ 数据通道已连接 (v2)')
    }

    setDataChannel(channel)
  }, [addMessage, addSystemMessage, onControlMessage])

  // 发送消息
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) {
      return false
    }

    // 直接访问当前状态，不触发 setState
    const currentChannel = dataChannel
    if (!currentChannel || currentChannel.readyState !== 'open') {
      return false
    }

    const message: DataChannelMessage = { type: 'chat', payload: text }
    currentChannel.send(JSON.stringify(message))
    console.log('[DataChannel] 发送消息:', text)
    addMessage(text, true)
    return true
  }, [dataChannel, addMessage])

  // 发送控制消息
  const sendControlMessage = useCallback((type: string, payload: any) => {
    const currentChannel = dataChannel
    if (!currentChannel || currentChannel.readyState !== 'open') {
      console.warn('⚠️ Cannot send control message: DataChannel not open')
      return false
    }

    const message: DataChannelMessage = { type: 'control', payload }
    currentChannel.send(JSON.stringify(message))
    console.log('[DataChannel] 发送控制消息:', payload)
    return true
  }, [dataChannel])

  // 清理
  const cleanup = useCallback(() => {
    setDataChannel(prev => {
      if (prev) {
        try {
          if (prev.readyState === 'open') {
            prev.close()
          }
        } catch (e) {
          console.error('Error closing data channel:', e)
        }
      }
      return null
    })
    isSetupRef.current = false
    setMessages([])
  }, [])

  // 自动滚动到最新消息
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  return {
    dataChannel,
    messages,
    messagesContainerRef,
    setupDataChannel,
    sendMessage,
    sendControlMessage,
    addSystemMessage,
    cleanup
  }
}
