import { numWord, pct, rates, type Totals } from './agg'

// Правила, по которым регион попадает в «Регионы, требующие внимания» и в рекомендации.
// Пороги одинаковые везде и описаны в README. Сравнение идет с общероссийским значением
// за тот же период и с теми же фильтрами. Вывод о нарушении прав из количества не делается.

export type Level = 'high' | 'medium' | 'info'

export const THRESHOLDS = {
  /** минимум обращений за период, чтобы доли были показательны */
  minRec: 50,
  /** отклонение доли от общероссийской должно быть статистически устойчивым: z-оценка биномиальной доли */
  minZ: 2,
  /** минимум завершенных дел с установленным нарушением для доли восстановленных прав */
  minViol: 10,
  overdue: { high: 1.6, medium: 1.4, minDiff: 0.01 },   // доля просроченных выше средней в N раз и не меньше чем на 1 п.п.
  repeat: { high: 1.45, medium: 1.3, minDiff: 0.015 },   // доля повторных
  restored: { high: 0.65, medium: 0.75, minDiff: 0.05 }, // доля восстановленных прав ниже средней (отношение)
  growth: { medium: 0.25, minAbs: 15 },                  // рост категории к прошлому году: +25% и не меньше 15 обращений
  repeatGrowth: { minDiff: 0.05, minRep: 15 },          // доля повторных в категории выросла на 5 п.п., не меньше 15 повторных
  load: { medium: 1.5, high: 2, elevated: 1.2 },         // незавершенных на исполнителя относительно среднего по России;
                                                        // elevated: с какого уровня причиной просрочек называется нагрузка
}

export type Signal = {
  metric: 'overdue' | 'repeat' | 'restored'
  level: Exclude<Level, 'info'>
  value: number
  national: number
  ratio: number
}

/** z-оценка отклонения доли p в выборке n от общероссийской p0 */
export const zScore = (p: number, p0: number, n: number) => (n > 0 && p0 > 0 && p0 < 1 ? (p - p0) / Math.sqrt((p0 * (1 - p0)) / n) : 0)

