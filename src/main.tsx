import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTauriShim } from './tauri-shim'
import './styles/globals.css'

// 初始化 Tauri IPC 适配层
initTauriShim()

function Root() {
  const [titleBarVisible, setTitleBarVisible] = useState(true)

  useEffect(() => {
    const handler = () => setTitleBarVisible((v) => !v)
    window.addEventListener('toggle-titlebar', handler)
    return () => window.removeEventListener('toggle-titlebar', handler)
  }, [])

  // F12 打开 DevTools
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

  return (
    <div className={titleBarVisible ? '' : 'titlebar-hidden'}>
      <App />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
