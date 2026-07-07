/** OpenCode Go 用量统计 */
export interface UsageStats {
  db_exists: boolean
  today_tokens: number
  weekly_tokens: number
  monthly_tokens: number
  rolling_reset_in_sec: number | null
  weekly_reset_in_sec: number | null
  monthly_reset_in_sec: number | null
  error: string | null
  timestamp: number
}

/** 会话信息（保留接口，但 opencode.ai 不提供） */
export interface SessionInfo {
  id: string
  model_id: string
  tokens: number
  time_created: number
}

/** MiniMax Token 计划用量 */
export interface MiniMaxUsage {
  rolling_used: number
  rolling_reset_ms: number
  weekly_used: number
  weekly_reset_ms: number
  rolling_reset_label: string
  weekly_reset_label: string
}

/** Cookie 刷新结果 */
export interface RefreshResult {
  started: boolean
  message: string | null
}
