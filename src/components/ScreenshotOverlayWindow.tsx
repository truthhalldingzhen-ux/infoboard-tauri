/**
 * 截图覆盖窗口入口
 *
 * 通过 URL 参数 overlay=screenshot 或窗口 label 识别。
 * 空闲时保持透明，不挡操作。
 */

import { useEffect, useState } from 'react'
import { ScreenshotOverlay } from '../plugins/screenshot/ScreenshotOverlay'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function ScreenshotOverlayWindow() {
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined

    listen<string>('screenshot:data', (event) => {
      setImage(event.payload)
      setError(null)
    }).then((fn) => {
      unlisten = fn
    })

    invoke<string | null>('screenshot_get_image')
      .then((v) => {
        if (v) setImage(v)
      })
      .catch((e) => setError(String(e)))

    return () => {
      unlisten?.()
    }
  }, [])

  // 空闲：全透明，避免白底挡桌面
  if (!image && !error) {
    return <div className="fixed inset-0" style={{ background: 'transparent' }} />
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return <ScreenshotOverlay initialImage={image!} onClose={() => setImage(null)} />
}
