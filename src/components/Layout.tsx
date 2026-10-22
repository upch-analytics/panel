import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BarChart3, FileText, Inbox, MapPin, Map as MapIcon, Menu, Search, ShieldCheck, X, RotateCw } from 'lucide-react'
import { useDataState } from '../data/load'

const NAV = [
  { to: '/', label: 'Обзор по России', icon: BarChart3, end: true },
  { to: '/map', label: 'Карта регионов', icon: MapIcon },
  { to: '/regions', label: 'Региональная аналитика', icon: MapPin },
  { to: '/appeals', label: 'Обращения', icon: Inbox },
  { to: '/reports', label: 'Отчетность', icon: FileText },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="on-dark flex h-full flex-col gap-6 bg-menu px-3.5 py-5 text-white">
      <div className="flex items-center gap-2.5 px-2">
        <span className="grid size-9 place-items-center rounded-md bg-accent" aria-hidden="true">
          <ShieldCheck size={19} strokeWidth={2} />
        </span>
        <span className="leading-tight">
          <span className="block font-semibold">ФГИС УПЧ</span>
          <span className="block text-sm text-menu-muted">Аналитика обращений</span>
        </span>
      </div>
      <nav aria-label="Разделы" className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-2.5 py-2.5 font-medium transition-colors ${
                isActive ? 'bg-accent text-white' : 'text-menu-muted hover:bg-white/6 hover:text-white'
              }`
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <p className="mt-auto px-2 text-sm text-menu-muted">Прототип для хакатона. Данные демонстрационные.</p>
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { state } = useDataState()
  const today = state.status === 'ready' ? state.data.meta.today.split('-').reverse().join('.') : null
  return (
    <header className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3">
      <button type="button" onClick={onMenu} className="-ml-1 rounded-sm p-1.5 text-ink lg:hidden" aria-label="Открыть меню">
        <Menu size={22} />
      </button>
      <span className="text-sm text-muted">Период: январь - 20 октября 2026</span>
      {today && <span className="text-sm text-muted">Обновлено {today}</span>}
      <span className="rounded-full border border-bad/25 bg-bad-soft px-2.5 py-0.5 text-xs font-semibold text-bad">
        Демонстрационный режим
      </span>
      <label className="ml-auto hidden w-80 items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-muted focus-within:border-accent md:flex">
        <Search size={16} aria-hidden="true" />
        <input className="w-full bg-transparent text-ink outline-none placeholder:text-muted" placeholder="Регион или номер обращения" aria-label="Поиск по региону или номеру обращения" />
      </label>
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
      <div className="mx-auto my-16 max-w-lg rounded-lg border border-line bg-surface p-6" role="alert">
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
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen lg:block">
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
      <div className="min-w-0 px-4 pb-10 sm:px-8">
        <Topbar onMenu={() => setOpen(true)} />
        <main>
          <DataGate>{children}</DataGate>
        </main>
        <footer className="mt-10 border-t border-line pt-4 text-sm text-muted">
          Все значения демонстрационные и не являются официальной статистикой. Контуры субъектов: © участники OpenStreetMap, ODbL.
        </footer>
      </div>
    </div>
  )
}
