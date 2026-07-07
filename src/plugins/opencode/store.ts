import { create } from 'zustand'
import type { UsageStats, MiniMaxUsage } from './types'

interface OpenCodeState {
  usage: UsageStats | null
  minimax: MiniMaxUsage | null
  loading: boolean
  error: string | null
  setUsage: (usage: UsageStats | null) => void
  setMiniMax: (minimax: MiniMaxUsage | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useOpenCodeStore = create<OpenCodeState>((set) => ({
  usage: null,
  minimax: null,
  loading: false,
  error: null,
  setUsage: (usage) => set({ usage }),
  setMiniMax: (minimax) => set({ minimax }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
