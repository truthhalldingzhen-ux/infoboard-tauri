import { useAppStore } from '../../stores/appStore'

const navItems = [{ id: 'dashboard', label: '仪表盘', icon: '⬡' }]

export default function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)

  return (
    <aside
      className={`flex flex-col gap-2 p-2 transition-all duration-200 ${
        collapsed ? 'w-0 overflow-hidden p-0' : 'w-12'
      }`}
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-bg-surface-hover transition-colors"
          title={item.label}
        >
          <span className="text-sm">{item.icon}</span>
        </button>
      ))}
    </aside>
  )
}
