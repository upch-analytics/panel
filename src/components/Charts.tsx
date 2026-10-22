import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts'
import { change, num, signedPct, type Totals } from '../data/agg'
import { monthShort, monthName } from '../data/period'

// Цвета графиков из токенов (DESIGN.md, «Графики»)
const C = { cur: 'var(--color-accent)', prev: 'var(--color-faint)', grid: 'var(--color-line)', axis: 'var(--color-muted)' }

export interface MonthPoint { month: string; cur: number | null; prev: number | null }

export function MonthlyChart({ points, partialMonth, partialDay, curYear }: { points: MonthPoint[]; partialMonth: string; partialDay: number; curYear: string }) {
  const iPartial = points.findIndex(p => p.month === partialMonth)
  // Полные месяцы и неполный последний месяц рисуются разными линиями
  const rows = points.map((p, i) => ({
    ...p,
    label: monthShort(Number(p.month.slice(5)) - 1) + (points[0].month.slice(0, 4) !== points[points.length - 1].month.slice(0, 4) ? ` ${p.month.slice(2, 4)}` : ''),
    full: iPartial >= 0 && i >= iPartial ? null : p.cur,
    part: iPartial >= 0 && (i === iPartial || i === iPartial - 1) ? p.cur : null,
  }))
  const hasPrev = points.some(p => p.prev != null)
  return (
    <figure className="m-0">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.axis, fontSize: 13 }} tickLine={false} axisLine={{ stroke: C.grid }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: C.axis, fontSize: 13 }} tickLine={false} axisLine={false} width={56} tickFormatter={v => num(v)} />
            <Tooltip
              formatter={(v, name) => [num(Number(v)), name === 'prev' ? 'Прошлый год' : name === 'part' ? `Неполный месяц, по ${partialDay} число` : 'Поступило']}
              labelFormatter={(_, p) => { const m = p?.[0]?.payload?.month as string | undefined; return m ? `${monthName(Number(m.slice(5)) - 1)} ${m.slice(0, 4)}` : '' }}
              contentStyle={{ borderRadius: 8, borderColor: 'var(--color-line)', fontSize: 14 }}
            />
            {hasPrev && <Line type="monotone" dataKey="prev" stroke={C.prev} strokeWidth={2} strokeDasharray="5 4" dot={false} name="prev" isAnimationActive={false} />}
            <Line type="monotone" dataKey="full" stroke={C.cur} strokeWidth={2.5} dot={{ r: 3, fill: C.cur }} name="cur" connectNulls={false} isAnimationActive={false} />
            {iPartial >= 0 && <Line type="monotone" dataKey="part" stroke={C.cur} strokeWidth={2} strokeDasharray="3 3" dot={(d: { index: number; cx?: number; cy?: number }) => d.index === iPartial && d.cx != null ? <circle key="pd" cx={d.cx} cy={d.cy} r={5} fill="var(--color-surface)" stroke={C.cur} strokeWidth={2} /> : <g key={`e${d.index}`} />} name="part" isAnimationActive={false} />}
            {iPartial >= 0 && <ReferenceLine x={rows[iPartial].label} stroke={C.grid} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-2"><span className="inline-block h-0.5 w-6 bg-accent" />{curYear}</span>
        {hasPrev && <span className="flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed border-faint" />Тот же период годом ранее</span>}
        {iPartial >= 0 && <span className="flex items-center gap-2"><span className="inline-block size-2.5 rounded-full border-2 border-accent bg-surface" />Неполный месяц: данные по {partialDay} число</span>}
      </figcaption>
    </figure>
  )
}

export interface CatRow { id: string; name: string; t: Totals; prev?: Totals }

/** Горизонтальные столбцы по категориям прав, сортировка по количеству */
export function CategoryBars({ rows, link, selected, growthFrom = 0.1 }: { rows: CatRow[]; link: (id: string) => string; selected?: string | null; growthFrom?: number }) {
  const total = rows.reduce((s, r) => s + r.t.rec, 0)
  const sorted = [...rows].sort((a, b) => b.t.rec - a.t.rec)
  const max = sorted[0]?.t.rec || 1
  return (
    <ul className="flex flex-col">
      {sorted.map(r => {
        const g = r.prev ? change(r.t.rec, r.prev.rec) : NaN
        const growing = Number.isFinite(g) && g >= growthFrom
        return (
          <li key={r.id}>
            {/* Две строки: название и цифры, под ними полоса на всю ширину (полоса не сжимается в узкой колонке) */}
            <Link to={link(r.id)} className={`block rounded-sm px-2 py-2 hover:bg-surface-hover ${selected === r.id ? 'bg-accent-soft' : ''}`}>
              <span className="flex items-baseline gap-2 text-sm">
                <span className="mr-auto font-medium">{r.name}</span>
                <span className="num font-medium">{num(r.t.rec)}</span>
                <span className="w-12 text-right text-muted">{total ? ((r.t.rec / total) * 100).toFixed(1).replace('.', ',') : 0}%</span>
                <span className={`flex w-20 items-center justify-end gap-0.5 ${growing ? 'font-semibold text-ink' : 'text-muted'}`}>
                  {growing && <ArrowUpRight size={14} aria-label="заметный рост" />}
                  {Number.isFinite(g) ? signedPct(g) : ''}
                </span>
              </span>
              <span className="relative mt-1.5 block h-2.5 rounded-[3px] bg-bg" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-[3px] bg-map-4" style={{ width: `${Math.max(1, (r.t.rec / max) * 100)}%` }} />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
