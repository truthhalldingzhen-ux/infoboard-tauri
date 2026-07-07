import { useEffect } from 'react'
import { Minus, Maximize2, X, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { windowMinimize, windowMaximize, windowClose, windowIsMaximized } from '../tray-bridge'
import { useAppStore } from '../../stores/appStore'

export default function TitleBar() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setMaximized = useAppStore((s) => s.setMaximized)

  useEffect(() => {
    windowIsMaximized()
      .then((m) => setMaximized(m))
      .catch(console.error)
  }, [setMaximized])

  const handleMaximize = async () => {
    await windowMaximize()
    const m = await windowIsMaximized()
    setMaximized(m)
  }

  return (
    <div className="drag-region flex items-center justify-between h-10 px-3 select-none">
      <button
        className="titlebar-button p-1 rounded-md hover:bg-bg-surface-hover transition-colors"
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? (
          <PanelRightOpen size={16} className="text-text-secondary" />
        ) : (
          <PanelRightClose size={16} className="text-text-secondary" />
        )}
      </button>

      <span className="text-xs font-medium text-text-muted">InfoBoard</span>

      <div className="flex items-center gap-1">
        <button
          className="titlebar-button p-1.5 rounded-md hover:bg-bg-surface-hover transition-colors"
          onClick={windowMinimize}
        >
          <Minus size={14} className="text-text-secondary" />
        </button>
        <button
          className="titlebar-button p-1.5 rounded-md hover:bg-bg-surface-hover transition-colors"
          onClick={handleMaximize}
        >
          <Maximize2 size={14} className="text-text-secondary" />
        </button>
        <button
          className="titlebar-button p-1.5 rounded-md hover:bg-red-500/20 transition-colors group"
          onClick={windowClose}
        >
          <X size={14} className="text-text-secondary group-hover:text-red-500" />
        </button>
      </div>
    </div>
  )
}
