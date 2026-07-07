import { invoke } from '@tauri-apps/api/core'

/** 将旧版 Electron IPC 映射到 Tauri invoke */
export function initTauriShim() {
  window.electronAPI = {
    minimize: () => invoke('window_minimize'),
    maximize: () => invoke('window_maximize'),
    close: () => invoke('window_close'),
    isMaximized: () => invoke('window_is_maximized'),
    isVisible: () => invoke('window_is_visible'),
    platform: 'win32',
    toggleTitleBar: async () => {
      window.dispatchEvent(new CustomEvent('toggle-titlebar'))
      return true
    },
    titleBarVisible: async () => true,
    setAutoStart: async () => false,
    getAutoStart: async () => false,
    startScreenshot: () => {
      /* 暂不支持 */
    },
    confirmScreenshot: () => {},
    cancelScreenshot: () => {},
    onScreenData: () => {},
    ocrRecognize: async () => ({ code: -1, data: '暂不支持' }),
  }

  window.opencodeDB = {
    getUsage: () => invoke('opencode_get_usage'),
    getSessions: () => invoke('opencode_get_sessions'),
    getMiniMax: () => invoke('opencode_get_minimax'),
    refreshCookie: () => invoke('opencode_refresh_cookie'),
    getCookieMtime: () => invoke('opencode_get_cookie_mtime'),
  }

  window.toastAPI = {
    show: (data) => {
      window.dispatchEvent(new CustomEvent('toast-show', { detail: data }))
    },
  }
}
