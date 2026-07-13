import { useState, useCallback, useEffect, useRef } from 'react'
import type { TargetLangCode, TranslateResult } from './types'
import * as niutrans from './bridge'
import { writeText } from '../../core/clipboard-bridge'

export interface UseTranslateReturn {
  inputText: string
  setInputText: (text: string) => void
  result: TranslateResult | null
  loading: boolean
  error: string | null
  targetLang: TargetLangCode
  setTargetLang: (lang: TargetLangCode) => void
  translate: () => Promise<void>
  copyResult: () => Promise<void>
  hasApiKey: boolean
  charCount: number
}

export function useTranslate(): UseTranslateReturn {
  const [inputText, setInputTextRaw] = useState('')
  const inputRef = useRef(inputText)
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetLang, setTargetLang] = useState<TargetLangCode>('zh')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [charCount, setCharCount] = useState(0)

  useEffect(() => {
    checkApiKey()
    refreshCharCount()
    const handler = () => checkApiKey()
    window.addEventListener('settings:changed', handler)
    return () => window.removeEventListener('settings:changed', handler)
  }, [])

  async function checkApiKey() {
    try {
      const exists = await niutrans.hasApiKey()
      setHasApiKey(exists)
    } catch {
      setHasApiKey(false)
    }
  }

  async function refreshCharCount() {
    try {
      const count = await niutrans.getCharCount()
      setCharCount(count)
    } catch {
      // ignore
    }
  }

  const setInputText = useCallback((text: string) => {
    inputRef.current = text
    setInputTextRaw(text)
  }, [])

  const translate = useCallback(async () => {
    const text = inputRef.current.trim()
    if (!text) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await niutrans.translate(text, targetLang)
      console.log('[翻译] 翻译成功')
      setResult(res)
      refreshCharCount()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '翻译失败'
      console.log('[翻译] 失败:', msg)
      if (msg === 'API_KEY_MISSING') {
        setError('请先在设置中配置小牛翻译 API')
      } else {
        setError(msg || '翻译失败')
      }
    } finally {
      setLoading(false)
    }
  }, [targetLang])

  const copyResult = useCallback(async () => {
    if (!result?.text) return
    await writeText(result.text)
  }, [result])

  return {
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
  }
}
