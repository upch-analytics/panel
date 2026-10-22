import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { pct, type Totals } from '../data/agg'
import { METRIC_TEXT, severity, signals, type Signal } from '../data/rules'
import type { Region } from '../data/types'

export const LEVEL = {
  high: { label: 'Высокий', bar: 'bg-bad', chip: 'bg-bad-soft text-bad' },
  medium: { label: 'Средний', bar: 'bg-mid', chip: 'bg-mid-soft text-mid' },
  info: { label: 'Информационный', bar: 'bg-accent', chip: 'bg-accent-soft text-accent' },
} as const

function reason(s: Signal) {
  const dir = s.metric === 'restored' ? 'ниже' : 'выше'
  return `${METRIC_TEXT[s.metric]} ${pct(s.value)}, ${dir} среднего по России (${pct(s.national)})`
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
  const shown = all ? items : items.slice(0, 8)

  return (
    <section aria-labelledby="att-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-3 px-5 pt-4 pb-3">
        <h2 id="att-title" className="font-serif text-2xl font-semibold">Регионы, требующие внимания</h2>
        <span className="text-sm text-muted">{items.length ? `${items.length} из ${regions.filter(r => r.connected).length} подключенных` : 'Нет регионов с заметными отклонениями'}</span>
      </div>
      <p className="px-5 pb-3 text-sm text-muted">
        Повышенная доля просрочек или повторных обращений, низкая доля восстановленных прав по сравнению со средним по России. Это основание для дополнительного анализа, а не вывод о нарушениях.
      </p>
      {items.length > 0 && (
        <ul className="border-t border-line">
          {shown.map(({ r, s }) => {
            const top = s.some(x => x.level === 'high') ? 'high' : 'medium'
            return (
              <li key={r.code} className="border-b border-line last:border-b-0">
                <Link to={link(r.code)} className="relative flex items-center gap-4 py-3 pr-4 pl-6 hover:bg-surface-hover">
                  <span className={`absolute inset-y-2 left-0 w-1 rounded-r ${LEVEL[top].bar}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[top].chip}`}>{LEVEL[top].label} уровень внимания</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{s.map(reason).join('; ')}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {items.length > 8 && (
        <div className="border-t border-line px-5 py-3">
          <button type="button" onClick={() => setAll(v => !v)} className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
            {all ? 'Свернуть список' : `Показать все (${items.length})`}
          </button>
        </div>
      )}
    </section>
  )
}
