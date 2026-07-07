/**
 * 截图覆盖层组件
 *
 * 工作流程：
 * 1. 主进程捕获桌面截图并发送到此组件
 * 2. 显示截屏图片 + 半透明遮罩
 * 3. 用户框选区域 → 选区内显示原图（无遮罩）
 * 4. 确认 → 从原始截屏中裁剪写入剪贴板
 *
 * 交互规则：
 * - Esc / 右键 / 取消按钮 → 直接退出截图
 * - 操作框在选区左下角
 * - 只有选区本身恢复原色，选区外全部变暗
 */

import { useState, useCallback, useEffect } from 'react'
import { useThemeColors } from '../../hooks/useThemeColors'

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

type OverlayState = 'idle' | 'selecting' | 'selected' | 'ocr-loading' | 'ocr-result'

const FALLBACK_ACCENT = '#DA7756'

/** 截图窗口是独立 Electron 窗口，模块加载时同步应用主题 */
;(function applyThemeFromStorage() {
  try {
    const stored = localStorage.getItem('infoboard-settings')
    if (stored) {
      const { theme } = JSON.parse(stored)
      const root = document.documentElement
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else if (theme) {
        root.setAttribute('data-theme', theme)
      }
    }
  } catch {}
})()

export function ScreenshotOverlay() {
  const { accent } = useThemeColors()
  const ACCENT = accent || FALLBACK_ACCENT
  const [screenImage, setScreenImage] = useState<string | null>(null)
  const [state, setState] = useState<OverlayState>('idle')
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [ocrText, setOcrText] = useState<string>('')
  const [ocrError, setOcrError] = useState<string>('')
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  /** 接收主进程发送的截屏数据 */
  useEffect(() => {
    window.electronAPI.onScreenData((dataUrl: string) => {
      setScreenImage(dataUrl)
    })
  }, [])

  /** 计算规范化的选区矩形（处理反向拖拽） */
  const calcRect = useCallback(
    (sx: number, sy: number, ex: number, ey: number): SelectionRect => ({
      x: Math.min(sx, ex),
      y: Math.min(sy, ey),
      width: Math.abs(ex - sx),
      height: Math.abs(ey - sy),
    }),
    []
  )

  /** 取消截图（统一出口） */
  const handleCancel = useCallback(() => {
    window.electronAPI.cancelScreenshot()
  }, [])

  /** 鼠标按下 */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 右键 → 直接退出
      if (e.button === 2) {
        handleCancel()
        return
      }
      // selected 状态下点击 → 忽略（不重新框选）
      if (state === 'selected') return
      if (state !== 'idle') return
      setStartPos({ x: e.clientX, y: e.clientY })
      setCurrentPos({ x: e.clientX, y: e.clientY })
      setState('selecting')
    },
    [state, handleCancel]
  )

  /** 鼠标移动 */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (state !== 'selecting') return
      setCurrentPos({ x: e.clientX, y: e.clientY })
    },
    [state]
  )

  /** 鼠标松开 */
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

  /** 选区变化时清除裁剪缓存 */
  useEffect(() => {
    setCroppedDataUrl(null)
  }, [selection])

  /** 键盘事件：Esc → 退出，右键菜单屏蔽 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      handleCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [handleCancel])

  /** 使用 Canvas 裁剪图片（在渲染进程完成，消除坐标映射误差） */
  const cropImage = useCallback((imageSrc: string, rect: SelectionRect): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // 注意：当前仅支持主显示器，多显示器下 sources[0] 可能不匹配
        const scaleX = img.naturalWidth / window.innerWidth
        const scaleY = img.naturalHeight / window.innerHeight
        const canvas = document.createElement('canvas')
        const cropW = Math.round(rect.width * scaleX)
        const cropH = Math.round(rect.height * scaleY)
        canvas.width = cropW
        canvas.height = cropH
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(
          img,
          Math.round(rect.x * scaleX),
          Math.round(rect.y * scaleY),
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH
        )
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = imageSrc
    })
  }, [])

  /** 获取裁剪后的 data URL（带缓存） */
  const getCroppedDataUrl = useCallback(async (): Promise<string | null> => {
    if (croppedDataUrl) return croppedDataUrl
    if (!selection || !screenImage) return null
    const dataUrl = await cropImage(screenImage, selection)
    setCroppedDataUrl(dataUrl)
    return dataUrl
  }, [croppedDataUrl, selection, screenImage, cropImage])

  /** 确认截图：渲染进程裁剪后发送 data URL 到主进程 */
  const handleConfirm = useCallback(async () => {
    try {
      const dataUrl = await getCroppedDataUrl()
      if (dataUrl) window.electronAPI.confirmScreenshot(dataUrl)
    } catch (err) {
      console.error('[截图] 裁剪失败:', err)
    }
  }, [getCroppedDataUrl])

  /** OCR 识别：渲染进程裁剪后调用 ocrRecognize */
  const handleOcr = useCallback(async () => {
    if (!selection || !screenImage) return
    setState('ocr-loading')
    setOcrText('')
    setOcrError('')

    try {
      const dataUrl = await getCroppedDataUrl()
      if (!dataUrl) return
      const result = await window.electronAPI.ocrRecognize(dataUrl)

      if (result.code === 100 && Array.isArray(result.data)) {
        const text = result.data.map((item) => item.text).join('\n')
        setOcrText(text)
        setState('ocr-result')
      } else if (result.code === 101) {
        setOcrText('')
        setState('ocr-result')
      } else {
        const msg = typeof result.data === 'string' ? result.data : '识别失败'
        setOcrError(msg)
        setState('ocr-result')
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'OCR 出错')
      setState('ocr-result')
    }
  }, [selection, screenImage, getCroppedDataUrl])

  /** 当前选区 */
  const currentRect =
    state === 'selecting' ? calcRect(startPos.x, startPos.y, currentPos.x, currentPos.y) : selection

  /** 操作框位置：选区左下角 */
  const getActionBoxPosition = (rect: SelectionRect) => {
    const offset = 8
    let x = rect.x
    let y = rect.y + rect.height + offset
    const screenH = window.innerHeight
    // 底部超出 → 放选区上方
    if (y + 40 > screenH) {
      y = rect.y - 40 - offset
    }
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
      {/* 底层：截屏图片 */}
      {screenImage && (
        <img
          src={screenImage}
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
          draggable={false}
        />
      )}

      {/* 加载状态 */}
      {!screenImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <span className="text-white text-sm">正在截取屏幕...</span>
        </div>
      )}

      {/* 遮罩：用 4 个矩形覆盖选区外的区域 */}
      {screenImage && currentRect && currentRect.width > 0 && currentRect.height > 0 && (
        <>
          {/* 上方 */}
          <div
            className="absolute left-0 top-0 right-0"
            style={{ height: currentRect.y, background: 'rgba(0,0,0,0.4)' }}
          />
          {/* 下方 */}
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{ top: currentRect.y + currentRect.height, background: 'rgba(0,0,0,0.4)' }}
          />
          {/* 左侧 */}
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
          {/* 右侧 */}
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

      {/* 无选区时轻微变暗 */}
      {screenImage && !currentRect && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.08)' }}
        />
      )}

      {/* 选区边框 + 尺寸标签 */}
      {currentRect && currentRect.width > 0 && currentRect.height > 0 && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: currentRect.x,
              top: currentRect.y,
              width: currentRect.width,
              height: currentRect.height,
              border: `2px dashed ${ACCENT}`,
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

      {/* 操作框（selected / ocr-loading 状态）：选区左下角 */}
      {(state === 'selected' || state === 'ocr-loading') && selection && (
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
            style={{ background: ACCENT }}
          >
            确认
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleOcr()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={state === 'ocr-loading'}
            className="px-4 py-1.5 text-xs font-medium text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: ACCENT }}
          >
            {state === 'ocr-loading' ? '识别中...' : '识别'}
          </button>
        </div>
      )}

      {/* OCR 结果面板 */}
      {(state === 'ocr-loading' || state === 'ocr-result') && selection && screenImage && (
        <div
          className="absolute flex flex-col z-10"
          style={{
            left:
              selection.x + selection.width + 8 > window.innerWidth - 320
                ? Math.max(8, selection.x - 308)
                : selection.x + selection.width + 8,
            top: Math.min(
              selection.y,
              Math.max(8, window.innerHeight - Math.max(selection.height, 120) - 8)
            ),
            width: 300,
            height: Math.max(selection.height, 120),
            background: 'rgba(30,30,35,0.92)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            overflow: 'hidden',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
              识别结果
            </span>
            <button
              onClick={() => {
                setState('selected')
                setOcrText('')
                setOcrError('')
              }}
              className="text-xs rounded-full flex items-center justify-center hover:opacity-80"
              style={{
                width: 20,
                height: 20,
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              ✕
            </button>
          </div>
          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-3">
            {state === 'ocr-loading' && (
              <div className="flex items-center justify-center h-full gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                  style={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderTopColor: 'rgba(255,255,255,0.7)',
                  }}
                />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  识别中...
                </span>
              </div>
            )}
            {state === 'ocr-result' && ocrError && (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="text-xs" style={{ color: 'rgba(255,100,100,0.7)' }}>
                  {ocrError}
                </span>
              </div>
            )}
            {state === 'ocr-result' && !ocrError && (
              <div
                className="text-xs leading-relaxed whitespace-pre-wrap select-text"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {ocrText || <span style={{ color: 'rgba(255,255,255,0.35)' }}>未识别到文字</span>}
              </div>
            )}
          </div>
          {/* 底部复制按钮 */}
          {state === 'ocr-result' && !ocrError && ocrText && (
            <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard
                    .writeText(ocrText)
                    .then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    })
                    .catch(() => {})
                }}
                className="w-full text-xs font-medium py-1.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
              >
                {copied ? '已复制 ✓' : '复制全部'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 底部提示 */}
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
