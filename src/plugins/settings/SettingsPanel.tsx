/**
 * 设置面板组件
 *
 * 包含区域：
 * 1. 主题切换（暖橙浅色 / 深色 / 粉紫透明 / 跟随系统）
 * 2. 天气 API 配置
 * 3. 系统设置（开机自启动）
 * 4. 插件管理
 */

import { useCallback, useEffect, useState } from 'react'
import { useSettings } from './useSettings'
import { pluginRegistry } from '../../core/PluginRegistry'
import type { ThemeMode } from './types'
import { THEME_PREVIEWS } from './types'
import * as autostart from '../../core/autostart-bridge'
import * as niutrans from '../translate/bridge'
import * as mailBridge from '../dynamic-island/mail-bridge'
import type { MailConfig, MailConfigPublic } from '../dynamic-island/mail-bridge'

/**
 * 设置面板
 */
export function SettingsPanel() {
  const { settings, updateSettings, togglePlugin } = useSettings()
  const [autoStart, setAutoStart] = useState(false)
  const [mailAccounts, setMailAccounts] = useState<MailConfigPublic[]>([])
  const [newMail, setNewMail] = useState<MailConfig>({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    user: '',
    pass: '',
  })
  const [mailSaving, setMailSaving] = useState(false)
  const [mailError, setMailError] = useState<string | null>(null)
  const [mailSuccess, setMailSuccess] = useState<string | null>(null)
  const [niutransAppId, setNiutransAppId] = useState('')
  const [niutransApiKey, setNiutransApiKey] = useState('')
  const [niutransHasKey, setNiutransHasKey] = useState(false)
  const canSaveNiu = !!niutransAppId && (!!niutransApiKey || niutransHasKey)

  const allPlugins = pluginRegistry.getAllPlugins()

  // 加载邮箱配置
  useEffect(() => {
    mailBridge
      .getConfig()
      .then((accounts) => {
        setMailAccounts(accounts)
      })
      .catch(() => {})
  }, [])

  // 读取小牛翻译配置状态
  useEffect(() => {
    niutrans
      .hasApiKey()
      .then((exists) => {
        setNiutransHasKey(exists)
      })
      .catch(() => {})
  }, [])

  // 从系统读取开机自启动状态
  useEffect(() => {
    autostart
      .isEnabled()
      .then((enabled) => {
        setAutoStart(enabled)
      })
      .catch(() => {
        // 读取失败，默认关闭
      })
  }, [])

  /** 切换开机自启动 */
  const handleAutoStartToggle = useCallback(async () => {
    const next = !autoStart
    setAutoStart(next)
    await autostart.setEnabled(next)
    updateSettings({ autoStart: next })
  }, [autoStart, updateSettings])

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 主题切换 */}
      <section>
        <SectionTitle>主题</SectionTitle>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {THEME_PREVIEWS.map((preview) => {
            const isActive = settings.theme === preview.id
            return (
              <button
                key={preview.id}
                className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg transition-all relative"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: isActive ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                }}
                onClick={() => updateSettings({ theme: preview.id })}
              >
                {/* 选中对勾 */}
                {isActive && (
                  <span
                    className="absolute top-1 right-1 text-[10px] font-bold"
                    style={{ color: 'var(--accent)' }}
                  >
                    ✓
                  </span>
                )}
                {/* 三色预览条 */}
                <div className="flex gap-0.5 w-full">
                  {preview.colors.map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 h-5 rounded-sm"
                      style={{
                        backgroundColor: color,
                        border: '1px solid rgba(0,0,0,0.08)',
                      }}
                    />
                  ))}
                </div>
                {/* 主题名称 */}
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {preview.name}
                </span>
              </button>
            )
          })}
        </div>
        {/* 跟随系统 */}
        <button
          className="w-full py-1.5 mt-2 text-xs font-medium rounded-md transition-all"
          style={
            settings.theme === 'system'
              ? { backgroundColor: 'var(--accent)', color: '#fff' }
              : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }
          }
          onClick={() => updateSettings({ theme: 'system' })}
        >
          跟随系统
        </button>
      </section>

      {/* 天气 API 配置 */}
      <section>
        <SectionTitle>天气 API</SectionTitle>
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              API Host
            </label>
            <input
              type="text"
              className="input text-xs"
              value={settings.weatherApiHost}
              placeholder="和风天气 API Host"
              onChange={(e) => updateSettings({ weatherApiHost: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              API Key
            </label>
            <input
              type="text"
              className="input text-xs"
              value={settings.weatherApiKey}
              placeholder="和风天气 API Key"
              onChange={(e) => updateSettings({ weatherApiKey: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* MiniMax API 配置 */}
      <section>
        <SectionTitle>MiniMax API</SectionTitle>
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              API Key
            </label>
            <input
              type="password"
              className="input text-xs"
              value={settings.minimaxApiKey}
              placeholder="MiniMax Token 计划的 API Key"
              onChange={(e) => updateSettings({ minimaxApiKey: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* 小牛翻译 API 配置 */}
      <section>
        <SectionTitle>小牛翻译 API</SectionTitle>
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              App ID
            </label>
            <input
              type="text"
              className="input text-xs"
              value={niutransAppId}
              placeholder="小牛翻译 App ID"
              onChange={(e) => setNiutransAppId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              API Key
            </label>
            <input
              type="password"
              className="input text-xs"
              value={niutransApiKey}
              placeholder={niutransHasKey ? '已保存（输入新密钥可替换）' : '小牛翻译 API Key'}
              onChange={(e) => setNiutransApiKey(e.target.value)}
            />
          </div>
          <button
            className="w-full py-1.5 text-xs font-medium rounded-md transition-all"
            style={{
              backgroundColor: canSaveNiu ? 'var(--accent)' : 'var(--border-subtle)',
              color: canSaveNiu ? '#fff' : 'var(--text-muted)',
              cursor: canSaveNiu ? 'pointer' : 'not-allowed',
            }}
            disabled={!canSaveNiu}
            onClick={async () => {
              try {
                if (niutransApiKey) {
                  await niutrans.setApiKey(niutransApiKey)
                }
                await niutrans.setAppId(niutransAppId)
                window.toastAPI?.show?.({ message: '小牛翻译 API 已保存' })
                setNiutransHasKey(true)
                setNiutransApiKey('')
              } catch {
                window.toastAPI?.show?.({ message: '保存失败，请重试', color: '#ef4444' })
              }
            }}
          >
            保存翻译 API
          </button>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            免费注册：
            <a
              href="https://niutrans.com/cloud/api/list"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              niutrans.com
            </a>
          </span>
        </div>
      </section>

      {/* 邮箱配置 */}
      <section>
        <SectionTitle>邮箱账户（IMAP）</SectionTitle>
        <div className="mt-2 flex flex-col gap-2">
          {mailAccounts.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-1">
              {mailAccounts.map((acc) => (
                <div
                  key={acc.user}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>
                    {acc.user}
                    {acc.hasPass ? (
                      <span className="ml-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        · 已保存凭据
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {acc.host}:{acc.port}
                  </span>
                  <button
                    className="text-[10px] px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
                    style={{ color: '#ef4444' }}
                    onClick={async () => {
                      try {
                        await mailBridge.removeAccount(acc.user)
                        setMailAccounts((prev) => prev.filter((a) => a.user !== acc.user))
                      } catch {
                        setMailError('删除失败')
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 新增账户表单 */}
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              className="input text-xs"
              value={newMail.host}
              placeholder="IMAP 服务器（如 imap.gmail.com）"
              onChange={(e) => setNewMail({ ...newMail, host: e.target.value })}
            />
            <div className="flex gap-1.5">
              <input
                type="number"
                className="input text-xs w-20 flex-shrink-0"
                value={newMail.port}
                placeholder="端口"
                onChange={(e) =>
                  setNewMail({ ...newMail, port: parseInt(e.target.value, 10) || 993 })
                }
              />
              <label
                className="flex items-center gap-1 text-xs cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <input
                  type="checkbox"
                  checked={newMail.secure}
                  onChange={(e) => setNewMail({ ...newMail, secure: e.target.checked })}
                />
                SSL/TLS
              </label>
            </div>
            <input
              type="text"
              className="input text-xs"
              value={newMail.user}
              placeholder="邮箱地址"
              onChange={(e) => setNewMail({ ...newMail, user: e.target.value })}
            />
            <input
              type="password"
              className="input text-xs"
              value={newMail.pass}
              placeholder="密码 / 应用专用密码"
              onChange={(e) => setNewMail({ ...newMail, pass: e.target.value })}
            />
          </div>

          {/* 操作反馈 */}
          {mailError && (
            <span className="text-[10px]" style={{ color: '#ef4444' }}>
              {mailError}
            </span>
          )}
          {mailSuccess && (
            <span className="text-[10px]" style={{ color: '#4ADE80' }}>
              {mailSuccess}
            </span>
          )}

          {/* 添加按钮 */}
          <button
            className="w-full py-1.5 text-xs font-medium rounded-md transition-all"
            style={{
              backgroundColor:
                newMail.user && newMail.pass ? 'var(--accent)' : 'var(--border-subtle)',
              color: newMail.user && newMail.pass ? '#fff' : 'var(--text-muted)',
              cursor: newMail.user && newMail.pass ? 'pointer' : 'not-allowed',
            }}
            disabled={!newMail.user || !newMail.pass || mailSaving}
            onClick={async () => {
              setMailSaving(true)
              setMailError(null)
              setMailSuccess(null)
              try {
                await mailBridge.addAccount(newMail)
                // 刷新列表
                const updated = await mailBridge.getConfig()
                setMailAccounts(updated)
                // 重置表单
                setNewMail({
                  host: 'imap.gmail.com',
                  port: 993,
                  secure: true,
                  user: '',
                  pass: '',
                })
                setMailSuccess('账户已添加')
                setTimeout(() => setMailSuccess(null), 3000)
              } catch (err) {
                setMailError(String(err))
              } finally {
                setMailSaving(false)
              }
            }}
          >
            {mailSaving ? '保存中...' : '添加账户'}
          </button>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Gmail 用户需使用
            <a
              href="https://support.google.com/accounts/answer/185833"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              {' '}
              应用专用密码
            </a>
          </span>
        </div>
      </section>

      {/* 系统 */}
      <section>
        <SectionTitle>系统</SectionTitle>
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              开机自启动
            </span>
            <ToggleSwitch checked={autoStart} onChange={handleAutoStartToggle} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              全局快捷键
            </span>
            <kbd
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
              }}
            >
              Ctrl+Shift+I
            </kbd>
          </div>
        </div>
      </section>

      {/* 插件管理 */}
      <section>
        <SectionTitle>插件管理</SectionTitle>
        <div className="mt-2 flex flex-col gap-2">
          {allPlugins.map((plugin) => {
            const isDisabled = settings.disabledPlugins.includes(plugin.manifest.id)
            const isLocked = plugin.manifest.id === 'settings'

            return (
              <div key={plugin.manifest.id} className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{
                    color: isLocked ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}
                >
                  {plugin.manifest.name}
                  {isLocked && (
                    <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-muted)' }}>
                      （锁定）
                    </span>
                  )}
                </span>
                <ToggleSwitch
                  checked={!isDisabled}
                  disabled={isLocked}
                  onChange={() => togglePlugin(plugin.manifest.id)}
                />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** 分组标题 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-semibold tracking-widest uppercase"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </div>
  )
}

/** Toggle 开关 */
function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
}) {
  return (
    <button
      className="relative w-9 h-5 rounded-full transition-colors"
      style={{
        backgroundColor: disabled
          ? 'var(--border-subtle)'
          : checked
            ? 'var(--accent)'
            : 'var(--border-subtle)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}
