import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useDataState } from '../data/load'
import { carry } from '../data/filters'
import { findAppeal } from '../data/records'
import { findCreated } from '../data/created'

// Поиск в верхней панели: субъект по названию или обращение по номеру (например 38-2609-4-0013)

interface Hit { key: string; label: string; hint: string; to: string }

export function GlobalSearch() {
  const { state } = useDataState()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const hits = useMemo<Hit[]>(() => {
    if (state.status !== 'ready') return []
    const term = q.trim().toLowerCase().replace(/^№\s*/, '')
    if (!term) return []
    const out: Hit[] = []
    if (/^\d{2}-\d{4}-\d-\d{1,4}$/.test(term)) {
      const [c, ym, cat, seq] = term.split('-')
      const id = `${c}-${ym}-${cat}-${seq.padStart(4, '0')}`
      const a = findCreated(id) ?? findAppeal(state.data, id)
      out.push(a
        ? { key: id, label: `Обращение № ${id}`, hint: a.topic, to: `/appeals/${id}${carry(params)}` }
        : { key: 'none', label: `Обращение № ${id} не найдено`, hint: 'Проверьте номер', to: '' })
    }
    for (const r of state.data.regions) {
      if (out.length >= 8) break
      if (r.name.toLowerCase().includes(term) || r.short.toLowerCase().includes(term) || r.code === term)
        out.push({ key: r.code, label: r.name, hint: r.connected ? `Код ${r.code}` : 'Нет данных', to: `/region/${r.code}${carry(params)}` })
    }
    return out
  }, [q, state, params])

  const go = (h?: Hit) => { if (!h?.to) return; setQ(''); setOpen(false); navigate(h.to) }

  return (
    <div className="relative order-last w-full md:order-none md:ml-auto md:w-80">
      <label className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 text-muted focus-within:border-accent">
        <Search size={16} aria-hidden="true" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            if (e.key === 'Enter') go(hits[active])
            if (e.key === 'Escape') setOpen(false)
          }}
          role="combobox" aria-expanded={open && hits.length > 0} aria-controls="global-search-list" aria-autocomplete="list"
          aria-activedescendant={hits[active] ? `gs-${hits[active].key}` : undefined}
          className="h-9 w-full bg-transparent text-ink outline-none placeholder:text-muted"
          placeholder="Регион или номер обращения" aria-label="Поиск по региону или номеру обращения" />
      </label>
      {open && hits.length > 0 && (
        <ul id="global-search-list" role="listbox" className="absolute right-0 left-0 z-30 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-pop">
          {hits.map((h, i) => (
            <li key={h.key} id={`gs-${h.key}`} role="option" aria-selected={i === active} aria-disabled={!h.to}
              onMouseDown={e => { e.preventDefault(); go(h) }}
              className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-accent-soft' : 'hover:bg-surface-hover'} ${h.to ? '' : 'cursor-default'}`}>
              <span className={`block text-sm font-medium ${i === active ? 'text-accent' : ''}`}>{h.label}</span>
              <span className="block truncate text-sm text-muted">{h.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
