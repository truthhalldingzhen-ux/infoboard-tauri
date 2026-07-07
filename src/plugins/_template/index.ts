/**
 * 插件导出模板
 *
 * 统一导出插件定义，供 plugins/index.ts 注册使用
 */

import type { InfoBoardPlugin } from '../../core/types'
import { manifest } from './manifest'
import { MyPluginComponent } from './Component'

/**
 * 完整的插件定义
 *
 * 包含：
 * - manifest: UI 配置
 * - Component: 功能组件
 * - onInit: 初始化钩子（可选）
 * - onDestroy: 销毁钩子（可选）
 */
export const myPlugin: InfoBoardPlugin = {
  manifest,
  Component: MyPluginComponent,

  /**
   * 初始化钩子（可选）
   * 插件注册时调用，用于初始化资源
   */
  onInit: () => {
    console.log(`[Plugin] ${manifest.name} 已加载`)
    // TODO: 初始化操作，如：
    // - 注册事件监听
    // - 启动定时器
    // - 加载配置
  },

  /**
   * 销毁钩子（可选）
   * 插件注销时调用，用于清理资源
   */
  onDestroy: () => {
    console.log(`[Plugin] ${manifest.name} 已卸载`)
    // TODO: 清理操作，如：
    // - 移除事件监听
    // - 清除定时器
    // - 保存状态
  },
}

// 也可以单独导出各个部分
export { manifest } from './manifest'
export { MyPluginComponent } from './Component'
export { useData, useDataWithRefresh, useDataWithStorage } from './useData'
