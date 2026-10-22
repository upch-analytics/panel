import { useMemo } from 'react'
import { Download, Printer } from 'lucide-react'
import { useData } from '../data/load'
import { useFilters } from '../data/filters'
import { byCategory, num, pct, previousYear, rates, signedPct, change, sumCube, type Totals } from '../data/agg'
import { compareLabel, periodLabel } from '../data/period'
import { downloadCsv, stamp, toCsv } from '../data/csv'
import type { DemoData } from '../data/types'
import { FilterBar } from '../components/FilterBar'
import { PageTitle } from './Common'

type Ind = 'rec' | 'dyn' | 'per10k' | 'over' | 'rest' | 'rep' | 'work'
const INDICATORS: { id: Ind; label: string; value: (t: Totals, pop: number, prev: Totals | null) => number; fmt: (v: number) => string; csv: (v: number) => string | number }[] = [
  { id: 'rec', label: 'Поступило обращений', value: t => t.rec, fmt: num, csv: v => Math.round(v) },
  { id: 'dyn', label: 'Изменение к прошлому году', value: (t, _p, prev) => (prev ? change(t.rec, prev.rec) : NaN), fmt: signedPct, csv: v => (Number.isFinite(v) ? signedPct(v) : '') },
  { id: 'per10k', label: 'На 10 000 жителей', value: (t, pop) => (pop ? (t.rec * 10) / pop : NaN), fmt: v => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : ''), csv: v => (Number.isFinite(v) ? Number(v.toFixed(1)) : '') },
  { id: 'over', label: 'Доля просроченных', value: t => rates(t).overShare, fmt: v => pct(v), csv: v => pct(v) },
  { id: 'rest', label: 'Доля восстановленных прав', value: t => rates(t).restShare, fmt: v => pct(v), csv: v => pct(v) },
  { id: 'rep', label: 'Доля повторных', value: t => rates(t).repShare, fmt: v => pct(v), csv: v => pct(v) },
  { id: 'work', label: 'На рассмотрении', value: t => t.rec - t.done, fmt: num, csv: v => Math.round(v) },
]

interface Row { name: string; t: Totals; prev: Totals | null; pop: number; total?: boolean }

/** Строки отчета: Россия по округам, округ по субъектам, субъект по категориям прав */
function buildRows(data: DemoData, f: ReturnType<typeof useFilters>, territory: string): { title: string; rowLabel: string; rows: Row[] } {
  const range = f.range!
  const cats = f.cat ? [f.cat] : undefined
  const prevF = previousYear(data, { range })
  const get = (codes: string[] | undefined) => {
    const t = sumCube(data, { range, codes, cats })
    const prev = prevF ? sumCube(data, { ...prevF, codes, cats }) : null
    return { t, prev }
  }
  const popOf = (codes: string[]) => data.regions.filter(r => codes.includes(r.code)).reduce((s, r) => s + r.pop, 0)
  const connected = data.regions.filter(r => r.connected)
  if (territory.startsWith('fd:')) {
    const fd = territory.slice(3)
    const regs = connected.filter(r => r.district === fd)
    const rows = regs.map(r => ({ name: r.name, pop: r.pop, ...get([r.code]) }))
    const codes = regs.map(r => r.code)
    return { title: `${data.meta.districts[fd]} федеральный округ`, rowLabel: 'Субъект', rows: [...rows.sort((a, b) => a.name.localeCompare(b.name, 'ru')), { name: 'Итого по округу', pop: popOf(codes), total: true, ...get(codes) }] }
  }
  if (territory.startsWith('r:')) {
    const code = territory.slice(2)
    const r = data.regions.find(x => x.code === code)!
    const now = byCategory(data, { range, codes: [code] })
    const prev = prevF ? byCategory(data, { ...prevF, codes: [code] }) : null
    const rows = now.map((c, i) => ({ name: c.name, t: c.t, prev: prev?.[i].t ?? null, pop: r.pop }))
    return { title: r.name, rowLabel: 'Категория прав', rows: [...rows, { name: 'Итого по субъекту', pop: r.pop, total: true, ...get([code]) }] }
  }
  const rows = Object.entries(data.meta.districts).map(([id, name]) => {
    const codes = connected.filter(r => r.district === id).map(r => r.code)
    return { name: `${name} ФО`, pop: popOf(codes), ...get(codes) }
  })
  const all = connected.map(r => r.code)
  return { title: 'Российская Федерация', rowLabel: 'Федеральный округ', rows: [...rows, { name: 'Итого по России', pop: popOf(all), total: true, ...get(all) }] }
}

