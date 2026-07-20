/**
 * 截图插件 — Tauri invoke 封装
 *
 * start: 截图 + 打开覆盖窗
 * captureOnly: 仅截图返回 data URL（不建窗）
 * confirm: 写剪贴板并关闭覆盖窗
 * cancel: 用户取消，关闭覆盖窗
 * closeOverlay: 仅关窗（浏览器剪贴板已成功时）
 */

import { invoke } from '@tauri-apps/api/core'

/** 开始截图：截全屏并打开覆盖窗 */
export async function start(): Promise<void> {
  await invoke('screenshot_start')
}

/** 仅截图，返回 data URL，不打开覆盖窗 */
export async function captureOnly(): Promise<string> {
  return await invoke<string>('screenshot_capture_only')
}

/** @deprecated 请用 start() 或 captureOnly()，勿再把 start 当纯截图 */
export async function capture(): Promise<string> {
  return captureOnly()
}

export async function confirm(dataUrl: string): Promise<void> {
  await invoke('screenshot_confirm', { dataUrl })
}

export async function cancel(): Promise<void> {
  await invoke('screenshot_cancel')
}

export async function closeOverlay(): Promise<void> {
  await invoke('screenshot_close_overlay')
}
