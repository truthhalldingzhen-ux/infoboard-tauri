/**
 * 插件接口定义
 *
 * 核心原则：UI 样式和功能逻辑完全分离
 * - PluginManifest：只管外观（图标、名称、配色）
 * - PluginComponentProps：组件通过 props 接收 manifest，不自己定义外观
 */

// ─── UI 配置层 ─── 只管外观，不管功能
export interface PluginManifest {
  /** 唯一标识，如 "weather", "todo" */
  id: string

  /** 显示名称，如 "天气", "待办" */
  name: string

  /** 所属区域：info（信息区）或 tool（工具区） */
  section: 'info' | 'tool'

  /** 图标：emoji、SVG 路径或图标库名称 */
  icon: string

  /** 角标（可选），如待办未完成数量 */
  badge?: number | string

  /** 主题色（可选），用于卡片强调色 */
  color?: string

  /** 自定义样式覆盖（可选） */
  style?: Record<string, string>
}

// ─── 功能逻辑层 ─── 只管功能，不管外观
// Component 通过 props 接收 manifest 数据，不自己定义外观
export interface PluginComponentProps {
  /** 由核心注入的 manifest 数据，组件只读不写 */
  manifest: PluginManifest

  /** 是否展开状态（工具区插件使用） */
  expanded?: boolean
}

// ─── 完整插件导出 ───
export interface InfoBoardPlugin {
  /** UI 配置 */
  manifest: PluginManifest

  /** 功能组件 */
  Component: React.ComponentType<PluginComponentProps>

  /** 插件初始化钩子（可选） */
  onInit?: () => void

  /** 插件销毁钩子（可选） */
  onDestroy?: () => void
}
