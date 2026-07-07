/**
 * 主题色响应式 Hook
 *
 * 从 themeColorStore 订阅当前 accent 颜色值，
 * 主题切换时自动更新，零重复读取。
 */

import { useSyncExternalStore } from 'react'
import { subscribe, getSnapshot } from '../stores/themeColorStore'
import { withAlpha } from '../utils/themeColor'

/**
 * 获取当前主题的强调色及其衍生色
 *
 * @example
 * ```tsx
 * const { accent, withAlpha } = useThemeColors()
 * <WeatherIcon color={accent} />
 * <div style={{ backgroundColor: withAlpha(accent, 0.08) }} />
 * ```
 */
export function useThemeColors() {
  const accent = useSyncExternalStore(subscribe, getSnapshot)

  return { accent, withAlpha }
}
