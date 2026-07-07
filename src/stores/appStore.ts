import { create } from 'zustand'

interface AppState {
  theme: 'light' | 'dark' | 'pink-purple'
  sidebarCollapsed: boolean
  isMaximized: boolean
  setTheme: (theme: 'light' | 'dark' | 'pink-purple') => void
  toggleSidebar: () => void
  setMaximized: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  sidebarCollapsed: false,
  isMaximized: false,
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMaximized: (isMaximized) => set({ isMaximized }),
}))
