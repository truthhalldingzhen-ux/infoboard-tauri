/**
 * 待办插件 — UI 配置
 *
 * 只管外观（图标、名称、配色），不管功能
 */

import type { PluginManifest } from '../../core/types'

export const manifest: PluginManifest = {
  id: 'todo',
  name: '待办',
  section: 'info',
  icon: '📋',
  color: 'var(--accent)', // 强调色跟随主题
}
