import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, CalendarPlus, ChevronLeft, ChevronRight, Download, FileText, Search } from 'lucide-react'
import { useData } from '../data/load'
import { carry, useFilters } from '../data/filters'
import { periodLabel } from '../data/period'
import { documents, findAppeal, relatedAppeals, result, ruDate, scopeAppeals, STATUS, summary, timeline, type Appeal, type Status } from '../data/records'
import { downloadCsv, stamp, toCsv } from '../data/csv'
import { FilterBar } from '../components/FilterBar'
import { useToast } from '../components/Toast'
import { NotFound, PageTitle } from './Common'

const FOLDERS = [
  { id: 'all', label: 'Все', test: () => true },
  { id: 'overdue_now', label: 'Просрочены сейчас', test: (a: Appeal) => a.overdue && !a.doneDate },
  { id: 'overdue', label: 'С нарушением срока', test: (a: Appeal) => a.overdue },
  { id: 'in_work', label: 'На рассмотрении', test: (a: Appeal) => !a.doneDate },
  { id: 'repeat', label: 'Повторные', test: (a: Appeal) => a.repeat },
  { id: 'restored', label: 'Права восстановлены', test: (a: Appeal) => a.status === 'restored' },
] as const

const SORTS = [
  { id: 'date_desc', label: 'Сначала новые' },
  { id: 'date_asc', label: 'Сначала старые' },
  { id: 'overdue_desc', label: 'По сроку просрочки' },
]
const PAGE = 25

/** Открытое просроченное: требует действия сейчас; закрытое с опозданием: факт, приглушенно */
function DeadlineCell({ a }: { a: Appeal }) {
  if (a.overdue && !a.doneDate) return <span className="font-medium text-bad">просрочено {a.overdueDays} дн.</span>
  if (a.overdue) return <span className="text-muted" title="Рассмотрено с нарушением срока">с опозданием {a.overdueDays} дн.</span>
  if (a.doneDate) return <span className="text-muted">рассмотрено {ruDate(a.doneDate)}</span>
  return <span className="text-muted">до {ruDate(a.deadline)}</span>
}

