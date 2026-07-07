/**
 * 插件数据逻辑模板
 *
 * 负责：
 * 1. 数据获取
 * 2. 状态管理
 * 3. 业务处理
 * 4. 存储读写
 *
 * 只管功能，不管外观
 */

import { useState, useEffect, useCallback } from 'react'

/**
 * 数据接口定义
 */
interface Data {
  // 在这里定义你的数据结构
  [key: string]: any
}

/**
 * Hook 返回值接口
 */
interface UseDataReturn {
  /** 数据 */
  data: Data | null

  /** 加载状态 */
  loading: boolean

  /** 错误信息 */
  error: string | null

  /** 刷新数据 */
  refresh: () => void

  /** 更新数据 */
  update: (newData: Partial<Data>) => void
}

/**
 * 数据逻辑 Hook
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data, loading, error, refresh } = useData()
 *
 *   if (loading) return <Loading />
 *   if (error) return <Error message={error} />
 *
 *   return <div>{data?.name}</div>
 * }
 * ```
 */
export function useData(): UseDataReturn {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * 获取数据
   * 替换为你的实际数据获取逻辑
   */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: 替换为实际的数据获取逻辑
      // 示例：本地存储、API 调用、文件读取等

      // 模拟异步操作
      await new Promise((resolve) => setTimeout(resolve, 500))

      // 示例数据
      const mockData: Data = {
        id: 1,
        name: '示例数据',
        timestamp: new Date().toISOString(),
      }

      setData(mockData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取数据失败'
      setError(errorMessage)
      console.error('[MyPlugin] 获取数据失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 刷新数据
   */
  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  /**
   * 更新数据
   * @param newData - 要合并的新数据
   */
  const update = useCallback((newData: Partial<Data>) => {
    setData((prev) => {
      if (!prev) return newData as Data
      return { ...prev, ...newData }
    })
  }, [])

  // 初始化时获取数据
  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refresh,
    update,
  }
}

/**
 * 带定时刷新的数据 Hook
 *
 * @param interval - 刷新间隔（毫秒），默认 60000（1 分钟）
 *
 * @example
 * ```tsx
 * const { data, loading } = useDataWithRefresh(30000) // 每 30 秒刷新
 * ```
 */
export function useDataWithRefresh(interval: number = 60000): UseDataReturn {
  const result = useData()

  useEffect(() => {
    const timer = setInterval(() => {
      result.refresh()
    }, interval)

    return () => clearInterval(timer)
  }, [interval, result.refresh])

  return result
}

/**
 * 带本地存储的数据 Hook
 *
 * @param storageKey - 存储键名
 *
 * @example
 * ```tsx
 * const { data, update } = useDataWithStorage('my-plugin-data')
 *
 * // 数据会自动保存到 localStorage
 * update({ name: '新名称' })
 * ```
 */
export function useDataWithStorage(storageKey: string): UseDataReturn {
  const [data, setData] = useState<Data | null>(() => {
    // 从 localStorage 加载
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 保存到 localStorage
   */
  const saveToStorage = useCallback(
    (dataToSave: Data | null) => {
      try {
        if (dataToSave) {
          localStorage.setItem(storageKey, JSON.stringify(dataToSave))
        } else {
          localStorage.removeItem(storageKey)
        }
      } catch (err) {
        console.error('[MyPlugin] 保存数据失败:', err)
      }
    },
    [storageKey]
  )

  /**
   * 更新数据并保存
   */
  const update = useCallback(
    (newData: Partial<Data>) => {
      setData((prev) => {
        const updated = prev ? { ...prev, ...newData } : (newData as Data)
        saveToStorage(updated)
        return updated
      })
    },
    [saveToStorage]
  )

  /**
   * 刷新（重新从存储加载）
   */
  const refresh = useCallback(() => {
    setLoading(true)
    try {
      const stored = localStorage.getItem(storageKey)
      setData(stored ? JSON.parse(stored) : null)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载数据失败'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [storageKey])

  return {
    data,
    loading,
    error,
    refresh,
    update,
  }
}
