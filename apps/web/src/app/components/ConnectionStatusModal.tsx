"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useVideoChatContext } from '@/app/context/VideoChatContext'

type CandidateInfo = {
  id: string
  type?: string
  protocol?: string
  address?: string
  port?: number
  foundation?: string
  priority?: number
  candidate?: string
}

type SelectedPairInfo = {
  // 本地候选类型：host/srflx/relay
  localType?: string
  // 远端候选类型：host/srflx/relay
  remoteType?: string
  // 本地候选地址与端口
  localAddress?: string
  localPort?: number
  // 远端候选地址与端口
  remoteAddress?: string
  remotePort?: number
  // 传输协议：udp/tcp
  localProtocol?: string
  remoteProtocol?: string
  // 传输链路标识
  transportId?: string
  // 往返时延（秒）
  rtt?: number
  // 候选对状态：succeeded/in-progress/failed 等
  pairState?: string
  // 是否被提名为最终候选对
  nominated?: boolean
  // 是否被选中（最终生效的候选对）
  selected?: boolean
}

const getConnectionMode = (localType?: string, remoteType?: string) => {
  if (localType === 'relay' || remoteType === 'relay') return 'TURN (Relay)'
  if (localType === 'srflx' || remoteType === 'srflx') return 'STUN (SRFLX)'
  if (localType === 'host' || remoteType === 'host') return 'Direct/Host'
  return 'Unknown'
}

