import { getAll } from '../../plugins/registry'

export default function Sidebar({
  activeId,
  onSelect,
}: {
  activeId: string
  onSelect: (id: string) => void
}) {
  const plugins = getAll()

  return (
    <aside className="flex flex-col gap-1 p-2 border-r border-border-subtle">
      {plugins.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`
            flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-sm
            ${activeId === p.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-surface-hover'}
          `}
          title={p.name}
        >
          {p.icon}
        </button>
      ))}
    </aside>
  )
}