export function signals(region: Totals, national: Totals): Signal[] {
  const T = THRESHOLDS
  if (region.rec < T.minRec) return []
  const r = rates(region), n = rates(national)
  const out: Signal[] = []
  const over = r.overShare / n.overShare
  if (r.overShare - n.overShare >= T.overdue.minDiff && over >= T.overdue.medium && zScore(r.overShare, n.overShare, region.due) >= T.minZ)
    out.push({ metric: 'overdue', level: over >= T.overdue.high ? 'high' : 'medium', value: r.overShare, national: n.overShare, ratio: over })
  const rep = r.repShare / n.repShare
  if (r.repShare - n.repShare >= T.repeat.minDiff && rep >= T.repeat.medium && zScore(r.repShare, n.repShare, region.rec) >= T.minZ)
    out.push({ metric: 'repeat', level: rep >= T.repeat.high ? 'high' : 'medium', value: r.repShare, national: n.repShare, ratio: rep })
  if (region.viol >= T.minViol) {
    const rest = r.restShare / n.restShare
    if (n.restShare - r.restShare >= T.restored.minDiff && rest <= T.restored.medium && -zScore(r.restShare, n.restShare, region.viol) >= T.minZ)
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

// Рекомендации для страницы региона. Каждое правило: явный порог из THRESHOLDS,
// фактическое значение и сравнение (с Россией или с прошлым периодом).

export interface Recommendation {
  id: string
  level: Level
  title: string
  metric: string
  why: string
  action: string
  /** куда вести: папка обращений и категория */
  link?: { folder?: string; cat?: string; sort?: string }
}

export interface CategoryInput { id: string; name: string; t: Totals; prev?: Totals }
export interface MuniInput { name: string; cur: number; prev: number; topTopic: string; /** обращений с нарушением срока */ over?: number }

const fmtPct = (v: number) => pct(v)
const fmtPp = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')} п.п.`

export function recommendations(input: {
  region: Totals
  national: Totals
  cats: CategoryInput[]
  munis: MuniInput[]
  openPerExecutor: number
  nationalOpenPerExecutor: number
}): Recommendation[] {
  const T = THRESHOLDS
  const out: Recommendation[] = []
  const sig = signals(input.region, input.national)

  // Причина просрочек зависит от нагрузки: при нагрузке не выше средней совет про перераспределение
  // противоречил бы блоку «Нагрузка на исполнителей», поэтому указываются ответы органов власти и территории
  const loadRatio = input.openPerExecutor / input.nationalOpenPerExecutor
  const fmt1 = (v: number) => v.toFixed(1).replace('.', ',')
  const loadText = `${fmt1(input.openPerExecutor)} незавершенных обращения на исполнителя при ${fmt1(input.nationalOpenPerExecutor)} по России`
  const overMunis = input.munis
    .filter(m => (m.over ?? 0) >= 2 && m.cur >= 10)
    .sort((a, b) => (b.over! / b.cur) - (a.over! / a.cur))
    .slice(0, 2)
  const overMuniText = overMunis.map(m => `${m.name} (${fmtPct(m.over! / m.cur)})`).join(', ')
  const loadHigh = Number.isFinite(loadRatio) && loadRatio >= T.load.elevated

  for (const s of sig) {
    if (s.metric === 'overdue') out.push({
      id: 'overdue', level: s.level,
      title: 'Доля просроченных обращений выше общероссийской',
      metric: `${fmtPct(s.value)} при ${fmtPct(s.national)} по России, выше на ${fmtPp(s.value - s.national)} (в ${s.ratio.toFixed(1).replace('.', ',')} раза)`,
      why: loadHigh
        ? `Нарушение сроков снижает доверие заявителей. Нагрузка на исполнителей выше средней: ${loadText}.`
        : `Нарушение сроков снижает доверие заявителей. Нагрузка на исполнителей не выше средней (${loadText}), поэтому вероятная причина: задержка ответов органов власти на запросы${overMunis.length ? `. Больше всего просрочек в территориях: ${overMuniText}` : ''}.`,
      action: loadHigh
        ? 'Рекомендуется проверить распределение нагрузки между ответственными исполнителями и причины нарушения сроков.'
        : `Рекомендуется проверить, как органы власти соблюдают сроки ответов на запросы${overMunis.length ? `, в первую очередь по территориям: ${overMunis.map(m => m.name).join(', ')}` : ''}.`,
      // Действовать можно только по открытым просроченным: самые давние сверху
      link: { folder: 'overdue_now', sort: 'overdue_desc' },
    })
    if (s.metric === 'repeat') out.push({
      id: 'repeat', level: s.level,
      title: 'Повышенная доля повторных обращений',
      metric: `${fmtPct(s.value)} при ${fmtPct(s.national)} по России, выше на ${fmtPp(s.value - s.national)}`,
      why: 'Повторные обращения означают, что проблема заявителя не была решена после первого обращения.',
      action: 'Рекомендуется проанализировать причины повторного обращения граждан и результативность ранее принятых мер.',
      link: { folder: 'repeat' },
    })
    if (s.metric === 'restored') out.push({
      id: 'restored', level: s.level,
      title: 'Низкая доля восстановленных прав',
      metric: `${fmtPct(s.value)} при ${fmtPct(s.national)} по России, ниже на ${fmtPp(s.national - s.value)}`,
      why: 'В случаях с установленным нарушением права восстанавливаются реже, чем в среднем по России.',
      action: 'Рекомендуется проверить исполнение органами власти рекомендаций Уполномоченного и при необходимости использовать дополнительные меры реагирования.',
      link: { folder: 'restored' },
    })
  }

  // Рост обращений по категории к тому же периоду прошлого года (не больше двух самых заметных)
  // и рост доли повторных внутри категории (одна, с наибольшим приростом)
  const growthRecs: (Recommendation & { score: number })[] = []
  const repRecs: (Recommendation & { score: number })[] = []
  for (const c of input.cats) {
    if (!c.prev) continue
    const g = c.prev.rec ? c.t.rec / c.prev.rec - 1 : NaN
    if (Number.isFinite(g) && g >= T.growth.medium && c.t.rec - c.prev.rec >= T.growth.minAbs) {
      const m = input.munis.filter(x => x.prev > 0 && x.cur - x.prev >= 3).sort((a, b) => (b.cur - b.prev) - (a.cur - a.prev)).slice(0, 2)
      growthRecs.push({
        score: g,
        // Рост числа обращений сам по себе не нарушение (принцип 3 DESIGN.md): информационный сигнал
        id: `growth-${c.id}`, level: 'info',
        title: `Заметный рост обращений: ${c.name.toLowerCase()}`,
        metric: `${numWord(c.t.rec, 'обращение', 'обращения', 'обращений')}, рост ${Math.round(g * 100)}% к тому же периоду прошлого года (было ${c.prev.rec})`,
        why: `Рост может быть связан как с проблемой, так и с большей доступностью Уполномоченного.${m.length ? ` Наибольший прирост в территориях: ${m.map(x => x.name).join(', ')}.` : ''}`,
        action: m.length ? 'Рекомендуется проанализировать причины роста в указанных территориях.' : 'Рекомендуется проанализировать причины роста обращений по категории.',
        link: { cat: c.id },
      })
    }
    // Рост доли повторных внутри категории
    const rn = c.t.rec ? c.t.rep / c.t.rec : 0, rp = c.prev.rec ? c.prev.rep / c.prev.rec : 0
    if (c.t.rep >= T.repeatGrowth.minRep && rn - rp >= T.repeatGrowth.minDiff) repRecs.push({
      score: rn - rp,
      id: `rep-${c.id}`, level: 'medium',
      title: `Больше повторных обращений: ${c.name.toLowerCase()}`,
      metric: `${fmtPct(rn)} повторных при ${fmtPct(rp)} годом ранее`,
      why: 'Граждане чаще возвращаются с той же проблемой, ранее принятые меры могли оказаться недостаточными.',
      action: `Рекомендуется проанализировать причины повторного обращения граждан по категории «${c.name}» и результативность ранее принятых мер.`,
      link: { folder: 'repeat', cat: c.id },
    })
  }

  const strip = ({ score: _s, ...r }: Recommendation & { score: number }): Recommendation => r
  out.push(...growthRecs.sort((a, b) => b.score - a.score).slice(0, 2).map(strip))
  out.push(...repRecs.sort((a, b) => b.score - a.score).slice(0, 1).map(strip))

  // Нагрузка на исполнителей
  const load = input.openPerExecutor / input.nationalOpenPerExecutor
  if (Number.isFinite(load) && load >= T.load.medium) out.push({
    id: 'load', level: load >= T.load.high ? 'high' : 'medium',
    title: 'Высокая нагрузка на исполнителей',
    metric: `${input.openPerExecutor.toFixed(1).replace('.', ',')} незавершенных обращения на исполнителя при ${input.nationalOpenPerExecutor.toFixed(1).replace('.', ',')} в среднем по России`,
    why: 'Высокая нагрузка повышает риск нарушения сроков рассмотрения.',
    action: 'Рекомендуется рассмотреть перераспределение обращений или привлечение дополнительных исполнителей.',
    link: { folder: 'in_work' },
  })

  const order = { high: 0, medium: 1, info: 2 }
  out.sort((a, b) => order[a.level] - order[b.level])
  if (!out.some(r => r.level !== 'info')) out.push({
    id: 'ok', level: 'info',
    title: 'Существенных отклонений не выявлено',
    metric: 'Доли просроченных, повторных обращений и восстановленных прав близки к общероссийским значениям',
    why: 'Показатели региона находятся в пределах установленных порогов.',
    action: 'Рекомендуется продолжить плановый мониторинг.',
  })
  const top = [...input.cats].sort((a, b) => b.t.rec - a.t.rec)[0]
  if (top && input.region.rec) out.push({
    id: 'top-cat', level: 'info',
    title: `Основная категория обращений: ${top.name.toLowerCase()}`,
    metric: `${Math.round((top.t.rec / input.region.rec) * 100)}% всех обращений региона`,
    why: 'Структура обращений показывает, какие права граждане чаще считают нарушенными.',
    action: 'Рекомендуется учитывать эту категорию при планировании проверок и приемов граждан.',
    link: { cat: top.id },
  })
  return out
}
