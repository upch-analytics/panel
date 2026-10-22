import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useData } from '../data/load'
import { carry, useFilters } from '../data/filters'
import { periodLabel, serializePeriod, monthName, type Period } from '../data/period'

/** short: короткая видимая подпись, полная остается доступным именем поля */
function Field({ label, short, hidden, children }: { label: string; short?: string; hidden?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex max-w-full min-w-0 flex-col gap-1 xl:flex-row xl:items-center xl:gap-2" aria-label={short ? label : undefined}>
      <span className={hidden ? 'sr-only' : 'text-sm text-muted'} aria-hidden={short ? true : undefined}>{short ?? label}</span>
      {children}
    </label>
  )
}

/** regionMode: navigate открывает страницу региона, filter задает фильтр region в адресе (раздел «Обращения») */
/** current: код открытого региона (страница региона): список показывает его, а выбор открывает другой регион */
export function FilterBar({ showRegion = true, showDistrict = true, regionMode = 'navigate', current, children }: { showRegion?: boolean; showDistrict?: boolean; regionMode?: 'navigate' | 'filter'; current?: string; children?: React.ReactNode }) {
  const { data } = useData()
  const { period, cat, fd, set, reset, params } = useFilters()
  const navigate = useNavigate()
  const years = [...new Set(data.meta.months.map(m => Number(m.slice(0, 4))))]
  const lastYm = data.meta.months[data.meta.months.length - 1]

  const setPeriod = (p: Period) => set({ p: serializePeriod(p) })
  const year = period.kind === 'range' ? Number(period.to.slice(0, 4)) : period.year

  const onKind = (kind: Period['kind']) => {
    if (kind === 'year') setPeriod({ kind, year })
    if (kind === 'quarter') setPeriod({ kind, year, q: year === 2026 ? 3 : 4 })
    if (kind === 'month') setPeriod({ kind, year, month: year === 2026 ? 9 : 12 })
    if (kind === 'range') setPeriod({ kind, from: '2025-11', to: '2026-09' })
  }

  const chips: { label: string; clear: () => void }[] = []
  if (serializePeriod(period) !== 'y2026') chips.push({ label: periodLabel(data, period), clear: () => set({ p: null }) })
  if (cat) chips.push({ label: data.meta.categories.find(c => c.id === cat)?.name ?? cat, clear: () => set({ cat: null }) })
  const regionParam = regionMode === 'filter' ? params.get('region') : null
  // При выбранном регионе округ следует из него; смена округа сбрасывает регион
  const regionDistrict = regionParam ? data.regions.find(r => r.code === regionParam)?.district ?? null : null
  const fdValue = regionDistrict ?? fd
  if (fd && showDistrict && !regionDistrict) chips.push({ label: `${data.meta.districts[fd]} ФО`, clear: () => set({ fd: null }) })
  if (regionParam) chips.push({ label: data.regions.find(r => r.code === regionParam)?.name ?? regionParam, clear: () => set({ region: null }) })

  const monthOptions = data.meta.months.filter(m => m.startsWith(String(year)))

  return (
    <section aria-label="Фильтры" className="no-print card px-4 py-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 xl:items-center">
        <Field label="Период">
          <select className="select" value={period.kind} onChange={e => onKind(e.target.value as Period['kind'])}>
            <option value="year">Год</option>
            <option value="quarter">Квартал</option>
            <option value="month">Месяц</option>
            <option value="range">Диапазон</option>
          </select>
        </Field>
        {period.kind !== 'range' && (
          <Field label="Год">
            <select className="select" value={year} onChange={e => {
              const y = Number(e.target.value)
              if (period.kind === 'year') setPeriod({ kind: 'year', year: y })
              if (period.kind === 'quarter') setPeriod({ kind: 'quarter', year: y, q: period.q })
              if (period.kind === 'month') setPeriod({ kind: 'month', year: y, month: y === 2026 ? Math.min(period.month, 10) : period.month })
            }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
        )}
        {period.kind === 'quarter' && (
          <Field label="Квартал">
            <select className="select" value={period.q} onChange={e => setPeriod({ ...period, q: Number(e.target.value) })}>
              {[1, 2, 3, 4].filter(q => `${period.year}-${String(q * 3 - 2).padStart(2, '0')}` <= lastYm).map(q => (
                <option key={q} value={q}>{['I', 'II', 'III', 'IV'][q - 1]} квартал</option>
              ))}
            </select>
          </Field>
        )}
        {period.kind === 'month' && (
          <Field label="Месяц">
            <select className="select" value={period.month} onChange={e => setPeriod({ ...period, month: Number(e.target.value) })}>
              {monthOptions.map(m => { const i = Number(m.slice(5)); return <option key={m} value={i}>{monthName(i - 1)}</option> })}
            </select>
          </Field>
        )}
        {period.kind === 'range' && (
          <>
            <Field label="С месяца">
              <select className="select" value={period.from} onChange={e => setPeriod({ ...period, from: e.target.value })}>
                {data.meta.months.map(m => <option key={m} value={m}>{monthName(Number(m.slice(5)) - 1)} {m.slice(0, 4)}</option>)}
              </select>
            </Field>
            <Field label="По месяц">
              <select className="select" value={period.to} onChange={e => setPeriod({ ...period, to: e.target.value })}>
                {data.meta.months.filter(m => m >= period.from).map(m => <option key={m} value={m}>{monthName(Number(m.slice(5)) - 1)} {m.slice(0, 4)}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Категория прав" short="Категория">
          <select className="select w-52" value={cat ?? ''} onChange={e => set({ cat: e.target.value || null })}>
            <option value="">Все категории</option>
            {data.meta.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {showDistrict && <Field label="Федеральный округ" short="Округ">
          <select className="select w-48" value={fdValue ?? ''} onChange={e => set({ fd: e.target.value || null, ...(regionParam ? { region: null } : {}) })}>
            <option value="">Вся Россия</option>
            {Object.entries(data.meta.districts).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </Field>}
        {showRegion && (
          <Field label="Регион" hidden={!current}>
            <select className="select w-48" value={regionMode === 'filter' ? params.get('region') ?? '' : current ?? ''} onChange={e => {
              if (regionMode === 'filter') set({ region: e.target.value || null, page: null })
              else if (e.target.value) navigate(`/region/${e.target.value}${carry(params)}`)
            }}>
              <option value="">{regionMode === 'filter' ? 'Все регионы' : 'Открыть регион…'}</option>
              {[...data.regions].filter(r => regionMode !== 'filter' || !fdValue || r.district === fdValue).sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(r => (
                <option key={r.code} value={r.code}>{r.name}{r.connected ? '' : ' (нет данных)'}</option>
              ))}
            </select>
          </Field>
        )}
        {children}
      </div>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {chips.map(c => (
            <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-sm font-medium text-accent">
              {c.label}
              <button type="button" onClick={c.clear} className="grid size-6 place-items-center rounded-full hover:bg-accent/15" aria-label={`Убрать фильтр: ${c.label}`}>
                <X size={14} />
              </button>
            </span>
          ))}
          <button type="button" onClick={reset} className="ml-1 text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
            Сбросить все
          </button>
        </div>
      )}
    </section>
  )
}
