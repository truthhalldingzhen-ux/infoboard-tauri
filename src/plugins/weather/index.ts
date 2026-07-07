/**
 * 天气插件导出
 *
 * 组合 manifest + Component，导出完整的 InfoBoardPlugin
 */

import type { InfoBoardPlugin } from '../../core/types'
import { manifest } from './manifest'
import { WeatherCard } from './WeatherCard'

export const weatherPlugin: InfoBoardPlugin = {
  manifest,
  Component: WeatherCard,
  onInit: () => {
    console.log('[天气插件] 已加载')
  },
}

// 单独导出，方便其他地方按需引用
export { manifest } from './manifest'
export { WeatherCard } from './WeatherCard'
export { useWeather } from './useWeather'
