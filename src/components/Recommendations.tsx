import { Link } from 'react-router-dom'
import { AlertTriangle, Info, CircleAlert, ArrowRight } from 'lucide-react'
import type { Recommendation } from '../data/rules'
import { LEVEL } from './AttentionList'
import { Methodology } from './Methodology'
import { plural } from '../data/agg'

const ICON = { high: AlertTriangle, medium: CircleAlert, info: Info }

/** label: подпись ссылки; по умолчанию «Открыть обращения» */
export function Recommendations({ items, link, label }: { items: Recommendation[]; link: (r: Recommendation) => string | null; label?: (r: Recommendation) => string }) {
  const high = items.filter(i => i.level === 'high').length
  return (
    <section aria-labelledby="rec-title" className="rounded-lg border border-line-strong bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-5 pt-4 pb-3">
        <h2 id="rec-title" className="text-lg font-bold tracking-[-0.01em]">Приоритетные проблемы и рекомендации</h2>
        <span className="text-sm text-muted">
          {high ? `${high} ${plural(high, 'проблема', 'проблемы', 'проблем')} с высоким уровнем внимания. ` : ''}Сформировано по правилам из показателей за период
        </span>
      </div>
      <ol className="divide-y divide-line">
        {items.map(r => {
          const Icon = ICON[r.level]
          const to = link(r)
          return (
            <li key={r.id} className="grid gap-x-6 gap-y-2 px-5 py-4 md:grid-cols-[1fr_1fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Icon size={18} className={r.level === 'high' ? 'text-bad' : r.level === 'medium' ? 'text-mid' : 'text-accent'} aria-hidden="true" />
                  <h3 className="text-lg font-semibold">{r.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[r.level].chip}`}>{LEVEL[r.level].label} уровень внимания</span>
                </div>
                <p className="mt-1 font-medium text-ink-2">{r.metric}</p>
                <p className="mt-1 text-muted">{r.why}</p>
              </div>
              <div className="md:border-l md:border-line md:pl-4">
                <p className="text-sm text-muted">Рекомендуемое действие</p>
                <p className="mt-0.5">{r.action}</p>
                {to && (
                  <Link to={to} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
                    {label?.(r) ?? 'Открыть обращения'} <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="space-y-2 border-t border-line px-5 py-3 text-sm text-muted">
        <p>Рекомендации являются основанием для дополнительной проверки и анализа и не означают вывода о нарушении прав.</p>
        <Methodology />
      </div>
    </section>
  )
}
