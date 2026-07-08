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
    getUsage: () => {
      console.log('[opencode] 调用 getUsage')
      return invoke('opencode_get_usage')
        .then((r) => {
          console.log('[opencode] getUsage 结果:', r)
          return r
        })
        .catch((e) => {
          console.error('[opencode] getUsage 失败:', e)
          throw e
        })
    },
    getSessions: () => invoke('opencode_get_sessions'),
    getMiniMax: () => {
      console.log('[opencode] 调用 getMiniMax')
      // 从设置中读取 MiniMax API Key
      let apiKey: string | undefined
      try {
        const s = localStorage.getItem('infoboard-settings')
        if (s) apiKey = JSON.parse(s).minimaxApiKey
      } catch {
        /* */
      }
      return invoke('opencode_get_minimax', { apiKey: apiKey || '' })
        .then((r) => {
          console.log('[opencode] getMiniMax 结果:', r)
          return r
        })
        .catch((e) => {
          console.error('[opencode] getMiniMax 失败:', e)
          throw e
        })
    },
    refreshCookie: () => invoke('opencode_refresh_cookie'),
    getCookieMtime: () => invoke('opencode_get_cookie_mtime'),
  }

  window.toastAPI = {
    show: (data) => {
      window.dispatchEvent(new CustomEvent('toast-show', { detail: data }))
    },
  }
}
