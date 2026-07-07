/**
 * 灵动岛插件 — 主组件
 *
 * 负责：
 * 1. 集成真实 SMTC 媒体数据（Phase 4b）
 * 2. 渲染收缩态和展开态
 * 3. 点击展开/收缩交互（由 InfoSection 控制）
 *
 * 数据源：
 * - 媒体数据：通过 useMediaControl hook 获取真实 SMTC 数据
 * - 通知数据：通过 useNotifications hook 获取 IMAP 邮件数据
 * - Mock 数据：仅开发环境可用，用于测试 UI
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import type { PluginComponentProps } from '../../core/types'
import type { PillState, MediaSession, NotificationItem } from './types'
import { useMediaControl } from './useMediaControl'
import { useNotifications } from './useNotifications'
import { PillCollapsed } from './PillCollapsed'
import { MediaControls } from './MediaControls'
import { useMusicPlayerBridge } from './useMusicPlayerBridge'
import { LyricsView } from './LyricsView'
import { eventBus } from '../../core/eventBus'

// ─── Mock 数据（模块级，避免每次渲染重建） ───

const MOCK_MEDIA: MediaSession = {
  title: '【4K】赛博朋克2077 全剧情电影',
  artist: '影视飓风',
  playbackStatus: 'playing',
  sourceAppId: 'bilibili.exe',
  thumbnail: '',
  ownerAvatar: '',
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'email',
    title: '张伟',
    body: '关于项目的更新...',
    timestamp: Date.now() - 120000,
    read: false,
  },
  {
    id: '2',
    type: 'email',
    title: '李娜',
    body: '周报请查收',
    timestamp: Date.now() - 300000,
    read: true,
  },
  {
    id: '3',
    type: 'email',
    title: '王小明',
    body: '请确认下周会议时间',
    timestamp: Date.now() - 720000,
    read: false,
  },
]

/**
 * 灵动岛主组件
 */
