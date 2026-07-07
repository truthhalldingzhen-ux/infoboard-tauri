/**
 * 灵动岛插件 — UI 配置
 *
 * 只管外观（图标、名称、配色），不管功能
 * 换图标/样式 = 只改这个文件，功能代码零改动
 */

import type { PluginManifest } from '../../core/types'

export const manifest: PluginManifest = {
  id: 'dynamic-island',
  name: '灵动岛',
  section: 'info',
  icon: '🏝️',
  color: '#1C1C1E', // 深色胶囊，与暖色主题形成对比
  // badge 动态设置：未读通知数 或 媒体播放指示
}
