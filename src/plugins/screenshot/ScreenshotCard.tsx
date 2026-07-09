/**
 * 截图卡片组件
 *
 * 工具区插件：在展开面板中显示截图入口
 * 点击按钮触发截图指令
 */

import { useState } from 'react'
import type { PluginComponentProps } from '../../core/types'
import { ScreenshotOverlay } from './ScreenshotOverlay'

/** Lucide camera 图标内联 SVG */
function CameraIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

export function ScreenshotCard({ manifest }: PluginComponentProps) {
  const color = manifest.color ?? 'var(--accent)'
  const [showOverlay, setShowOverlay] = useState(false)

  const handleStart = () => {
    setShowOverlay(true)
  }

  const handleClose = () => {
    setShowOverlay(false)
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 p-4">
        <button
          onClick={handleStart}
          className="flex flex-col items-center gap-2 rounded-xl px-6 py-4 transition-all hover:scale-105 active:scale-95"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
            border: `1.5px solid ${color}`,
          }}
        >
          <CameraIcon size={28} color={color} />
          <span className="text-xs font-medium" style={{ color }}>
            开始截图
          </span>
        </button>
        <p className="text-center text-[11px] text-[var(--text-muted)]">点击后全屏框选区域</p>
      </div>

      {/* 截图覆盖层 */}
      {showOverlay && <ScreenshotOverlay onClose={handleClose} />}
    </>
  )
}
