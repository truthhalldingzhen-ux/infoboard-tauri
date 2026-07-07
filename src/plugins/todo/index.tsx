import { useState } from 'react'
import { Check, Plus, Trash2, Pencil, X, CheckSquare, Square } from 'lucide-react'
import { useTodo } from './useTodo'
import type { PluginComponentProps } from '../types'

export default function TodoCard(_props: PluginComponentProps) {
  const { todos, addTodo, toggleTodo, removeTodo, editTodo } = useTodo()
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const handleAdd = async () => {
    await addTodo(newText)
    setNewText('')
  }

  const activeTodos = todos.filter((t) => !t.done)
  const doneTodos = todos.filter((t) => t.done)

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
        <CheckSquare size={14} className="text-accent" />
        待办事项 <span className="text-text-muted font-normal">({todos.length})</span>
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="添加待办..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary p-2" onClick={handleAdd} disabled={!newText.trim()}>
          <Plus size={14} />
        </button>
      </div>
      {activeTodos.length === 0 && doneTodos.length === 0 && (
        <div className="text-xs text-text-muted text-center py-4">暂无待办</div>
      )}
      {activeTodos.length > 0 && (
        <div className="space-y-1">
          {activeTodos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              isEditing={editingId === todo.id}
              editText={editText}
              onToggle={() => toggleTodo(todo.id)}
              onRemove={() => removeTodo(todo.id)}
              onEditStart={() => {
                setEditingId(todo.id)
                setEditText(todo.text)
              }}
              onEditChange={setEditText}
              onEditSave={async () => {
                if (editText.trim()) await editTodo(todo.id, editText.trim())
                setEditingId(null)
              }}
              onEditCancel={() => setEditingId(null)}
            />
          ))}
        </div>
      )}
      {doneTodos.length > 0 && (
        <details>
          <summary className="text-xs text-text-muted cursor-pointer">
            已完成 ({doneTodos.length})
          </summary>
          <div className="space-y-1 mt-2">
            {doneTodos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                isEditing={false}
                editText=""
                onToggle={() => toggleTodo(todo.id)}
                onRemove={() => removeTodo(todo.id)}
                onEditStart={() => {}}
                onEditChange={() => {}}
                onEditSave={() => {}}
                onEditCancel={() => {}}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function TodoRow({
  todo,
  isEditing,
  editText,
  onToggle,
  onRemove,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
}: {
  todo: { id: string; text: string; done: boolean }
  isEditing: boolean
  editText: string
  onToggle: () => void
  onRemove: () => void
  onEditStart: () => void
  onEditChange: (v: string) => void
  onEditSave: () => void
  onEditCancel: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-surface-hover group transition-colors">
      <button onClick={onToggle} className="text-text-muted hover:text-accent transition-colors">
        {todo.done ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} />}
      </button>
      {isEditing ? (
        <input
          className="input flex-1 py-1 text-sm"
          value={editText}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditSave()
            if (e.key === 'Escape') onEditCancel()
          }}
          autoFocus
        />
      ) : (
        <span
          className={`flex-1 text-sm ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}
        >
          {todo.text}
        </span>
      )}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEditing ? (
          <>
            <button
              onClick={onEditStart}
              className="p-1 rounded hover:bg-bg-surface-hover text-text-muted"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onRemove}
              className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEditSave}
              className="p-1 rounded hover:bg-bg-surface-hover text-text-muted"
            >
              <Check size={12} />
            </button>
            <button
              onClick={onEditCancel}
              className="p-1 rounded hover:bg-bg-surface-hover text-text-muted"
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
