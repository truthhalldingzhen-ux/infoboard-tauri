import { useRef, useEffect, useMemo, forwardRef } from 'react'

interface LyricLine {
  time: number
  text: string
}

interface LyricsViewProps {
  lyrics: LyricLine[]
  currentIndex: number
  loading: boolean
  height?: number
}

const LyricsPanel = forwardRef<HTMLDivElement, { lyrics: LyricLine[]; currentIndex: number }>(
  ({ lyrics, currentIndex }, ref) => {
    const isSynced = lyrics.some((l) => l.time > 0)
    return (
      <div
        ref={ref}
        className="w-full overflow-y-auto"
        style={{ scrollBehavior: 'smooth', maxHeight: 200 }}
      >
        <div className="space-y-1.5 px-1">
          {lyrics.map((line, i) => {
            const isCurrent = isSynced && i === currentIndex
            return (
              <p
                key={i}
                className="leading-relaxed transition-all duration-300 text-center"
                style={{
                  color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isCurrent ? 600 : 400,
                  fontSize: isCurrent ? '0.9rem' : '0.78rem',
                  opacity: isSynced ? (isCurrent ? 1 : 0.45) : 0.7,
                }}
              >
                {line.text}
              </p>
            )
          })}
        </div>
      </div>
    )
  }
)

export function LyricsView({ lyrics, currentIndex, loading, height }: LyricsViewProps) {
  const lyricsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentIndex >= 0 && lyricsRef.current) {
      const el = lyricsRef.current.children[0]?.children[currentIndex] as HTMLElement
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex])

  if (loading) {
    return (
      <div
        className="w-full flex items-center justify-center py-6"
        style={{ height: height || 'auto' }}
      >
        <p className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>
          正在获取歌词...
        </p>
      </div>
    )
  }

  if (!lyrics.length) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center py-6"
        style={{ height: height || 'auto' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          暂无歌词
        </p>
      </div>
    )
  }

  return <LyricsPanel ref={lyricsRef} lyrics={lyrics} currentIndex={currentIndex} />
}
