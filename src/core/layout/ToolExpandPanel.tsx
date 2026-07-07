import { useRef, useEffect } from 'react'
import { createElement } from 'react'
import type { PluginManifest, PluginComponentProps } from '../../plugins/types'

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

interface ToolExpandPanelProps {
  plugin: { manifest: PluginManifest; Component: React.ComponentType<PluginComponentProps> }
  onClose: () => void
}

export default function ToolExpandPanel({ plugin, onClose }: ToolExpandPanelProps) {
  const { manifest, Component } = plugin
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement
        if (!target.closest('[data-plugin-id]')) {
          onClose()
        }
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="flex-1 rounded-glass glass-card overflow-hidden animate-slide-up"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          {isEmoji(manifest.icon) ? (
            <span className="text-lg" style={{ color: manifest.color }}>
              {manifest.icon}
            </span>
          ) : SVG_ICONS[manifest.icon] ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: manifest.color || 'var(--text-muted)' }}
            >
              {SVG_ICONS[manifest.icon]}
            </svg>
          ) : (
            <span className="text-lg text-text-muted">{manifest.icon}</span>
          )}
          <span className="text-sm font-semibold text-text-primary">{manifest.name}</span>
        </div>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-bg-surface-hover transition-colors"
          onClick={onClose}
        >
          <svg
            className="w-4 h-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        {createElement(Component, { manifest, expanded: true })}
      </div>
    </div>
  )
}
