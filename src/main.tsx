import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTauriShim } from './tauri-shim'
import './styles/globals.css'

// 初始化 Tauri IPC 适配层（模拟 Electron preload API）
initTauriShim()

function Root() {
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
