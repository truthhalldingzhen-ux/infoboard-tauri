/**
 * 城市定位 Hook
 *
 * 方案：ip-api.com 获取坐标 → 和风天气 GeoAPI 反查区级 LocationID
 * ip-api.com 免费、无需 Key，但只返回市级坐标
 * 和风天气 GeoAPI 用坐标反查可精确到区/街道级 LocationID
 */

import { useState, useCallback, useRef } from 'react'
import type { CityInfo, UseLocationSearchReturn } from './types'
import { QWEATHER_API_HOST, QWEATHER_API_KEY } from './config'

/** 从设置读取 API 配置 */
function getApiConfig(): { host: string; key: string } {
  try {
    const stored = localStorage.getItem('infoboard-settings')
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        host: parsed.weatherApiHost || QWEATHER_API_HOST,
        key: parsed.weatherApiKey || QWEATHER_API_KEY,
      }
    }
  } catch {
    /* 忽略 */
  }
  return { host: QWEATHER_API_HOST, key: QWEATHER_API_KEY }
}

/**
 * 用和风天气 GeoAPI 通过坐标反查地区（精确到区/街道）
 * 端点：GET /geo/v2/city/lookup?location={lon},{lat}
 */
async function reverseGeocode(lat: number, lon: number): Promise<CityInfo | null> {
  const { host, key } = getApiConfig()
  console.log('[天气插件] GeoAPI 反查配置:', { host, keyLen: key.length, lat, lon })
  if (!host || !key) {
    console.warn('[天气插件] GeoAPI 缺少 host 或 key')
    return null
  }

  try {
    const url = `https://${host}/geo/v2/city/lookup?location=${lon.toFixed(2)},${lat.toFixed(2)}&key=${key}&lang=zh&number=1`
    console.log('[天气插件] GeoAPI 请求:', url)
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    console.log('[天气插件] GeoAPI 响应状态:', res.status)

    if (!res.ok) {
      console.warn('[天气插件] GeoAPI HTTP 错误:', res.status, res.statusText)
      return null
    }

    const data = await res.json()
    console.log('[天气插件] GeoAPI 响应数据:', JSON.stringify(data).slice(0, 300))

    if (data.code !== '200' || !data.location?.length) {
      console.warn('[天气插件] GeoAPI 业务错误或无结果:', data.code)
      return null
    }

    const loc = data.location[0]
    console.log('[天气插件] GeoAPI 反查成功:', loc.name, loc.adm2, loc.id)
    return {
      locationId: loc.id,
      name: loc.name,
      adm2: loc.adm2,
      adm1: loc.adm1,
      country: loc.country,
      lon: loc.lon,
      lat: loc.lat,
    }
  } catch (err) {
    console.error('[天气插件] GeoAPI 反查异常:', err)
    return null
  }
}

/**
 * 城市定位 Hook
 */
export function useLocationSearch(): UseLocationSearchReturn & {
  autoLocate: () => Promise<void>
} {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CityInfo[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 自动定位：ip-api.com 坐标 → 和风 GeoAPI 反查区级
   */
  const autoLocate = useCallback(async () => {
    setSearching(true)
    setSearchError(null)

    try {
      // 第 1 步：ip-api.com 获取坐标
      const ipRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) })
      if (!ipRes.ok) throw new Error('IP 定位请求失败')

      const ipData = await ipRes.json()
      console.log('[天气插件] IP 定位结果:', JSON.stringify(ipData))
      if (ipData.error) throw new Error(`IP 定位失败: ${ipData.reason || 'unknown'}`)

      // 第 2 步：用坐标反查和风天气 GeoAPI（精确到区）
      const geoResult = await reverseGeocode(ipData.latitude, ipData.longitude)

      if (geoResult) {
        // GeoAPI 成功：返回区级精度
        setResults([geoResult])
        setKeyword(geoResult.name)
      } else {
        // GeoAPI 失败：回退到 IP 坐标 + 城市名
        const fallback: CityInfo = {
          locationId: '',
          name: ipData.city || ipData.region || '未知',
          adm2: ipData.city,
          adm1: ipData.region,
          country: ipData.country_name,
          lat: String(ipData.latitude),
          lon: String(ipData.longitude),
        }
        setResults([fallback])
        setKeyword(fallback.name)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '自动定位失败'
      setSearchError(msg)
      console.error('[天气插件] 自动定位失败:', err)
    } finally {
      setSearching(false)
    }
  }, [])

  /**
   * 文字搜索（和风天气 GeoAPI，带 300ms 防抖）
   */
  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!query.trim()) {
      setResults([])
      setSearchError(null)
      return
    }

    if (query.trim().length < 1) return

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setSearching(true)
      setSearchError(null)

      try {
        const { host, key } = getApiConfig()
        const url = `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(query.trim())}&key=${key}&lang=zh&number=8`
        const res = await fetch(url, { signal: controller.signal })

        if (!res.ok) throw new Error(`搜索请求失败 (${res.status})`)

        const data = await res.json()

        if (data.code !== '200') {
          console.warn('[天气插件] GeoAPI 返回:', data.code)
          setResults([])
          return
        }

        const cities: CityInfo[] = (data.location || []).map((loc: any) => ({
          locationId: loc.id,
          name: loc.name,
          adm2: loc.adm2,
          adm1: loc.adm1,
          country: loc.country,
          lon: loc.lon,
          lat: loc.lat,
        }))

        setResults(cities)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.warn('[天气插件] 城市搜索失败:', err)
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
    setSearchError(null)
    setKeyword('')
  }, [])

  return {
    keyword,
    setKeyword,
    results,
    searching,
    searchError,
    search,
    clearResults,
    autoLocate,
  }
}
