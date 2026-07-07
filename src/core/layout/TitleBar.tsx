import { useEffect, useState } from 'react'
import { windowMinimize, windowMaximize, windowClose, windowIsMaximized } from '../tray-bridge'

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    windowIsMaximized()
      .then(setIsMaximized)
      .catch(() => {})
  }, [])

  const handleMaximize = async () => {
    await windowMaximize()
    const m = await windowIsMaximized()
    setIsMaximized(m)
  }

  return (
    <header
      className="h-10 flex items-center justify-between px-4 select-none drag-region"
      style={{
        backgroundColor: 'var(--bg-surface-solid, var(--bg-surface))',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* 左侧：应用图标 */}
      <div className="flex items-center no-drag-region">
        <svg
          className="w-4 h-4"
          style={{ color: 'var(--accent)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      </div>

      {/* 右侧：控制按钮 */}
      <div className="flex items-center gap-1 no-drag-region">
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-surface-hover transition-colors"
          onClick={windowMinimize}
          title="最小化"
        >
          <svg
            className="w-3.5 h-3.5 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M5 12h14" />
          </svg>
        </button>

        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-surface-hover transition-colors"
          onClick={handleMaximize}
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <svg
              className="w-3.5 h-3.5 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          )}
        </button>

        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500 hover:text-white transition-colors group"
          onClick={windowClose}
          title="关闭"
        >
          <svg
            className="w-3.5 h-3.5 text-text-muted group-hover:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
  )
}
