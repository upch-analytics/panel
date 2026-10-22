import type { DemoData } from './types'
import type { MonthRange } from './agg'

// Период в адресе страницы: y2026, q2026-3, m2026-09, r2025-03_2026-02
export type Period =
  | { kind: 'year'; year: number }
  | { kind: 'quarter'; year: number; q: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'range'; from: string; to: string }

export const DEFAULT_PERIOD = 'y2026'

const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const QUARTERS = ['I', 'II', 'III', 'IV']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export function parsePeriod(s: string | null): Period {
  const v = s ?? DEFAULT_PERIOD
  let m: RegExpMatchArray | null
  if ((m = v.match(/^y(\d{4})$/))) return { kind: 'year', year: +m[1] }
  if ((m = v.match(/^q(\d{4})-([1-4])$/))) return { kind: 'quarter', year: +m[1], q: +m[2] }
  if ((m = v.match(/^m(\d{4})-(\d{2})$/))) return { kind: 'month', year: +m[1], month: +m[2] }
  if ((m = v.match(/^r(\d{4}-\d{2})_(\d{4}-\d{2})$/))) return m[1] <= m[2] ? { kind: 'range', from: m[1], to: m[2] } : { kind: 'range', from: m[2], to: m[1] }
  return parsePeriod(DEFAULT_PERIOD)
}

export function serializePeriod(p: Period): string {
  switch (p.kind) {
    case 'year': return `y${p.year}`
    case 'quarter': return `q${p.year}-${p.q}`
    case 'month': return `m${p.year}-${String(p.month).padStart(2, '0')}`
    case 'range': return `r${p.from}_${p.to}`
  }
}

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

/** Диапазон индексов месяцев; null, если период вне набора данных */
export function periodRange(data: DemoData, p: Period): MonthRange | null {
  const months = data.meta.months
  let from: string, to: string
  switch (p.kind) {
    case 'year': from = ym(p.year, 1); to = ym(p.year, 12); break
    case 'quarter': from = ym(p.year, p.q * 3 - 2); to = ym(p.year, p.q * 3); break
    case 'month': from = to = ym(p.year, p.month); break
    case 'range': from = p.from; to = p.to; break
  }
  const last = months[months.length - 1]
  if (from > last || to < months[0]) return null
  const a = months.indexOf(from < months[0] ? months[0] : from)
  const b = months.indexOf(to > last ? last : to)
  return { from: a, to: b }
}

/** Подпись периода с учетом того, что последний месяц неполный */
export function periodLabel(data: DemoData, p: Period): string {
  const r = periodRange(data, p)
  if (!r) return 'Нет данных за период'
  const [fy, fm] = data.meta.months[r.from].split('-').map(Number)
  const [ty, tm] = data.meta.months[r.to].split('-').map(Number)
  const partial = data.meta.months[r.to] === data.meta.partialMonth
  const day = Number(data.meta.today.slice(8, 10))
  const end = partial ? `${day} ${MONTHS_GEN[tm - 1]} ${ty}` : `${MONTHS_NOM[tm - 1]} ${ty}`
  switch (p.kind) {
    case 'year': return partial ? `Январь - ${end}` : `${p.year} год`
    case 'quarter': return partial ? `${QUARTERS[p.q - 1]} квартал ${p.year} (по ${day} ${MONTHS_GEN[tm - 1]})` : `${QUARTERS[p.q - 1]} квартал ${p.year}`
    case 'month': return partial ? `1-${day} ${MONTHS_GEN[tm - 1]} ${ty}` : `${cap(MONTHS_NOM[tm - 1])} ${ty}`
    case 'range': return `${cap(MONTHS_NOM[fm - 1])} ${fy} - ${end}`
  }
}

export function compareLabel(data: DemoData, p: Period): string {
  const r = periodRange(data, p)
  if (!r || r.from < 12) return ''
  const fy = Number(data.meta.months[r.from].slice(0, 4)) - 1
  const ty = Number(data.meta.months[r.to].slice(0, 4)) - 1
  return `к тому же периоду ${fy === ty ? fy : `${fy}-${ty}`}`
}

export const monthName = (i: number) => MONTHS_NOM[i]
export const monthShort = (i: number) => ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][i]
