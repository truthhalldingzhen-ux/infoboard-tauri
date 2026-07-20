import { useEffect, useState } from 'react'
import { ScreenshotOverlay } from '../plugins/screenshot/ScreenshotOverlay'
import { invoke } from '@tauri-apps/api/core'

export function ScreenshotOverlayWindow() {
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    invoke<string | null>('screenshot_get_image')
      .then(setImage)
      .catch((e) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900/80 z-50">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (!image) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900/80 z-50">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return <ScreenshotOverlay initialImage={image} onClose={() => {}} />
}
