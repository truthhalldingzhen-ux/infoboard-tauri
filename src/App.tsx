import { useEffect, useMemo, createElement } from 'react'
import TitleBar from './core/layout/TitleBar'
import Sidebar from './core/layout/Sidebar'
import Toast from './core/toast/Toast'
import { useAppStore } from './stores/appStore'
import { useSettingsStore } from './plugins/settings/store'
import { getById, getAll } from './plugins/registry'
import './plugins/index'

export default function App() {
  const activePluginId = useAppStore((s) => s.activePluginId)
  const setActivePluginId = useAppStore((s) => s.setActivePluginId)
  const pluginVisibility = useSettingsStore((s) => s.pluginVisibility)
  const initSettings = useSettingsStore((s) => s.init)

  useEffect(() => {
    initSettings()
  }, [initSettings])

  // 首次加载时自动设置第一个可见插件为 active
  useEffect(() => {
    if (!activePluginId) {
      const first = getAll().find((p) => pluginVisibility[p.id] !== false)
      if (first) setActivePluginId(first.id)
    }
  }, [activePluginId, pluginVisibility, setActivePluginId])

  const activePlugin = useMemo(() => {
    const p = getById(activePluginId)
    if (!p) return null
    if (pluginVisibility[p.id] === false) return null
    return p
  }, [activePluginId, pluginVisibility])

  return (
    <div className="h-screen flex flex-col bg-bg-main">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeId={activePluginId} onSelect={setActivePluginId} />
        <main className="flex-1 flex flex-col p-5 gap-6 overflow-auto">
          {activePlugin && createElement(activePlugin.component)}
        </main>
      </div>
      <Toast />
    </div>
  )
}