export function DynamicIsland({ manifest, expanded }: PluginComponentProps) {
  // ─── 真实媒体数据（SMTC） ───

  const {
    currentMedia: smtcMedia,
    isLoading: isMediaLoading,
    error: mediaError,
    sendCommand,
  } = useMediaControl()

  // ─── MusicPlayer 桥接 ───

  const mpState = useMusicPlayerBridge()

  const mpCurrentIndex = useMemo(() => {
    if (!mpState.isOnline || mpState.lyrics.length === 0) return -1
    const adjustedTime = mpState.position + (mpState.lyricsOffset || 0)
    const isSynced = mpState.lyrics.some((l) => l.time > 0)
    if (!isSynced) return -1
    let idx = -1
    for (let i = 0; i < mpState.lyrics.length; i++) {
      if (mpState.lyrics[i].time <= adjustedTime) idx = i
      else break
    }
    return idx
  }, [mpState.lyrics, mpState.position, mpState.lyricsOffset])

  // ─── 真实通知数据（IMAP 邮件） ───

  const {
    notifications: realNotifications,
    connected: mailConnected,
    markAllRead,
    fetchContent,
  } = useNotifications()

  // ─── 通知交互状态 ───

  const [notificationsExpanded, setNotificationsExpanded] = useState(false)
  const [selectedMailUid, setSelectedMailUid] = useState<number | null>(null)
  const [selectedMailContent, setSelectedMailContent] = useState<string | null>(null)
  const [loadingMailContent, setLoadingMailContent] = useState(false)

  // ─── Mock 数据（仅开发环境） ───

  const [mockMedia, setMockMedia] = useState<MediaSession | null>(null)
  const [mockNotifications, setMockNotifications] = useState<NotificationItem[]>([])
  const [useMockData, setUseMockData] = useState(false)

  // ─── 计算当前使用的数据源 ───

  // 优先使用 mock 数据（开发环境测试），否则使用真实 SMTC 数据
  const smtcOrMock = useMockData ? mockMedia : smtcMedia

  // 当 SMTC 无数据但 MusicPlayer 在线时，用 MusicPlayer 数据构造合成媒体会话
  const currentMedia: MediaSession | null = useMemo(() => {
    if (smtcOrMock) return smtcOrMock
    if (
      mpState.isOnline &&
      (mpState.playbackState === 'playing' || mpState.playbackState === 'paused')
    ) {
      return {
        title: mpState.title,
        artist: mpState.artist,
        thumbnail: mpState.thumbnail || '',
        playbackStatus: mpState.playbackState,
        sourceAppId: 'musicplayer.exe',
      }
    }
    return null
  }, [
    smtcOrMock,
    mpState.isOnline,
    mpState.playbackState,
    mpState.title,
    mpState.artist,
    mpState.thumbnail,
  ])
  const activeNotifications = useMockData ? mockNotifications : realNotifications

  // 计算未读通知数（必须在 pillState 之前定义）
  const unreadCount = useMemo(
    () => activeNotifications.filter((n) => !n.read).length,
    [activeNotifications]
  )

  // 计算 pill 状态（基于未读数，不是邮件总数）
  const pillState = useMemo<PillState>(() => {
    const hasMedia = currentMedia != null
    const hasUnread = unreadCount > 0

    if (hasMedia && hasUnread) return 'media-and-notification'
    if (hasMedia) return 'media-playing'
    if (hasUnread) return 'notification'
    return 'idle'
  }, [currentMedia, unreadCount])

  // 有内容时通知 InfoSection 显示灵动岛，空闲时隐藏
  const hasContent = pillState !== 'idle'
  useEffect(() => {
    eventBus.emit('island:visibility', { visible: hasContent }, 'dynamic-island')
  }, [hasContent])

  // 获取最新通知（用于收缩态显示摘要）
  const latestNotification = useMemo(
    () => (activeNotifications.length > 0 ? activeNotifications[0] : null),
    [activeNotifications]
  )

  // ─── Mock 数据方法（仅开发环境） ───

  const isDev = process.env.NODE_ENV === 'development'

  const loadMockMedia = useCallback(() => {
    setMockMedia(MOCK_MEDIA)
    setMockNotifications([])
    setUseMockData(true)
  }, [])

  const loadMockNotifications = useCallback(() => {
    setMockMedia(null)
    setMockNotifications(MOCK_NOTIFICATIONS)
    setUseMockData(true)
  }, [])

  const loadMockBoth = useCallback(() => {
    setMockMedia(MOCK_MEDIA)
    setMockNotifications(MOCK_NOTIFICATIONS)
    setUseMockData(true)
  }, [])

  const clearMockData = useCallback(() => {
    setMockMedia(null)
    setMockNotifications([])
    setUseMockData(false)
  }, [])

  // ─── 控制命令路由（MusicPlayer 在线时走 HTTP，否则 SMTC） ───

  const handleSendCommand = useCallback(
    async (command: 'play' | 'pause' | 'toggle' | 'next' | 'previous') => {
      if (mpState.isOnline) {
        try {
          await fetch('http://127.0.0.1:17831/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command }),
          })
          return true
        } catch {
          return false
        }
      }
      return sendCommand(command)
    },
    [mpState.isOnline, sendCommand]
  )

  // ─── 邮件交互 ───

  const handleMailClick = useCallback(
    async (uid: number, account: string) => {
      setSelectedMailUid(uid)
      setLoadingMailContent(true)
      setSelectedMailContent(null)
      const content = await fetchContent(uid, account)
      setSelectedMailContent(content)
      setLoadingMailContent(false)
    },
    [fetchContent]
  )

  const handleMailBack = useCallback(() => {
    setSelectedMailUid(null)
    setSelectedMailContent(null)
  }, [])

  // ─── 渲染 ───

  return (
    <div className="relative">
      {/* 收缩摘要：始终可见 */}
      <PillCollapsed
        state={pillState}
        media={currentMedia}
        unreadCount={unreadCount}
        latestSender={latestNotification?.title}
        latestSubject={latestNotification?.body}
      />

      {/* 展开详情：grid 行高动画 0fr ↔ 1fr */}
      <div
        className="transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
        }}
      >
        <div className="overflow-hidden min-h-0">
          <ExpandedView
            pillState={pillState}
            currentMedia={currentMedia}
            notifications={activeNotifications}
            unreadCount={unreadCount}
            isMediaLoading={isMediaLoading}
            mediaError={mediaError}
            mpState={mpState}
            mpCurrentIndex={mpCurrentIndex}
            isDev={isDev}
            useMockData={useMockData}
            notificationsExpanded={notificationsExpanded}
            selectedMailUid={selectedMailUid}
            selectedMailContent={selectedMailContent}
            loadingMailContent={loadingMailContent}
            onSendCommand={handleSendCommand}
            onToggleNotificationsExpand={() => setNotificationsExpanded((v) => !v)}
            onMarkAllRead={markAllRead}
            onMailClick={handleMailClick}
            onMailBack={handleMailBack}
            onLoadMockMedia={loadMockMedia}
            onLoadMockNotifications={loadMockNotifications}
            onLoadMockBoth={loadMockBoth}
            onClearMockData={clearMockData}
          />
        </div>
      </div>
    </div>
  )
}

