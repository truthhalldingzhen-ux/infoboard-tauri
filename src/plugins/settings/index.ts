/**
 * 设置插件导出
 *
 * 工具区插件，点击展开设置面板
 * 遵循现有插件架构（参考 screenshot/todo）
 */

import type { InfoBoardPlugin } from '../../core/types'
import { manifest } from './manifest'
import { SettingsPanel } from './SettingsPanel'

export const settingsPlugin: InfoBoardPlugin = {
  manifest,
  Component: SettingsPanel,
  onInit: () => {
    console.log('[设置插件] 已加载')
  },
}

export { manifest } from './manifest'
export { SettingsPanel } from './SettingsPanel'