export function StatusBadge({ s, short }: { s: Status; short?: boolean }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS[s].cls}`} title={STATUS[s].label}>{short ? STATUS[s].short : STATUS[s].label}</span>
}

export function Appeals() {
  const { data } = useData()
  const f = useFilters()
  const p = f.params
  const folder = FOLDERS.find(x => x.id === p.get('folder')) ?? FOLDERS[0]
  const status = p.get('status') as Status | null
  const region = p.get('region')
  // В папках просрочек по умолчанию сверху самые давние просрочки
  const defaultSort = folder.id === 'overdue_now' || folder.id === 'overdue' ? 'overdue_desc' : 'date_desc'
  const sort = SORTS.find(s => s.id === p.get('sort'))?.id ?? defaultSort
  const page = Math.max(1, Number(p.get('page')) || 1)
  const [q, setQ] = useState(p.get('q') ?? '')

  const base = useMemo(() => {
    if (!f.range) return []
    const codes = region ? [region] : f.codes
    return scopeAppeals(data, { range: f.range, codes, cats: f.cat ? [f.cat] : undefined })
  }, [data, f.range, f.codes, f.cat, region])

  const counts = useMemo(() => Object.fromEntries(FOLDERS.map(x => [x.id, base.filter(x.test).length])), [base])
  const names = useMemo(() => new Map(data.regions.map(r => [r.code, r.name])), [data])
  const catName = useMemo(() => new Map(data.meta.categories.map(c => [c.id, c.name])), [data])

  const list = useMemo(() => {
    const term = (p.get('q') ?? '').trim().toLowerCase()
    const out = base.filter(a => folder.test(a) && (!status || a.status === status) &&
      (!term || a.id.includes(term) || a.topic.toLowerCase().includes(term) || a.executor.toLowerCase().includes(term) || a.muni.toLowerCase().includes(term)))
    if (sort === 'date_desc') out.sort((a, b) => b.received.localeCompare(a.received) || b.id.localeCompare(a.id))
    if (sort === 'date_asc') out.sort((a, b) => a.received.localeCompare(b.received) || a.id.localeCompare(b.id))
    if (sort === 'overdue_desc') out.sort((a, b) => b.overdueDays - a.overdueDays || b.received.localeCompare(a.received))
    return out
  }, [base, folder, status, sort, p])

  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE)
  const scope = region ? names.get(region) : f.fd ? `${data.meta.districts[f.fd]} ФО` : 'Россия'

  const exportCsv = () => {
    const csv = toCsv(
      ['Реестр обращений ФГИС УПЧ', `Территория: ${scope}`, `Период: ${periodLabel(data, f.period)}`, `Папка: ${folder.label}`, `Сформировано: ${stamp()}`, 'Демонстрационные данные, не являются официальной статистикой'],
      ['Номер', 'Дата поступления', 'Субъект', 'Муниципалитет', 'Категория прав', 'Тема', 'Канал', 'Адресат', 'Исполнитель', 'Статус', 'Срок ответа', 'Просрочка, дн.', 'Повторное'],
      list.map(a => [a.id, ruDate(a.received), names.get(a.code) ?? a.code, a.muni, catName.get(a.cat) ?? a.cat, a.topic, a.channel, a.addressee, a.executor, STATUS[a.status].label, ruDate(a.deadline), a.overdueDays || '', a.repeat ? 'да' : 'нет']),
    )
    downloadCsv(`obrashcheniya-${folder.id}-${data.meta.today}.csv`, csv)
  }

  return (
    <>
      <PageTitle sub={`${scope}. ${periodLabel(data, f.period)}`}>Обращения</PageTitle>
      <div className="flex flex-col gap-5">
        <FilterBar regionMode="filter">
          <label className="flex max-w-full min-w-0 flex-col gap-1 xl:flex-row xl:items-center xl:gap-2">
            <span className="text-sm text-muted">Статус</span>
            <select className="select" value={status ?? ''} onChange={e => f.set({ status: e.target.value || null })}>
              <option value="">Все статусы</option>
              {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
          </label>
        </FilterBar>

        <section aria-label="Реестр обращений" className="rounded-lg border border-line bg-surface">
          <div role="tablist" aria-label="Папки" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2">
            {FOLDERS.map(x => (
              <button key={x.id} role="tab" type="button" aria-selected={folder.id === x.id} onClick={() => f.set({ folder: x.id === 'all' ? null : x.id })}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium ${folder.id === x.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}>
                {x.label}
                <span className={`num rounded-full px-1.5 text-xs ${folder.id === x.id ? 'bg-accent-soft' : 'bg-bg'}`}>{counts[x.id]?.toLocaleString('ru-RU')}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <form className="flex w-80 max-w-full items-center gap-2 rounded-sm border border-line-strong px-2.5 focus-within:border-accent" onSubmit={e => { e.preventDefault(); f.set({ q: q.trim() || null }) }} role="search">
              <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
              <input value={q} onChange={e => setQ(e.target.value)} onBlur={() => f.set({ q: q.trim() || null })} className="h-9 w-full bg-transparent text-sm outline-none" placeholder="Номер, тема, исполнитель" aria-label="Поиск по номеру, теме и исполнителю" />
            </form>
            <label className="flex items-center gap-2 text-sm text-muted">
              Сортировка
              <select className="select" value={sort} onChange={e => f.set({ sort: e.target.value === defaultSort ? null : e.target.value })}>
                {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            {(p.get('q') || status) && <span className="text-sm text-muted">Найдено: {list.length.toLocaleString('ru-RU')}</span>}
            <button type="button" onClick={exportCsv} disabled={!list.length} className="ml-auto inline-flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-hover disabled:opacity-50">
              <Download size={16} aria-hidden="true" /> Выгрузить в CSV
            </button>
          </div>
          {/* Телефон: карточки вместо таблицы, чтобы статус и срок были видны без прокрутки вбок */}
          <ul className="border-t border-line md:hidden">
            {shown.map(a => (
              <li key={a.id} className="border-b border-line last:border-0">
                <Link to={`/appeals/${a.id}${carry(p)}`} className="block px-4 py-3 hover:bg-surface-hover">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="num font-medium text-accent">№ {a.id}</span>
                    <span className="text-sm text-muted">{ruDate(a.received)}</span>
                  </span>
                  <span className="mt-1 block">{a.topic}</span>
                  <span className="block text-sm text-muted">{region ? a.muni : `${names.get(a.code)}, ${a.muni}`}. {a.executor}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <StatusBadge s={a.status} short />
                    {a.repeat && <span className="rounded-full bg-mid-soft px-2 py-0.5 text-xs font-semibold text-mid">Повторное</span>}
                    <DeadlineCell a={a} />
                  </span>
                </Link>
              </li>
            ))}
            {!shown.length && <li className="px-4 py-10 text-center text-muted">Обращений по заданным условиям нет. Измените фильтры или папку.</li>}
          </ul>
          <div className="hidden overflow-x-auto border-t border-line md:block">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-bg/60 text-left">
                <tr className="border-b border-line">
                  <th scope="col" className="px-3 py-2 font-medium">Номер</th>
                  <th scope="col" className="px-3 py-2 font-medium">Поступило</th>
                  <th scope="col" className="px-3 py-2 font-medium">Субъект, тема</th>
                  <th scope="col" className="px-3 py-2 font-medium">Категория</th>
                  <th scope="col" className="px-3 py-2 font-medium">Исполнитель</th>
                  <th scope="col" className="px-3 py-2 font-medium">Статус</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Срок</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(a => (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface-hover">
                    <td className="px-3 py-2.5 whitespace-nowrap"><Link to={`/appeals/${a.id}${carry(p)}`} className="num font-medium text-accent underline-offset-4 hover:underline">№ {a.id}</Link></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{ruDate(a.received)}</td>
                    <td className="min-w-56 px-3 py-2.5"><span className="block">{a.topic}</span><span className="text-muted">{region ? a.muni : `${names.get(a.code)}, ${a.muni}`}</span></td>
                    <td className="px-3 py-2.5">{catName.get(a.cat)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{a.executor}</td>
                    <td className="px-3 py-2.5"><span className="flex flex-wrap gap-1"><StatusBadge s={a.status} short />{a.repeat && <span className="inline-block rounded-full bg-mid-soft px-2 py-0.5 text-xs font-semibold text-mid">Повторное</span>}</span></td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap"><DeadlineCell a={a} /></td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Обращений по заданным условиям нет. Измените фильтры или папку.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav aria-label="Страницы" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
              <span className="text-muted">Страница {Math.min(page, pages)} из {pages.toLocaleString('ru-RU')}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => f.set({ page: String(page - 1) })} className="inline-flex items-center gap-1 rounded-sm border border-line-strong px-3 py-1.5 hover:bg-surface-hover disabled:opacity-40"><ChevronLeft size={16} aria-hidden="true" />Назад</button>
                <button type="button" disabled={page >= pages} onClick={() => f.set({ page: String(page + 1) })} className="inline-flex items-center gap-1 rounded-sm border border-line-strong px-3 py-1.5 hover:bg-surface-hover disabled:opacity-40">Вперед<ChevronRight size={16} aria-hidden="true" /></button>
              </div>
            </nav>
          )}
        </section>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (<><dt className="text-muted">{label}</dt><dd className="m-0">{children}</dd></>)
}

export function AppealCard() {
  const { id = '' } = useParams()
  const { data } = useData()
  const f = useFilters()
  const toast = useToast()
  const a = useMemo(() => findAppeal(data, id), [data, id])
  if (!a) return <NotFound />
  const region = data.regions.find(r => r.code === a.code)!
  const cat = data.meta.categories.find(c => c.id === a.cat)!
  const tl = timeline(a, data.meta.today)
  const related = relatedAppeals(data, a)
  const back = `/appeals${carry(f.params, Object.fromEntries(['folder', 'region', 'status', 'q', 'sort', 'page'].flatMap(k => (f.params.get(k) ? [[k, f.params.get(k)!]] : []))))}`

  return (
    <>
      <nav aria-label="Навигация" className="mt-6 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to={back} className="inline-flex items-center gap-1 text-accent underline underline-offset-4"><ArrowLeft size={14} aria-hidden="true" />К списку обращений</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to={`/region/${a.code}${carry(f.params)}`} className="text-accent underline underline-offset-4">{region.name}</Link>
      </nav>
      <div className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="num font-serif text-4xl font-semibold tracking-tight">Обращение № {a.id}</h1>
        <StatusBadge s={a.status} />
        {a.repeat && <span className="rounded-full bg-mid-soft px-2 py-0.5 text-xs font-semibold text-mid">Повторное</span>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-5">
          <section aria-labelledby="sum-title" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="sum-title" className="text-xl font-semibold">{a.topic}</h2>
            <p className="mt-2 max-w-[70ch] text-lg">{summary(a)}</p>
            <p className="mt-3 text-sm text-muted">Заявитель: {a.applicant} (обезличенный номер, персональные данные не отображаются)</p>
          </section>

          {a.overdue && !a.doneDate && (
            <section aria-label="Действия по просроченному обращению" className="no-print flex flex-wrap items-center gap-3 rounded-lg border border-bad/30 bg-bad-soft p-4">
              <p className="mr-auto font-medium text-bad">Срок рассмотрения нарушен на {a.overdueDays} дн.</p>
              <button type="button" onClick={() => toast(`Напоминание отправлено исполнителю ${a.executor} (демонстрационное действие, ничего не сохраняется)`)} className="inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover">
                <Bell size={16} aria-hidden="true" /> Напомнить исполнителю
              </button>
              <button type="button" onClick={() => toast('Срок рассмотрения продлен на 30 дней (демонстрационное действие, ничего не сохраняется)')} className="inline-flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 py-2 font-medium hover:bg-surface-hover">
                <CalendarPlus size={16} aria-hidden="true" /> Продлить срок
              </button>
              <span className="w-full text-sm text-bad">Кнопки демонстрационные: в прототипе показывают уведомление.</span>
            </section>
          )}

          <section aria-labelledby="tl-title" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="tl-title" className="text-xl font-semibold">История рассмотрения</h2>
            <ol className="mt-3 border-l-2 border-line pl-5">
              {tl.map((e, i) => (
                <li key={i} className="relative pb-4 last:pb-0">
                  <span className={`absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-surface ${e.tone === 'bad' ? 'bg-bad' : e.tone === 'good' ? 'bg-good' : 'bg-map-4'}`} aria-hidden="true" />
                  <span className="num text-sm text-muted">{ruDate(e.date)}</span>
                  <p className={e.tone === 'bad' ? 'font-medium text-bad' : e.tone === 'good' ? 'font-medium text-good' : ''}>{e.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="res-title" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="res-title" className="text-xl font-semibold">Результат рассмотрения</h2>
            <p className="mt-2">{result(a)}</p>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="att-title2" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="att-title2" className="text-xl font-semibold">Сведения</h2>
            <dl className="mt-3 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
              <Row label="Номер"><span className="num">{a.id}</span></Row>
              <Row label="Статус"><StatusBadge s={a.status} /></Row>
              <Row label="Поступило">{ruDate(a.received)}</Row>
              <Row label="Канал подачи">{a.channel}</Row>
              <Row label="Адресат">{a.addressee}</Row>
              <Row label="Категория прав">{cat.name}</Row>
              <Row label="Субъект">{region.name}</Row>
              <Row label="Муниципалитет">{a.muni}</Row>
              <Row label="Ответственный">{a.executor}</Row>
              <Row label="Срок ответа">{ruDate(a.deadline)}{a.extended ? ' (продлен)' : ''}</Row>
              <Row label="Просрочка">{a.overdue ? (a.doneDate ? `ответ с опозданием на ${a.overdueDays} дн.` : <span className="font-medium text-bad">{a.overdueDays} дн., рассмотрение не завершено</span>) : 'нет'}</Row>
              {a.doneDate && <Row label="Рассмотрено">{ruDate(a.doneDate)}</Row>}
            </dl>
          </section>
          <section aria-labelledby="doc-title" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="doc-title" className="text-xl font-semibold">Документы</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {documents(a).map(d => <li key={d} className="flex items-center gap-2"><FileText size={16} className="text-muted" aria-hidden="true" />{d}</li>)}
            </ul>
            <p className="mt-2 text-sm text-muted">Названия документов демонстрационные, файлы не прикреплены.</p>
          </section>
          {a.repeat && (
            <section aria-labelledby="rel-title" className="rounded-lg border border-line bg-surface p-5">
              <h2 id="rel-title" className="text-xl font-semibold">Связанные обращения</h2>
              {related.length ? (
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {related.map(r => (
                    <li key={r.id}><Link to={`/appeals/${r.id}${carry(f.params)}`} className="num font-medium text-accent underline underline-offset-4">№ {r.id}</Link> <span className="text-muted">от {ruDate(r.received)}: {STATUS[r.status].label.toLowerCase()}</span></li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-muted">Предыдущее обращение подано до начала периода, охваченного системой.</p>}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
