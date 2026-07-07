/**
 * 天气插件配置常量（和风天气 API）
 *
 * ⚠️ TODO: 生产环境应通过 Electron IPC 代理 API 请求，避免暴露 Key
 *
 * 和风天气控制台：https://console.qweather.com
 */

/** 和风天气 API Host（在控制台 → 设置中查看，用户在设置页配置） */
export const QWEATHER_API_HOST = ''

/** 和风天气 GeoAPI Host（城市搜索） */
export const GEO_API_HOST = 'geoapi.qweatherapi.com'

/** 和风天气 API Key（用户在设置页配置） */
export const QWEATHER_API_KEY = ''

/** 默认地区 LocationID（北京 = 101010100） */
export const DEFAULT_LOCATION_ID = '101010100'

/** 默认城市名（仅用于显示） */
export const DEFAULT_CITY_NAME = '北京'

/** 缓存时长（30 分钟） */
export const CACHE_DURATION = 30 * 60 * 1000

/** 缓存键名 */
export const CACHE_KEY = 'weather-data'

/** 城市配置键名 */
export const CITY_KEY = 'weather-city'

/** 刷新间隔（30 分钟） */
export const REFRESH_INTERVAL = 30 * 60 * 1000
