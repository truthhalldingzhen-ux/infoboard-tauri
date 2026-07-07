/**
 * OpenCode Go 套餐用量监控插件 — 类型定义
 */

/** OpenCode 用量统计 */
export interface UsageStats {
  dbExists: boolean
  todayTokens: number
  weeklyTokens: number
  monthlyTokens: number
  timestamp: number
  error?: string
  rollingResetInSec?: number
  weeklyResetInSec?: number
  monthlyResetInSec?: number
}

/** 会话信息 */
export interface SessionInfo {
  id: string
  modelId: string
  tokens: number
  timeCreated: number
}

/** MiniMax Token 用量 */
export interface MiniMaxUsage {
  rollingUsed: number
  rollingResetMs: number
  weeklyUsed: number
  weeklyResetMs: number
  rollingResetLabel: string
  weeklyResetLabel: string
}

/** 单个时间段的 token 用量 */
export interface PeriodUsage {
  key: string
  label: string
  tokens: number
  /** 重置倒计时文案（如 "4小时22分钟"） */
  resetLabel?: string
}

/** 插件聚合数据 */
export interface OpenCodeGoData {
  periods: PeriodUsage[]
  dbExists: boolean
  recentSessions: SessionInfo[]
  lastUpdated: number
  /** MiniMax Token 用量（可选） */
  minimax?: MiniMaxUsage
}

/** Hook 返回值 */
export interface UseOpenCodeGoResult {
  data: OpenCodeGoData | null
  loading: boolean
  error: string | null
  refresh: () => void
}