// ─── 展开视图 ───

interface ExpandedViewProps {
  pillState: PillState
  currentMedia: MediaSession | null
  notifications: NotificationItem[]
  unreadCount: number
  isMediaLoading: boolean
  mediaError: string | null
  mpState: {
    isOnline: boolean
    playbackState: string
    title: string
    artist: string
    thumbnail: string
    position: number
    duration: number
    lyrics: Array<{ time: number; text: string }>
    lyricsOffset: number
  }
  mpCurrentIndex: number
  isDev: boolean
  useMockData: boolean
  notificationsExpanded: boolean
  selectedMailUid: number | null
  selectedMailContent: string | null
  loadingMailContent: boolean
  onSendCommand: (command: 'play' | 'pause' | 'toggle' | 'next' | 'previous') => Promise<boolean>
  onToggleNotificationsExpand: () => void
  onMarkAllRead: () => void
  onMailClick: (uid: number, account: string) => void
  onMailBack: () => void
  onLoadMockMedia: () => void
  onLoadMockNotifications: () => void
  onLoadMockBoth: () => void
  onClearMockData: () => void
}

/**
 * 展开视图
 */
function ExpandedView({
  pillState,
  currentMedia,
  notifications,
  unreadCount,
  isMediaLoading,
  mediaError,
  mpState,
  mpCurrentIndex,
  isDev,
  useMockData,
  notificationsExpanded,
  selectedMailUid,
  selectedMailContent,
  loadingMailContent,
  onSendCommand,
  onToggleNotificationsExpand,
  onMarkAllRead,
  onMailClick,
  onMailBack,
  onLoadMockMedia,
  onLoadMockNotifications,
  onLoadMockBoth,
  onClearMockData,
}: ExpandedViewProps) {
  return (
    <div className="flex flex-col gap-3 mt-3">
      {/* 媒体控制区 */}
      {currentMedia && <MediaControls media={currentMedia} onSendCommand={onSendCommand} />}

      {/* 播放进度条 */}
      {mpState.isOnline && mpState.duration > 0 && (
        <div className="px-3 py-1">
          <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, (mpState.position / mpState.duration) * 100))}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {fmt(mpState.position)}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {fmt(mpState.duration)}
            </span>
          </div>
        </div>
      )}

      {/* MusicPlayer 歌词区 */}
      {mpState.isOnline && mpState.lyrics.length > 0 && (
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <div
            className="text-[10px] mb-1.5 flex items-center justify-between"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>
              {mpState.title} — {mpState.artist}
            </span>
            <span>🎵 MusicPlayer</span>
          </div>
          <LyricsView lyrics={mpState.lyrics} currentIndex={mpCurrentIndex} loading={false} />
        </div>
      )}

      {/* MusicPlayer 在线但无歌词 */}
      {mpState.isOnline && mpState.lyrics.length === 0 && (
        <div
          className="text-xs text-center py-2 px-3 rounded-lg"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
          }}
        >
          🎵 {mpState.title} — {mpState.artist}（暂无歌词）
        </div>
      )}

      {/* 加载状态 */}
      {isMediaLoading && !useMockData && (
        <div
          className="text-xs text-center py-2 px-3 rounded-lg"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
          }}
        >
          正在检测媒体播放...
        </div>
      )}

      {/* 错误状态 */}
      {mediaError && !useMockData && (
        <div
          className="text-xs text-center py-2 px-3 rounded-lg"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
          }}
        >
          ⚠️ {mediaError}
        </div>
      )}

      {/* ─── 邮件详情视图 ─── */}
      {selectedMailUid !== null && (
        <div
          className="flex flex-col gap-2 p-3 rounded-lg"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className="flex items-center gap-2">
            <button
              className="text-xs px-2 py-1 rounded"
              style={{ color: '#F0B8D4' }}
              onClick={(e) => {
                e.stopPropagation()
                onMailBack()
              }}
            >
              ← 返回
            </button>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              邮件内容
            </span>
          </div>

          <div
            className="text-xs p-2 rounded-md max-h-48 overflow-y-auto whitespace-pre-wrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
            }}
          >
            {loadingMailContent ? '加载中...' : selectedMailContent || '无法加载邮件内容'}
          </div>
        </div>
      )}

      {/* ─── 通知列表区 ─── */}
      {notifications.length > 0 && selectedMailUid === null && (
        <div
          className="flex flex-col gap-2 p-3 rounded-lg"
          style={{ backgroundColor: 'transparent' }}
        >
          {/* 标题栏：未读数 + 展开/收起 + 一键已读 */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              📬 邮件通知
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ color: '#F0B8D4' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkAllRead()
                  }}
                  title="全部已读"
                >
                  ✓ 全部已读
                </button>
              )}
              {notifications.length > 3 && (
                <button
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleNotificationsExpand()
                  }}
                >
                  {notificationsExpanded ? '收起' : `${notifications.length}封`}
                </button>
              )}
            </div>
          </div>

          {/* 通知列表（默认 3 封，点击展开全部） */}
          <div className="flex flex-col gap-1.5">
            {(notificationsExpanded ? notifications : notifications.slice(0, 3)).map((n) => {
              // 从 id 中提取 uid 和 account: "mail::xxx@yyy::123"
              const parts = n.id.split('::')
              const uid = parts.length === 3 ? parseInt(parts[2], 10) : NaN
              const account = parts.length === 3 ? parts[1] : ''
              return (
                <div
                  key={n.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: n.read ? 'transparent' : 'var(--bg-surface)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isNaN(uid) && account) onMailClick(uid, account)
                  }}
                >
                  {/* 未读指示器 */}
                  {!n.read && (
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: '#F0B8D4' }}
                    />
                  )}

                  {/* 发件人首字头像 */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: '#F0B8D4',
                      marginLeft: n.read ? 16 : 0,
                    }}
                  >
                    <span className="text-xs text-white font-semibold">{n.title.charAt(0)}</span>
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {n.title}
                    </div>
                    <div
                      className="text-[11px] truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {n.body}
                    </div>
                  </div>

                  {/* 时间 */}
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {formatTimestamp(n.timestamp)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 数据源指示器（调试用） */}
      {isDev && useMockData && (
        <div
          className="text-[10px] text-center py-1 px-2 rounded"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
          }}
        >
          🔄 使用 Mock 数据
        </div>
      )}

      {/* 开发工具：Mock 数据控制（仅开发环境显示） */}
      {isDev && (
        <div
          className="flex flex-wrap gap-2 justify-center py-2 px-3 rounded-lg border border-dashed"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <span
            className="text-[10px] w-full text-center mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            🔄 开发工具：模拟数据
          </span>

          <button
            className="text-xs px-3 py-1 rounded-md transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onLoadMockMedia()
            }}
          >
            🎬 模拟媒体
          </button>

          <button
            className="text-xs px-3 py-1 rounded-md transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onLoadMockNotifications()
            }}
          >
            📬 模拟通知
          </button>

          <button
            className="text-xs px-3 py-1 rounded-md transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onLoadMockBoth()
            }}
          >
            🎭 模拟混合
          </button>

          <button
            className="text-xs px-3 py-1 rounded-md transition-colors hover:opacity-80"
            style={{
              backgroundColor: useMockData ? '#FEE2E2' : 'var(--bg-main)',
              color: useMockData ? '#DC2626' : 'var(--text-primary)',
              border: `1px solid ${useMockData ? '#FECACA' : 'var(--border-subtle)'}`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              onClearMockData()
            }}
          >
            {useMockData ? '🗑️ 清除 Mock' : '🔄 使用真实数据'}
          </button>
        </div>
      )}

      {/* 空状态提示 */}
      {pillState === 'idle' && !isDev && !isMediaLoading && (
        <div className="text-center py-4">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            打开 Bilibili 播放视频，这里会自动显示
          </span>
        </div>
      )}
    </div>
  )
}

// ─── 工具函数 ───

/** 格式化时间戳为相对时间 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  // 未来时间戳
  if (diff < 0) return '来自未来'

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时`
  return `${Math.floor(diff / 86400000)}天`
}

function fmt(s: number): string {
  if (!s || isNaN(s)) return '0:00'
  return (
    Math.floor(s / 60) +
    ':' +
    Math.floor(s % 60)
      .toString()
      .padStart(2, '0')
  )
}
