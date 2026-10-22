import { Link, useParams } from 'react-router-dom'
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
