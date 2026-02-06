import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { RoomControls } from './RoomControls'
import { CallControls } from './CallControls'
import { ThemeToggle } from '../../components/theme-toggle'
import { Activity, Settings } from 'lucide-react'

interface ControlPanelProps {
  isInCall?: boolean
}

export function ControlPanel({ isInCall = false }: ControlPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700">
        <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              {isInCall ? '控制面板' : 'Session Manager'}
            </CardTitle>
            {/* <ThemeToggle /> */}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <RoomControls />
          <CallControls />
        </CardContent>
      </Card>
      
      {!isInCall && (
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-indigo-100 dark:border-indigo-900 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Quick Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-indigo-700 dark:text-indigo-300 space-y-2">
              <div className="flex items-start gap-2">
                <span className="bg-indigo-600 dark:bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">1</span>
                <p>Click "Create Room" to generate a room ID</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-indigo-600 dark:bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">2</span>
                <p>Share the room ID with others</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-indigo-600 dark:bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">3</span>
                <p>Others enter the ID and click "Join"</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-indigo-600 dark:bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5">4</span>
                <p>Allow camera and microphone access</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
