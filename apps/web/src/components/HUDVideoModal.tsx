import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent } from "./ui/dialog"
import { EmbeddedVideoChat } from '@/app/components/EmbeddedVideoChat'

function CallTimer() {
  const [time, setTime] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTime(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  const fmt = (n: number) => n.toString().padStart(2, '0')
  return (
    <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="font-medium text-sm tracking-widest">{fmt(Math.floor(time / 60))}:{fmt(time % 60)}</span>
    </div>
  )
}

interface HUDVideoModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string | null
  stationLabel?: string // e.g. "CAM-01"
  subLabel?: string // e.g. "Loc: SECTOR-7 | Sig: -42dBm"
  iframeExtraParams?: string // e.g. "?autoJoin=true"
}

export function HUDVideoModal({ 
  isOpen, 
  onClose, 
  roomId, 
  stationLabel = "CAM-01 Current Session",
  subLabel = "Live Connection",
  iframeExtraParams = ""
}: HUDVideoModalProps) {
  
  // 确保iframe url 构造正确
  const iframeSrc = roomId ? `/room/${roomId}${iframeExtraParams}` : undefined

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] h-[85vh] p-0 overflow-hidden bg-slate-50 border-0 shadow-2xl rounded-2xl flex flex-col">
         {/* 顶部信息栏 - 亮色简约风格 */}
         <div className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-20 shadow-sm shrink-0">
             <div className="flex flex-col">
                 <div className="flex items-center gap-3">
                     <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                     <span className="text-slate-800 text-lg font-bold tracking-tight">{stationLabel}</span>
                 </div>
                 <span className="text-slate-400 text-xs font-medium pl-5 md:pl-6 uppercase tracking-wider">{subLabel}</span>
             </div>
             <CallTimer />
         </div>

         {/* 视频容器区域 */}
         <div className="relative flex-1 bg-white w-full overflow-hidden p-4">
            <div className="w-full h-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-inner relative">
                {roomId && <EmbeddedVideoChat roomId={roomId} />}
            </div>
         </div>
      </DialogContent>
    </Dialog>
  )
}
