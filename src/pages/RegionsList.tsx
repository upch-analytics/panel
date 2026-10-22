import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { useData } from '../data/load'
import { carry, useFilters } from '../data/filters'
import { byRegion, num, pct, rates, sumCube } from '../data/agg'
import { periodLabel } from '../data/period'
import { severity, signals } from '../data/rules'
import { FilterBar } from '../components/FilterBar'
import { LEVEL } from '../components/AttentionList'
import { PageTitle } from './Common'

type Key = 'name' | 'rec' | 'per10k' | 'over' | 'rep' | 'rest' | 'att'
const COLS: { key: Key; label: string }[] = [
  { key: 'name', label: 'Субъект' },
  { key: 'rec', label: 'Обращений' },
  { key: 'per10k', label: 'На 10 000 жителей' },
  { key: 'over', label: 'Просрочено' },
  { key: 'rep', label: 'Повторные' },
  { key: 'rest', label: 'Права восстановлены' },
]

export function RegionsList() {
  const { data } = useData()
  const f = useFilters()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'att', dir: -1 })

  const rows = useMemo(() => {
    if (!f.range) return []
    const cats = f.cat ? [f.cat] : undefined
    const values = byRegion(data, { range: f.range, cats })
    const national = sumCube(data, { range: f.range, cats })
    return data.regions
      .filter(r => !f.fd || r.district === f.fd)
      .map(r => {
        const t = values.get(r.code)
        const x = t ? rates(t) : null
        const s = t ? signals(t, national) : []
        return {
          r, t, s,
          v: { name: 0, rec: t?.rec ?? -1, per10k: t ? (t.rec * 10) / r.pop : -1, over: x?.overShare ?? -1, rep: x?.repShare ?? -1, rest: x?.restShare ?? -1, att: s.length ? severity(s) : t ? 0 : -1 } as Record<Key, number>,
          bad: new Set(s.map(z => z.metric)),
        }
      })
  }, [data, f.range, f.cat, f.fd])

  const shown = rows
    .filter(x => !q.trim() || x.r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (sort.key === 'name' ? a.r.name.localeCompare(b.r.name, 'ru') : a.v[sort.key] - b.v[sort.key]) * sort.dir)

  return (
    <>
      <PageTitle sub={`${periodLabel(data, f.period)}. Выберите субъект, чтобы открыть подробную аналитику`}>Региональная аналитика</PageTitle>
      <div className="flex flex-col gap-5">
        <FilterBar showRegion={false} />
        <section aria-label="Субъекты" className="rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <label className="flex w-72 max-w-full items-center gap-2 rounded-sm border border-line-strong px-2.5 focus-within:border-accent">
              <Search size={16} className="text-muted" aria-hidden="true" />
              <input value={q} onChange={e => setQ(e.target.value)} className="h-9 w-full bg-transparent text-sm outline-none" placeholder="Найти субъект" aria-label="Найти субъект" />
            </label>
            <span className="text-sm text-muted">{shown.length} субъектов, подключено {shown.filter(x => x.r.connected).length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-y border-line bg-bg/60 text-left">
                  {COLS.map(c => (
                    <th key={c.key} scope="col" className={`px-4 py-2 font-medium ${c.key === 'name' ? '' : 'text-right'}`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="inline-flex items-center gap-1 hover:text-accent" onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.key === 'name' ? 1 : -1 }))}>
                        {c.label}
                        {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />)}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2 font-medium" aria-sort={sort.key === 'att' ? 'descending' : 'none'}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent" onClick={() => setSort({ key: 'att', dir: -1 })}>
                      Внимание{sort.key === 'att' && <ArrowDown size={14} aria-hidden="true" />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ r, t, s, v, bad }) => {
                  const top = s.some(x => x.level === 'high') ? 'high' : s.length ? 'medium' : null
                  return (
                    <tr key={r.code} className="border-b border-line last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-2"><Link to={`/region/${r.code}${carry(f.params)}`} className="font-medium text-accent underline-offset-4 hover:underline">{r.name}</Link></td>
                      {t ? (
                        <>
                          <td className="px-4 py-2 text-right">{num(v.rec)}</td>
                          <td className="px-4 py-2 text-right">{v.per10k.toFixed(1).replace('.', ',')}</td>
                          <td className={`px-4 py-2 text-right ${bad.has('overdue') ? 'font-semibold text-bad' : ''}`}>{pct(v.over)}</td>
                          <td className={`px-4 py-2 text-right ${bad.has('repeat') ? 'font-semibold text-bad' : ''}`}>{pct(v.rep)}</td>
                          <td className={`px-4 py-2 text-right ${bad.has('restored') ? 'font-semibold text-bad' : ''}`}>{pct(v.rest)}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="px-4 py-2 text-right text-muted">Нет данных: не подключен к ФГИС</td>
                      )}
                      <td className="px-4 py-2">{top && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[top].chip}`}>{LEVEL[top].label}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
