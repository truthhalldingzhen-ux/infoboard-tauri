/**
 * 截图插件 — UI 配置
 *
 * section: tool — 工具区插件
 * 点击直接进入截图，不展开二级面板
 */

import type { PluginManifest } from '../../core/types'

export const manifest: PluginManifest = {
  id: 'screenshot',
  name: '截图',
  section: 'tool',
  icon: 'camera',
  color: 'var(--accent)',
}
