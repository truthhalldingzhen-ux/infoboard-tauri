/**
 * 剪贴板 — Tauri plugin invoke 封装
 *
 * 使用 tauri-plugin-clipboard-manager 实现剪贴板读写
 */

import { writeText as clipboardWriteText } from '@tauri-apps/plugin-clipboard-manager'

/**
 * 将文本写入系统剪贴板
 *
 * @param text - 要写入的文本
 *
 * @example
 * ```ts
 * await writeText('验证码: 123456')
 * ```
 */
export async function writeText(text: string): Promise<void> {
  try {
    await clipboardWriteText(text)
  } catch (err) {
    console.error('[clipboard] writeText 失败:', err)
  }
}
