import type { InfoBoardPlugin } from '../../core/types'
import { manifest } from './manifest'
import { TranslateCard } from './TranslateCard'

export const translatePlugin: InfoBoardPlugin = {
  manifest,
  Component: TranslateCard,

  onInit: () => {
    console.log('[Plugin] 翻译已加载')
  },

  onDestroy: () => {
    console.log('[Plugin] 翻译已卸载')
  },
}

export { manifest } from './manifest'
export { TranslateCard } from './TranslateCard'
export { useTranslate } from './useTranslate'
