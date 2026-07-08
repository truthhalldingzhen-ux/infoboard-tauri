/**
 * 小牛翻译 — Tauri command invoke 封装
 *
 * 提供 6 个方法，对应后端 6 个 niutrans_* 命令
 */

import { invoke } from '@tauri-apps/api/core'
import type { TranslateResult } from './types'

export interface TranslateConfig {
  has_key: boolean
  app_id: string
  api_key_mask: string
}

/**
 * 翻译文本
 *
 * @param text - 要翻译的文本
 * @param targetLang - 目标语言代码（如 'zh', 'en', 'ja'）
 */
export async function translate(text: string, targetLang: string): Promise<TranslateResult> {
  return await invoke<TranslateResult>('niutrans_translate', {
    text,
    targetLang,
  })
}

/**
 * 设置 API Key
 */
export async function setApiKey(key: string): Promise<void> {
  await invoke('niutrans_set_api_key', { key })
}

/**
 * 设置 App ID
 */
export async function setAppId(id: string): Promise<void> {
  await invoke('niutrans_set_app_id', { id })
}

/**
 * 检查是否已配置 API Key 和 App ID
 */
export async function hasApiKey(): Promise<boolean> {
  return await invoke<boolean>('niutrans_has_api_key')
}

/**
 * 获取配置信息（带掩码）
 */
export async function getConfig(): Promise<TranslateConfig> {
  return await invoke<TranslateConfig>('niutrans_get_config')
}

/**
 * 获取累计翻译字符数
 */
export async function getCharCount(): Promise<number> {
  return await invoke<number>('niutrans_get_char_count')
}
