import { useState, useRef, useEffect, useCallback } from 'react'

type Message = {
  text: string
  isSelf: boolean
  time: string
}

export function useDataChannel() {
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isSetupRef = useRef(false)

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
      addMessage(event.data, false)
    }

    if (isOpen) {
      addSystemMessage('✓ 数据通道已连接')
    }

    setDataChannel(channel)
  }, [addMessage, addSystemMessage])

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

    currentChannel.send(text)
    console.log('[DataChannel] 发送消息:', text)
    addMessage(text, true)
    return true
  }, [dataChannel, addMessage])

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
    addSystemMessage,
    cleanup
  }
}
