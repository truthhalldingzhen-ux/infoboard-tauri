/**
 * 主题颜色工具函数
 *
 * 提供颜色透明度处理，兼容 CSS getComputedStyle 返回的各种格式
 */

/**
 * 为颜色添加透明度
 *
 * 兼容三种输入格式：
 * - `#RRGGBB`（十六进制，6 位）
 * - `rgb(r, g, b)`（getComputedStyle 最常返回此格式）
 * - `rgba(r, g, b, a)`（已带 alpha）
 *
 * @param color 原始颜色字符串
 * @param alpha 目标透明度（0-1）
 * @returns 带透明度的 rgba 颜色字符串
 */
export function withAlpha(color: string, alpha: number): string {
  const trimmed = color.trim()

  // 匹配 #RRGGBB
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{6})$/)
  if (hexMatch) {
    const hex = hexMatch[1]
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // 匹配 rgb(r, g, b) — getComputedStyle 最常返回此格式
  const rgbMatch = trimmed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`
  }

  // 匹配 rgba(r, g, b, a) — 替换 alpha 值
  const rgbaMatch = trimmed.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/)
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
  }

  // 无法解析，原样返回
  return trimmed
}
