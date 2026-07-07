import { useEffect, useState, useCallback } from 'react'
import { load } from '@tauri-apps/plugin-store'
import type { TodoItem } from './types'

const STORE_FILE = 'todo.json'

let store: Awaited<ReturnType<typeof load>> | null = null

async function getStore() {
  if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: { todos: [] } })
  return store
}

async function loadTodos(): Promise<TodoItem[]> {
  try {
    const s = await getStore()
    return (await s.get<TodoItem[]>('todos')) || []
  } catch {
    return []
  }
}

async function saveTodos(todos: TodoItem[]) {
  try {
    const s = await getStore()
    await s.set('todos', todos)
  } catch {
    console.warn('[待办] 保存失败')
  }
}

export function useTodo() {
  const [todos, setTodos] = useState<TodoItem[]>([])

  useEffect(() => {
    loadTodos().then(setTodos)
  }, [])

  const addTodo = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const newTodo: TodoItem = {
        id: crypto.randomUUID(),
        text: text.trim(),
        done: false,
        createdAt: Date.now(),
      }
      const next = [...todos, newTodo]
      setTodos(next)
      await saveTodos(next)
    },
    [todos]
  )

  const toggleTodo = useCallback(
    async (id: string) => {
      const next = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
      setTodos(next)
      await saveTodos(next)
    },
    [todos]
  )

  const removeTodo = useCallback(
    async (id: string) => {
      const next = todos.filter((t) => t.id !== id)
      setTodos(next)
      await saveTodos(next)
    },
    [todos]
  )

  const editTodo = useCallback(
    async (id: string, text: string) => {
      const next = todos.map((t) => (t.id === id ? { ...t, text } : t))
      setTodos(next)
      await saveTodos(next)
    },
    [todos]
  )

  return { todos, addTodo, toggleTodo, removeTodo, editTodo }
}
