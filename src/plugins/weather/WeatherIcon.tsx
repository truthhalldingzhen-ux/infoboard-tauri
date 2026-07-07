/**
 * 天气 SVG 图标组件
 *
 * 使用 Lucide 图标库的 SVG 路径，替代 emoji
 * 图标来源：better-icons (lucide)
 */

import React from 'react'

/** 图标属性 */
interface WeatherIconProps {
  /** 图标名称 */
  name: string
  /** 尺寸（px），默认 24 */
  size?: number
  /** 颜色，默认 currentColor 继承父元素 */
  color?: string
  /** 额外 CSS 类名 */
  className?: string
}

/** SVG 路径映射 */
const ICON_PATHS: Record<string, React.ReactNode> = {
  // ─── 天气图标 ───
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: (
    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
  ),
  'cloud-sun': (
    <path d="M12 2v2m-7.07.93l1.41 1.41M20 12h2m-2.93-7.07l-1.41 1.41m-1.713 6.31a4 4 0 0 0-5.925-4.128M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6" />
  ),
  'cloud-moon': (
    <path d="M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6zm5.376-1.488a6 6 0 0 0 3.461-4.127c.148-.625-.659-.97-1.248-.714a4 4 0 0 1-5.259-5.26c.255-.589-.09-1.395-.716-1.248a6 6 0 0 0-4.594 5.36" />
  ),
  cloud: <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9" />,
  'cloud-rain': (
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M16 14v6m-8-6v6m4-4v6" />
  ),
  'cloud-drizzle': (
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M8 19v1m0-6v1m8 4v1m0-6v1m-4 6v1m0-6v1" />
  ),
  'cloud-snow': (
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01" />
  ),
  'cloud-lightning': (
    <>
      <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" />
      <path d="m13 12l-3 5h4l-3 5" />
    </>
  ),
  'cloud-fog': <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M16 17H7m10 4H9" />,
  'cloud-hail': (
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M16 16h.01M8 16h.01M12 20h.01M8 20h.01M16 20h.01M12 16h.01" />
  ),
  sunrise: (
    <path d="M12 2v8m-7.07.93l1.41 1.41M2 18h2m16 0h2m-2.93-7.07l-1.41 1.41M22 22H2M8 6l4-4l4 4m0 12a4 4 0 0 0-8 0" />
  ),

  // ─── 详情图标 ───
  droplets: (
    <>
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05c0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05" />
      <path d="M12.56 6.6A11 11 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </>
  ),
  wind: (
    <path d="M12.8 19.6A2 2 0 1 0 14 16H2m15.5-8a2.5 2.5 0 1 1 2 4H2m7.8-7.6A2 2 0 1 1 11 8H2" />
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76l-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  umbrella: (
    <>
      <path d="M12 13v7a2 2 0 0 0 4 0M12 2v2" />
      <path d="M20.992 13a1 1 0 0 0 .97-1.274a10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z" />
    </>
  ),

  // ─── 状态图标 ───
  offline: (
    <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.68 13.12a15 15 0 0 1-.83 3.38M6.23 6.23A15 15 0 0 0 2 12c0 2.36.55 4.6 1.54 6.62" />
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4m0 4h.01" />
    </>
  ),
}

/**
 * 和风天气图标代码 → Lucide 图标名称映射
 */
const QWEATHER_ICON_MAP: Record<number, string> = {
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
  304: 'cloud-hail',
  305: 'cloud-drizzle',
  306: 'cloud-rain',
  307: 'cloud-rain',
  308: 'cloud-rain',
  309: 'cloud-drizzle',
  310: 'cloud-rain',
  311: 'cloud-rain',
  312: 'cloud-rain',
  313: 'cloud-rain',
  314: 'cloud-rain',
  315: 'cloud-rain',
  316: 'cloud-rain',
  317: 'cloud-rain',
  318: 'cloud-rain',
  350: 'cloud-rain',
  399: 'cloud-rain',
  400: 'cloud-snow',
  401: 'cloud-snow',
  402: 'cloud-snow',
  403: 'cloud-snow',
  404: 'cloud-snow',
  405: 'cloud-snow',
  406: 'cloud-snow',
  407: 'cloud-snow',
  408: 'cloud-snow',
  409: 'cloud-snow',
  410: 'cloud-snow',
  456: 'cloud-snow',
  457: 'cloud-snow',
  499: 'cloud-snow',
  500: 'cloud-fog',
  501: 'cloud-fog',
  502: 'cloud-fog',
  503: 'cloud-fog',
  504: 'cloud-fog',
  507: 'cloud-fog',
  508: 'cloud-fog',
  509: 'cloud-fog',
  510: 'cloud-fog',
  511: 'cloud-fog',
  512: 'cloud-fog',
  513: 'cloud-fog',
  514: 'cloud-fog',
  515: 'cloud-fog',
  900: 'sun',
  901: 'cloud-snow',
  999: 'cloud',
}

/**
 * 将和风天气图标代码转为 Lucide 图标名称
 */
export function getIconName(iconCode: string): string {
  const code = parseInt(iconCode, 10)
  return QWEATHER_ICON_MAP[code] || 'cloud-sun'
}

/**
 * 天气 SVG 图标组件
 *
 * @example
 * ```tsx
 * <WeatherIcon name="sun" size={32} color="#3B82F6" />
 * <WeatherIcon name="100" size={24} />  // 和风天气图标代码
 * ```
 */
export function WeatherIcon({ name, size = 24, color, className }: WeatherIconProps) {
  // 如果传入的是数字代码，转为图标名称
  const iconName = /^\d+$/.test(name) ? getIconName(name) : name
  const paths = ICON_PATHS[iconName]

  if (!paths) {
    // 兜底：返回一个通用天气图标
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color || 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {ICON_PATHS['cloud-sun']}
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths}
    </svg>
  )
}