export function Reports() {
  const { data } = useData()
  const f = useFilters()
  const p = f.params
  const territory = p.get('t') ?? 'ru'
  const selected = (p.get('ind')?.split(',').filter(x => INDICATORS.some(i => i.id === x)) as Ind[] | undefined) ?? ['rec', 'dyn', 'per10k', 'over', 'rest', 'rep']
  const inds = INDICATORS.filter(i => selected.includes(i.id))
  const report = useMemo(() => (f.range ? buildRows(data, f, territory) : null), [data, f, territory])
  const created = stamp()
  const period = periodLabel(data, f.period)
  const catName = f.cat ? data.meta.categories.find(c => c.id === f.cat)?.name : null

  const toggle = (id: Ind) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : INDICATORS.filter(i => selected.includes(i.id) || i.id === id).map(i => i.id)
    f.set({ ind: next.length ? next.join(',') : null })
  }

  const exportCsv = () => {
    if (!report) return
    const csv = toCsv(
      ['Отчет по обращениям граждан ФГИС УПЧ', `Территория: ${report.title}`, `Период: ${period}${compareLabel(data, f.period) ? `, сравнение ${compareLabel(data, f.period)}` : ''}`, ...(catName ? [`Категория прав: ${catName}`] : []), `Дата формирования: ${created}`, 'Демонстрационные данные, не являются официальной статистикой'],
      [report.rowLabel, ...inds.map(i => i.label)],
      report.rows.map(r => [r.name, ...inds.map(i => i.csv(i.value(r.t, r.pop, r.prev)))]),
    )
    downloadCsv(`otchet-upch-${data.meta.today}.csv`, csv)
  }

  const territories = [
    { id: 'ru', label: 'Россия, по федеральным округам' },
    ...Object.entries(data.meta.districts).map(([id, name]) => ({ id: `fd:${id}`, label: `${name} ФО, по субъектам` })),
    ...data.regions.filter(r => r.connected).sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(r => ({ id: `r:${r.code}`, label: `${r.name}, по категориям` })),
  ]

  return (
    <>
      <div className="no-print">
        <PageTitle sub="Выберите территорию, период и показатели. Отчет можно выгрузить в CSV для Excel или распечатать">Отчетность</PageTitle>
      </div>
      <div className="flex flex-col gap-5">
        <div className="no-print">
          <FilterBar showRegion={false} showDistrict={false}>
            <label className="flex max-w-full min-w-0 flex-col gap-1 xl:flex-row xl:items-center xl:gap-2">
              <span className="text-sm text-muted">Территория отчета</span>
              <select className="select" value={territory} onChange={e => f.set({ t: e.target.value === 'ru' ? null : e.target.value })}>
                {territories.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          </FilterBar>
        </div>
        <fieldset className="no-print rounded-lg border border-line bg-surface p-4">
          <legend className="px-1 text-sm text-muted">Показатели в отчете</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {INDICATORS.map(i => (
              <label key={i.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} className="size-4 accent-[var(--color-accent)]" />
                {i.label}
              </label>
            ))}
          </div>
        </fieldset>

        {report && (
          <article aria-labelledby="rep-title" className="rounded-lg border border-line bg-surface p-6 print:border-0 print:p-0">
            <header className="flex flex-wrap items-start gap-4 border-b border-line pb-4">
              <div className="mr-auto">
                <p className="text-sm text-muted">Отчет по обращениям граждан, ФГИС УПЧ</p>
                <h2 id="rep-title" className="font-serif text-3xl font-semibold">{report.title}</h2>
                <p className="mt-1 text-ink-2">{period}{catName ? `, ${catName.toLowerCase()}` : ''}. Сравнение {compareLabel(data, f.period) || 'не проводится'}</p>
                <p className="mt-1 text-sm text-muted">Дата формирования: {created}</p>
              </div>
              <span className="rounded-full border border-line-strong bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-2">Демонстрационные данные</span>
              <div className="no-print flex w-full gap-2 sm:w-auto">
                <button type="button" onClick={exportCsv} disabled={!inds.length} className="inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"><Download size={16} aria-hidden="true" />Выгрузить CSV</button>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 py-2 font-medium hover:bg-surface-hover"><Printer size={16} aria-hidden="true" />Печать</button>
              </div>
            </header>
            {inds.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line-strong text-left">
                      <th scope="col" className="py-2 pr-4 font-medium">{report.rowLabel}</th>
                      {inds.map(i => <th key={i.id} scope="col" className="py-2 pr-4 text-right font-medium">{i.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map(r => {
                      const total = report.rows[report.rows.length - 1]
                      // Доля хуже итоговой более чем на 1 п.п.: выделяется, чтобы отчет сразу показывал проблемные строки
                      const worse = (i: Ind) => {
                        if (r.total || !['over', 'rep', 'rest'].includes(i)) return false
                        const v = INDICATORS.find(x => x.id === i)!.value(r.t, r.pop, r.prev), tv = INDICATORS.find(x => x.id === i)!.value(total.t, total.pop, total.prev)
                        return i === 'rest' ? tv - v > 0.05 : v - tv > 0.01
                      }
                      return (
                        <tr key={r.name} className={`border-b border-line ${r.total ? 'font-semibold' : ''}`}>
                          <td className="py-2 pr-4">{r.name}</td>
                          {inds.map(i => <td key={i.id} className={`py-2 pr-4 text-right ${worse(i.id) ? 'font-semibold text-bad' : ''}`}>{i.fmt(i.value(r.t, r.pop, r.prev))}</td>)}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-4 text-muted">Отметьте хотя бы один показатель.</p>}
            <p className="mt-4 text-sm text-muted">
              Выделены доли хуже итоговой строки: просроченные и повторные выше более чем на 1 п.п., восстановленные права ниже более чем на 5 п.п. Доля просроченных считается по обращениям с наступившим сроком ответа; доля восстановленных прав: от завершенных дел с установленным нарушением. Все значения демонстрационные и не являются официальной статистикой.
            </p>
          </article>
        )}
      </div>
    </>
  )
}
