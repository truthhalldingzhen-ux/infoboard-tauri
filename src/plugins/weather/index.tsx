import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Moon,
  CloudSun,
  CloudMoon,
  Droplets,
  Wind,
  Eye,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import type { PluginComponentProps } from '../types'

interface WeatherData {
  city: string
  temperature: number
  description: string
  icon: string
  humidity: number
  windSpeed: number
  visibility: number
  forecast: { date: string; tempMax: number; tempMin: number; icon: string; desc: string }[]
  updatedAt: number
}

const QWEATHER_API_KEY = 'QWEATHER_API_REMOVED'
const DEFAULT_LOCATION = '101010100'
const CACHE_KEY = 'weather-data-v2'
const CACHE_DURATION = 30 * 60 * 1000
const REFRESH_INTERVAL = 30 * 60 * 1000

const ICON_MAP: Record<number, string> = {
  100: 'sun',
  101: 'cloud-sun',
  102: 'cloud-sun',
  103: 'cloud-sun',
  104: 'cloud',
  150: 'moon',
  151: 'cloud-moon',
  153: 'cloud-moon',
  300: 'cloud-rain',
  301: 'cloud-rain',
  302: 'cloud-lightning',
  303: 'cloud-lightning',
  305: 'cloud-rain',
  306: 'cloud-rain',
  307: 'cloud-rain',
  400: 'cloud-snow',
  401: 'cloud-snow',
  402: 'cloud-snow',
  403: 'cloud-snow',
  500: 'cloud-fog',
  501: 'cloud-fog',
  502: 'cloud-fog',
  999: 'cloud',
}

function iconCode(code: string): string {
  return ICON_MAP[parseInt(code)] || 'cloud'
}

function WeatherSvg({ name, size }: { name: string; size: number }) {
  const p = { width: size, height: size, strokeWidth: 1.5, className: 'text-accent' as string }
  switch (name) {
    case 'sun':
      return <Sun {...p} />
    case 'moon':
      return <Moon {...p} />
    case 'cloud-sun':
      return <CloudSun {...p} />
    case 'cloud-moon':
      return <CloudMoon {...p} />
    case 'cloud':
      return <Cloud {...p} />
    case 'cloud-rain':
      return <CloudRain {...p} />
    case 'cloud-snow':
      return <CloudSnow {...p} />
    case 'cloud-lightning':
      return <CloudLightning {...p} />
    case 'cloud-fog':
      return <CloudFog {...p} />
    default:
      return <CloudSun {...p} />
  }
}

function loadCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeatherData
    if (Date.now() - parsed.updatedAt < CACHE_DURATION) return parsed
  } catch {
    /* */
  }
  return null
}

function saveCache(data: WeatherData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    /* */
  }
}

async function fetchWeather(location: string): Promise<WeatherData> {
  const base = 'https://api.qweather.com/v7'
  const key = QWEATHER_API_KEY
  const [nowRes, dailyRes] = await Promise.all([
    fetch(`${base}/weather/now?location=${location}&key=${key}&lang=zh`),
    fetch(`${base}/weather/3d?location=${location}&key=${key}&lang=zh`),
  ])
  if (!nowRes.ok) throw new Error(`实时天气请求失败 (${nowRes.status})`)
  if (!dailyRes.ok) throw new Error(`预报请求失败 (${dailyRes.status})`)
  const now = await nowRes.json()
  const daily = await dailyRes.json()
  if (now.code !== '200') throw new Error(`天气 API 错误: ${now.code}`)
  const n = now.now
  const cityName = now.resolvedLocation || '北京'
  return {
    city: cityName,
    temperature: parseInt(n.temp) || 0,
    description: n.text || '',
    icon: n.icon || '100',
    humidity: parseInt(n.humidity) || 0,
    windSpeed: parseInt(n.windSpeed) || 0,
    visibility: parseInt(n.vis) || 0,
    forecast: (daily.daily || []).slice(0, 3).map((d: any, i: number) => ({
      date: ['今天', '明天', '后天'][i] || d.fxDate,
      tempMax: parseInt(d.tempMax) || 0,
      tempMin: parseInt(d.tempMin) || 0,
      icon: d.iconDay || '100',
      desc: d.textDay || '',
    })),
    updatedAt: Date.now(),
  }
}

function WeatherCardInner() {
  const [data, setData] = useState<WeatherData | null>(loadCache)
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const locationRef = useRef(DEFAULT_LOCATION)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await fetchWeather(locationRef.current)
      setData(d)
      saveCache(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取天气失败')
      const cached = loadCache()
      if (cached) setData(cached)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  if (loading && !data)
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 size={14} className="animate-spin" />
        加载天气...
      </div>
    )
  if (error && !data)
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: '#ef4444' }}>
        <AlertCircle size={16} />
        {error}
        <button onClick={refresh} className="ml-auto">
          <RefreshCw size={14} />
        </button>
      </div>
    )
  if (!data) return null

  const accent = '#DA7756'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 text-xs text-text-muted mb-1">
            {data.city} · {data.description}
          </div>
          <div className="text-3xl font-bold text-text-primary">{data.temperature}°</div>
        </div>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${accent}18` }}
        >
          <WeatherSvg name={iconCode(data.icon)} size={28} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Droplets, label: '湿度', value: `${data.humidity}%` },
          { icon: Wind, label: '风速', value: `${data.windSpeed} km/h` },
          { icon: Eye, label: '能见度', value: `${data.visibility} km` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-bg-main">
            <Icon size={14} className="text-accent" />
            <span className="text-xs font-semibold text-text-primary">{value}</span>
            <span className="text-[10px] text-text-muted">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {data.forecast.map((day) => (
          <div
            key={day.date}
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-bg-main"
          >
            <span className="text-xs text-text-secondary">{day.date}</span>
            <WeatherSvg name={iconCode(day.icon)} size={18} />
            <span className="text-xs font-semibold text-text-primary">
              {day.tempMax}°/{day.tempMin}°
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-text-muted">
          {new Date(data.updatedAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          更新
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs px-2 py-1 rounded-md bg-accent text-white disabled:opacity-60"
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>
    </div>
  )
}

export default function WeatherCard(_props: PluginComponentProps) {
  return <WeatherCardInner />
}
