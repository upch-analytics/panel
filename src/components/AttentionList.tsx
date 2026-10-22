import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { pct, type Totals } from '../data/agg'
import { METRIC_TEXT, severity, signals, type Signal } from '../data/rules'
import type { Region } from '../data/types'
import { Methodology } from './Methodology'

export const LEVEL = {
  high: { label: 'Высокий', group: 'Высокий уровень внимания', dot: 'bg-bad', chip: 'bg-bad-soft text-bad' },
  medium: { label: 'Средний', group: 'Средний уровень внимания', dot: 'bg-mid', chip: 'bg-mid-soft text-mid' },
  info: { label: 'Информационный', group: 'Для сведения', dot: 'bg-accent', chip: 'bg-accent-soft text-accent' },
} as const

const ratioText = (s: Signal) =>
  s.metric === 'restored'
    ? `ниже среднего по России (${pct(s.national)})`
    : `в ${s.ratio.toFixed(1).replace('.', ',')} раза выше среднего по России (${pct(s.national)})`

function Reason({ s, first }: { s: Signal; first: boolean }) {
  const name = first ? METRIC_TEXT[s.metric] : METRIC_TEXT[s.metric].toLowerCase()
  return <>{name} <b className="font-semibold text-ink">{pct(s.value)}</b>, {ratioText(s)}</>
}

export function AttentionList({ regions, values, national, link }: {
  regions: Region[]
  values: Map<string, Totals>
  national: Totals
  link: (code: string) => string
}) {
  const [all, setAll] = useState(false)
  const items = regions
    .filter(r => r.connected && values.has(r.code))
    .map(r => ({ r, s: signals(values.get(r.code)!, national) }))
    .filter(x => x.s.length)
    .sort((a, b) => severity(b.s) - severity(a.s))
    .map(x => ({ ...x, level: (x.s.some(s => s.level === 'high') ? 'high' : 'medium') as 'high' | 'medium' }))
  const shown = all ? items : items.slice(0, 8)
  const groups = (['high', 'medium'] as const).map(level => ({ level, rows: shown.filter(x => x.level === level), total: items.filter(x => x.level === level).length })).filter(g => g.rows.length)

  return (
    <section aria-labelledby="att-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-3 px-5 pt-4 pb-1">
        <h2 id="att-title" className="font-serif text-2xl font-semibold">Регионы, требующие внимания</h2>
        <span className="text-sm text-muted">{items.length ? `${items.length} из ${regions.filter(r => r.connected).length} подключенных` : 'Нет регионов с заметными отклонениями'}</span>
      </div>
      <p className="px-5 pb-3 text-sm text-muted">
        Устойчиво повышенная доля просрочек или повторных обращений, низкая доля восстановленных прав по сравнению со средним по России. Это основание для дополнительного анализа, а не вывод о нарушениях.
      </p>
      {groups.map(g => (
        <div key={g.level} className="border-t border-line">
          <h3 className="flex items-center gap-2 bg-bg/50 px-5 py-2 text-sm font-semibold text-ink-2">
            <span className={`size-2 rounded-full ${LEVEL[g.level].dot}`} aria-hidden="true" />
            {LEVEL[g.level].group}: {g.total}
          </h3>
          <ul>
            {g.rows.map(({ r, s }) => (
              <li key={r.code} className="border-t border-line">
                <Link to={link(r.code)} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-hover">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {s.map((x, i) => <span key={x.metric}>{i > 0 && '; '}<Reason s={x} first={i === 0} /></span>)}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-5 py-3">
        {items.length > 8 && (
          <button type="button" onClick={() => setAll(v => !v)} className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
            {all ? 'Свернуть список' : `Показать все (${items.length})`}
          </button>
        )}
        <Methodology />
      </div>
    </section>
  )
}
