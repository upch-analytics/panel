import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useData } from '../data/load'
import { carry, useFilters } from '../data/filters'
import { byCategory, monthly, num, pct, pp, previousYear, rates, sumCube } from '../data/agg'
import { compareLabel, periodLabel, periodRange } from '../data/period'
import { recommendations, type MuniInput } from '../data/rules'
import { scopeAppeals, ruDate, STATUS } from '../data/records'
import type { DemoData } from '../data/types'
import { FilterBar } from '../components/FilterBar'
import { KpiBand, coreCells, type KpiCell } from '../components/KpiBand'
import { CategoryBars, MonthlyChart } from '../components/Charts'
import { Recommendations } from '../components/Recommendations'
import { NotFound, PageTitle } from './Common'

/** Незавершенные обращения на одного исполнителя: все месяцы, на текущую дату */
function openLoad(data: DemoData, codes: string[]) {
  const all = { from: 0, to: data.meta.months.length - 1 }
  const t = sumCube(data, { range: all, codes })
  const ex = data.regions.filter(r => codes.includes(r.code)).reduce((s, r) => s + r.executors, 0)
  return { open: t.rec - t.done, executors: ex, perExecutor: (t.rec - t.done) / ex }
}

const GROUPS: { id: 'elderly' | 'disabled' | 'remote'; label: string }[] = [
  { id: 'elderly', label: 'Пожилые граждане' },
  { id: 'disabled', label: 'Лица с инвалидностью' },
  { id: 'remote', label: 'Жители удаленных территорий' },
]

