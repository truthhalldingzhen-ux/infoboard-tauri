import { useState, useCallback, useEffect } from 'react'
import TitleBar from './core/layout/TitleBar'
import InfoSection from './core/layout/InfoSection'
import ToolSection from './core/layout/ToolSection'
import Toast from './core/toast/Toast'
import { usePluginSystem } from './core/plugin-host'
import './plugins/index'

export default function App() {
  usePluginSystem()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  return (
    <div className="min-h-screen bg-bg-main flex flex-col" onContextMenu={handleContextMenu}>
      <TitleBar />
      <main className="flex-1 flex flex-col p-5 gap-6 overflow-auto">
        <InfoSection />
        <ToolSection />
      </main>
      <Toast />

      {menu && (
        <div
          className="fixed z-50 py-1 rounded-lg shadow-lg border"
          style={{
            left: menu.x,
            top: menu.y,
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            minWidth: 140,
          }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-xs transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => setMenu(null)}
          >
            显示/隐藏标题栏
          </button>
          <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--border-subtle)' }} />
          <button
            className="w-full text-left px-3 py-1.5 text-xs transition-colors"
            style={{ color: '#ef4444' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => setMenu(null)}
          >
            关闭窗口
          </button>
        </div>
      )}
    </div>
  )
}
