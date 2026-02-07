"use client"

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { useUiStore } from '@/app/store/uiStore'

export function WsErrorDialog() {
  const wsErrorOpen = useUiStore(s => s.wsErrorOpen)
  const wsErrorMessage = useUiStore(s => s.wsErrorMessage)
  const closeWsError = useUiStore(s => s.closeWsError)
  const retryWs = useUiStore(s => s.retryWs)

  if (!wsErrorOpen) return null

  return (
    <Dialog open={wsErrorOpen} onOpenChange={(open) => !open && closeWsError()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            信令连接异常
          </DialogTitle>
          <DialogDescription>
            {wsErrorMessage || '信令连接失败，请稍后重试。'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={closeWsError}>
            关闭
          </Button>
          <Button className="gap-2" onClick={retryWs}>
            <RefreshCw className="h-4 w-4" />
            重试连接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
