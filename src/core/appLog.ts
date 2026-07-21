/**
 * 应用内日志控制台 — 拦截 console 输出供打包后调试
 *
 * 在入口最早调用 installLogConsole()，之后 console.log/warn/error 等会同步写入环形缓冲，
 * 面板通过订阅刷新 UI。
 */

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: number
  level: LogLevel
  message: string
  timestamp: number
  /** 序列化后的参数（便于复制） */
  args: string[]
}

type Listener = () => void

const MAX_ENTRIES = 500
let seq = 0
const entries: LogEntry[] = []
const listeners = new Set<Listener>()
let installed = false

/** 原始 console 方法（安装后仍可调用） */
const original = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
}

function notify() {
  for (const l of listeners) {
    try {
      l()
    } catch {
      /* ignore */
    }
  }
}

function stringifyArg(arg: unknown): string {
  if (arg === null) return 'null'
  if (arg === undefined) return 'undefined'
  if (typeof arg === 'string') return arg
  if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
    return String(arg)
  }
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`
  }
  try {
    return JSON.stringify(arg, null, 0)
  } catch {
    try {
      return String(arg)
    } catch {
      return '[Unserializable]'
    }
  }
}

function push(level: LogLevel, args: unknown[]) {
  const message = args.map(stringifyArg).join(' ')
  const entry: LogEntry = {
    id: ++seq,
    level,
    message,
    timestamp: Date.now(),
    args: args.map(stringifyArg),
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
  notify()
}

/**
 * 安装 console 拦截（幂等，入口只调一次）
 */
export function installLogConsole(): void {
  if (installed) return
  installed = true

  const wrap =
    (level: LogLevel) =>
    (...args: unknown[]) => {
      push(level, args)
      original[level](...args)
    }

  console.log = wrap('log')
  console.info = wrap('info')
  console.warn = wrap('warn')
  console.error = wrap('error')
  console.debug = wrap('debug')

  // 未捕获错误
  window.addEventListener('error', (e) => {
    push('error', [
      e.message || 'Uncaught Error',
      e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '',
      e.error,
    ])
  })
  window.addEventListener('unhandledrejection', (e) => {
    push('error', ['Unhandled Promise Rejection', e.reason])
  })

  original.info('[LogConsole] 应用内日志台已安装（F12 开关）')
}

export function getLogEntries(): readonly LogEntry[] {
  return entries
}

export function clearLogEntries(): void {
  entries.length = 0
  notify()
}

export function subscribeLogs(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function formatLogLine(e: LogEntry): string {
  const t = new Date(e.timestamp)
  const time = [
    String(t.getHours()).padStart(2, '0'),
    String(t.getMinutes()).padStart(2, '0'),
    String(t.getSeconds()).padStart(2, '0'),
    String(t.getMilliseconds()).padStart(3, '0'),
  ].join(':')
  return `[${time}] [${e.level.toUpperCase()}] ${e.message}`
}

export function exportLogsText(): string {
  return entries.map(formatLogLine).join('\n')
}

/** 手动追加一条（后端事件等） */
export function appendLog(level: LogLevel, ...args: unknown[]): void {
  push(level, args)
}
