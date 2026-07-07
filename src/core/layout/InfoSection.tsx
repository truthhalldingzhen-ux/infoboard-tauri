import { useState, useCallback, createElement } from 'react'
import { usePlugins } from '../../core/plugin-host'
import type { PluginManifest, PluginComponentProps } from '../../plugins/types'

export default function InfoSection() {
  const infoPlugins = usePlugins('info')
  const [expandedPluginId, setExpandedPluginId] = useState<string | null>(null)

  const togglePlugin = useCallback((pluginId: string) => {
    setExpandedPluginId((prev) => (prev === pluginId ? null : pluginId))
  }, [])

  if (infoPlugins.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <SectionLabel />
        <div className="flex gap-3">
          <div className="flex-1 h-[150px] rounded-card bg-bg-surface border border-border-subtle flex items-center justify-center text-text-muted text-sm">
            暂无信息插件
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel />
      <div className="flex flex-col gap-3">
        {infoPlugins.map((plugin) => (
          <InfoCard
            key={plugin.manifest.id}
            plugin={plugin}
            isExpanded={expandedPluginId === plugin.manifest.id}
            onToggle={() => togglePlugin(plugin.manifest.id)}
          />
        ))}
      </div>
    </section>
  )
}

function SectionLabel() {
  return (
    <span className="text-[11px] font-semibold text-text-muted tracking-widest uppercase">
      信息区
    </span>
  )
}

interface InfoCardProps {
  plugin: { manifest: PluginManifest; Component: React.ComponentType<PluginComponentProps> }
  isExpanded: boolean
  onToggle: () => void
}

function InfoCard({ plugin, isExpanded, onToggle }: InfoCardProps) {
  const { manifest, Component } = plugin
  const isGlass = manifest.id !== 'dynamic-island'
  const cardClass = isGlass
    ? 'rounded-card glass-card cursor-pointer overflow-hidden transition-all duration-500'
    : 'rounded-card cursor-pointer overflow-hidden transition-all duration-500'

  return (
    <div
      className={cardClass}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <div className="p-4">{createElement(Component, { manifest, expanded: isExpanded })}</div>
    </div>
  )
}
