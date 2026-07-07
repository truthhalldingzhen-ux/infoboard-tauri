import { Sun, Moon, Palette, Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from './store'
import { getAll } from '../registry'

const THEMES = [
  { value: 'light' as const, label: '暖色', icon: Sun },
  { value: 'dark' as const, label: '深色', icon: Moon },
  { value: 'pink-purple' as const, label: '粉紫', icon: Palette },
]

export default function SettingsPanel() {
  const theme = useSettingsStore((s) => s.theme)
  const pluginVisibility = useSettingsStore((s) => s.pluginVisibility)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setPluginVisibility = useSettingsStore((s) => s.setPluginVisibility)
  const plugins = getAll().filter((p) => p.id !== 'settings')

  return (
    <div className="card p-4 space-y-5">
      <div className="text-xs font-semibold text-text-primary">设置</div>

      {/* 主题选择 */}
      <div className="space-y-2">
        <div className="text-xs text-text-secondary">主题色</div>
        <div className="flex gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all
                  ${theme === t.value ? 'bg-accent text-white' : 'bg-bg-surface-hover text-text-secondary hover:bg-bg-surface-hover'}
                `}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 插件开关 */}
      <div className="space-y-2">
        <div className="text-xs text-text-secondary">插件显示</div>
        {plugins.map((p) => {
          const visible = pluginVisibility[p.id] !== false // 默认显示
          return (
            <div key={p.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">{p.icon}</span>
                <span className="text-xs text-text-primary">{p.name}</span>
              </div>
              <button
                onClick={() => setPluginVisibility(p.id, !visible)}
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
