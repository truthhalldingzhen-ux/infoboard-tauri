/**
 * 待办插件导出
 *
 * 组合 manifest + Component，导出完整的 InfoBoardPlugin
 */

import type { InfoBoardPlugin } from '../../core/types'
import { manifest } from './manifest'
import { TodoCard } from './TodoCard'

export const todoPlugin: InfoBoardPlugin = {
  manifest,
  Component: TodoCard,
  onInit: () => {
    console.log('[待办插件] 已加载')
  },
}

// 单独导出，方便其他地方按需引用
export { manifest } from './manifest'
export { TodoCard } from './TodoCard'
export { useTodo } from './useTodo'
