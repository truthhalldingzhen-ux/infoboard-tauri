import { useEffect, useState } from 'react'
import { pluginRegistry } from '../plugins/registry'
import type { InfoBoardPlugin } from '../plugins/types'

export function initPluginSystem(): Promise<void> {
  pluginRegistry.clear()
  return import('../plugins').then(() => {
    console.log(`[PluginHost] 已加载 ${pluginRegistry.size} 个插件`)
  })
}

export function usePluginSystem(): void {
  useEffect(() => {
    if (pluginRegistry.size === 0) {
      initPluginSystem()
    }
  }, [])
}

export function usePlugins(section: 'info' | 'tool'): InfoBoardPlugin[] {
  const [, setVersion] = useState(0)

  useEffect(() => {
    if (pluginRegistry.size === 0) {
      initPluginSystem().then(() => setVersion((v) => v + 1))
    }
  }, [])

  return pluginRegistry.getPluginsBySection(section)
}
