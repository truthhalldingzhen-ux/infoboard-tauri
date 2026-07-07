/**
 * 插件功能组件模板
 *
 * 只管功能，不管外观
 * 修改这里只影响功能，不动外观配置
 *
 * 组件通过 props 接收 manifest 数据，不自己定义外观
 */

import type { PluginComponentProps } from '../../core/types'
import { useData } from './useData'

/**
 * 插件功能组件
 *
 * @example
 * ```tsx
 * <MyPluginComponent manifest={manifest} expanded={false} />
 * ```
 */
export function MyPluginComponent({ manifest, expanded }: PluginComponentProps) {
  const { data, loading, error, refresh } = useData()

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full loading" />
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-red-500 mb-2">{error}</p>
        <button className="btn btn-secondary text-xs" onClick={refresh}>
          重试
        </button>
      </div>
    )
  }

  // 根据展开状态显示不同内容
  if (expanded) {
    return <ExpandedView data={data} refresh={refresh} />
  }

  return <CompactView data={data} refresh={refresh} />
}

/**
 * 紧凑视图（折叠状态）
 */
function CompactView({ data, refresh }: { data: any; refresh: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">{data ? '有数据' : '暂无数据'}</p>
      <button
        className="text-xs text-accent hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          refresh()
        }}
      >
        刷新
      </button>
    </div>
  )
}

/**
 * 展开视图
 */
function ExpandedView({ data, refresh }: { data: any; refresh: () => void }) {
  return (
    <div className="space-y-4">
      {/* 数据展示 */}
      <div className="p-3 rounded-card bg-bg-surface-hover">
        <pre className="text-xs text-text-secondary overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button className="btn btn-primary text-xs" onClick={refresh}>
          刷新数据
        </button>
      </div>
    </div>
  )
}
