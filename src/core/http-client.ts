/**
 * 统一 HTTP GET：打包环境强制走 Rust 代理，暴露真实错误
 */

import { invoke } from '@tauri-apps/api/core'

function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // Tauri 2
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}

function formatInvokeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export async function httpGetJson<T = unknown>(url: string, signal?: AbortSignal): Promise<T> {
  if (isTauri()) {
    try {
      const text = await invoke<string>('http_proxy_get', { url })
      try {
        return JSON.parse(text) as T
      } catch (e) {
        throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`)
      }
    } catch (e) {
      // 不回退 fetch：打包 WebView 几乎一定失败，且会掩盖真实原因
      throw new Error(formatInvokeError(e))
    }
  }

  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})`)
  }
  return (await res.json()) as T
}

export async function httpGetText(url: string, signal?: AbortSignal): Promise<string> {
  if (isTauri()) {
    try {
      return await invoke<string>('http_proxy_get', { url })
    } catch (e) {
      throw new Error(formatInvokeError(e))
    }
  }
  const res = await fetch(url, { signal })
  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})`)
  }
  return await res.text()
}
