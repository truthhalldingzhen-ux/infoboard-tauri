/**
 * 通知 Hook
 *
 * 通过轮询获取邮件列表（每 3 秒）
 * 新邮件到达时自动提取验证码并复制到剪贴板
 *
 * 使用 ref 存储可变状态，避免闭包循环导致 effect 反复重跑
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { NotificationItem } from './types'

/** 全量刷新间隔（毫秒） */
const FULL_REFRESH_INTERVAL = 30_000
/** 新邮件快检间隔（毫秒） */
const NEW_CHECK_INTERVAL = 1_000

interface UseNotificationsReturn {
  notifications: NotificationItem[]
  isLoading: boolean
  error: string | null
  connected: boolean
  markRead: (id: string) => void
  markAllRead: () => void
  fetchContent: (uid: number, account: string) => Promise<string | null>
  refresh: () => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  /** 用于轮询中读取最新 connected 状态 */
  const connectedRef = useRef(false)

  /** 用于在回调中读取最新通知列表（避免闭包过期） */
  const notificationsRef = useRef(notifications)
  notificationsRef.current = notifications

  /**
   * 拉取邮件并合并本地已读状态 + 自动提取验证码
   * 不依赖任何闭包中的 state，通过 ref 读取最新状态
   */
  const doFetchMails = useCallback(async () => {
    if (!window.mailControl || !connectedRef.current) return

    try {
      const mails = await window.mailControl.fetchRecent(5)
      const items: NotificationItem[] = mails.map((mail) => ({
        id: `mail::${mail.account}::${mail.uid}`,
        type: 'email' as const,
        title: mail.sender,
        body: mail.subject,
        timestamp: mail.date,
        read: mail.seen,
      }))

      // 合并本地已读状态，同时保留 doCheckNew 添加但服务器尚未返回的新条目
      setNotifications((prev) => {
        const serverIds = new Set(items.map((n) => n.id))

        // 合并服务器条目与本地已读状态
        const merged = items.map((item) => ({
          ...item,
          read: item.read || (prev.find((n) => n.id === item.id)?.read ?? false),
        }))

        // 补充 doCheckNew 刚添加但服务器还未返回的新条目
        for (const n of prev) {
          if (!serverIds.has(n.id)) {
            merged.push(n)
          }
        }

        return merged
      })
    } catch (err) {
      console.error('[useNotifications] 拉取失败:', err)
    }
  }, []) // 无依赖：通过 ref 读取最新状态

