import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../data/load'
import { carry, useFilters } from '../data/filters'
import { byCategory, byRegion, monthly, num, previousYear, sumCube, type Totals } from '../data/agg'
import { compareLabel, periodLabel, periodRange } from '../data/period'
import { FilterBar } from '../components/FilterBar'
import { KpiBand, coreCells } from '../components/KpiBand'
import { RussiaMap } from '../components/RussiaMap'
import { RankList } from '../components/RankList'
import { MODES } from '../data/mapScale'
import type { Region } from '../data/types'
import { CategoryBars, MonthlyChart } from '../components/Charts'
import { AttentionList } from '../components/AttentionList'
import { PageTitle } from './Common'

export function useOverviewModel() {
  const { data } = useData()
  const f = useFilters()
  return useMemo(() => {
    if (!f.filter || !f.range) return null
    const cur = sumCube(data, f.filter)
    const prevF = previousYear(data, f.filter)
    const prev = prevF ? sumCube(data, prevF) : null
    // Карта и список внимания: все субъекты, сравнение с Россией в целом при тех же периоде и категории
    const all = { range: f.range, cats: f.filter.cats }
    const values = byRegion(data, all)
    const national = sumCube(data, all)
    return { cur, prev, values, national, prevF }
  }, [data, f.filter, f.range])
}

