import type { ScopeId, VariableId } from '../types'

export interface CuratedCase {
  id: string
  kicker: string
  name: string
  detail: string
  lat: number
  lon: number
  variable: VariableId
  scope: ScopeId
  stat: string
  statNote: string
  blurb: string
  tone: 'warm' | 'cool' | 'neutral'
  featured: boolean
}

export const CURATED_CASES: CuratedCase[] = [
  {
    id: 'johor',
    kicker: 'Heat · Tropics',
    name: 'Johor Bahru',
    detail: 'Johor, Malaysia',
    lat: 1.4582,
    lon: 103.7649,
    variable: 'T2M',
    scope: 'local',
    stat: '+0.24 °C',
    statNote: 'per decade',
    blurb: 'A strait city warming in every season, not just the dry ones.',
    tone: 'warm',
    featured: true,
  },
  {
    id: 'amazon-arc',
    kicker: 'Water · Amazon',
    name: 'Amazon Arc',
    detail: 'Mato Grosso, Brazil',
    lat: -10,
    lon: -55,
    variable: 'PRECTOTCORR',
    scope: 'continental',
    stat: '−200 mm',
    statNote: 'per decade',
    blurb: 'The southern arc is drying while the basin core holds its rain.',
    tone: 'warm',
    featured: true,
  },
  {
    id: 'central-valley',
    kicker: 'Heat · California',
    name: 'Central Valley',
    detail: 'California, United States',
    lat: 36.75,
    lon: -119.77,
    variable: 'T2M',
    scope: 'regional',
    stat: '+0.48 °C',
    statNote: 'per decade',
    blurb: 'Inland heat pulls away from a coast that barely moves.',
    tone: 'warm',
    featured: true,
  },
  {
    id: 'svalbard',
    kicker: 'Ice · High Arctic',
    name: 'Longyearbyen',
    detail: 'Svalbard, Norway',
    lat: 78.2,
    lon: 15.6,
    variable: 'SNODP',
    scope: 'local',
    stat: '−7.9 cm',
    statNote: 'per decade',
    blurb: 'Snow depth is thinning fast where winter used to hold.',
    tone: 'cool',
    featured: false,
  },
  {
    id: 'sahel',
    kicker: 'Water · Sahel',
    name: 'Sahel',
    detail: 'Mali',
    lat: 14.5,
    lon: 0,
    variable: 'PRECTOTCORR',
    scope: 'continental',
    stat: '+43 mm',
    statNote: 'per decade',
    blurb: 'A subtle recovery in a region defined by drought.',
    tone: 'neutral',
    featured: false,
  },
  {
    id: 'iceland',
    kicker: 'Ice · North Atlantic',
    name: 'Icelandic Highlands',
    detail: 'Iceland',
    lat: 64.9,
    lon: -19,
    variable: 'SNODP',
    scope: 'regional',
    stat: '−3.0 cm',
    statNote: 'per decade · not significant',
    blurb: 'A decline the record cannot yet separate from natural swings.',
    tone: 'neutral',
    featured: false,
  },
]

export const FEATURED_CASES = CURATED_CASES.filter((item) => item.featured)
