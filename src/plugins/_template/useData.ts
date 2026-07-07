import { useState, useEffect } from 'react'

export function useTemplateData() {
  const [data, setData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    // 示例：模拟数据加载
    const timer = setTimeout(() => {
      setData('模板数据')
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  return { data, loading }
}
