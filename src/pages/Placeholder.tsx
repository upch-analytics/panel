import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { geoConicEqualArea, geoPath } from 'd3-geo'
import { useData } from '../data/load'

// Временные страницы каркаса (этап 2). Заменяются полноценными разделами на этапах 3-4.

export function PageTitle({ children, sub }: { children: string; sub?: string }) {
  return (
    <div className="mt-7 mb-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  )
}

export function OverviewStub() {
  const { data, geo } = useData()
  const { paths, total } = useMemo(() => {
    const proj = geoConicEqualArea().rotate([-100, 0]).parallels([52, 64]).fitExtent([[8, 8], [952, 492]], geo)
    const path = geoPath(proj)
    const paths = geo.features.map(f => ({ code: f.properties.code, d: path(f) ?? '' }))
    const total = Object.values(data.cube).reduce((s, a) => s + a.reduce((t, v, i) => (i % 6 === 0 ? t + v : t), 0), 0)
    return { paths, total }
  }, [data, geo])
  const connected = data.regions.filter(r => r.connected)
  const names = new Map(data.regions.map(r => [r.code, r]))

  return (
    <>
      <PageTitle sub="Каркас панели: данные и контуры субъектов загружены, разделы появятся на следующих этапах">Обращения граждан по России</PageTitle>
      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface p-5"><div className="text-sm text-muted">Субъектов в справочнике</div><div className="num font-serif text-3xl font-semibold">{data.regions.length}</div></div>
        <div className="bg-surface p-5"><div className="text-sm text-muted">Подключены к ФГИС</div><div className="num font-serif text-3xl font-semibold">{connected.length} из {data.regions.length}</div></div>
        <div className="bg-surface p-5"><div className="text-sm text-muted">Обращений в наборе, 2023-2026</div><div className="num font-serif text-3xl font-semibold">{total.toLocaleString('ru-RU')}</div></div>
      </div>
      <div className="mt-5 rounded-lg border border-line bg-surface p-4">
        <svg viewBox="0 0 960 500" className="h-auto w-full" role="img" aria-label="Контуры субъектов Российской Федерации">
          {paths.map(p => {
            const r = names.get(p.code)
            return (
              <Link key={p.code} to={`/region/${p.code}`} aria-label={r?.name}>
                <path d={p.d} className={r?.connected ? 'fill-map-2 hover:fill-map-4' : 'fill-map-off'} stroke="#fff" strokeWidth={0.6} vectorEffect="non-scaling-stroke">
                  <title>{r?.name}</title>
                </path>
              </Link>
            )
          })}
        </svg>
      </div>
    </>
  )
}

export function RegionStub() {
  const { code } = useParams()
  const { data } = useData()
  const region = data.regions.find(r => r.code === code)
  if (!region) return <NotFound />
  return (
    <>
      <p className="mt-6 text-sm text-muted"><Link className="text-accent underline" to="/">Обзор по России</Link> / {region.name}</p>
      <PageTitle sub={`${data.meta.districts[region.district]} федеральный округ, код субъекта ${region.code}`}>{region.name}</PageTitle>
      <Link to="/" className="inline-flex rounded-sm border border-line-strong bg-surface px-4 py-2 font-medium hover:bg-surface-hover">Вернуться к карте России</Link>
    </>
  )
}

export function SectionStub({ title }: { title: string }) {
  return (
    <>
      <PageTitle sub="Раздел появится на следующем этапе">{title}</PageTitle>
    </>
  )
}

export function NotFound() {
  return (
    <>
      <PageTitle sub="Такой страницы нет. Возможно, ссылка устарела.">Страница не найдена</PageTitle>
      <Link to="/" className="text-accent underline">Перейти к обзору по России</Link>
    </>
  )
}
