/**
 * B站视频信息补充 — Tauri invoke 封装
 *
 * 通过 B站公开 API 搜索视频标题，获取封面图、UP主名称/头像、BV 号、播放量/弹幕数
 */

import { invoke } from '@tauri-apps/api/core'

/** B站视频信息 */
export interface BilibiliVideoInfo {
  /** 封面图 URL */
  cover: string
  /** UP主名称 */
  ownerName: string
  /** UP主头像 URL */
  ownerAvatar: string
  /** BV 号 */
  bvid: string
  /** 播放量 */
  playCount: number
  /** 弹幕数 */
  danmakuCount: number
}

/**
 * 补充 B站视频信息
 *
 * @param title - 视频标题
 * @returns B站视频信息，失败或无匹配时返回 null
 *
 * @example
 * ```ts
 * const info = await enrichMedia('【4K】赛博朋克2077 全剧情电影')
 * if (info) {
 *   console.log(info.ownerName) // "影视飓风"
 * }
 * ```
 */
export async function enrichMedia(title: string): Promise<BilibiliVideoInfo | null> {
  try {
    return await invoke<BilibiliVideoInfo | null>('bilibili_enrich_media', { title })
  } catch (err) {
    console.error('[bilibili-info] enrichMedia 失败:', err)
    return null
  }
}
