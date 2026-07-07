import { useEffect, useCallback, useRef, useState } from 'react'
import { RefreshCw, AlertCircle, Database, Zap } from 'lucide-react'
import { useOpenCodeStore } from './store'
import * as bridge from './bridge'
import type { RefreshResult } from './types'
import type { PluginComponentProps } from '../types'

/** 格式百分比 */
function fmtPercent(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '0%'
  return Math.round(n) + '%'
}

/** 格式化秒数为可读文本 */
function fmtSec(sec: number | null | undefined): string | undefined {
  if (!sec || sec <= 0) return undefined
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}天${h}小时`
  if (h > 0) return `${h}小时${m}分钟`
  if (m > 0) return `${m}分钟`
  return `${sec}秒`
}

/** 进度条组件 */
function PercentBar({ percent, color }: { percent: number; color: string }) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface-hover)' }}
    >
      <div
        className="h-full transition-all duration-500 ease-out"
        style={{ width: `${p}%`, backgroundColor: color, opacity: 0.85 }}
      />
    </div>
  )
}

/** 单行用量 */
function UsageRow({
  label,
  percent,
  resetLabel,
  color,
}: {
  label: string
  percent: number
  resetLabel?: string
  color: string
}) {
  return (
    <div className="py-1.5 border-b border-border-subtle last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-sm font-bold text-text-primary">
          {fmtPercent(percent)}
          {resetLabel && (
            <span className="text-xs font-normal text-text-muted ml-2">重置{resetLabel}</span>
          )}
        </span>
      </div>
      <PercentBar percent={percent} color={color} />
    </div>
  )
}

type RefreshState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'success'; at: number }
  | { kind: 'error'; message: string }

function RefreshButton({ onRefreshed }: { onRefreshed: () => void }) {
  const [state, setState] = useState<RefreshState>({ kind: 'idle' })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])
  useEffect(() => {
    return clearTimers
  }, [clearTimers])

  const handleClick = useCallback(async () => {
    if (state.kind === 'running') return
    setState({ kind: 'running' })
    try {
      const mtimeBefore = await bridge.getCookieMtime()
      const result: RefreshResult = await bridge.refreshCookie()
      if (!result.started) {
        setState({ kind: 'error', message: result.message || '启动失败' })
        const t = setTimeout(() => setState({ kind: 'idle' }), 8000)
        timers.current.push(t)
        return
      }
      const POLL_MS = 1000
      const MAX_WAIT_MS = 15000
      const startTs = Date.now()
      const poll = async () => {
        if (Date.now() - startTs > MAX_WAIT_MS) {
          setState({ kind: 'error', message: '15s 内 cookie 未更新' })
          const t = setTimeout(() => setState({ kind: 'idle' }), 10000)
          timers.current.push(t)
          return
        }
        try {
          const mtimeNow = await bridge.getCookieMtime()
          if (mtimeNow > mtimeBefore) {
            setState({ kind: 'success', at: Date.now() })
            onRefreshed()
            const t = setTimeout(() => setState({ kind: 'idle' }), 8000)
            timers.current.push(t)
            return
          }
        } catch {
          /* */
        }
        const t = setTimeout(poll, POLL_MS)
        timers.current.push(t)
      }
      const t = setTimeout(poll, POLL_MS)
      timers.current.push(t)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setState({ kind: 'error', message: msg })
      const t = setTimeout(() => setState({ kind: 'idle' }), 8000)
      timers.current.push(t)
    }
  }, [state.kind, onRefreshed])

  const isRunning = state.kind === 'running'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isRunning}
        className="text-xs px-2.5 py-1 rounded-md border-none cursor-pointer whitespace-nowrap transition-all disabled:cursor-wait disabled:opacity-60"
        style={{
          backgroundColor: isRunning ? 'var(--accent-light)' : 'var(--accent)',
          color: '#fff',
        }}
      >
        {isRunning ? (
          <span className="flex items-center gap-1">
            <RefreshCw size={12} className="animate-spin" />
            刷新中...
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <RefreshCw size={12} />
            刷新 Cookie
          </span>
        )}
      </button>
      {state.kind === 'success' && (
        <span className="text-xs" style={{ color: '#22c55e' }}>
          ✅ 已刷新
        </span>
      )}
      {state.kind === 'error' && (
        <span className="text-xs max-w-[260px] text-right break-all" style={{ color: '#ef4444' }}>
          ❌ {state.message}
        </span>
      )}
    </div>
  )
}

function OpenCodeCardInner() {
  const usage = useOpenCodeStore((s) => s.usage)
  const minimax = useOpenCodeStore((s) => s.minimax)
  const loading = useOpenCodeStore((s) => s.loading)
  const error = useOpenCodeStore((s) => s.error)
  const setUsage = useOpenCodeStore((s) => s.setUsage)
  const setMiniMax = useOpenCodeStore((s) => s.setMiniMax)
  const setLoading = useOpenCodeStore((s) => s.setLoading)
  const setError = useOpenCodeStore((s) => s.setError)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usageResult, minimaxResult] = await Promise.allSettled([
        bridge.getUsage(),
        bridge.getMiniMax(),
      ])
      if (usageResult.status === 'fulfilled') {
        setUsage(usageResult.value)
        if (usageResult.value.error) setError(usageResult.value.error)
      } else {
        setError('用量查询失败')
      }
      if (minimaxResult.status === 'fulfilled') setMiniMax(minimaxResult.value)
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setLoading(false)
    }
  }, [setUsage, setMiniMax, setLoading, setError])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const accent = '#6C5CE7'

  if (usage && !usage.db_exists && !loading && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Database size={16} />
        未检测到 OpenCode 数据
      </div>
    )
  }
  if (loading && !usage)
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <RefreshCw size={14} className="animate-spin" />
        加载中...
      </div>
    )
  if (error && !usage)
    return (
      <div className="card p-4 flex items-center gap-2 text-sm" style={{ color: '#ef4444' }}>
        <AlertCircle size={16} />
        <span className="flex-1 truncate">{error}</span>
        <RefreshButton onRefreshed={fetchData} />
      </div>
    )
  if (!usage) return null

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#ef4444' }}>
          <AlertCircle size={12} />
          <span className="flex-1 truncate">{error}</span>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary">OpenCode Go</span>
          <div className="flex-1" />
        </div>
        <UsageRow
          label="滚动窗口"
          percent={usage.today_tokens}
          resetLabel={fmtSec(usage.rolling_reset_in_sec)}
          color={accent}
        />
        <UsageRow
          label="每周窗口"
          percent={usage.weekly_tokens}
          resetLabel={fmtSec(usage.weekly_reset_in_sec)}
          color={accent}
        />
        <UsageRow
          label="每月窗口"
          percent={usage.monthly_tokens}
          resetLabel={fmtSec(usage.monthly_reset_in_sec)}
          color={accent}
        />
      </div>
      {minimax && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-accent" />
            <span className="text-xs font-semibold text-text-primary">MiniMax Token 计划</span>
          </div>
          <UsageRow
            label="滚动窗口"
            percent={minimax.rolling_used}
            resetLabel={minimax.rolling_reset_label}
            color={accent}
          />
          <UsageRow
            label="每周窗口"
            percent={minimax.weekly_used}
            resetLabel={minimax.weekly_reset_label}
            color={accent}
          />
        </div>
      )}
      <RefreshButton onRefreshed={fetchData} />
    </div>
  )
}

export default function OpenCodeCard(_props: PluginComponentProps) {
  return <OpenCodeCardInner />
}
