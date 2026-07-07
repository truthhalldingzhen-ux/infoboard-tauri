/**
 * OpenCode Go + MiniMax 用量卡片
 *
 * 折叠态：OpenCode 滚动 + MiniMax 滚动并排显示
 * 展开态：OpenCode 三时段 + MiniMax 两时段（含重置时间）
 */

import React from 'react'
import { useOpenCodeGo } from './useOpenCodeGo'
import type { PluginComponentProps } from '../../core/types'
import type { PeriodUsage, OpenCodeGoData } from './types'

function formatPercent(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '0%'
  return Math.round(n) + '%'
}

function formatRefreshTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function getRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)
  if (diff < 5) return '刚刚'
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

function PercentBar({ percent, color }: { percent: number; color: string }) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div
      style={{
        width: '100%',
        height: '8px',
        borderRadius: '4px',
        backgroundColor: 'var(--bg-surface-hover, rgba(255,255,255,0.08))',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: p + '%',
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: 0.85,
        }}
      />
    </div>
  )
}

function CollapsedBar({
  data,
  error,
  accent,
}: {
  data: OpenCodeGoData
  error: string | null
  accent: string
}) {
  const oc = data.periods[0]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontSize: '12px',
        padding: '2px 0',
      }}
    >
      {error ? (
        <span style={{ color: 'var(--color-red-500, #ef4444)', fontSize: '11px', fontWeight: 600 }}>
          ⚠ {error}
        </span>
      ) : (
        <>
          <CollapsedRow
            label="OpenCode"
            percent={oc?.tokens}
            resetLabel={oc?.resetLabel}
            color={accent}
          />
          {data.minimax && (
            <CollapsedRow
              label="MiniMax"
              percent={data.minimax.rollingUsed}
              resetLabel={data.minimax.rollingResetLabel}
              color={accent}
            />
          )}
        </>
      )}
    </div>
  )
}

function CollapsedRow({
  label,
  percent,
  resetLabel,
  color,
}: {
  label: string
  percent: number | undefined
  resetLabel: string | undefined
  color: string
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '3px',
          fontSize: '11px',
        }}
      >
        <span>
          <span style={{ color: 'var(--text-muted)' }}>{label} </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatPercent(percent)}
          </span>
        </span>
        {resetLabel && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>重置 {resetLabel}</span>
        )}
      </div>
      <PercentBar percent={percent ?? 0} color={color} />
    </div>
  )
}

export function OpenCodeGoCard({ expanded, manifest }: PluginComponentProps) {
  const { data, loading, error, refresh } = useOpenCodeGo()
  const accent = manifest?.color || '#6C5CE7'

  if (data && !data.dbExists && !loading && !error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-muted)' }}>未检测到 OpenCode 数据</span>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
        <span style={{ color: 'var(--text-muted)' }}>加载中...</span>
      </div>
    )
  }

  if (error && !data) {
    return <ErrorState error={error} />
  }

  if (!data) return null

  return (
    <div>
      <CollapsedBar data={data} error={error} accent={accent} />

      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ paddingTop: '12px' }}>
            <ExpandedView
              data={data}
              loading={loading}
              error={error}
              refresh={refresh}
              accent={accent}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpandedView({
  data,
  loading,
  error,
  refresh,
  accent,
}: {
  data: OpenCodeGoData
  loading: boolean
  error: string | null
  refresh: () => void
  accent: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '10px',
          }}
        >
          OpenCode Go
        </div>
        {data.periods.map((p) => (
          <PeriodRow key={p.key} period={p} color={accent} />
        ))}
      </div>

      {data.minimax && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '10px',
            }}
          >
            MiniMax Token 计划
          </div>
          <MiniMaxRow
            label="滚动窗口"
            percent={data.minimax.rollingUsed}
            resetLabel={data.minimax.rollingResetLabel}
            color={accent}
          />
          <MiniMaxRow
            label="每周窗口"
            percent={data.minimax.weeklyUsed}
            resetLabel={data.minimax.weeklyResetLabel}
            color={accent}
          />
        </div>
      )}

      {data.recentSessions.length > 0 && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            最近会话
          </div>
          {data.recentSessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
              }}
            >
              <span
                style={{
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '120px',
                  flex: 1,
                }}
              >
                {s.modelId}
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: '8px' }}>
                {formatPercent(s.tokens)}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: 'var(--color-red-500, #ef4444)',
            padding: '6px 8px',
            borderRadius: '5px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <span style={{ flex: 1 }}>⚠ {error}</span>
          <RefreshCookieButton />
        </div>
      )}
    </div>
  )
}

