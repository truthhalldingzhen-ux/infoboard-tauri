/**
 * 设置插件 manifest
 *
 * 工具区插件，点击展开设置面板
 */
import type { PluginManifest } from '../../core/types'

export const manifest: PluginManifest = {
  id: 'settings',
  name: '设置',
  section: 'tool',
  icon: 'settings',
  color: 'var(--accent)',
}
