/**
 * 开机自启动 — Tauri command invoke 封装
 *
 * 提供 isEnabled / setEnabled 两个方法
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * 查询当前是否已启用开机自启动
 */
export async function isEnabled(): Promise<boolean> {
  return await invoke<boolean>('autostart_is_enabled')
}

/**
 * 设置开机自启动
 *
 * @param enabled - true 启用，false 禁用
 */
export async function setEnabled(enabled: boolean): Promise<void> {
  await invoke('autostart_set_enabled', { enabled })
}
