import {
  Cloud,
  CloudRain,
  Droplets,
  Snowflake,
  Sun,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react'
import type { VariableDef, VariableIcon } from '../types'

const GLYPHS: Record<VariableIcon, typeof Thermometer> = {
  thermometer: Thermometer,
  rain: CloudRain,
  droplet: Droplets,
  sun: Sun,
  cloud: Cloud,
  humidity: Waves,
  wind: Wind,
  snow: Snowflake,
}

export function VariableGlyph({
  variable,
  size = 16,
  strokeWidth = 1.6,
}: {
  variable: VariableDef
  size?: number
  strokeWidth?: number
}) {
  const Icon = GLYPHS[variable.icon]
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />
}

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="logo-mark"
    >
      <circle cx="16" cy="16" r="12.25" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3.75 16h24.5M16 3.75v24.5" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
      <path
        d="M7.5 20.6c2.6-5.2 5.4-7.8 8.5-7.8s5.9 2.6 8.5 7.8"
        stroke="var(--amber)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.2" fill="var(--amber)" />
      <circle cx="16" cy="16" r="5.4" stroke="var(--amber)" strokeWidth="0.6" opacity="0.55" />
    </svg>
  )
}

export function CrosshairMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="16" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <circle cx="22" cy="22" r="9" stroke="currentColor" strokeWidth="0.8" opacity="0.65" />
      <path d="M22 1v12M22 31v12M1 22h12M31 22h12" stroke="currentColor" strokeWidth="0.9" />
      <circle cx="22" cy="22" r="2" fill="var(--amber)" />
    </svg>
  )
}
