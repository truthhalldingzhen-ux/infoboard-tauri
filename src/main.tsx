import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import GlobalToast from './core/GlobalToast'
import { initTauriShim } from './tauri-shim'
import { ScreenshotOverlayWindow } from './components/ScreenshotOverlayWindow'
import './styles/globals.css'

initTauriShim()

function Root() {
  const [titleBarVisible, setTitleBarVisible] = useState(true)
  // 仅用 hash 识别覆盖窗，避免主窗口被误判
  const isOverlay = window.location.hash.startsWith('#/screenshot')

  useEffect(() => {
    const handler = () => setTitleBarVisible((v) => !v)
    window.addEventListener('toggle-titlebar', handler)
    return () => window.removeEventListener('toggle-titlebar', handler)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('plugin:core|internal_toggle_devtools').catch(() => {})
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (isOverlay) {
    return <ScreenshotOverlayWindow />
  }

  return (
    <div className={titleBarVisible ? '' : 'titlebar-hidden'}>
      <App />
      <GlobalToast />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
