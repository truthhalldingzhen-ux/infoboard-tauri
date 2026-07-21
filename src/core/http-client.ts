/**
 * 统一 HTTP GET：优先 Tauri 后端代理（绕过 WebView CSP），失败再降级 fetch
 */

import { invoke } from '@tauri-apps/api/core'

export async function httpGetJson<T = unknown>(url: string, signal?: AbortSignal): Promise<T> {
  // 后端代理不支持 AbortSignal，signal 仅用于纯前端 fetch 路径
  try {
    const text = await invoke<string>('http_proxy_get', { url })
    return JSON.parse(text) as T
  } catch (proxyErr) {
    // 非 Tauri / 白名单拒绝时降级
    const res = await fetch(url, { signal })
    if (!res.ok) {
      throw new Error(`请求失败 (${res.status})`)
    }
    return (await res.json()) as T
  }
}

export async function httpGetText(url: string, signal?: AbortSignal): Promise<string> {
  try {
    return await invoke<string>('http_proxy_get', { url })
  } catch {
    const res = await fetch(url, { signal })
    if (!res.ok) {
      throw new Error(`请求失败 (${res.status})`)
    }
    return await res.text()
  }
}
