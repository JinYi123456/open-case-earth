import type { VariableDef } from '../types'

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
}

export function superscript(value: number): string {
  return String(value)
    .split('')
    .map((char) => SUPERSCRIPT[char] ?? char)
    .join('')
}

export function fmt(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs > 0 && abs < 0.001) return value.toExponential(1).replace('e-', 'e-')
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function signed(value: number, decimals = 2, unit = ''): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = Math.abs(value) < Math.pow(10, -decimals) / 2 ? 0 : value
  const prefix = rounded > 0 ? '+' : rounded < 0 ? '−' : '±'
  return `${prefix}${fmt(Math.abs(rounded), decimals)}${unit ? ` ${unit}` : ''}`
}

export function pValue(p: number): string {
  if (!Number.isFinite(p)) return '—'
  if (p < 0.0001) {
    const exponent = Math.floor(Math.log10(p))
    const mantissa = p / Math.pow(10, exponent)
    return `${mantissa.toFixed(1)} × 10${superscript(exponent)}`
  }
  if (p < 0.001) return p.toFixed(4)
  return p.toFixed(3)
}

export function confidenceFromP(p: number): string {
  if (!Number.isFinite(p)) return '—'
  if (p < 0.001) return '>99.9%'
  if (p < 0.01) return '>99%'
  if (p < 0.05) return '>95%'
  return '<95%'
}

export function formatRate(value: number, variable: VariableDef): string {
  return `${signed(value, variable.slopeDecimals, variable.slopeUnit)} / decade`
}

export function formatValue(value: number, variable: VariableDef): string {
  return `${fmt(value, variable.decimals)} ${variable.annualUnit}`
}

export function formatYearRange(start: number, end: number): string {
  return `${start}—${end}`
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}`
}

export function formatLon(lon: number): string {
  const normalized = ((((lon + 180) % 360) + 360) % 360) - 180
  return `${Math.abs(normalized).toFixed(3)}° ${normalized >= 0 ? 'E' : 'W'}`
}

export function formatCoords(lat: number, lon: number): string {
  return `${formatLat(lat)}, ${formatLon(lon)}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

export function caseNumber(seed: string): string {
  const hash = hashString(seed)
  return `0CE-${String(hash % 9000 + 1000)}`
}

export function titleCasePlace(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length > 2 && word === word.toUpperCase()
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ')
}
