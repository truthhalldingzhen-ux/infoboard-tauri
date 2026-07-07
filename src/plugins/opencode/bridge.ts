import { invoke } from '@tauri-apps/api/core'
import type { UsageStats, SessionInfo, MiniMaxUsage, RefreshResult } from './types'

export async function getUsage(): Promise<UsageStats> {
  return invoke<UsageStats>('opencode_get_usage')
}

export async function getSessions(): Promise<SessionInfo[]> {
  return invoke<SessionInfo[]>('opencode_get_sessions')
}

export async function getMiniMax(): Promise<MiniMaxUsage> {
  return invoke<MiniMaxUsage>('opencode_get_minimax')
}

export async function refreshCookie(): Promise<RefreshResult> {
  return invoke<RefreshResult>('opencode_refresh_cookie')
}

export async function getCookieMtime(): Promise<number> {
  return invoke<number>('opencode_get_cookie_mtime')
}
