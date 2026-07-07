import TitleBar from './core/layout/TitleBar'
import Sidebar from './core/layout/Sidebar'
import Toast from './core/toast/Toast'
import OpenCodeCard from './plugins/opencode/index'

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-bg-main">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col p-5 gap-6 overflow-auto">
          <OpenCodeCard />
        </main>
      </div>
      <Toast />
    </div>
  )
}
