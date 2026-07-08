/**
 * 截图覆盖层组件
 *
 * 工作流程：
 * 1. Rust 后端捕获桌面截图并传递给此组件
 * 2. 显示截屏图片 + 半透明遮罩
 * 3. 用户框选区域 → 选区内显示原图（无遮罩）
 * 4. 确认 → 从原始截屏中裁剪写入剪贴板
 *
 * 注意：截图功能暂未实现，此 UI 组件保留供后续集成
 */

import { useState, useCallback, useEffect } from 'react'

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

type OverlayState = 'idle' | 'selecting' | 'selected'

export function ScreenshotOverlay() {
  const [screenImage, setScreenImage] = useState<string | null>(null)
  const [state, setState] = useState<OverlayState>('idle')
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [selection, setSelection] = useState<SelectionRect | null>(null)

  const calcRect = useCallback(
    (sx: number, sy: number, ex: number, ey: number): SelectionRect => ({
      x: Math.min(sx, ex),
      y: Math.min(sy, ey),
      width: Math.abs(ex - sx),
      height: Math.abs(ey - sy),
    }),
    []
  )

  const handleCancel = useCallback(() => {
    window.electronAPI?.cancelScreenshot?.()
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) {
        handleCancel()
        return
      }
      if (state === 'selected' || state !== 'idle') return
      setStartPos({ x: e.clientX, y: e.clientY })
      setCurrentPos({ x: e.clientX, y: e.clientY })
      setState('selecting')
    },
    [state, handleCancel]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (state !== 'selecting') return
      setCurrentPos({ x: e.clientX, y: e.clientY })
    },
    [state]
  )

  const handleMouseUp = useCallback(() => {
    if (state !== 'selecting') return
    const rect = calcRect(startPos.x, startPos.y, currentPos.x, currentPos.y)
    if (rect.width < 5 || rect.height < 5) {
      setState('idle')
      return
    }
    setSelection(rect)
    setState('selected')
  }, [state, startPos, currentPos, calcRect])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    const ctx = (e: MouseEvent) => {
      e.preventDefault()
      handleCancel()
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('contextmenu', ctx)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('contextmenu', ctx)
    }
  }, [handleCancel])

  useEffect(() => {
    window.electronAPI?.onScreenData?.((dataUrl: string) => setScreenImage(dataUrl))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!selection || !screenImage) return
    try {
      if (window.electronAPI?.confirmScreenshot) {
        // 裁剪逻辑待实现
        window.electronAPI.confirmScreenshot(screenImage)
      }
    } catch (err) {
      console.error('[截图] 失败:', err)
    }
  }, [selection, screenImage])

  const currentRect =
    state === 'selecting' ? calcRect(startPos.x, startPos.y, currentPos.x, currentPos.y) : selection

  const getActionBoxPosition = (rect: SelectionRect) => {
    const offset = 8
    let x = rect.x
    let y = rect.y + rect.height + offset
    if (y + 40 > window.innerHeight) y = rect.y - 40 - offset
    return { left: x, top: y }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {screenImage && (
        <img
          src={screenImage}
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
          draggable={false}
        />
      )}
      {!screenImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <span className="text-white text-sm">正在截取屏幕...</span>
        </div>
      )}
      {screenImage && currentRect && currentRect.width > 0 && currentRect.height > 0 && (
        <>
          <div
            className="absolute left-0 top-0 right-0"
            style={{ height: currentRect.y, background: 'rgba(0,0,0,0.4)' }}
          />
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{ top: currentRect.y + currentRect.height, background: 'rgba(0,0,0,0.4)' }}
          />
          <div
            className="absolute"
            style={{
              left: 0,
              top: currentRect.y,
              width: currentRect.x,
              height: currentRect.height,
              background: 'rgba(0,0,0,0.4)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: currentRect.x + currentRect.width,
              top: currentRect.y,
              right: 0,
              height: currentRect.height,
              background: 'rgba(0,0,0,0.4)',
            }}
          />
        </>
      )}
      {screenImage && !currentRect && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.08)' }}
        />
      )}
      {currentRect && currentRect.width > 0 && currentRect.height > 0 && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: currentRect.x,
              top: currentRect.y,
              width: currentRect.width,
              height: currentRect.height,
              border: '2px dashed var(--accent)',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              left: currentRect.x,
              top: currentRect.y - 28,
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 4,
              padding: '3px 8px',
            }}
          >
            <span className="text-white text-xs font-mono">
              {Math.round(currentRect.width)} × {Math.round(currentRect.height)}
            </span>
          </div>
        </>
      )}
      {state === 'selected' && selection && (
        <div
          className="absolute flex gap-2"
          style={{
            ...getActionBoxPosition(selection),
            background: 'var(--bg-surface)',
            borderRadius: 8,
            padding: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCancel()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="px-4 py-1.5 text-xs font-medium rounded-md hover:opacity-80"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            取消
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleConfirm()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="px-4 py-1.5 text-xs font-medium text-white rounded-md hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            确认
          </button>
        </div>
      )}
      <div
        className="absolute flex items-center gap-1.5"
        style={{ left: '50%', bottom: 20, transform: 'translateX(-50%)' }}
      >
        <kbd
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          Esc
        </kbd>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          右键 · 取消键 · 退出截图
        </span>
      </div>
    </div>
  )
}
