import React, { createContext, useContext, ReactNode } from 'react'
import { useVideoChat } from '../hooks/useVideoChat'

type VideoChatContextType = ReturnType<typeof useVideoChat>

const VideoChatContext = createContext<VideoChatContextType | null>(null)

export function VideoChatProvider({ children }: { children: ReactNode }) {
  const videoChat = useVideoChat()
  
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
