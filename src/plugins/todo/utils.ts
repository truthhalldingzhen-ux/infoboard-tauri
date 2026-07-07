/**
 * 待办工具函数
 *
 * 提取共享的排序和计算逻辑，避免重复代码
 */

import type { Todo } from './types'

/**
 * 按截止时间排序比较函数
 *
 * 排序规则：
 * 1. 有截止时间的排前面（按时间升序）
 * 2. 无截止时间的排后面（按创建时间降序）
 */
export function compareTodosByDeadline(a: Todo, b: Todo): number {
  const aHas = a.deadlineTs != null
  const bHas = b.deadlineTs != null
  if (aHas && bHas) return a.deadlineTs! - b.deadlineTs!
  if (aHas) return -1
  if (bHas) return 1
  return b.createdAt - a.createdAt
}

/**
 * 获取第一条未完成的待办（用于折叠态预览）
 *
 * @param todos - 所有待办列表
 * @returns 第一条未完成的待办，如果没有则返回 undefined
 */
export function getFirstActiveTodo(todos: Todo[]): Todo | undefined {
  const activeTodos = todos.filter((t) => !t.completed)
  if (activeTodos.length === 0) {
    return undefined
  }
  return [...activeTodos].sort(compareTodosByDeadline)[0]
}

/**
 * ISO 日期格式正则表达式
 */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
