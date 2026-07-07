/** 插件组件通过 props 接收 manifest，不自己定义外观 */
export interface PluginComponentProps {
  /** 由核心注入的 manifest 数据 */
  manifest: PluginManifest
  /** 是否展开状态 */
  expanded?: boolean
}

/** 插件 UI 配置 - 只管外观，不管功能 */
export interface PluginManifest {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 所属区域：info（信息区卡片）/ tool（工具区网格） */
  section: 'info' | 'tool'
  /** 图标：emoji 或 SVG 图标键名 */
  icon: string
  /** 角标（可选） */
  badge?: number | string
  /** 主题色（可选） */
  color?: string
  /** 描述（可选） */
  description?: string
}

/** 完整插件定义 */
export interface InfoBoardPlugin {
  manifest: PluginManifest
  Component: React.ComponentType<PluginComponentProps>
  onInit?: () => void
  onDestroy?: () => void
}
