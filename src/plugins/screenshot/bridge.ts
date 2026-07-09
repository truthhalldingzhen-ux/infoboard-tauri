/**
 * 截图插件 — Tauri invoke 封装
 *
 * 提供截图全流程的 invoke 方法
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * 截取全屏，返回 data:image/png;base64,... 格式的 data URL
 */
export async function capture(): Promise<string> {
  try {
    return await invoke<string>('screenshot_capture')
  } catch (err) {
    console.error('[截图] capture 失败:', err)
    throw err
  }
}

/**
 * 确认截图：将裁剪后的 data URL 写入剪贴板
 *
 * @param dataUrl - 裁剪后的 data:image/png;base64,... 格式
 */
export async function confirmScreenshot(dataUrl: string): Promise<void> {
  try {
    await invoke('screenshot_confirm', { dataUrl })
  } catch (err) {
    console.error('[截图] confirmScreenshot 失败:', err)
    throw err
  }
}

/**
 * 取消截图
 */
export async function cancelScreenshot(): Promise<void> {
  try {
    await invoke('screenshot_cancel')
  } catch (err) {
    console.error('[截图] cancelScreenshot 失败:', err)
  }
}
