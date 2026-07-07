/**
 * 主题色共享存储
 *
 * 采用轻量 pub-sub 模式：
 * - 模块初始化时同步读一次 getComputedStyle 做种子缓存
 * - MutationObserver 监听 data-theme 属性变化
 * - 组件通过 useSyncExternalStore 消费缓存值，零重复读取
 */

/** :root 默认 accent 值（globals.css） */
const FALLBACK_ACCENT = '#DA7756'

/**
 * 从 DOM 读取当前 --accent 的计算值
 */
function readAccent(): string {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    return raw || FALLBACK_ACCENT
  } catch {
    return FALLBACK_ACCENT
  }
}

// ─── 模块顶层：同步初始化 ───
// import 时立即执行，早于任何 React 组件挂载
let cachedAccent = readAccent()
const listeners = new Set<() => void>()

/**
 * 注册变化回调（React useSyncExternalStore 接口）
 */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * 同步读取缓存值（React useSyncExternalStore 接口）
 */
export function getSnapshot(): string {
  return cachedAccent
}

// MutationObserver 监听后续主题切换
const observer = new MutationObserver(() => {
  cachedAccent = readAccent()
  listeners.forEach((cb) => cb())
})

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
})
