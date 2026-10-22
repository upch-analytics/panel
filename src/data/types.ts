import type { FeatureCollection, Geometry } from 'geojson'

export type MetricKey = 'rec' | 'over' | 'done' | 'viol' | 'rest' | 'rep'

export interface Category { id: string; name: string }

export interface Region {
  code: string
  iso: string | null
  name: string
  short: string
  district: string
  pop: number
  connected: boolean
  executors: number
  groups: { elderly: number; disabled: number; remote: number; large: number }
  /** муниципальные образования, первым административный центр */
  munis: string[]
}

export interface DemoData {
  meta: {
    demo: true
    note: string
    seed: string
    today: string
    months: string[]
    partialMonth: string
    partialFraction: number
    metrics: MetricKey[]
    categories: Category[]
    districts: Record<string, string>
    responseDays: number
    notRegisteredEstimate2026: number
  }
  regions: Region[]
  /** code -> плоский массив: (месяц × категория × метрика) */
  cube: Record<string, number[]>
}

export type RegionsGeo = FeatureCollection<Geometry, { code: string }>
