/**
 * MusicPlayer 本地 HTTP 桥
 *
 * 轮询 127.0.0.1:17831（可选本地播放器）。
 * 离线时指数退避，避免控制台 ERR_CONNECTION_REFUSED 刷屏。
 */

import { useState, useEffect } from 'react'

const PLAYER_API_URL = 'http://127.0.0.1:17831/state'
/** 在线时轮询间隔 */
const ONLINE_POLL_MS = 1000
/** 离线退避：1s → 2s → 4s → … → 30s */
const OFFLINE_MIN_MS = 1000
const OFFLINE_MAX_MS = 30_000

interface LyricLine {
  time: number
  text: string
}

interface RawResponse {
  active: boolean
  state: 'playing' | 'paused' | 'stopped'
  title: string
  artist: string
  thumbnail: string
  position: number
  duration: number
  lyricsOffset: number
  lyrics: LyricLine[]
}

interface PlayerState {
  isOnline: boolean
  playbackState: 'playing' | 'paused' | 'stopped'
  title: string
  artist: string
  thumbnail: string
  position: number
  duration: number
  lyrics: LyricLine[]
  lyricsOffset: number
}

const OFFLINE_STATE: PlayerState = {
  isOnline: false,
  playbackState: 'stopped',
  title: '',
  artist: '',
  thumbnail: '',
  position: 0,
  duration: 0,
  lyrics: [],
  lyricsOffset: 0,
}

export function useMusicPlayerBridge(): PlayerState {
  const [state, setState] = useState<PlayerState>(OFFLINE_STATE)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let animFrame: number | null = null
    let lastServerPos = 0
    let lastServerTime = 0
    let playing = false
    let duration = 0
    /** 连续失败次数，用于退避 */
    let failStreak = 0
    /** 仅首次离线打一次日志，避免刷屏 */
    let loggedOffline = false

    const scheduleNext = (ms: number) => {
      if (cancelled) return
      timer = setTimeout(() => {
        void fetchState()
      }, ms)
    }

    const fetchState = async () => {
      try {
        const resp = await fetch(PLAYER_API_URL, {
          signal: AbortSignal.timeout(1500),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data: RawResponse = await resp.json()

        failStreak = 0
        if (loggedOffline) {
          console.log('[MusicPlayer] 本地播放器已连接')
          loggedOffline = false
        }

        lastServerPos = data.position
        lastServerTime = performance.now()
        playing = data.state === 'playing'
        duration = data.duration

        if (!cancelled) {
          setState({
            isOnline: data.active,
            playbackState: data.state,
            title: data.title || '',
            artist: data.artist || '',
            thumbnail: data.thumbnail || '',
            position: data.position,
            duration: data.duration,
            lyrics: data.lyrics || [],
            lyricsOffset: data.lyricsOffset || 0,
          })
        }
        scheduleNext(ONLINE_POLL_MS)
      } catch {
        // 本地服务未启动是正常情况，静默退避
        failStreak += 1
        playing = false
        if (!loggedOffline) {
          console.info(
            '[MusicPlayer] 本地服务未运行 (127.0.0.1:17831)，已暂停高频轮询；启动 MusicPlayer 后自动恢复'
          )
          loggedOffline = true
        }
        if (!cancelled) {
          setState((prev) => {
            if (!prev.isOnline && prev.playbackState === 'stopped') return prev
            return { ...OFFLINE_STATE }
          })
        }
        const backoff = Math.min(
          OFFLINE_MAX_MS,
          OFFLINE_MIN_MS * Math.pow(2, Math.min(failStreak - 1, 5))
        )
        scheduleNext(backoff)
      }
    }

    // 仅在线播放时做进度插值，离线不推进 position
    const interpolate = () => {
      if (cancelled) return
      if (playing && lastServerTime > 0) {
        const elapsed = (performance.now() - lastServerTime) / 1000
        const estimated = lastServerPos + elapsed
        if (estimated < duration) {
          setState((prev) => (prev.isOnline ? { ...prev, position: estimated } : prev))
        }
      }
      animFrame = requestAnimationFrame(interpolate)
    }

    void fetchState()
    animFrame = requestAnimationFrame(interpolate)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (animFrame !== null) cancelAnimationFrame(animFrame)
    }
  }, [])

  return state
}
