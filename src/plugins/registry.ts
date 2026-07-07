import type { PluginManifest } from './types'

const registry = new Map<string, PluginManifest>()

export function register(plugin: PluginManifest) {
  if (registry.has(plugin.id)) {
    console.warn(`插件 "${plugin.id}" 已注册，跳过`)
    return
  }
  registry.set(plugin.id, plugin)
}

export function getAll(): PluginManifest[] {
  return Array.from(registry.values())
}

export function getById(id: string): PluginManifest | undefined {
  return registry.get(id)
}
