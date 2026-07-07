import { invoke } from '@tauri-apps/api/core'

export async function windowMinimize() {
  return invoke<void>('window_minimize')
}

export async function windowMaximize() {
  return invoke<void>('window_maximize')
}

export async function windowClose() {
  return invoke<void>('window_close')
}

export async function windowIsMaximized(): Promise<boolean> {
  return invoke<boolean>('window_is_maximized')
}

export async function windowIsVisible(): Promise<boolean> {
  return invoke<boolean>('window_is_visible')
}
