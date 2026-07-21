/**
 * 小牛翻译 — Tauri command invoke 封装
 */

import { invoke } from '@tauri-apps/api/core'
import type { TranslateResult } from './types'

export interface TranslateConfig {
  has_key: boolean
  app_id: string
  api_key_mask: string
}

/** 把 Tauri invoke 错误转成可读字符串（常为 string，不是 Error） */
export function formatInvokeError(err: unknown): string {
  if (err instanceof Error) return err.message || String(err)
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    if (typeof o.message === 'string') return o.message
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err ?? '未知错误')
}

/**
 * 翻译文本
 * @param text 原文
 * @param targetLang 目标语言（如 zh / en）
 * @param fromLang 源语言，默认 auto
 */
export async function translate(
  text: string,
  targetLang: string,
  fromLang = 'auto'
): Promise<TranslateResult> {
  try {
    return await invoke<TranslateResult>('niutrans_translate', {
      text,
      from: fromLang,
      to: targetLang,
    })
  } catch (e) {
    throw new Error(formatInvokeError(e))
  }
}

export async function setApiKey(key: string): Promise<void> {
  await invoke('niutrans_set_api_key', { key })
}

export async function setAppId(id: string): Promise<void> {
  await invoke('niutrans_set_app_id', { appId: id })
}

export async function hasApiKey(): Promise<boolean> {
  return await invoke<boolean>('niutrans_has_api_key')
}

export async function getConfig(): Promise<TranslateConfig> {
  return await invoke<TranslateConfig>('niutrans_get_config')
}

export async function getCharCount(): Promise<number> {
  return await invoke<number>('niutrans_get_char_count')
}
