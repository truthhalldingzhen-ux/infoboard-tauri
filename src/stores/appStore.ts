import { create } from 'zustand'

interface AppState {
  theme: 'light' | 'dark' | 'pink-purple'
  sidebarCollapsed: boolean
  isMaximized: boolean
  activePluginId: string
  setTheme: (theme: 'light' | 'dark' | 'pink-purple') => void
  toggleSidebar: () => void
  setMaximized: (v: boolean) => void
  setActivePluginId: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  sidebarCollapsed: false,
  isMaximized: false,
  activePluginId: '',
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMaximized: (isMaximized) => set({ isMaximized }),
  setActivePluginId: (activePluginId) => set({ activePluginId }),
}))
