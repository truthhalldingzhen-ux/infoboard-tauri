import type { PluginManifest } from '../types'

export const manifest: PluginManifest = {
  id: '_template',
  name: '插件模板',
  description: '复制此目录后修改 manifest 即可接入新插件',
  icon: '🧩',
  category: 'tool',
  component: null as unknown as React.ComponentType,
}
