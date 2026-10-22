import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Region } from '../data/types'
import type { Totals } from '../data/agg'
import type { MapMode } from '../data/filters'
import { classify, MODES, rankOrder, SCALE } from '../data/mapScale'
import { THRESHOLDS } from '../data/rules'

// Ранжированный список рядом с картой: показывает выраженность показателя, а не площадь региона.
// Субъекты с малым числом обращений идут в общем порядке, но помечены: их доли неустойчивы.

interface Props {
  regions: Region[]
  values: Map<string, Totals>
  mode: MapMode
  link: (code: string) => string
  onHover: (code: string | null) => void
  /** сколько строк показать; без ограничения список прокручивается внутри блока */
  limit?: number
  footer?: React.ReactNode
}

export function RankList({ regions, values, mode, link, onHover, limit, footer }: Props) {
  const m = MODES[mode]
  const byCode = useMemo(() => new Map(regions.map(r => [r.code, r])), [regions])
  const rows = useMemo(() => {
    const { val, cls } = classify(values, byCode, m)
    const order = rankOrder(m)
    return [...val.entries()]
      .sort((a, b) => order(a[1], b[1]))
      .map(([code, v]) => ({ r: byCode.get(code)!, v, c: cls.get(code)!, low: (values.get(code)?.rec ?? 0) < THRESHOLDS.minRec }))
      // Устойчивые доли сверху, малые выборки в конце: иначе рейтинг возглавляет случайный выброс
      .sort((a, b) => Number(a.low) - Number(b.low))
  }, [values, byCode, m])
  const shown = limit ? rows.slice(0, limit) : rows

  return (
    <div className="flex h-full flex-col" onMouseLeave={() => onHover(null)}>
      <div className="px-4 pt-3 pb-2">
        <h3 className="font-semibold">{m.rankTitle}</h3>
        <p className="text-sm text-muted">
          {limit ? `Первые ${shown.length} из ${rows.length} субъектов` : `${rows.length} субъектов по убыванию выраженности`}
          {rows.some(x => x.low) && `; меньше ${THRESHOLDS.minRec} обращений: в конце списка`}
        </p>
      </div>
      <ol className={`border-t border-line ${limit ? '' : 'max-h-[34rem] overflow-y-auto'}`}>
        {shown.map((x, i) => (
          <li key={x.r.code} className="border-b border-line last:border-b-0">
            <Link
              to={link(x.r.code)}
              onMouseEnter={() => onHover(x.r.code)}
              onFocus={() => onHover(x.r.code)}
              onBlur={() => onHover(null)}
              className="relative grid grid-cols-[1.75rem_0.75rem_1fr_auto] items-center gap-x-2 px-4 py-1.5 text-sm hover:bg-surface-hover"
            >
              <span className="num text-right text-muted">{i + 1}</span>
              <span className={`size-3 rounded-[2px] ${x.low ? 'outline outline-1 outline-offset-1 outline-dashed outline-ink-2' : ''}`} style={{ background: SCALE[x.c] }} title={x.low ? `Меньше ${THRESHOLDS.minRec} обращений за период: доля неустойчива` : `Класс ${x.c + 1} из 5`} aria-hidden="true" />
              <span className={`truncate ${x.low ? 'text-muted' : ''}`}>
                {x.r.short}
                {x.low && <span className="sr-only">, меньше {THRESHOLDS.minRec} обращений, доля неустойчива</span>}
              </span>
              <span className="num font-medium">
                {m.fmt(x.v)}
                <span className="sr-only">, класс {x.c + 1} из 5</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {footer && <div className="mt-auto border-t border-line px-4 py-2.5 text-sm">{footer}</div>}
    </div>
  )
}