export function RegionPage() {
  const { code } = useParams()
  const { data } = useData()
  const f = useFilters()
  const region = data.regions.find(r => r.code === code)

  const model = useMemo(() => {
    if (!region?.connected || !f.range) return null
    const codes = [region.code]
    const cats = f.cat ? [f.cat] : undefined
    const filter = { range: f.range, codes, cats }
    const cur = sumCube(data, filter)
    const prevF = previousYear(data, filter)
    const prev = prevF ? sumCube(data, prevF) : null
    const national = sumCube(data, { range: f.range, cats })
    const catNow = byCategory(data, { range: f.range, codes })
    const catPrev = prevF ? byCategory(data, { ...prevF, codes }) : null
    const catRows = catNow.map((c, i) => ({ ...c, prev: catPrev?.[i].t }))

    // Муниципалитеты: по карточкам обращений за период и тот же период годом ранее
    const curA = scopeAppeals(data, { range: f.range, codes, cats })
    const prevA = prevF ? scopeAppeals(data, { range: prevF.range, codes, cats }) : []
    const muni = new Map<string, MuniInput & { topics: Map<string, number> }>()
    for (const a of curA) {
      const m = muni.get(a.muni) ?? { name: a.muni, cur: 0, prev: 0, topTopic: '', topics: new Map() }
      m.cur++; m.topics.set(a.topic, (m.topics.get(a.topic) ?? 0) + 1)
      muni.set(a.muni, m)
    }
    for (const a of prevA) { const m = muni.get(a.muni); if (m) m.prev++ }
    const munis = [...muni.values()].map(m => ({ ...m, topTopic: [...m.topics.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '' }))

    const groups = GROUPS.map(g => ({ ...g, n: curA.filter(a => a.group === g.id).length }))
    const load = openLoad(data, codes)
    const natLoad = openLoad(data, Object.keys(data.cube))
    const recs = recommendations({ region: cur, national, cats: catRows, munis, openPerExecutor: load.perExecutor, nationalOpenPerExecutor: natLoad.perExecutor })

    let r = f.range
    if (r.to - r.from < 2) r = periodRange(data, { kind: 'year', year: Number(data.meta.months[r.to].slice(0, 4)) })!
    const mc = monthly(data, { range: r, codes, cats })
    const mp = r.from >= 12 ? monthly(data, { range: { from: r.from - 12, to: r.to - 12 }, codes, cats }) : null
    const points = mc.map((m, i) => ({ month: m.month, cur: m.t.rec, prev: mp ? mp[i].t.rec : null }))
    const latest = [...curA].sort((a, b) => b.received.localeCompare(a.received)).slice(0, 6)
    return { cur, prev, national, catRows, munis, groups, load, natLoad, recs, points, latest, curA }
  }, [data, region, f.range, f.cat])

  if (!region) return <NotFound />

  const back = `/${carry(f.params)}`
  const header = (
    <>
      <nav aria-label="Навигация" className="mt-6 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to={back} className="text-accent underline underline-offset-4">Обзор по России</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to={`/${carry(f.params, { fd: region.district })}`} className="text-accent underline underline-offset-4">{data.meta.districts[region.district]} ФО</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{region.name}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle sub={`${data.meta.districts[region.district]} федеральный округ. ${periodLabel(data, f.period)}`}>{region.name}</PageTitle>
        <Link to={back} className="no-print mb-6 inline-flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 py-2 font-medium hover:bg-surface-hover">
          <ArrowLeft size={17} aria-hidden="true" /> Вернуться к карте России
        </Link>
      </div>
    </>
  )

  if (!region.connected) {
    return (
      <>
        {header}
        <div className="rounded-lg border border-line bg-surface p-6">
          <h2 className="text-xl font-semibold">Нет данных</h2>
          <p className="mt-2 max-w-2xl text-muted">Уполномоченный по правам человека в субъекте пока не подключен к ФГИС УПЧ, поэтому обращения региона в системе не отображаются. Отсутствие данных не означает отсутствия проблем.</p>
        </div>
      </>
    )
  }
  if (!model) return <>{header}<FilterBar showDistrict={false} current={region.code} /></>

  const cmp = compareLabel(data, f.period).replace('к тому же периоду ', 'к ')
  const link = (folder: string, extra: Record<string, string> = {}) => `/appeals${carry(f.params, { region: region.code, folder, ...extra })}`
  const r = rates(model.cur), n = rates(model.national)
  const cmpBadge = (v: number, nat: number, higherIsBad: boolean): KpiCell['compare'] => {
    if (!Number.isFinite(v) || !Number.isFinite(nat)) return undefined
    const d = v - nat
    const worse = higherIsBad ? d > 0.002 : d < -0.002
    const better = higherIsBad ? d < -0.002 : d > 0.002
    return { text: `${pp(d)} к России (${pct(nat)})`, tone: worse ? 'bad' : better ? 'good' : 'neutral' }
  }
  const cells = coreCells(model.cur, model.prev, cmp, link)
  cells[1].compare = cmpBadge(r.overShare, n.overShare, true)
  cells[2].compare = cmpBadge(r.restShare, n.restShare, false)
  cells[3].compare = cmpBadge(r.repShare, n.repShare, true)
  cells[0].sub = `${cells[0].sub}, на 10 000 жителей ${((model.cur.rec * 10) / region.pop).toFixed(1).replace('.', ',')}`

  const growthMunis = model.munis
    .filter(m => m.cur >= 5)
    .map(m => ({ ...m, g: m.prev ? m.cur / m.prev - 1 : NaN }))
    .sort((a, b) => (b.cur - b.prev) - (a.cur - a.prev))
    .slice(0, 5)

  return (
    <>
      {header}
      <div className="flex flex-col gap-5">
        <FilterBar showDistrict={false} current={region.code} />
        <KpiBand cells={cells} label="Основные показатели региона" />
        <Recommendations items={model.recs} link={rec => (rec.link ? link(rec.link.folder ?? 'all', rec.link.cat ? { cat: rec.link.cat } : {}) : null)} />

        <div className="grid gap-5 xl:grid-cols-[2fr_3fr]">
          <section aria-labelledby="rcat-title" className="min-w-0 rounded-lg border border-line bg-surface px-3 pt-4 pb-4">
            <h2 id="rcat-title" className="px-2 font-serif text-2xl font-semibold">Категории прав</h2>
            <p className="mt-1 mb-2 px-2 text-sm text-muted">Количество, доля и изменение {cmp}. Выделен рост от 10%</p>
            <CategoryBars rows={model.catRows} selected={f.cat} link={id => link('all', { cat: id })} />
          </section>
          <section aria-labelledby="rdyn-title" className="min-w-0 rounded-lg border border-line bg-surface px-5 pt-4 pb-5">
            <h2 id="rdyn-title" className="font-serif text-2xl font-semibold">Поступление по месяцам</h2>
            <p className="mt-1 mb-3 text-sm text-muted">{num(model.cur.rec)} обращений за период</p>
            <MonthlyChart points={model.points} partialMonth={data.meta.partialMonth} partialDay={Number(data.meta.today.slice(8))} curYear={model.points[0]?.month.slice(0, 4) ?? ''} />
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <section aria-labelledby="muni-title" className="min-w-0 rounded-lg border border-line bg-surface p-5 lg:col-span-2">
            <h2 id="muni-title" className="text-xl font-semibold">Проблемные муниципалитеты</h2>
            <p className="mt-1 text-sm text-muted">Наибольший прирост обращений {cmp}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line"><th scope="col" className="py-2 pr-4 font-normal">Территория</th><th scope="col" className="py-2 pr-4 text-right font-normal">Обращений</th><th scope="col" className="py-2 pr-4 text-right font-normal">Изменение</th><th scope="col" className="py-2 font-normal">Основная тема</th></tr>
                </thead>
                <tbody>
                  {growthMunis.map(m => (
                    <tr key={m.name} className="border-b border-line last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.name}</td>
                      <td className="py-2 pr-4 text-right">{num(m.cur)}</td>
                      <td className={`py-2 pr-4 text-right whitespace-nowrap ${m.cur - m.prev > 0 && m.g >= 0.25 ? 'font-semibold text-ink' : 'text-muted'}`}>{m.prev ? `${m.cur - m.prev >= 0 ? '+' : ''}${m.cur - m.prev} (${Math.round(m.g * 100)}%)` : 'новые'}</td>
                      <td className="py-2 text-ink-2">{m.topTopic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flex min-w-0 flex-col gap-5">
            <section aria-labelledby="load-title" className="min-w-0 rounded-lg border border-line bg-surface p-5">
              <h2 id="load-title" className="text-xl font-semibold">Нагрузка на исполнителей</h2>
              <p className="num mt-2 font-serif text-3xl font-semibold">{model.load.perExecutor.toFixed(1).replace('.', ',')}</p>
              <p className="text-sm text-ink-2">незавершенных обращений на исполнителя ({num(model.load.open)} на {model.load.executors})</p>
              <p className={`mt-1 text-sm ${model.load.perExecutor > model.natLoad.perExecutor * 1.2 ? 'text-bad' : 'text-muted'}`}>
                {model.load.perExecutor > model.natLoad.perExecutor * 1.2 ? 'Выше' : model.load.perExecutor < model.natLoad.perExecutor * 0.8 ? 'Ниже' : 'Около'} среднего по России: {model.natLoad.perExecutor.toFixed(1).replace('.', ',')}
              </p>
            </section>
            <section aria-labelledby="grp-title" className="min-w-0 rounded-lg border border-line bg-surface p-5">
              <h2 id="grp-title" className="text-xl font-semibold">Категории граждан</h2>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {model.groups.map(g => (
                  <li key={g.id} className="flex justify-between gap-3"><span>{g.label}</span><span className="text-right"><b className="font-medium">{num(g.n)}</b> <span className="text-muted">({model.curA.length ? Math.round((g.n / model.curA.length) * 100) : 0}%)</span></span></li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <section aria-labelledby="last-title" className="rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-3">
            <h2 id="last-title" className="text-xl font-semibold">Последние обращения региона</h2>
            <Link to={link('all')} className="text-sm font-medium text-accent underline underline-offset-4">Все обращения региона</Link>
          </div>
          <ul className="border-t border-line">
            {model.latest.map(a => (
              <li key={a.id} className="border-b border-line last:border-0">
                <Link to={`/appeals/${a.id}${carry(f.params)}`} className="grid gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-hover md:grid-cols-[9rem_1fr_auto]">
                  <span className="num text-sm font-medium">№ {a.id}</span>
                  <span className="min-w-0"><span className="block truncate">{a.topic}</span><span className="text-sm text-muted">{ruDate(a.received)}, {a.muni}</span></span>
                  <span className={`h-fit w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

