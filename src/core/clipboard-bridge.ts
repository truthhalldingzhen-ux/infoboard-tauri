/**
 * 剪贴板 — Tauri plugin invoke 封装
 *
 * 使用 tauri-plugin-clipboard-manager 实现剪贴板读写
 */

import { writeText as clipboardWriteText } from '@tauri-apps/plugin-clipboard-manager'

/**
 * 将文本写入系统剪贴板
 * 失败时抛出错误，便于调用方降级（如 navigator.clipboard）
 */
export async function writeText(text: string): Promise<void> {
  try {
    await clipboardWriteText(text)
  } catch (err) {
    console.error('[clipboard] writeText 失败:', err)
    throw err instanceof Error ? err : new Error(String(err))
  }
}
