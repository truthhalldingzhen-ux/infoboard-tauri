/**
 * OpenCode Go + MiniMax 数据逻辑 Hook
 *
 * OpenCode：cookie + fetch dashboard（百分比）
 * MiniMax：官方 API + Bearer token（用剩余%反推已用%）
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  PeriodUsage,
  OpenCodeGoData,
  UseOpenCodeGoResult,
  UsageStats,
  MiniMaxUsage,
  SessionInfo,
} from './types'
import { POLL_INTERVAL } from './config'

const CACHE_KEY = 'opencode-go-cache-v3'

interface CacheData {
  data: OpenCodeGoData
  timestamp: number
}

function loadCache(): OpenCodeGoData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CacheData
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed.data
      }
    }
  } catch {
    /* */
  }
  return null
}

function saveCache(data: OpenCodeGoData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    /* */
  }
}

function isBridgeAvailable(): boolean {
  return typeof window.opencodeDB?.getUsage === 'function'
}

function fmtSec(sec: number | undefined): string | undefined {
  if (!sec || sec <= 0) return undefined
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}天${h}小时`
  if (h > 0) return `${h}小时${m}分钟`
  if (m > 0) return `${m}分钟`
  return `${sec}秒`
}

function buildPeriods(stats: UsageStats): PeriodUsage[] {
  return [
    {
      key: 'TODAY',
      label: '滚动',
      tokens: stats.todayTokens,
      resetLabel: fmtSec(stats.rollingResetInSec),
    },
    {
      key: 'WEEKLY',
      label: '每周',
      tokens: stats.weeklyTokens,
      resetLabel: fmtSec(stats.weeklyResetInSec),
    },
    {
      key: 'MONTHLY',
      label: '每月',
      tokens: stats.monthlyTokens,
      resetLabel: fmtSec(stats.monthlyResetInSec),
    },
  ]
}

export function useOpenCodeGo(): UseOpenCodeGoResult {
  const [data, setData] = useState<OpenCodeGoData | null>(() => loadCache())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)
  const revisionRef = useRef(0)

  const fetchData = useCallback(async () => {
    if (!isBridgeAvailable()) {
      setError('桥未就绪')
      setLoading(false)
      return
    }

    abortRef.current = false
    const currentRevision = ++revisionRef.current
    setLoading(true)
    setError(null)

    try {
      const [usageResult, sessionsResult, minimaxResult] = await Promise.allSettled([
        window.opencodeDB.getUsage(),
        window.opencodeDB.getSessions(5),
        window.opencodeDB.getMiniMax(),
      ])

      if (abortRef.current || currentRevision !== revisionRef.current) return

      const stats: UsageStats | null = usageResult.status === 'fulfilled' ? usageResult.value : null
      const sessions: SessionInfo[] =
        sessionsResult.status === 'fulfilled' ? sessionsResult.value : []
      const minimax = minimaxResult.status === 'fulfilled' ? minimaxResult.value : null

      if (!stats) {
        setError('用量查询失败')
        setLoading(false)
        return
      }

      if (!stats.dbExists) {
        setData({
          periods: buildPeriods({
            dbExists: false,
            todayTokens: 0,
            weeklyTokens: 0,
            monthlyTokens: 0,
            timestamp: 0,
          }),
          dbExists: false,
          recentSessions: [],
          lastUpdated: Date.now(),
        })
        setLoading(false)
        return
      }

      if (stats.error) {
        setError(stats.error)
        setLoading(false)
        return
      }

      // 过滤 minimax error（不阻塞 opencode 显示）
      let minimaxData: MiniMaxUsage | undefined = undefined
      if (minimax && typeof minimax === 'object' && minimax !== null && 'rollingUsed' in minimax) {
        minimaxData = minimax
      }

      const newData: OpenCodeGoData = {
        periods: buildPeriods(stats),
        dbExists: true,
        recentSessions: sessions,
        lastUpdated: Date.now(),
        minimax: minimaxData,
      }

      setData(newData)
      saveCache(newData)
      setError(null)
    } catch (err: unknown) {
      if (abortRef.current || currentRevision !== revisionRef.current) return
      setError(err instanceof Error ? err.message : '查询失败')
    } finally {
      if (currentRevision === revisionRef.current) setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    ++revisionRef.current
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, POLL_INTERVAL)
    const onRefreshEvent = () => refresh()
    window.addEventListener('opencode-go-refresh', onRefreshEvent)
    return () => {
      abortRef.current = true
      clearInterval(interval)
      window.removeEventListener('opencode-go-refresh', onRefreshEvent)
    }
  }, [fetchData, refresh])

  return { data, loading, error, refresh }
}
