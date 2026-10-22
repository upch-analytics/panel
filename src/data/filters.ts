import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PERIOD, parsePeriod, periodRange, type Period } from './period'
import { useData } from './load'
import type { Filter } from './agg'

// Состояние фильтров хранится в адресе страницы: ссылку можно отправить коллеге.
// p: период, cat: категория прав, fd: федеральный округ, map: режим карты, status: статус обращения

export type MapMode = 'count' | 'overdue' | 'repeat' | 'restored'
export const MAP_MODES: { id: MapMode; label: string }[] = [
  { id: 'count', label: 'Количество обращений' },
  { id: 'overdue', label: 'Просроченные' },
  { id: 'repeat', label: 'Повторные' },
  { id: 'restored', label: 'Восстановленные права' },
]

export function useFilters() {
  const [params, setParams] = useSearchParams()
  const { data } = useData()

  const period = useMemo(() => parsePeriod(params.get('p')), [params])
  const cat = params.get('cat')
  const fd = params.get('fd')
  const mode = (MAP_MODES.some(m => m.id === params.get('map')) ? params.get('map') : 'overdue') as MapMode

  const set = useCallback((patch: Record<string, string | null>) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      // Любой фильтр, кроме самой страницы, возвращает список на первую страницу
      if (!('page' in patch)) next.delete('page')
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || (k === 'p' && v === DEFAULT_PERIOD)) next.delete(k)
        else next.set(k, v)
      }
      return next
    }, { replace: true })
  }, [setParams])

  const reset = useCallback(() => set({ p: null, cat: null, fd: null, status: null, region: null, q: null, page: null }), [set])

  const range = useMemo(() => periodRange(data, period), [data, period])
  const codes = useMemo(() => (fd ? data.regions.filter(r => r.district === fd && r.connected).map(r => r.code) : undefined), [data, fd])

  const filter: Filter | null = range ? { range, cats: cat ? [cat] : undefined, codes } : null

  return { params, period, cat, fd, mode, set, reset, range, filter, codes }
}

/** Строка параметров для ссылок на другие разделы с теми же фильтрами */
export function carry(params: URLSearchParams, extra: Record<string, string> = {}): string {
  const next = new URLSearchParams()
  for (const k of ['p', 'cat', 'fd']) { const v = params.get(k); if (v) next.set(k, v) }
  for (const [k, v] of Object.entries(extra)) next.set(k, v)
  const s = next.toString()
  return s ? `?${s}` : ''
}

export type { Period }
