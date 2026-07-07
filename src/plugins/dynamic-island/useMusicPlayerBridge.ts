import { useState, useEffect, useRef } from 'react'

const POLL_INTERVAL = 1000
const PLAYER_API_URL = 'http://127.0.0.1:17831/state'

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

export function useMusicPlayerBridge(): PlayerState {
  const [state, setState] = useState<PlayerState>({
    isOnline: false,
    playbackState: 'stopped',
    title: '',
    artist: '',
    thumbnail: '',
    position: 0,
    duration: 0,
    lyrics: [],
    lyricsOffset: 0,
  })

  const prevOnlineRef = useRef(false)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let animFrame: number | null = null
    let lastServerPos = 0
    let lastServerTime = 0
    let playing = false
    let duration = 0

    const fetchState = async () => {
      try {
        const resp = await fetch(PLAYER_API_URL, { signal: AbortSignal.timeout(2000) })
        if (!resp.ok) throw new Error('not ok')
        const data: RawResponse = await resp.json()
        lastServerPos = data.position
        lastServerTime = performance.now()
        playing = data.state === 'playing'
        duration = data.duration

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
      } catch {
        setState((prev) => {
          if (!prev.isOnline) return prev
          return { ...prev, isOnline: false, playbackState: 'stopped' }
        })
      }
    }

    // 高频插值：基于服务端实时 position + 本地 elapsed 做平滑推进
    const interpolate = () => {
      if (playing && lastServerTime > 0) {
        const elapsed = (performance.now() - lastServerTime) / 1000
        const estimated = lastServerPos + elapsed
        if (estimated < duration) {
          setState((prev) =>
            prev.isOnline
              ? {
                  ...prev,
                  position: estimated,
                }
              : prev
          )
        }
      }
      animFrame = requestAnimationFrame(interpolate)
    }

    fetchState()
    timer = setInterval(fetchState, POLL_INTERVAL)
    animFrame = requestAnimationFrame(interpolate)

    return () => {
      if (timer) clearInterval(timer)
      if (animFrame !== null) cancelAnimationFrame(animFrame)
    }
  }, [])

  return state
}
