import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { BarChart3, FileText, Inbox, MapPin, Map as MapIcon, Menu, ShieldCheck, X, RotateCw } from 'lucide-react'
import { useDataState } from '../data/load'
import { parsePeriod, periodLabel } from '../data/period'
import { GlobalSearch } from './GlobalSearch'

const NAV = [
  { to: '/', label: 'Обзор по России', icon: BarChart3, end: true },
  { to: '/map', label: 'Карта регионов', icon: MapIcon },
  { to: '/regions', label: 'Региональная аналитика', icon: MapPin, also: '/region/' },
  { to: '/appeals', label: 'Обращения', icon: Inbox },
  { to: '/reports', label: 'Отчетность', icon: FileText },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return (
    <div className="on-dark flex h-full flex-col gap-6 overflow-hidden bg-menu px-3 py-5 text-white lg:rounded-xl">
      <div className="flex items-center gap-2.5 px-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent shadow-[0_0_0_4px_rgb(42_85_196/0.22)]" aria-hidden="true">
          <ShieldCheck size={19} strokeWidth={2} />
        </span>
        <span className="leading-tight">
          <span className="block font-display font-medium tracking-[-0.025em]">ФГИС УПЧ</span>
          <span className="block text-sm text-menu-muted">Аналитика обращений</span>
        </span>
      </div>
      <nav aria-label="Разделы" className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end, also }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            // Страница отдельного региона относится к разделу «Региональная аналитика»
            className={({ isActive: active }) => { const isActive = active || (!!also && pathname.startsWith(also)); return `flex items-center gap-2.5 rounded-full px-4 py-2.5 transition-colors ${
                isActive ? 'bg-accent font-semibold text-white shadow-[0_8px_24px_-10px_rgb(42_85_196/0.9)]' : 'text-menu-muted hover:bg-white/6 hover:text-white'
              }` }}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <p className="mx-1 mt-auto rounded-[20px] bg-white/5 p-4 text-xs text-menu-muted">Прототип для хакатона. Данные демонстрационные.</p>
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { state } = useDataState()
  const [params] = useSearchParams()
  const ready = state.status === 'ready'
  const today = ready ? state.data.meta.today.split('-').reverse().join('.') : null
  const period = ready ? periodLabel(state.data, parsePeriod(params.get('p'))) : null
  return (
    <header className="glass no-print top-3 z-20 mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[24px] px-5 py-3 lg:sticky">
      <button type="button" onClick={onMenu} className="-ml-1 rounded-sm p-1.5 text-ink lg:hidden" aria-label="Открыть меню">
        <Menu size={22} />
      </button>
      {period && <span className="text-sm text-muted">Период: <span className="text-ink">{period}</span></span>}
      {today && <span className="text-sm text-muted">Обновлено {today}</span>}
      <span className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-hover">
        Демонстрационный режим
      </span>
      <GlobalSearch />
    </header>
  )
}

function DataGate({ children }: { children: ReactNode }) {
  const { state, retry } = useDataState()
  if (state.status === 'loading') {
    return <div className="py-24 text-center text-muted" role="status">Загружаем данные и карту субъектов…</div>
  }
  if (state.status === 'error') {
    return (
      <div className="mx-auto my-16 max-w-lg card p-6" role="alert">
        <h2 className="text-xl font-semibold">Не удалось загрузить данные</h2>
        <p className="mt-2 text-muted">Проверьте подключение к интернету и повторите загрузку. Техническая причина: {state.message}</p>
        <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover">
          <RotateCw size={16} aria-hidden="true" /> Повторить загрузку
        </button>
      </div>
    )
  }
  return <>{children}</>
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-3 m-3 mr-0 hidden h-[calc(100vh-24px)] lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Закрыть меню" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-sm p-1 text-white" aria-label="Закрыть меню">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      <div className="min-w-0 px-3 pb-10 lg:px-4">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="px-1 sm:px-2">
          <DataGate>{children}</DataGate>
        </main>
        <footer className="no-print mt-10 border-t border-line px-2 pt-4 text-sm text-muted">
          Все значения демонстрационные и не являются официальной статистикой. Контуры субъектов: © участники OpenStreetMap, ODbL.
        </footer>
      </div>
    </div>
  )
}