export function Overview() {
  const { data, geo } = useData()
  const f = useFilters()
  const navigate = useNavigate()
  const model = useOverviewModel()
  const [hover, setHover] = useState<string | null>(null)
  const scope = f.fd ? `${data.meta.districts[f.fd]} федеральный округ` : 'Россия'

  const charts = useMemo(() => {
    if (!f.filter || !f.range) return null
    // График: минимум год, чтобы динамика читалась; для короткого периода берется его календарный год
    let r = f.range
    if (r.to - r.from < 2) {
      const y = data.meta.months[r.to].slice(0, 4)
      r = periodRange(data, { kind: 'year', year: Number(y) })!
    }
    const cur = monthly(data, { ...f.filter, range: r })
    const prev = r.from >= 12 ? monthly(data, { ...f.filter, range: { from: r.from - 12, to: r.to - 12 } }) : null
    const points = cur.map((c, i) => ({ month: c.month, cur: c.t.rec, prev: prev ? prev[i].t.rec : null }))
    const catNow = byCategory(data, { range: f.range, codes: f.codes })
    const prevF = previousYear(data, { range: f.range })
    const catPrev = prevF ? byCategory(data, { ...prevF, codes: f.codes }) : null
    const cats = catNow.map((c, i) => ({ ...c, prev: catPrev?.[i].t }))
    return { points, cats, years: `${data.meta.months[r.from].slice(0, 4)}${data.meta.months[r.to].slice(0, 4) !== data.meta.months[r.from].slice(0, 4) ? '-' + data.meta.months[r.to].slice(0, 4) : ''}` }
  }, [data, f.filter, f.range, f.codes])

  if (!model || !charts) {
    return (<><PageTitle sub="За выбранный период данных нет">{`Обращения граждан: ${scope}`}</PageTitle><FilterBar /></>)
  }

  const cmp = compareLabel(data, f.period)
  const link = (folder: string) => `/appeals${carry(f.params, { folder })}`
  const regionsScope = f.fd ? data.regions.filter(r => r.district === f.fd) : data.regions
  const connected = regionsScope.filter(r => r.connected).length
  // Доля обращений, зарегистрированных в системе: оценка по неподключенным субъектам (пропорционально объему периода)
  const nc2026 = data.meta.notRegisteredEstimate2026
  const rec2026 = sumCube(data, { range: periodRange(data, { kind: 'year', year: 2026 })! }).rec
  const ncEst = f.fd ? 0 : nc2026 * (model.cur.rec / rec2026)
  const regShare = model.cur.rec / (model.cur.rec + ncEst)

  const cells = [
    // Полная формулировка сравнения в подзаголовке страницы, в ячейках коротко: «к 2025»
    ...coreCells(model.cur, model.prev, cmp.replace('к тому же периоду ', 'к '), link),
    {
      label: 'Охват системой',
      value: `${connected} из ${regionsScope.length}`,
      sub: `субъектов подключены`,
      delta: f.fd ? undefined : `в системе ${(regShare * 100).toFixed(1).replace('.', ',')}% обращений (оценка)`,
      tone: 'neutral' as const,
      to: `/regions${carry(f.params)}`,
      hint: 'Количество субъектов взято из того же справочника, что и карта',
    },
  ]

  return (
    <>
      <PageTitle hero eyebrow={`Обзор, ${periodLabel(data, f.period)}`} sub={`Обращения к Уполномоченным по правам человека: где нарушаются права, как это меняется и что уже сделано${cmp ? `. Сравнение ${cmp}` : ''}`}>{scope === 'Россия' ? 'Обращения граждан по России' : `Обращения граждан: ${scope}`}</PageTitle>
      <div className="flex flex-col gap-5">
        <FilterBar />
        <RussiaMap
          geo={geo}
          regions={data.regions}
          values={model.values}
          mode={f.mode}
          onMode={m => f.set({ map: m })}
          onOpen={code => navigate(`/region/${code}${carry(f.params)}`)}
          focus={f.codes}
          highlight={hover}
          aside={
            <RankList regions={f.fd ? regionsScope : data.regions} values={model.values} mode={f.mode} limit={8} onHover={setHover}
              link={code => `/region/${code}${carry(f.params)}`}
              footer={<Link to={`/map${carry(f.params, { map: f.mode })}`} className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover">Все субъекты и федеральные округа</Link>} />
          }
        />
        <KpiBand cells={cells} />
        <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
          <section aria-labelledby="dyn-title" className="min-w-0 card px-5 pt-4 pb-5">
            <h2 id="dyn-title" className="text-lg font-bold tracking-[-0.01em]">Поступление обращений по месяцам</h2>
            <p className="mt-1 mb-3 text-sm text-muted">{scope}, {num(model.cur.rec)} обращений за период</p>
            <MonthlyChart points={charts.points} partialMonth={data.meta.partialMonth} partialDay={Number(data.meta.today.slice(8))} curYear={charts.years} />
          </section>
          <section aria-labelledby="cat-title" className="min-w-0 card px-3 pt-4 pb-4">
            <h2 id="cat-title" className="px-2 text-lg font-bold tracking-[-0.01em]">Категории прав</h2>
            <p className="mt-1 mb-2 px-2 text-sm text-muted">Количество, доля и изменение {cmp || 'к прошлому периоду'}. Нажмите, чтобы открыть обращения</p>
            <CategoryBars rows={charts.cats} selected={f.cat} link={id => `/appeals${carry(f.params, { cat: id })}`} />
          </section>
        </div>
        <AttentionList regions={regionsScope} values={model.values} national={model.national} link={code => `/region/${code}${carry(f.params)}`} />
      </div>
    </>
  )
}

export function MapPage() {
  const { data, geo } = useData()
  const f = useFilters()
  const navigate = useNavigate()
  const model = useOverviewModel()
  const [hover, setHover] = useState<string | null>(null)
  const m = MODES[f.mode]

  // Сравнение федеральных округов в текущем режиме карты: суммы по подключенным субъектам округа
  const districts = useMemo(() => {
    if (!model) return []
    return Object.entries(data.meta.districts).map(([id, name]) => {
      const regs = data.regions.filter(r => r.district === id && r.connected)
      const t = regs.reduce((acc, r) => { const v = model.values.get(r.code); if (v) for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += v[k]; return acc }, { rec: 0, over: 0, done: 0, viol: 0, rest: 0, rep: 0, due: 0, overDue: 0 })
      const pop = regs.reduce((acc, r) => acc + r.pop, 0)
      return { id, name, regs: regs.length, total: data.regions.filter(r => r.district === id).length, v: m.value(t, { pop } as Region), rec: t.rec }
    }).sort((a, b) => (m.invert ? a.v - b.v : b.v - a.v))
  }, [data, model, m])
  const national = model ? m.value(model.national, { pop: data.regions.filter(r => r.connected).reduce((s, r) => s + r.pop, 0) } as Region) : NaN

  return (
    <>
      <PageTitle sub={`${periodLabel(data, f.period)}. Карта и полный рейтинг субъектов по выбранному показателю`}>Карта регионов</PageTitle>
      <div className="flex flex-col gap-5">
        <FilterBar />
        {model && (
          <>
            <RussiaMap geo={geo} regions={data.regions} values={model.values} mode={f.mode} onMode={x => f.set({ map: x })}
              onOpen={code => navigate(`/region/${code}${carry(f.params)}`)} focus={f.codes} highlight={hover}
              aside={<RankList regions={f.fd ? data.regions.filter(r => r.district === f.fd) : data.regions} values={model.values} mode={f.mode} onHover={setHover} link={code => `/region/${code}${carry(f.params)}`} />} />
            <section aria-labelledby="fd-title" className="card p-5">
              <h2 id="fd-title" className="text-lg font-bold tracking-[-0.01em]">Федеральные округа</h2>
              <p className="mt-1 text-sm text-muted">{m.title}, за период. По России: {m.fmt(national)}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-muted">
                    <tr className="border-b border-line"><th scope="col" className="py-2 pr-4 font-normal">Округ</th><th scope="col" className="py-2 pr-4 text-right font-normal">{m.title}</th><th scope="col" className="py-2 pr-4 text-right font-normal">Обращений</th><th scope="col" className="py-2 text-right font-normal">Подключено субъектов</th></tr>
                  </thead>
                  <tbody>
                    {districts.map(d => {
                      const worse = f.mode !== 'count' && Number.isFinite(d.v) && (m.invert ? national - d.v > 0.03 : d.v - national > 0.005)
                      return (
                        <tr key={d.id} className="border-b border-line last:border-0">
                          <td className="py-2 pr-4"><Link to={`/map${carry(f.params, { fd: d.id, map: f.mode })}`} className="font-medium text-accent underline-offset-4 hover:underline">{d.name}</Link></td>
                          <td className={`py-2 pr-4 text-right ${worse ? 'font-semibold text-bad' : ''}`}>{m.fmt(d.v)}</td>
                          <td className="py-2 pr-4 text-right">{num(d.rec)}</td>
                          <td className="py-2 text-right">{d.regs} из {d.total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {m.note && <p className="mt-3 text-sm text-muted">{m.note}</p>}
            </section>
          </>
        )}
      </div>
    </>
  )
}

export type { Totals }
