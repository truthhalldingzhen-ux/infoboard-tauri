/**
 * 截图插件导出
 *
 * 组合 manifest + Component，导出完整的 InfoBoardPlugin
 * 模式同 weather/todo 插件
 */

import type { InfoBoardPlugin } from '../../core/types'
import { manifest } from './manifest'
import { ScreenshotCard } from './ScreenshotCard'

export const screenshotPlugin: InfoBoardPlugin = {
  manifest,
  Component: ScreenshotCard,
  onInit: () => {
    console.log('[截图插件] 已加载')
  },
}

// 单独导出，方便其他地方按需引用
export { manifest } from './manifest'
export { ScreenshotCard } from './ScreenshotCard'
