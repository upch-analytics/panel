import type { DemoData, MetricKey } from './types'

// Расчеты поверх куба «субъект × месяц × категория × метрика».
// Все сводные значения получаются суммированием ячеек, поэтому они всегда согласованы.

export const METRICS: MetricKey[] = ['rec', 'over', 'done', 'viol', 'rest', 'rep']
const NM = METRICS.length

/**
 * due: поступившие, у которых срок ответа (30 дней) уже наступил; overDue: просроченные среди них.
 * Доля просроченных считается по ним, иначе свежие месяцы занижают долю и искажают сравнение с прошлым годом.
 */
export type Totals = Record<MetricKey | 'due' | 'overDue', number>
export const zero = (): Totals => ({ rec: 0, over: 0, done: 0, viol: 0, rest: 0, rep: 0, due: 0, overDue: 0 })

/** Доля обращений месяца с наступившим сроком: текущий месяц 0, прошлый 0,65 (поступившие до 20 числа) */
function dueFactor(data: DemoData, m: number) {
  const age = data.meta.months.length - 1 - m
  return age <= 0 ? 0 : age === 1 ? 0.65 : 1
}

export interface Rates {
  overShare: number   // просрочено / поступило, среди обращений с наступившим сроком ответа
  repShare: number    // повторные / поступило
  restShare: number   // права восстановлены / завершено с установленным нарушением
  inWork: number      // поступило - рассмотрено
}
export function rates(t: Totals): Rates {
  return {
    overShare: t.due ? t.overDue / t.due : NaN,
    repShare: t.rec ? t.rep / t.rec : NaN,
    restShare: t.viol ? t.rest / t.viol : NaN,
    inWork: t.rec - t.done,
  }
}

/** Диапазон месяцев [from, to] включительно, индексы в meta.months */
export interface MonthRange { from: number; to: number }

export interface Filter {
  range: MonthRange
  codes?: string[]          // субъекты; по умолчанию все подключенные
  cats?: string[]           // id категорий; по умолчанию все
  /** доля, с которой берется последний месяц диапазона (для сравнения неполного месяца) */
  lastFrac?: number
  /** сдвиг в месяцах для прошлогоднего периода: зрелость сроков берется как у текущего */
  shift?: number
}

export function sumCube(data: DemoData, f: Filter): Totals {
  const out = zero()
  const nc = data.meta.categories.length
  const catIdx = f.cats?.length ? data.meta.categories.map((c, i) => (f.cats!.includes(c.id) ? i : -1)).filter(i => i >= 0) : null
  const codes = f.codes ?? Object.keys(data.cube)
  for (const code of codes) {
    const arr = data.cube[code]
    if (!arr) continue
    for (let m = f.range.from; m <= f.range.to; m++) {
      const frac = m === f.range.to && f.lastFrac != null ? f.lastFrac : 1
      const due = dueFactor(data, m + (f.shift ?? 0))
      for (let c = 0; c < nc; c++) {
        if (catIdx && !catIdx.includes(c)) continue
        const base = (m * nc + c) * NM
        for (let k = 0; k < NM; k++) out[METRICS[k]] += arr[base + k] * frac
        out.due += arr[base] * frac * due
        // В текущем периоде просрочки свежих месяцев уже ограничены сроком; в прошлогоднем ограничиваем так же
        out.overDue += arr[base + 1] * frac * (f.shift ? due : 1)
      }
    }
  }
  if (f.lastFrac != null) for (const k of METRICS) out[k] = Math.round(out[k])
  return out
}

/** Тот же период годом ранее. Если текущий период заканчивается неполным месяцем, прошлый берется с той же долей */
export function previousYear(data: DemoData, f: Filter): Filter | null {
  const from = f.range.from - 12, to = f.range.to - 12
  if (from < 0) return null
  const partialIdx = data.meta.months.indexOf(data.meta.partialMonth)
  const lastFrac = f.range.to === partialIdx ? data.meta.partialFraction : undefined
  return { ...f, range: { from, to }, lastFrac, shift: 12 }
}

export function byRegion(data: DemoData, f: Omit<Filter, 'codes'>): Map<string, Totals> {
  const out = new Map<string, Totals>()
  for (const code of Object.keys(data.cube)) out.set(code, sumCube(data, { ...f, codes: [code] }))
  return out
}

export function byCategory(data: DemoData, f: Omit<Filter, 'cats'>): { id: string; name: string; t: Totals }[] {
  return data.meta.categories.map(c => ({ ...c, t: sumCube(data, { ...f, cats: [c.id] }) }))
}

/** Поступившие по месяцам внутри диапазона */
export function monthly(data: DemoData, f: Filter): { month: string; t: Totals }[] {
  const out: { month: string; t: Totals }[] = []
  for (let m = f.range.from; m <= f.range.to; m++) out.push({ month: data.meta.months[m], t: sumCube(data, { ...f, range: { from: m, to: m }, lastFrac: undefined }) })
  return out
}

/** Согласование с числом: plural(5, 'обращение', 'обращения', 'обращений') */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(Math.round(n)) % 100, b = a % 10
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many
}
export const numWord = (n: number, one: string, few: string, many: string) => `${Math.round(n).toLocaleString('ru-RU')} ${plural(n, one, few, many)}`

export const pct = (v: number, digits = 1) => (Number.isFinite(v) ? (v * 100).toFixed(digits).replace('.', ',') + '%' : 'нет данных')
export const pp = (v: number) => (Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v * 100).toFixed(1).replace('.', ',')} п.п.` : '')
export const num = (v: number) => Math.round(v).toLocaleString('ru-RU')
export const change = (cur: number, prev: number) => (prev ? cur / prev - 1 : NaN)
export const signedPct = (v: number) => (Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v * 100).toFixed(1).replace('.', ',')}%` : '')
