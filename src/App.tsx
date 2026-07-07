import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import TitleBar from './core/layout/TitleBar'
import Sidebar from './core/layout/Sidebar'
import Toast from './core/toast/Toast'

export default function App() {
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    invoke<string>('greet', { name: 'InfoBoard' }).then(setGreeting).catch(console.error)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-bg-main">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col p-5 gap-6 overflow-auto">
          <div className="glass-card p-8 text-center">
            <h1 className="text-2xl font-display font-bold text-text-primary mb-2">InfoBoard</h1>
            <p className="text-text-secondary">{greeting || '正在加载...'}</p>
          </div>
        </main>
      </div>
      <Toast />
    </div>
  )
}