function PeriodRow({ period, color }: { period: PeriodUsage; color: string }) {
  const percent = Math.max(0, Math.min(100, period.tokens || 0))
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{period.label}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {formatPercent(percent)}
          {period.resetLabel && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 400,
                color: 'var(--text-muted)',
                marginLeft: '6px',
              }}
            >
              重置{period.resetLabel}
            </span>
          )}
        </span>
      </div>
      <PercentBar percent={percent} color={color} />
    </div>
  )
}

function MiniMaxRow({
  label,
  percent,
  resetLabel,
  color,
}: {
  label: string
  percent: number
  resetLabel: string
  color: string
}) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {formatPercent(p)}
          <span
            style={{
              fontSize: '9px',
              fontWeight: 400,
              color: 'var(--text-muted)',
              marginLeft: '6px',
            }}
          >
            重置{resetLabel}
          </span>
        </span>
      </div>
      <PercentBar percent={p} color={color} />
    </div>
  )
}

function ErrorState({ error }: { error: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
      <span
        style={{
          color: 'var(--color-red-500, #ef4444)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        ⚠ {error}
      </span>
      <RefreshCookieButton />
    </div>
  )
}

type RefreshState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'success'; at: number }
  | { kind: 'error'; message: string }

function RefreshCookieButton() {
  const [state, setState] = React.useState<RefreshState>({ kind: 'idle' })
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = () => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }
  const clearLater = (ms: number) => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    clearTimerRef.current = setTimeout(() => setState({ kind: 'idle' }), ms)
  }
  React.useEffect(() => cleanup, [])

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (state.kind === 'running') return
    if (!window.opencodeDB?.refreshCookie || !window.opencodeDB?.getCookieMtime) {
      setState({ kind: 'error', message: 'IPC 不可用' })
      clearLater(5000)
      return
    }
    setState({ kind: 'running' })
    try {
      const mtimeBefore = await window.opencodeDB.getCookieMtime()
      const result = await window.opencodeDB.refreshCookie()
      if (!result.started) {
        setState({ kind: 'error', message: result.message || '启动失败' })
        clearLater(8000)
        return
      }
      const POLL_MS = 1000
      const MAX_WAIT_MS = 15000
      const startTs = Date.now()
      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - startTs > MAX_WAIT_MS) {
          cleanup()
          setState({ kind: 'error', message: '15s 内 cookie 未更新' })
          clearLater(10000)
          return
        }
        try {
          const mtimeNow = await window.opencodeDB.getCookieMtime()
          if (mtimeNow > mtimeBefore) {
            cleanup()
            window.dispatchEvent(new CustomEvent('opencode-go-refresh'))
            setState({ kind: 'success', at: Date.now() })
            clearLater(8000)
          }
        } catch {
          /* */
        }
      }, POLL_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setState({ kind: 'error', message: msg })
      clearLater(8000)
    }
  }

  const isRunning = state.kind === 'running'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
      <button
        onClick={handleClick}
        disabled={isRunning}
        style={{
          fontSize: '10px',
          padding: '4px 10px',
          borderRadius: '5px',
          backgroundColor: isRunning ? 'var(--accent-light)' : 'var(--accent)',
          border: 'none',
          color: isRunning ? 'var(--accent)' : '#fff',
          cursor: isRunning ? 'wait' : 'pointer',
          opacity: isRunning ? 0.6 : 1,
          whiteSpace: 'nowrap',
          transition: 'background-color var(--transition-fast), opacity var(--transition-fast)',
        }}
      >
        {isRunning ? '⏳ 刷新中...' : '🔄 刷新 Cookie'}
      </button>
      {state.kind === 'success' && (
        <span style={{ fontSize: '10px', color: 'var(--color-green-500, #22c55e)' }}>
          ✅ 已刷新，{formatRefreshTime(state.at)}
        </span>
      )}
      {state.kind === 'error' && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--color-red-500, #ef4444)',
            maxWidth: '260px',
            textAlign: 'right',
            wordBreak: 'break-all',
          }}
        >
          ❌ {state.message}
        </span>
      )}
    </div>
  )
}
