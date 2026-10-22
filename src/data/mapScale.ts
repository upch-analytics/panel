import { quantile } from 'd3-array'
import type { Region } from './types'
import { pct, rates, type Totals } from './agg'
import type { MapMode } from './filters'

// Режимы карты и расчет классов шкалы. Общие для карты и ранжированного списка,
// чтобы список и заливка всегда считали одно и то же.

export const SCALE = ['var(--color-map-1)', 'var(--color-map-2)', 'var(--color-map-3)', 'var(--color-map-4)', 'var(--color-map-5)']

export type ModeDef = { title: string; value: (t: Totals, r: Region) => number; fmt: (v: number) => string; invert: boolean; note?: string; rankTitle: string }

export const MODES: Record<MapMode, ModeDef> = {
  count: { title: 'Обращений на 10 000 жителей', rankTitle: 'Больше всего обращений на 10 000 жителей', value: (t, r) => (t.rec * 10) / r.pop, fmt: v => v.toFixed(1).replace('.', ','), invert: false, note: 'Число обращений зависит от численности населения и доступности Уполномоченного и не оценивается как хорошее или плохое' },
  overdue: { title: 'Доля просроченных обращений', rankTitle: 'Наибольшая доля просроченных', value: t => rates(t).overShare, fmt: v => pct(v), invert: false },
  repeat: { title: 'Доля повторных обращений', rankTitle: 'Наибольшая доля повторных', value: t => rates(t).repShare, fmt: v => pct(v), invert: false },
  restored: { title: 'Доля восстановленных прав', rankTitle: 'Наименьшая доля восстановленных прав', value: t => rates(t).restShare, fmt: v => pct(v), invert: true, note: 'Шкала обратная: чем ниже доля, тем насыщеннее цвет' },
}

export interface Classified {
  /** значение показателя по субъекту */
  val: Map<string, number>
  /** класс 0..4, где 4 соответствует самому насыщенному цвету */
  cls: Map<string, number>
  /** границы классов по возрастанию значения: min, 20, 40, 60, 80%, max */
  edges: number[]
}

/** Квантили 20/40/60/80% по подключенным субъектам с обращениями за период */
export function classify(values: Map<string, Totals>, byCode: Map<string, Region>, m: ModeDef): Classified {
  const val = new Map<string, number>()
  for (const [code, t] of values) {
    const r = byCode.get(code)
    if (!r) continue
    const v = m.value(t, r)
    if (Number.isFinite(v) && t.rec > 0) val.set(code, v)
  }
  const sorted = [...val.values()].sort((a, b) => a - b)
  const th = [0.2, 0.4, 0.6, 0.8].map(q => quantile(sorted, q) ?? 0)
  const cls = new Map<string, number>()
  for (const [code, v] of val) {
    let i = 0
    while (i < th.length && v >= th[i]) i++
    cls.set(code, m.invert ? 4 - i : i)
  }
  return { val, cls, edges: [sorted[0] ?? 0, ...th, sorted[sorted.length - 1] ?? 0] }
}

/** Порядок «самые выраженные сверху» в текущем режиме */
export const rankOrder = (m: ModeDef) => (a: number, b: number) => (m.invert ? a - b : b - a)
