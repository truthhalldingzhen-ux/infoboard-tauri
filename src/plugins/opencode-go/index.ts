/**
 * OpenCode Go 套餐用量监控插件
 *
 * 通过读取本地 OpenCode SQLite 数据库，
 * 实时展示 Go 套餐各时间段用量及限额对比。
 */

import type { InfoBoardPlugin } from '../../core/types'
import { manifest } from './manifest'
import { OpenCodeGoCard } from './OpenCodeGoCard'

export const openCodeGoPlugin: InfoBoardPlugin = {
  manifest,
  Component: OpenCodeGoCard,
  onInit: () => {
    console.log('[OpenCode Go 插件] 已加载')
  },
}
