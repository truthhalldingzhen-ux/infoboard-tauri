/**
 * 灵动岛 — 收缩态胶囊视图
 *
 * 始终可见的摘要视图，显示关键信息：
 * - idle 态：「🏝️ 灵动岛 · 待命中」
 * - 播放态：「▶️ 视频标题」
 * - 通知态：「📬 N封未读 · 发件人：主题」
 * - 混合态：「▶️ 视频标题 · N封未读」
 */

import type { PillState, MediaSession } from './types'
import { Play, Mail, Smartphone } from 'lucide-react'

// ─── 收缩态视图组件 ───

interface PillCollapsedProps {
  /** 灵动岛状态 */
  state: PillState

  /** 当前媒体会话（播放态时有值） */
  media: MediaSession | null

  /** 未读通知数 */
  unreadCount: number

  /** 最新通知的发件人（用于显示摘要） */
  latestSender?: string

  /** 最新通知的主题（用于显示摘要） */
  latestSubject?: string
}

/**
 * 收缩态胶囊视图
 *
 * 根据不同状态显示不同内容：
 * - idle: 空闲提示
 * - media-playing: 视频标题
 * - notification: 未读数 + 最新通知摘要
 * - media-and-notification: 视频标题 + 未读数
 */
export function PillCollapsed({
  state,
  media,
  unreadCount,
  latestSender,
  latestSubject,
}: PillCollapsedProps) {
  // 根据状态渲染不同内容
  const renderContent = () => {
    switch (state) {
      case 'idle':
        return <IdleContent />

      case 'media-playing':
        return media ? <MediaContent media={media} /> : <IdleContent />

      case 'notification':
        return (
          <NotificationContent
            unreadCount={unreadCount}
            sender={latestSender}
            subject={latestSubject}
          />
        )

      case 'media-and-notification':
        return media ? (
          <MixedContent media={media} unreadCount={unreadCount} />
        ) : (
          <NotificationContent
            unreadCount={unreadCount}
            sender={latestSender}
            subject={latestSubject}
          />
        )

      default:
        return <IdleContent />
    }
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-4 h-10 rounded-full transition-all duration-300 cursor-pointer select-none"
      style={{
        backgroundColor: 'var(--bg-glass)',
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35))',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(255,255,255,0.12)',
        width: 'calc(100% + 32px)',
        marginLeft: '-16px',
      }}
    >
      {renderContent()}
    </div>
  )
}

// ─── 内容组件 ───

/** 空闲态内容 */
function IdleContent() {
  return (
    <>
      <Smartphone size={16} color="#F0B8D4" />
      <span className="text-sm text-[#A1A1A6] font-medium">灵动岛 · 待命中</span>
    </>
  )
}

/** 播放态内容 */
function MediaContent({ media }: { media: MediaSession }) {
  // 截断标题，最多显示 20 个字符
  const truncatedTitle = media.title.length > 20 ? media.title.slice(0, 20) + '...' : media.title

  return (
    <>
      <Play size={14} color="#F0B8D4" />
      <span className="text-sm text-white font-medium truncate max-w-[200px]">
        {truncatedTitle}
      </span>
    </>
  )
}

/** 通知态内容 */
interface NotificationContentProps {
  unreadCount: number
  sender?: string
  subject?: string
}

function NotificationContent({ unreadCount, sender, subject }: NotificationContentProps) {
  // 截断主题，最多显示 15 个字符；空字符串时降级为"新消息"
  const displaySubject =
    (subject && subject.length > 15 ? subject.slice(0, 15) + '...' : subject) || '新消息'

  return (
    <>
      <Mail size={14} color="#F0B8D4" />
      <span className="text-sm text-white font-medium">{unreadCount}封未读</span>
      {sender && (
        <span className="text-sm text-[rgba(255,255,255,0.7)] truncate max-w-[150px]">
          · {sender}：{displaySubject}
        </span>
      )}
    </>
  )
}

/** 混合态内容 */
function MixedContent({ media, unreadCount }: { media: MediaSession; unreadCount: number }) {
  // 截断标题，最多显示 15 个字符
  const truncatedTitle = media.title.length > 15 ? media.title.slice(0, 15) + '...' : media.title

  return (
    <>
      <Play size={14} color="#F0B8D4" />
      <span className="text-sm text-white font-medium truncate max-w-[150px]">
        {truncatedTitle}
      </span>
      <span className="text-sm text-[rgba(255,255,255,0.7)]">· {unreadCount}封未读</span>
    </>
  )
}
