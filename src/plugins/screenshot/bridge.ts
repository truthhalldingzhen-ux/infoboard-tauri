import { invoke } from '@tauri-apps/api/core'

export async function start(): Promise<void> {
  return await invoke('screenshot_start')
}

export async function capture(): Promise<string> {
  return await invoke('screenshot_start')
    .then(() => invoke<string | null>('screenshot_get_image'))
    .then((v) => {
      if (typeof v === 'string') return v
      throw new Error('截图失败')
    })
}

export async function confirm(dataUrl: string): Promise<void> {
  await invoke('screenshot_confirm', { dataUrl })
}

export async function cancel(): Promise<void> {
  await invoke('screenshot_cancel')
}
