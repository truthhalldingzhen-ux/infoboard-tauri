/**
 * 灵动岛插件 — 类型定义
 *
 * 定义所有数据结构和状态类型
 */

// ─── 灵动岛总体状态 ───

/** 灵动岛状态类型 */
export type PillState =
  | 'idle' // 空闲态：无媒体播放、无通知
  | 'media-playing' // 播放态：检测到媒体播放
  | 'notification' // 通知态：有新通知
  | 'media-and-notification' // 混合态：同时有媒体和通知

// ─── 媒体会话相关 ───

/** 媒体播放状态 */
export type PlaybackStatus = 'playing' | 'paused' | 'stopped' | 'closed'

/** 媒体控制命令 */
export type MediaCommand = 'play' | 'pause' | 'toggle' | 'next' | 'previous'

/** SMTC 媒体会话信息 */
export interface MediaSession {
  /** 视频标题 */
  title: string

  /** UP主 / 频道名 */
  artist: string

  /** 缩略图 base64 或路径 */
  thumbnail?: string

  /** 播放状态 */
  playbackStatus: PlaybackStatus

  /** 来源应用（如 'bilibili.exe'） */
  sourceAppId?: string

  /** 播放进度（秒） */
  position?: number

  /** 总时长（秒） */
  duration?: number

  /** UP主头像 URL（B站来源时可用） */
  ownerAvatar?: string
}

// ─── 通知相关 ───

/** 通知条目类型 */
export type NotificationType = 'email' | 'system'

/** 通知条目 */
export interface NotificationItem {
  /** 唯一标识 */
  id: string

  /** 通知类型 */
  type: NotificationType

  /** 发件人 或 通知标题 */
  title: string

  /** 邮件主题 或 通知正文 */
  body: string

  /** 时间戳 */
  timestamp: number

  /** 是否已读 */
  read: boolean
}

// ─── 灵动岛内部状态 ───

/** 灵动岛内部状态 */
export interface IslandState {
  /** 当前 pill 状态 */
  pillState: PillState

  /** 当前媒体会话 */
  currentMedia: MediaSession | null

  /** 通知列表 */
  notifications: NotificationItem[]

  /** 未读通知数 */
  unreadCount: number

  /** 是否展开（点击展开） */
  isExpanded: boolean
}

// ─── Mock 数据相关 ───

/** Mock 数据类型 */
export type MockDataType = 'media' | 'notifications' | 'both' | 'clear'

/** Mock 配置 */
export interface MockConfig {
  /** 是否启用 Mock 模式（仅开发环境） */
  enabled: boolean

  /** Mock 媒体数据 */
  media?: MediaSession

  /** Mock 通知数据 */
  notifications?: NotificationItem[]
}
