import { Sun, Moon, Palette, Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from './store'
import { pluginRegistry } from '../registry'
import type { PluginComponentProps } from '../types'

const THEMES = [
  { value: 'light' as const, label: '暖色', icon: Sun },
  { value: 'dark' as const, label: '深色', icon: Moon },
  { value: 'pink-purple' as const, label: '粉紫', icon: Palette },
]

export default function SettingsPanel(_props: PluginComponentProps) {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const disabledPlugins = useSettingsStore((s) => s.disabledPlugins)
  const togglePlugin = useSettingsStore((s) => s.togglePlugin)

  const allPlugins = pluginRegistry.getAllPlugins().filter((p) => p.manifest.id !== 'settings')

  return (
    <div className="p-4 space-y-5">
      <div className="text-xs font-semibold text-text-primary">设置</div>
      <div className="space-y-2">
        <div className="text-xs text-text-secondary">主题色</div>
        <div className="flex gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${theme === t.value ? 'bg-accent text-white' : 'bg-bg-surface-hover text-text-secondary hover:bg-bg-surface-hover'}`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-text-secondary">插件显示</div>
        {allPlugins.map((p) => {
          const visible = !disabledPlugins.includes(p.manifest.id)
          return (
            <div key={p.manifest.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">{p.manifest.icon}</span>
                <span className="text-xs text-text-primary">{p.manifest.name}</span>
              </div>
              <button
                onClick={() => togglePlugin(p.manifest.id)}
                className={`p-1 rounded transition-colors ${visible ? 'text-accent' : 'text-text-muted'}`}
              >
                {visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
