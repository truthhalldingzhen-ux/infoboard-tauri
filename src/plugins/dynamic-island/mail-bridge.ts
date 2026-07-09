/**
 * IMAP 邮件 — Tauri invoke 封装
 *
 * 提供邮件全功能的 invoke 方法
 * 替代之前 useNotifications.ts 中使用的 window.mailControl.*
 */

import { invoke } from '@tauri-apps/api/core'

/** 邮箱账户配置 */
export interface MailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

/** 邮件摘要 */
export interface MailSummary {
  uid: number
  sender: string
  subject: string
  date: number
  seen: boolean
  account: string
}

/** 连接结果 */
export interface ConnectResult {
  success: boolean
  errors: string[]
}

/** 新邮件检测结果 */
export interface CheckNewResult {
  newMails: MailSummary[]
  code: string | null
}

/**
 * 获取所有邮箱配置
 */
export async function getConfig(): Promise<MailConfig[]> {
  try {
    return await invoke<MailConfig[]>('mail_get_config')
  } catch (err) {
    console.error('[mail] getConfig 失败:', err)
    return []
  }
}

/**
 * 保存所有邮箱配置
 */
export async function setConfig(accounts: MailConfig[]): Promise<void> {
  try {
    await invoke('mail_set_config', { accounts })
  } catch (err) {
    console.error('[mail] setConfig 失败:', err)
    throw err
  }
}

/**
 * 添加单个邮箱账户
 */
export async function addAccount(config: MailConfig): Promise<void> {
  try {
    await invoke('mail_add_account', { config })
  } catch (err) {
    console.error('[mail] addAccount 失败:', err)
    throw err
  }
}

/**
 * 删除单个邮箱账户
 */
export async function removeAccount(user: string): Promise<void> {
  try {
    await invoke('mail_remove_account', { user })
  } catch (err) {
    console.error('[mail] removeAccount 失败:', err)
    throw err
  }
}

/**
 * 从配置文件读取凭据并连接所有账户
 */
export async function connectSaved(): Promise<ConnectResult> {
  try {
    return await invoke<ConnectResult>('mail_connect_saved')
  } catch (err) {
    console.error('[mail] connectSaved 失败:', err)
    return { success: false, errors: [String(err)] }
  }
}

/**
 * 拉取最近 N 封邮件
 */
export async function fetchRecent(count?: number): Promise<MailSummary[]> {
  try {
    return await invoke<MailSummary[]>('mail_fetch_recent', { count: count ?? 5 })
  } catch (err) {
    console.error('[mail] fetchRecent 失败:', err)
    return []
  }
}

/**
 * 检测新邮件 + 提取验证码
 */
export async function checkNew(): Promise<CheckNewResult> {
  try {
    return await invoke<CheckNewResult>('mail_check_new')
  } catch (err) {
    console.error('[mail] checkNew 失败:', err)
    return { newMails: [], code: null }
  }
}

/**
 * 获取邮件正文
 */
export async function fetchContent(uid: number, account: string): Promise<string | null> {
  try {
    return await invoke<string | null>('mail_fetch_content', { uid, account })
  } catch (err) {
    console.error('[mail] fetchContent 失败:', err)
    return null
  }
}

/**
 * 标记已读
 */
export async function markRead(uids: number[], account: string): Promise<boolean> {
  try {
    return await invoke<boolean>('mail_mark_read', { uids, account })
  } catch (err) {
    console.error('[mail] markRead 失败:', err)
    return false
  }
}

/**
 * 断开所有连接
 */
export async function disconnectAll(): Promise<void> {
  try {
    await invoke('mail_disconnect_all')
  } catch (err) {
    console.error('[mail] disconnectAll 失败:', err)
  }
}

/**
 * 获取连接状态
 */
export async function connectionInfo(): Promise<{
  connected_count: number
  accounts: Array<{ user: string; connected: boolean }>
}> {
  try {
    return await invoke('mail_connection_info')
  } catch (err) {
    console.error('[mail] connectionInfo 失败:', err)
    return { connected_count: 0, accounts: [] }
  }
}