export function ConnectionStatusModal() {
  const { peerConnection } = useVideoChatContext()
  const [open, setOpen] = useState(false)
  const [iceState, setIceState] = useState('new')
  const [connectionState, setConnectionState] = useState('new')
  const [signalingState, setSignalingState] = useState('stable')
  const [gatheringState, setGatheringState] = useState('new')
  const [selectedPair, setSelectedPair] = useState<SelectedPairInfo | null>(null)
  const [iceCandidates, setIceCandidates] = useState<CandidateInfo[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const candidatesRef = useRef<Map<string, CandidateInfo>>(new Map())

  useEffect(() => {
    if (!peerConnection) return

    const updateStates = () => {
      setIceState(peerConnection.iceConnectionState)
      setConnectionState(peerConnection.connectionState)
      setSignalingState(peerConnection.signalingState)
      setGatheringState(peerConnection.iceGatheringState)
    }

    updateStates()

    const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!event.candidate) return
      const id = event.candidate.candidate
      if (!id || candidatesRef.current.has(id)) return

      const info: CandidateInfo = {
        id,
        type: event.candidate.type,
        protocol: event.candidate.protocol,
        address: event.candidate.address,
        port: event.candidate.port,
        foundation: event.candidate.foundation,
        priority: event.candidate.priority,
        candidate: event.candidate.candidate,
      }

      candidatesRef.current.set(id, info)
      setIceCandidates(Array.from(candidatesRef.current.values()).slice(0, 50))
    }

    const handleIceStateChange = () => updateStates()
    const handleConnStateChange = () => updateStates()
    const handleSignalingStateChange = () => updateStates()
    const handleGatheringStateChange = () => updateStates()

    peerConnection.addEventListener('icecandidate', handleIceCandidate)
    peerConnection.addEventListener('iceconnectionstatechange', handleIceStateChange)
    peerConnection.addEventListener('connectionstatechange', handleConnStateChange)
    peerConnection.addEventListener('signalingstatechange', handleSignalingStateChange)
    peerConnection.addEventListener('icegatheringstatechange', handleGatheringStateChange)

    return () => {
      peerConnection.removeEventListener('icecandidate', handleIceCandidate)
      peerConnection.removeEventListener('iceconnectionstatechange', handleIceStateChange)
      peerConnection.removeEventListener('connectionstatechange', handleConnStateChange)
      peerConnection.removeEventListener('signalingstatechange', handleSignalingStateChange)
      peerConnection.removeEventListener('icegatheringstatechange', handleGatheringStateChange)
    }
  }, [peerConnection])

  useEffect(() => {
    if (!peerConnection || !open) return

    let timer: NodeJS.Timeout | null = null
    let cancelled = false

    const pollStats = async () => {
      try {
        const stats = await peerConnection.getStats()
        if (cancelled) return

        let selectedPairId: string | undefined
        let selectedPairInfo: SelectedPairInfo | null = null
        let localCandidateId: string | undefined
        let remoteCandidateId: string | undefined
        let candidatePairReport: any | null = null

        stats.forEach(report => {
          if (report.type !== 'candidate-pair') return

          const r = report as any

          if (r.selected) {
            candidatePairReport = r
            return
          }

          if (!candidatePairReport && r.nominated) {
            candidatePairReport = r
          }

          if (!candidatePairReport && r.state === 'succeeded') {
            candidatePairReport = r
          }
        })

        if (candidatePairReport) {
          selectedPairId = candidatePairReport.id
          localCandidateId = candidatePairReport.localCandidateId
          remoteCandidateId = candidatePairReport.remoteCandidateId
          selectedPairInfo = {
            transportId: candidatePairReport.transportId,
            rtt: candidatePairReport.currentRoundTripTime,
            pairState: candidatePairReport.state,
            nominated: candidatePairReport.nominated,
            selected: candidatePairReport.selected,
          }
        }

        if (!selectedPairId) {
          stats.forEach(report => {
            if (report.type === 'transport' && (report as any).selectedCandidatePairId) {
              selectedPairId = (report as any).selectedCandidatePairId
            }
          })
        }

        if (selectedPairId && !candidatePairReport) {
          stats.forEach(report => {
            if (report.id === selectedPairId && report.type === 'candidate-pair') {
              const r = report as any
              candidatePairReport = r
              localCandidateId = r.localCandidateId
              remoteCandidateId = r.remoteCandidateId
              selectedPairInfo = {
                transportId: r.transportId,
                rtt: r.currentRoundTripTime,
                pairState: r.state,
                nominated: r.nominated,
                selected: r.selected,
              }
            }
          })
        }

        if (selectedPairId) {
          stats.forEach(report => {
            if (report.id === localCandidateId && report.type === 'local-candidate') {
              selectedPairInfo = {
                ...selectedPairInfo,
                localType: (report as any).candidateType,
                localAddress: (report as any).address,
                localPort: (report as any).port,
                localProtocol: (report as any).protocol,
              }
            }
            if (report.id === remoteCandidateId && report.type === 'remote-candidate') {
              selectedPairInfo = {
                ...selectedPairInfo,
                remoteType: (report as any).candidateType,
                remoteAddress: (report as any).address,
                remotePort: (report as any).port,
                remoteProtocol: (report as any).protocol,
              }
            }
          })
        }

        setSelectedPair(selectedPairInfo)
        setLastUpdated(new Date())
      } catch {
        // ignore
      }

      if (!cancelled) {
        timer = setTimeout(pollStats, 2000)
      }
    }

    pollStats()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [peerConnection, open])

  const connectionMode = useMemo(() => {
    return getConnectionMode(selectedPair?.localType, selectedPair?.remoteType)
  }, [selectedPair])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        连接状态
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-[92vw] max-w-3xl max-h-[80vh] overflow-hidden rounded-xl bg-background shadow-xl border border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-lg font-semibold">连接状态与 ICE 诊断</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm px-3 py-1 rounded-md bg-muted hover:bg-muted/80"
              >
                关闭
              </button>
            </div>

            <div className="p-4 grid gap-4 overflow-y-auto max-h-[72vh] overflow-x-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Connection Mode</div>
                  <div className="text-base font-semibold">{connectionMode}</div>
                  <div className="text-xs text-muted-foreground mt-1">反映最终走的通道：直连/打洞/STUN/或 TURN 中继</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">ICE Connection State</div>
                  <div className="text-base font-semibold">{iceState}</div>
                  <div className="text-xs text-muted-foreground mt-1">ICE 连通性状态：checking/connected/failed 等</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Connection State</div>
                  <div className="text-base font-semibold">{connectionState}</div>
                  <div className="text-xs text-muted-foreground mt-1">整体连接状态：new/connecting/connected 等</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Signaling State</div>
                  <div className="text-base font-semibold">{signalingState}</div>
                  <div className="text-xs text-muted-foreground mt-1">SDP 交换阶段：stable/offer/answer 等</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">ICE Gathering State</div>
                  <div className="text-base font-semibold">{gatheringState}</div>
                  <div className="text-xs text-muted-foreground mt-1">候选收集过程：gathering/complete 等</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Last Updated</div>
                  <div className="text-base font-semibold">{lastUpdated ? lastUpdated.toLocaleTimeString() : '-'}</div>
                  <div className="text-xs text-muted-foreground mt-1">统计刷新时间（2 秒轮询）</div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="text-sm font-semibold mb-2">Selected Candidate Pair</div>
                <div className="text-xs text-muted-foreground mb-2">浏览器最终选中的候选对（决定实际链路）</div>
                {selectedPair ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Local</div>
                      <div>{selectedPair.localType || '-'} / {selectedPair.localProtocol || '-'}</div>
                      <div className="text-xs text-muted-foreground">{selectedPair.localAddress || '-'}:{selectedPair.localPort || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Remote</div>
                      <div>{selectedPair.remoteType || '-'} / {selectedPair.remoteProtocol || '-'}</div>
                      <div className="text-xs text-muted-foreground">{selectedPair.remoteAddress || '-'}:{selectedPair.remotePort || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">RTT</div>
                      <div>{selectedPair.rtt ? `${Math.round(selectedPair.rtt * 1000)} ms` : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Pair State</div>
                      <div>{selectedPair.pairState || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Selected / Nominated</div>
                      <div>{selectedPair.selected ? 'selected' : 'not selected'} / {selectedPair.nominated ? 'nominated' : 'not nominated'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">未选择候选对（可能尚未完成 ICE）</div>
                )}
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="text-sm font-semibold mb-2">ICE Candidates (Local)</div>
                <div className="text-xs text-muted-foreground mb-2">本地收集到的候选地址（host/srflx/relay）</div>
                {iceCandidates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无候选者</div>
                ) : (
                  <div className="max-h-64 overflow-y-auto text-xs space-y-2">
                    {iceCandidates.map((c, idx) => (
                      <div key={c.id} className="rounded-md bg-muted p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">#{idx + 1}</div>
                          <div className="text-muted-foreground">类型:</div>
                          <div>{c.type || '-'}</div>
                          <div className="text-muted-foreground">协议:</div>
                          <div>{c.protocol || '-'}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <div className="text-muted-foreground">地址:</div>
                          <div>{c.address || '-'}</div>
                          <div className="text-muted-foreground">端口:</div>
                          <div>{c.port || '-'}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <div className="text-muted-foreground">Foundation:</div>
                          <div>{c.foundation || '-'}</div>
                          <div className="text-muted-foreground">Priority:</div>
                          <div>{c.priority ?? '-'}</div>
                        </div>
                        <div className="text-muted-foreground mt-1">Candidate:</div>
                        <div className="break-all text-muted-foreground">{c.candidate || '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
