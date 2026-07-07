import { create } from 'zustand'
import { load } from '@tauri-apps/plugin-store'
import type { SettingsState } from './types'
import { DEFAULT_SETTINGS } from './types'

const STORE_FILE = 'settings.json'

let store: Awaited<ReturnType<typeof load>> | null = null

async function getStore() {
  if (!store) store = await load(STORE_FILE, { autoSave: true, defaults: { settings: {} } })
  return store
}

interface SettingsStore extends SettingsState {
  loaded: boolean
  init: () => Promise<void>
  setTheme: (theme: 'light' | 'dark' | 'pink-purple') => void
  togglePlugin: (id: string) => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  init: async () => {
    try {
      const s = await getStore()
      const saved = await s.get<SettingsState>('settings')
      if (saved) {
        set({ ...saved, loaded: true })
        document.documentElement.setAttribute('data-theme', saved.theme)
      } else {
        set({ loaded: true })
      }
    } catch {
      set({ loaded: true })
    }
  },

  setTheme: async (theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
    try {
      const s = await getStore()
      await s.set('settings', { ...get(), theme })
    } catch {
      /* */
    }
  },

  togglePlugin: async (id) => {
    const current = get().disabledPlugins
    const next = current.includes(id) ? current.filter((d) => d !== id) : [...current, id]
    set({ disabledPlugins: next })
    try {
      const s = await getStore()
      await s.set('settings', { ...get(), disabledPlugins: next })
    } catch {
      /* */
    }
  },
}))
