export {}

declare global {
  /** OCR 识别结果 */
  interface OcrResultItem {
    text: string
    box: [number, number][]
    score: number
  }

  interface OcrResponse {
    code: number
    data: OcrResultItem[] | string
  }

  /** OpenCode 用量统计（与 plugins/opencode-go/types 对齐） */
  interface OpenCodeUsageStats {
    dbExists: boolean
    todayTokens: number
    weeklyTokens: number
    monthlyTokens: number
    timestamp: number
    error?: string
    rollingResetInSec?: number
    weeklyResetInSec?: number
    monthlyResetInSec?: number
  }

  interface OpenCodeSessionInfo {
    id: string
    modelId: string
    tokens: number
    timeCreated: number
  }

  interface OpenCodeMiniMaxUsage {
    rollingUsed: number
    rollingResetMs: number
    weeklyUsed: number
    weeklyResetMs: number
    rollingResetLabel: string
    weeklyResetLabel: string
  }

  interface OpenCodeRefreshResult {
    started?: boolean
    message?: string
    ok?: boolean
    error?: string
    mtime?: number
  }

  interface OpenCodeDB {
    getUsage: () => Promise<OpenCodeUsageStats | null>
    getSessions: (limit?: number) => Promise<OpenCodeSessionInfo[]>
    getMiniMax: () => Promise<OpenCodeMiniMaxUsage | null>
    refreshCookie: () => Promise<OpenCodeRefreshResult | null>
    getCookieMtime: () => Promise<number>
  }

  /** 系统/IP 定位结果 */
  type GeolocateResult =
    | { lat: number; lon: number }
    | { latitude: number; longitude: number }
    | { error: string; reason?: string }
    | null

  interface ElectronAPI {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    isVisible: () => Promise<boolean>
    platform: string
    geolocate: () => Promise<GeolocateResult>
    toggleTitleBar: () => Promise<boolean>
    titleBarVisible: () => Promise<boolean>
    setAutoStart: (enabled: boolean) => Promise<boolean>
    getAutoStart: () => Promise<boolean>
    startScreenshot: () => void
    confirmScreenshot: (dataUrl: string) => void
    cancelScreenshot: () => void
    onScreenData: (callback: (dataUrl: string) => void) => void
    ocrRecognize: (dataUrl: string) => Promise<OcrResponse>
  }

  interface ToastAPI {
    show: (data: { message: string; color?: string; bg?: string; duration?: number }) => void
  }

  interface ClipboardBridge {
    writeText: (text: string) => Promise<void>
  }

  interface TranslateApiBridge {
    translate: (...args: unknown[]) => Promise<unknown>
    [key: string]: unknown
  }

  interface Window {
    electronAPI: ElectronAPI
    opencodeDB: OpenCodeDB
    deeplAPI?: TranslateApiBridge
    niutransAPI?: TranslateApiBridge
    clipboard?: ClipboardBridge
    toastAPI: ToastAPI
  }
}
