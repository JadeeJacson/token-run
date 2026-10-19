export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100_000 ? 0 : 1)}K`
  return String(value)
}

export function formatCny(value: number): string {
  return `¥${Math.max(0, value).toFixed(2)}`
}

export function lerp(min: number, max: number, amount: number): number {
  return min + (max - min) * amount
}

export function scaledEffect(value = 0, multiplier = 1): number {
  if (value === 0) return 0
  const sign = Math.sign(value)
  const scaled = value > 0 ? Math.ceil(Math.abs(value) * multiplier) : Math.round(Math.abs(value) * multiplier)
  return sign * Math.max(1, scaled)
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

export function progressSummary(analysis: number, code: number, test: number): string {
  const pieces: string[] = []
  if (analysis) pieces.push(`调查${signed(analysis)}`)
  if (code) pieces.push(`实现${signed(code)}`)
  if (test) pieces.push(`验证${signed(test)}`)
  return pieces.length ? `进度：${pieces.join(' / ')}。` : ''
}
