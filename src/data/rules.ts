import { rates, type Totals } from './agg'

// Правила, по которым регион попадает в «Регионы, требующие внимания» и в рекомендации.
// Пороги одинаковые везде и описаны в README. Сравнение идет с общероссийским значением
// за тот же период и с теми же фильтрами. Вывод о нарушении прав из количества не делается.

export type Level = 'high' | 'medium' | 'info'

export const THRESHOLDS = {
  /** минимум обращений за период, чтобы доли были показательны */
  minRec: 50,
  /** минимум завершенных дел с установленным нарушением для доли восстановленных прав */
  minViol: 10,
  overdue: { high: 1.6, medium: 1.4, minDiff: 0.01 },   // доля просроченных выше средней в N раз и не меньше чем на 1 п.п.
  repeat: { high: 1.45, medium: 1.3, minDiff: 0.015 },   // доля повторных
  restored: { high: 0.65, medium: 0.75, minDiff: 0.05 }, // доля восстановленных прав ниже средней (отношение)
  growth: { medium: 0.25, minAbs: 15 },                  // рост категории к прошлому году: +25% и не меньше 15 обращений
}

export type Signal = {
  metric: 'overdue' | 'repeat' | 'restored'
  level: Exclude<Level, 'info'>
  value: number
  national: number
  ratio: number
}

export function signals(region: Totals, national: Totals): Signal[] {
  const T = THRESHOLDS
  if (region.rec < T.minRec) return []
  const r = rates(region), n = rates(national)
  const out: Signal[] = []
  const over = r.overShare / n.overShare
  if (r.overShare - n.overShare >= T.overdue.minDiff && over >= T.overdue.medium)
    out.push({ metric: 'overdue', level: over >= T.overdue.high ? 'high' : 'medium', value: r.overShare, national: n.overShare, ratio: over })
  const rep = r.repShare / n.repShare
  if (r.repShare - n.repShare >= T.repeat.minDiff && rep >= T.repeat.medium)
    out.push({ metric: 'repeat', level: rep >= T.repeat.high ? 'high' : 'medium', value: r.repShare, national: n.repShare, ratio: rep })
  if (region.viol >= T.minViol) {
    const rest = r.restShare / n.restShare
    if (n.restShare - r.restShare >= T.restored.minDiff && rest <= T.restored.medium)
      out.push({ metric: 'restored', level: rest <= T.restored.high ? 'high' : 'medium', value: r.restShare, national: n.restShare, ratio: rest })
  }
  return out
}

/** Порядок в списке: сначала высокий уровень, затем самое сильное отклонение, затем число признаков */
export function severity(s: Signal[]): number {
  const dev = (x: Signal) => (x.metric === 'restored' ? 1 / x.ratio : x.ratio) - 1
  return Math.max(...s.map(x => (x.level === 'high' ? 10 : 0) + dev(x))) + s.length * 0.01
}

export const METRIC_TEXT: Record<Signal['metric'], string> = {
  overdue: 'Доля просроченных',
  repeat: 'Доля повторных',
  restored: 'Доля восстановленных прав',
}
