/**
 * 天气插件 — UI 配置
 *
 * 只管外观（图标、名称、配色），不管功能
 * 换图标/样式 = 只改这个文件，功能代码零改动
 */

import type { PluginManifest } from '../../core/types'

export const manifest: PluginManifest = {
  id: 'weather',
  name: '天气',
  section: 'info',
  icon: '☀️',
  color: '#3B82F6', // 天空蓝
}
