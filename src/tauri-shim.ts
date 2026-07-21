import { invoke } from '@tauri-apps/api/core'
import * as autostart from './core/autostart-bridge'

/** 将旧版 Electron IPC 映射到 Tauri invoke */
export function initTauriShim() {
  window.electronAPI = {
    minimize: () => invoke<void>('window_minimize'),
    maximize: () => invoke<void>('window_maximize'),
    close: () => invoke<void>('window_close'),
    isMaximized: () => invoke<boolean>('window_is_maximized'),
    isVisible: () => invoke<boolean>('window_is_visible'),
    platform: 'win32',
    geolocate: () => invoke<GeolocateResult>('geolocate_ip'),
    toggleTitleBar: async () => {
      window.dispatchEvent(new CustomEvent('toggle-titlebar'))
      return true
    },
    titleBarVisible: async () => true,
    setAutoStart: (enabled: boolean) => autostart.setEnabled(enabled).then(() => true),
    getAutoStart: () => autostart.isEnabled(),
    startScreenshot: () => invoke('screenshot_start'),
    confirmScreenshot: (dataUrl: string) => invoke('screenshot_confirm', { dataUrl }),
    cancelScreenshot: () => invoke('screenshot_cancel'),
    onScreenData: (cb: (dataUrl: string) => void) => {
      invoke('screenshot_get_image').then((v) => {
        if (typeof v === 'string') cb(v)
      })
    },
    ocrRecognize: async (imageBase64: string) =>
      invoke<OcrResponse>('ocr_recognize', { imageBase64 }),
  }

  window.opencodeDB = {
    getUsage: () => {
      console.log('[opencode] 调用 getUsage')
      return invoke<OpenCodeUsageStats>('opencode_get_usage')
        .then((r) => {
          console.log('[opencode] getUsage 结果:', r)
          return r
        })
        .catch((e) => {
          console.error('[opencode] getUsage 失败:', e)
          throw e
        })
    },
    getSessions: (limit?: number) =>
      invoke<OpenCodeSessionInfo[]>('opencode_get_sessions', { limit }),
    getMiniMax: () => {
      console.log('[opencode] 调用 getMiniMax')
      // 从设置中读取 MiniMax API Key
      let apiKey: string | undefined
      try {
        const s = localStorage.getItem('infoboard-settings')
        if (s) apiKey = (JSON.parse(s) as { minimaxApiKey?: string }).minimaxApiKey
      } catch {
        /* */
      }
      return invoke<OpenCodeMiniMaxUsage>('opencode_get_minimax', {
        apiKey: apiKey || null,
      })
        .then((r) => {
          console.log('[opencode] getMiniMax 结果:', r)
          return r
        })
        .catch((e) => {
          const msg = String(e)
          if (msg.includes('未配置 MiniMax')) {
            console.warn('[opencode] MiniMax 未配置，已跳过')
          } else {
            console.error('[opencode] getMiniMax 失败:', e)
          }
          throw e
        })
    },
    refreshCookie: () => invoke<OpenCodeRefreshResult>('opencode_refresh_cookie'),
    getCookieMtime: () => invoke<number>('opencode_get_cookie_mtime'),
  }

  window.toastAPI = {
    show: (data) => {
      window.dispatchEvent(new CustomEvent('toast-show', { detail: data }))
    },
  }
}
