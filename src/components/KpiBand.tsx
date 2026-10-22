import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { change, num, numWord, pct, pp, rates, signedPct, type Totals } from '../data/agg'

// Полоса ключевых показателей: ячейки в одной панели с разделителями (DESIGN.md, «Полоса показателей»)

export type Tone = 'good' | 'bad' | 'neutral'
const toneCls: Record<Tone, string> = { good: 'text-good', bad: 'text-bad', neutral: 'text-muted' }

export interface KpiCell {
  label: string
  value: string
  sub?: ReactNode
  delta?: string
  tone?: Tone
  to: string
  hint?: string
  /** сравнение с общероссийским значением (страница региона) */
  compare?: { text: string; tone: Tone }
}

const COLS = { 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5' } as const

export function KpiBand({ cells, label = 'Ключевые показатели' }: { cells: KpiCell[]; label?: string }) {
  // До xl две колонки; нечетная последняя ячейка растягивается, чтобы не оставлять пустую клетку
  return (
    <section aria-label={label} className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line [&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1 ${COLS[cells.length as 4 | 5] ?? 'xl:grid-cols-5'}`}>
      {cells.map(c => (
        <Link key={c.label} to={c.to} title={c.hint} className="group relative flex flex-col bg-surface px-4 py-3.5 2xl:px-5 transition-colors hover:bg-surface-hover focus-visible:z-10">
          <ArrowUpRight size={16} className="absolute top-3.5 right-3.5 text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          <span className="pr-5 text-sm text-muted">{c.label}</span>
          <span className="num mt-1.5 font-serif text-3xl font-semibold">{c.value}</span>
          {c.sub && <span className="mt-1 text-sm text-ink-2">{c.sub}</span>}
          {c.delta && <span className={`mt-0.5 text-sm ${toneCls[c.tone ?? 'neutral']}`}>{c.delta}</span>}
          {c.compare && (
            <span className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-sm px-2 py-0.5 text-sm font-medium ${c.compare.tone === 'bad' ? 'bg-bad-soft text-bad' : c.compare.tone === 'good' ? 'bg-good-soft text-good' : 'bg-bg text-muted'}`}>
              {c.compare.text}
            </span>
          )}
        </Link>
      ))}
    </section>
  )
}

/** Четыре основных показателя по набору итогов; используется на главной и на странице региона */
export function coreCells(cur: Totals, prev: Totals | null, compare: string, link: (folder: string) => string): KpiCell[] {
  const r = rates(cur)
  const p = prev ? rates(prev) : null
  const d = (a: number, b: number | undefined) => (b == null || !Number.isFinite(b) ? NaN : a - b)
  const overD = d(r.overShare, p?.overShare)
  const restD = d(r.restShare, p?.restShare)
  const repD = d(r.repShare, p?.repShare)
  const tone = (v: number, higherIsBad: boolean): Tone => (!Number.isFinite(v) || Math.abs(v) < 0.0005 ? 'neutral' : (v > 0) === higherIsBad ? 'bad' : 'good')
  const withCmp = (s: string) => (s && compare ? `${s} ${compare}` : '')
  return [
    {
      label: 'Всего обращений',
      value: num(cur.rec),
      sub: `в работе ${num(r.inWork)}`,
      delta: prev ? withCmp(signedPct(change(cur.rec, prev.rec))) : undefined,
      tone: 'neutral',
      to: link('all'),
    },
    {
      label: 'Доля просроченных',
      value: pct(r.overShare),
      sub: `${num(cur.over)} с нарушением срока`,
      delta: withCmp(pp(overD)),
      tone: tone(overD, true),
      to: link('overdue'),
    },
    {
      label: 'Права восстановлены',
      value: pct(r.restShare),
      sub: `${num(cur.rest)} из ${numWord(cur.viol, 'дела', 'дел', 'дел')} с нарушением`,
      delta: withCmp(pp(restD)),
      tone: tone(restD, false),
      to: link('restored'),
      hint: 'Доля завершенных случаев с подтвержденным восстановлением прав среди завершенных случаев с установленным нарушением',
    },
    {
      label: 'Доля повторных',
      value: pct(r.repShare),
      sub: numWord(cur.rep, 'повторное', 'повторных', 'повторных'),
      delta: withCmp(pp(repD)),
      tone: tone(repD, true),
      to: link('repeat'),
    },
  ]
}