  /**
   * 快检（每 1 秒）— 主进程已完成检测+拉取+提取+复制，这里只读结果
   */
  const doCheckNew = useCallback(async () => {
    if (!window.mailControl || !connectedRef.current) return

    try {
      const result = await window.mailControl.checkNew()

      if (result.newMails.length === 0) return

      // 追加新邮件到列表
      const newItems: NotificationItem[] = result.newMails.map((mail) => ({
        id: `mail::${mail.account}::${mail.uid}`,
        type: 'email' as const,
        title: mail.sender,
        body: mail.subject,
        timestamp: mail.date,
        read: mail.seen,
      }))

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id))
        const fresh = newItems.filter((item) => !existingIds.has(item.id))
        if (fresh.length === 0) return prev
        return [...fresh, ...prev]
      })

      // 主进程已复制验证码，只需显示 toast
      if (result.code) {
        if (window.toastAPI) {
          window.toastAPI.show({
            message: `📋 验证码已复制: ${result.code}`,
            color: '#4ADE80',
            bg: '#2D6A3D',
            duration: 4000,
          })
        }
      }
    } catch (err) {
      console.error('[useNotifications] 快检失败:', err)
    }
  }, [])

  /**
   * 标记单个已读（同步到 IMAP 服务器）
   */
  const markRead = useCallback(async (id: string) => {
    // 先记下要标记的 uid/account（乐观更新前获取）
    const parts = id.split('::')
    const account = parts.length === 3 ? parts[1] : ''
    const uid = parts.length === 3 ? parseInt(parts[2], 10) : NaN

    // 乐观更新本地状态
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))

    // 同步到 IMAP
    if (account && !isNaN(uid) && uid > 0 && window.mailControl) {
      try {
        await window.mailControl.markRead([uid], account)
      } catch (err) {
        console.error('[useNotifications] 标记已读同步失败:', err)
        // 不撤销本地乐观更新，下次全量刷新会同步服务器状态
      }
    }
  }, [])

  /**
   * 一键全部已读（同步到 IMAP 服务器）
   */
  const markAllRead = useCallback(async () => {
    const current = notificationsRef.current
    const accountUids = new Map<string, number[]>()
    let hasUnread = false

    for (const n of current) {
      if (!n.read) {
        hasUnread = true
        const parts = n.id.split('::')
        if (parts.length === 3) {
          const account = parts[1]
          const uid = parseInt(parts[2], 10)
          if (!isNaN(uid) && uid > 0 && account) {
            const existing = accountUids.get(account) || []
            existing.push(uid)
            accountUids.set(account, existing)
          }
        }
      }
    }

    // 乐观更新本地状态
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))

    if (!hasUnread) return

    for (const [account, uids] of accountUids) {
      if (uids.length > 0 && window.mailControl) {
        try {
          await window.mailControl.markRead(uids, account)
        } catch (err) {
          console.error('[useNotifications] 全部已读同步失败:', err)
        }
      }
    }
  }, [])

  /**
   * 获取邮件正文
   */
  const fetchContent = useCallback(async (uid: number, account: string): Promise<string | null> => {
    if (!window.mailControl) return null
    try {
      return await window.mailControl.fetchContent(uid, account)
    } catch (err) {
      console.error('[useNotifications] 获取邮件正文失败:', err)
      return null
    }
  }, [])

  /**
   * 手动刷新
   */
  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      await doFetchMails()
    } finally {
      setIsLoading(false)
    }
  }, [doFetchMails])

  /**
   * 初始化：连接 → 拉取 → 轮询（只在挂载时运行一次）
   */
  useEffect(() => {
    if (!window.mailControl) {
      setIsLoading(false)
      return
    }

    let fullRefreshTimer: ReturnType<typeof setInterval> | null = null
    let newCheckTimer: ReturnType<typeof setInterval> | null = null
    let unmounted = false

    const init = async () => {
      try {
        // 从主进程 electron-store 读取已保存的凭据并连接
        const result = await window.mailControl.connectSaved()
        if (unmounted) return

        if (!result.success) {
          console.warn('[useNotifications]', result.errors.join(', '))
          setIsLoading(false)
          return
        }

        setConnected(true)
        connectedRef.current = true

        // 首次全量拉取
        try {
          await doFetchMails()
        } catch (err) {
          console.error('[useNotifications] 首次拉取失败:', err)
        }
        if (unmounted) return
        setIsLoading(false)

        // 快检：每 1 秒检查 IDLE 缓冲区（轻量级 IPC，几乎无开销）
        newCheckTimer = setInterval(() => {
          doCheckNew()
        }, NEW_CHECK_INTERVAL)

        // 全量刷新：每 30 秒重新拉取完整列表
        fullRefreshTimer = setInterval(() => {
          doFetchMails()
        }, FULL_REFRESH_INTERVAL)
      } catch (err) {
        console.error('[useNotifications] 初始化失败:', err)
        if (!unmounted) setError('连接异常')
        if (!unmounted) setIsLoading(false)
      }
    }

    init()

    return () => {
      unmounted = true
      if (newCheckTimer) clearInterval(newCheckTimer)
      if (fullRefreshTimer) clearInterval(fullRefreshTimer)
    }
  }, []) // 空依赖：只运行一次

  // 连接在主进程管理，不在组件卸载时断开
  // 应用退出时由 mailControlManager.destroy() 统一清理

  return {
    notifications,
    isLoading,
    error,
    connected,
    markRead,
    markAllRead,
    fetchContent,
    refresh,
  }
}
