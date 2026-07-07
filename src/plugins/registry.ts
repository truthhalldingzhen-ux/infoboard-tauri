import type { InfoBoardPlugin } from './types'

class PluginRegistry {
  private plugins: Map<string, InfoBoardPlugin> = new Map()

  register(plugin: InfoBoardPlugin): void {
    const { id } = plugin.manifest
    if (this.plugins.has(id)) {
      console.warn(`插件 "${id}" 已存在，跳过`)
      return
    }
    this.plugins.set(id, plugin)
    plugin.onInit?.()
  }

  registerAll(plugins: InfoBoardPlugin[]): void {
    plugins.forEach((p) => this.register(p))
  }

  getPlugin(id: string): InfoBoardPlugin | undefined {
    return this.plugins.get(id)
  }

  getAllPlugins(): InfoBoardPlugin[] {
    return Array.from(this.plugins.values())
  }

  getPluginsBySection(section: 'info' | 'tool'): InfoBoardPlugin[] {
    return this.getAllPlugins().filter((p) => p.manifest.section === section)
  }

  get size(): number {
    return this.plugins.size
  }

  clear(): void {
    this.plugins.forEach((p) => p.onDestroy?.())
    this.plugins.clear()
  }
}

export const pluginRegistry = new PluginRegistry()
