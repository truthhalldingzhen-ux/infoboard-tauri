import { useState, useCallback } from 'react'
import { usePlugins } from '../../core/plugin-host'
import ToolExpandPanel from './ToolExpandPanel'
import type { PluginManifest } from '../../plugins/types'

const SVG_ICONS: Record<string, React.ReactNode> = {
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  languages: (
    <>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </>
  ),
}

function isEmoji(str: string): boolean {
  return str.length <= 2 && !/^[a-z]/.test(str)
}

export default function ToolSection() {
  const toolPlugins = usePlugins('tool')
  const [expandedPluginId, setExpandedPluginId] = useState<string | null>(null)

  const togglePlugin = useCallback((pluginId: string) => {
    setExpandedPluginId((prev) => (prev === pluginId ? null : pluginId))
  }, [])

  const expandedPlugin = expandedPluginId
    ? toolPlugins.find((p) => p.manifest.id === expandedPluginId)
    : null

  if (toolPlugins.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <SectionLabel />
        <div className="grid grid-cols-4 gap-2.5">
          {['笔记', '搜索', '剪贴板', '日历', '通讯', '数据', '设置', '更多'].map((name) => (
            <div
              key={name}
              className="h-[68px] rounded-card bg-bg-surface border border-border-subtle flex flex-col items-center justify-center gap-1.5 opacity-50"
            >
              <span className="text-text-muted text-xs">{name}</span>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel />
      <div className="grid grid-cols-4 gap-2.5">
        {toolPlugins.map((plugin) => (
          <ToolIcon
            key={plugin.manifest.id}
            manifest={plugin.manifest}
            isActive={expandedPluginId === plugin.manifest.id}
            onClick={() => togglePlugin(plugin.manifest.id)}
          />
        ))}
      </div>
      {expandedPlugin && (
        <ToolExpandPanel plugin={expandedPlugin} onClose={() => setExpandedPluginId(null)} />
      )}
    </section>
  )
}

function SectionLabel() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="text-[11px] font-semibold text-text-muted tracking-widest uppercase">
        工具区
      </span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  )
}

interface ToolIconProps {
  manifest: PluginManifest
  isActive: boolean
  onClick: () => void
}

function ToolIcon({ manifest, isActive, onClick }: ToolIconProps) {
  const iconClass = [
    'h-[68px] rounded-card glass-card',
    'flex flex-col items-center justify-center gap-1.5',
    'cursor-pointer transition-all duration-200',
    'hover:shadow-card-hover',
    isActive ? 'ring-2 ring-accent shadow-card-hover' : 'hover:bg-bg-surface-hover',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={iconClass} onClick={onClick} title={manifest.name}>
      {isEmoji(manifest.icon) ? (
        <span className="text-xl" style={{ color: isActive ? 'var(--accent)' : manifest.color }}>
          {manifest.icon}
        </span>
      ) : SVG_ICONS[manifest.icon] ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: isActive ? 'var(--accent)' : manifest.color || 'var(--text-muted)' }}
        >
          {SVG_ICONS[manifest.icon]}
        </svg>
      ) : (
        <span className="text-xl text-text-muted">{manifest.icon}</span>
      )}
      <span
        className="text-xs font-medium"
        style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
      >
        {manifest.name}
      </span>
      {manifest.badge !== undefined && (
        <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] font-semibold rounded-full bg-red-500 text-white">
          {manifest.badge}
        </span>
      )}
    </button>
  )
}
