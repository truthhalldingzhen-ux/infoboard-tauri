import { useState, useRef, useCallback } from 'react'
import type { PluginComponentProps } from '../../core/types'
import { useTranslate } from './useTranslate'
import { QUICK_LANGS, ALL_LANGS } from './types'
import type { TargetLangCode } from './types'

export function TranslateCard({ manifest }: PluginComponentProps) {
  const {
    inputText,
    setInputText,
    result,
    loading,
    error,
    targetLang,
    setTargetLang,
    translate,
    copyResult,
    hasApiKey,
    charCount,
  } = useTranslate()

  const accent = manifest.color ?? 'var(--accent)'

  if (!hasApiKey) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>未配置翻译 API</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          请前往 <strong>设置</strong> → <strong>小牛翻译 API</strong> 配置 App ID 和 API Key。
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
      <LanguageBar current={targetLang} onChange={setTargetLang} color={accent} />

      <InputArea
        value={inputText}
        onChange={setInputText}
        onTranslate={translate}
        loading={loading}
      />

      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#ef4444',
            padding: '8px 12px',
            backgroundColor: 'rgba(239,68,68,0.08)',
            borderRadius: '8px',
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              border: '2px solid var(--accent)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        </div>
      )}

      {result && !loading && <ResultArea result={result} onCopy={copyResult} />}

      <div
        style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          textAlign: 'right',
          padding: '0 2px',
        }}
      >
        已翻译 {charCount.toLocaleString()} 字符
      </div>
    </div>
  )
}

function LanguageBar({
  current,
  onChange,
  color,
}: {
  current: TargetLangCode
  onChange: (lang: TargetLangCode) => void
  color: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {QUICK_LANGS.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code)}
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: current === lang.code ? 600 : 400,
            backgroundColor: current === lang.code ? color : 'var(--bg-surface)',
            color: current === lang.code ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {lang.label}
        </button>
      ))}

      <select
        value={current}
        onChange={(e) => onChange(e.target.value as TargetLangCode)}
        style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        {ALL_LANGS.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function InputArea({
  value,
  onChange,
  onTranslate,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  onTranslate: () => void
  loading: boolean
}) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!loading && value.trim()) onTranslate()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入要翻译的文字..."
        rows={3}
        style={{
          width: '100%',
          resize: 'none',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '13px',
          lineHeight: '1.5',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      <button
        onClick={onTranslate}
        disabled={loading || !value.trim()}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          fontSize: '13px',
          fontWeight: 600,
          cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
          backgroundColor: 'var(--accent)',
          color: '#fff',
          opacity: loading || !value.trim() ? 0.5 : 1,
        }}
      >
        {loading ? '翻译中...' : '翻译'}
      </button>
    </div>
  )
}

function ResultArea({
  result,
  onCopy,
}: {
  result: { text: string; from: string; to: string }
  onCopy: () => void
}) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleClick = useCallback(async () => {
    try {
      await onCopy()
      setCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // 复制失败，不设置 copied 状态
    }
  }, [onCopy])

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {langName(result.from)} → {langName(result.to)}
        </span>
        <button
          onClick={handleClick}
          style={{
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '6px',
            border: copied ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
            cursor: 'pointer',
            backgroundColor: copied ? 'var(--accent)' : 'transparent',
            color: copied ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      <div
        style={{
          fontSize: '14px',
          lineHeight: '1.6',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {result.text}
      </div>
    </div>
  )
}

const LANG_NAMES: Record<string, string> = {
  zh: '中文',
  en: '英语',
  ja: '日语',
  de: '德语',
  fr: '法语',
  es: '西班牙语',
  pt: '葡萄牙语',
  ru: '俄语',
  ko: '韩语',
  it: '意大利语',
}

function langName(code: string): string {
  return LANG_NAMES[code.toLowerCase()] || code
}
