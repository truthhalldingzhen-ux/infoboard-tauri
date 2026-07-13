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

interface OpenCodeDB {
  getUsage: () => Promise<any>
  getSessions: (limit?: number) => Promise<any>
  getMiniMax: () => Promise<any>
  refreshCookie: () => Promise<any>
  getCookieMtime: () => Promise<number>
}

interface ElectronAPI {
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  isVisible: () => Promise<boolean>
  platform: string
  geolocate: () => Promise<any>
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

declare global {
  interface Window {
    electronAPI: ElectronAPI
    opencodeDB: OpenCodeDB
    deeplAPI?: any
    niutransAPI?: any
    clipboard?: any
    toastAPI: ToastAPI
    mailControl: any
    mediaControl: any
    bilibiliInfoAPI: any
  }
}

export {}
