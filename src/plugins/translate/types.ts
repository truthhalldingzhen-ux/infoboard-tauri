export interface TranslateResult {
  text: string
  from: string
  to: string
}

export type TargetLangCode = 'zh' | 'en' | 'ja' | 'de' | 'fr' | 'es' | 'pt' | 'ru' | 'ko' | 'it'

export interface TargetLangOption {
  code: TargetLangCode
  label: string
}

export const QUICK_LANGS: TargetLangOption[] = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

export const ALL_LANGS: TargetLangOption[] = [
  ...QUICK_LANGS,
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ko', label: '한국어' },
  { code: 'it', label: 'Italiano' },
]
