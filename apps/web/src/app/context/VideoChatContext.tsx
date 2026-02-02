import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import { useVideoChat } from '../hooks/useVideoChat'
import { useMemoryMonitor } from '../hooks/useMemoryMonitor'
import { MEMORY_LIMITS } from '../config/webrtc.config'

type VideoChatContextType = ReturnType<typeof useVideoChat>

const VideoChatContext = createContext<VideoChatContextType | null>(null)

export function VideoChatProvider({ children }: { children: ReactNode }) {
  const videoChat = useVideoChat()
  
  // 内存监控
  useMemoryMonitor({
    enabled: process.env.NODE_ENV === 'production', // 生产环境启用
    onCritical: (usage) => {
      console.error('🚨 [App] Memory critical, consider hanging up and refreshing')
      // 可选：自动挂断以释放内存
      if (usage.percentage > MEMORY_LIMITS.autoCleanupPercentage && videoChat.callStatus !== 'idle') {
        console.error('🚨 [App] Auto-hanging up due to critical memory')
        videoChat.hangUp()
        alert('内存使用过高，已自动挂断。建议刷新页面。')
      }
    }
  })
  
  // 页面卸载时自动清理连接
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (videoChat.callStatus !== 'idle') {
        console.log('🚪 [App] Page unloading, cleaning up connections...')
        videoChat.hangUp()
        // 可选：提示用户
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    const handleVisibilityChange = () => {
      if (document.hidden && videoChat.callStatus !== 'idle') {
        console.log('👁️ [App] Page hidden, connections will auto-cleanup on close')
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // 组件卸载时清理
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // 注意：只在真正的组件卸载时清理，不是因为状态变化
      // 所以这里不需要主动调用 hangUp，beforeunload 已经处理了
    }
  }, [videoChat.callStatus, videoChat.hangUp]) // 只依赖必要的属性
  
  return (
    <VideoChatContext.Provider value={videoChat}>
      {children}
    </VideoChatContext.Provider>
  )
}

export function useVideoChatContext() {
  const context = useContext(VideoChatContext)
  if (!context) {
    throw new Error('useVideoChatContext must be used within VideoChatProvider')
  }
  return context
}
