import { create } from 'zustand'
import { StationStatusPayload } from '../types/station'

interface StationState {
  // 使用 Record 存储，查找复杂度 O(1)
  stationStatusMap: Record<string, StationStatusPayload>
  
  // Actions
  updateStationStatus: (data: StationStatusPayload) => void
  removeStation: (stationId: string) => void
  batchUpdateStations: (updates: StationStatusPayload[]) => void
}

export const useStationStore = create<StationState>((set) => ({
  stationStatusMap: {},

  updateStationStatus: (data) => set((state) => {
    // 只有当数据真的不同时才更新，这里只是简单替换
    // Zustand 默认是 immutable update，这里只生成新的 stations 对象
    // 单个 station 的引用变化只会触发订阅了该 station 的组件
    return {
      stationStatusMap: {
        ...state.stationStatusMap,
        [data.stationId]: data
      }
    }
  }),

  removeStation: (stationId) => set((state) => {
    const { [stationId]: removed, ...rest } = state.stationStatusMap
    return { stationStatusMap: rest }
  }),
  
  batchUpdateStations: (updates) => set((state) => {
      const nextMap = { ...state.stationStatusMap }
      updates.forEach(u => nextMap[u.stationId] = u)
      return { stationStatusMap: nextMap }
  })
}))
