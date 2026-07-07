/**
 * 媒体控制 Hook
 *
 * 提供媒体会话状态和控制方法
 * 自动监听 SMTC 会话变化，实时更新状态
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MediaSession, PlaybackStatus } from './types'

/** B站信息缓存：title → enriched data */
const bilibiliCache = new Map<
  string,
  { thumbnail: string; artist: string; ownerAvatar: string; expires: number }
>()
const BILI_CACHE_TTL = 30 * 60 * 1000 // 30 分钟

/** Hook 返回值类型 */
interface UseMediaControlReturn {
  /** 当前媒体会话（null 表示无活跃会话） */
  currentMedia: MediaSession | null

  /** 是否正在加载 */
  isLoading: boolean

  /** 错误信息 */
  error: string | null

  /** 发送播放控制命令 */
  sendCommand: (command: 'play' | 'pause' | 'toggle' | 'next' | 'previous') => Promise<boolean>

  /** 手动刷新会话 */
  refresh: () => Promise<void>
}

/**
 * 媒体控制 Hook
 *
 * 通过轮询 SMTC 会话状态（每 2 秒）
 * 使用已验证可用的 getCurrentSession IPC 调用
 */
export function useMediaControl(): UseMediaControlReturn {
  const [currentMedia, setCurrentMedia] = useState<MediaSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** 保存 sendCommand 中 setTimeout 的引用，用于卸载时清理 */
  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAPIAvailable = useCallback(() => {
    return typeof window !== 'undefined' && window.mediaControl != null
  }, [])

  const fetchSession = useCallback(async () => {
    if (!isAPIAvailable()) {
      setIsLoading(false)
      return
    }

    try {
      setError(null)
      const session = await window.mediaControl.getCurrentSession()

      // 检测B站来源，自动补充封面和UP主信息
      if (session && isBilibiliSource(session.sourceAppId) && session.title) {
        const enriched = await enrichBilibiliSession(session)
        setCurrentMedia(enriched)
      } else {
        setCurrentMedia(session)
      }
    } catch (err) {
      console.error('[useMediaControl] 获取会话失败:', err)
      setError('获取媒体会话失败')
    } finally {
      setIsLoading(false)
    }
  }, [isAPIAvailable])

  /**
   * 发送播放控制命令
   */
  const sendCommand = useCallback(
    async (command: 'play' | 'pause' | 'toggle' | 'next' | 'previous') => {
      if (!isAPIAvailable()) {
        console.warn('[useMediaControl] mediaControl API 不可用')
        return false
      }

      try {
        const success = await window.mediaControl.sendCommand(command)

        // 命令发送后延迟刷新状态（等待 SMTC 更新）
        if (success) {
          // 清除前一个超时（防止快速连续点击导致堆积）
          if (commandTimeoutRef.current) {
            clearTimeout(commandTimeoutRef.current)
          }
          commandTimeoutRef.current = setTimeout(() => {
            commandTimeoutRef.current = null
            fetchSession()
          }, 500)
        }

        return success
      } catch (err) {
        console.error('[useMediaControl] 发送命令失败:', err)
        return false
      }
    },
    [isAPIAvailable, fetchSession]
  )

  const refresh = useCallback(async () => {
    setIsLoading(true)
    await fetchSession()
  }, [fetchSession])

  /**
   * 初始化：立即获取 + 每 2 秒轮询
   */
  useEffect(() => {
    if (!isAPIAvailable()) {
      console.warn('[useMediaControl] mediaControl API 不可用，跳过初始化')
      setIsLoading(false)
      return
    }

    let unmounted = false

    // 立即获取一次
    fetchSession().catch(() => {})

    // 每 2 秒轮询
    const timer = setInterval(() => {
      if (!unmounted) fetchSession().catch(() => {})
    }, 2000)

    return () => {
      unmounted = true
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current)
      }
      clearInterval(timer)
    }
  }, [isAPIAvailable, fetchSession])

  return {
    currentMedia,
    isLoading,
    error,
    sendCommand,
    refresh,
  }
}

/**
 * 格式化播放状态为中文
 */
export function formatPlaybackStatus(status: PlaybackStatus): string {
  switch (status) {
    case 'playing':
      return '播放中'
    case 'paused':
      return '已暂停'
    case 'stopped':
      return '已停止'
    case 'closed':
      return '已关闭'
    default:
      return '未知'
  }
}

// ─── B站信息补充 ───

/** 判断是否为B站来源 */
function isBilibiliSource(sourceAppId: string): boolean {
  if (!sourceAppId) return false
  const lower = sourceAppId.toLowerCase()
  return lower.includes('bilibili') || lower.includes('哔哩哔哩')
}

/** 补充B站媒体会话信息（封面 + UP主） */
async function enrichBilibiliSession(session: MediaSession): Promise<MediaSession> {
  const title = session.title

  // 检查缓存
  const cached = bilibiliCache.get(title)
  if (cached && cached.expires > Date.now()) {
    return {
      ...session,
      thumbnail: cached.thumbnail || session.thumbnail,
      artist: cached.artist || session.artist,
      ownerAvatar: cached.ownerAvatar,
    }
  }

  // 调用主进程 API 获取B站视频信息
  try {
    if (!window.bilibiliInfoAPI) return session

    const info = await window.bilibiliInfoAPI.enrichMedia(title)
    if (!info) return session

    // 写入缓存
    bilibiliCache.set(title, {
      thumbnail: info.cover,
      artist: info.ownerName,
      ownerAvatar: info.ownerAvatar,
      expires: Date.now() + BILI_CACHE_TTL,
    })

    return {
      ...session,
      thumbnail: info.cover || session.thumbnail,
      artist: info.ownerName || session.artist,
      ownerAvatar: info.ownerAvatar,
    }
  } catch (err) {
    console.error('[useMediaControl] B站信息补充失败:', err)
    return session
  }
}
