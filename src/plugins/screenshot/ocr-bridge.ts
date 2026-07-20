/**
 * OCR 插件 — Tauri invoke 封装
 *
 * 提供 OCR 文字识别的 invoke 方法
 */

import { invoke } from '@tauri-apps/api/core'

/** OCR 响应数据结构 */
export interface OcrResponse {
  code: number
  data: unknown // Vec<OcrResult> 或 String 错误信息
}

/** OCR 识别结果 */
export interface OcrResult {
  text: string
  box_coords: [[number, number], [number, number], [number, number], [number, number]]
  score: number
}

/** OCR 引擎状态 */
export interface OcrEngineStatus {
  ready: boolean
  engine_ready: boolean
  engine_path: string
}

/**
 * 对 base64 图片进行文字识别
 *
 * @param imageBase64 - 纯 base64 字符串（不含 data URL 前缀）
 * @returns OCR 响应
 */
export async function recognize(imageBase64: string): Promise<OcrResponse> {
  try {
    return await invoke<OcrResponse>('ocr_recognize', { imageBase64 })
  } catch (err) {
    console.error('[OCR] recognize 失败:', err)
    throw err
  }
}

/**
 * 查询 OCR 引擎是否已就绪
 */
export async function isReady(): Promise<boolean> {
  try {
    return await invoke<boolean>('ocr_is_ready')
  } catch (err) {
    console.error('[OCR] isReady 失败:', err)
    return false
  }
}

/**
 * 获取 OCR 引擎状态
 */
export async function engineStatus(): Promise<OcrEngineStatus> {
  try {
    return await invoke<OcrEngineStatus>('ocr_engine_status')
  } catch (err) {
    console.error('[OCR] engineStatus 失败:', err)
    return { ready: false, engine_ready: false, engine_path: '' }
  }
}
