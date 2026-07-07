/**
 * 插件 UI 配置模板
 *
 * 只管外观，不管功能
 * 修改这里只影响外观，不动功能代码
 */

import type { PluginManifest } from '../../core/types'

export const manifest: PluginManifest = {
  /** 唯一标识（必填，全小写，用连字符） */
  id: 'my-plugin',

  /** 显示名称（必填） */
  name: '我的插件',

  /** 所属区域（必填）：'info' 或 'tool' */
  section: 'tool',

  /** 图标（必填）：emoji、SVG 路径或图标库名称 */
  icon: '🔧',

  /** 角标（可选）：数字或字符串，如未读数量 */
  // badge: 3,

  /** 主题色（可选）：用于卡片强调色 */
  color: '#DA7756',

  /** 自定义样式覆盖（可选） */
  // style: {
  //   borderRadius: '12px',
  //   boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  // },
}
