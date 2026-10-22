import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoConicEqualArea, geoPath, geoCentroid } from 'd3-geo'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { quantile } from 'd3-array'
import { Maximize2, Minus, Plus, Search, ArrowRight, X } from 'lucide-react'
import type { Region, RegionsGeo } from '../data/types'
import { num, pct, rates, type Totals } from '../data/agg'
import { MAP_MODES, type MapMode } from '../data/filters'

// Интерактивная карта субъектов РФ.
// Проекция: коническая равновеликая Альберса, центральный меридиан 100° в.д., Чукотка не разрывается.
// Цвет: 5 классов по квантилям (20/40/60/80%) значений подключенных субъектов, без ручного назначения.

const W = 1000, H = 560
const SCALE = ['var(--color-map-1)', 'var(--color-map-2)', 'var(--color-map-3)', 'var(--color-map-4)', 'var(--color-map-5)']

type ModeDef = { title: string; value: (t: Totals, r: Region) => number; fmt: (v: number) => string; invert: boolean; note?: string }
const MODES: Record<MapMode, ModeDef> = {
  count: { title: 'Обращений на 10 000 жителей', value: (t, r) => (t.rec * 10) / r.pop, fmt: v => v.toFixed(1).replace('.', ','), invert: false, note: 'Число обращений зависит от численности населения и доступности Уполномоченного и не оценивается как хорошее или плохое' },
  overdue: { title: 'Доля просроченных обращений', value: t => rates(t).overShare, fmt: v => pct(v), invert: false },
  repeat: { title: 'Доля повторных обращений', value: t => rates(t).repShare, fmt: v => pct(v), invert: false },
  restored: { title: 'Доля восстановленных прав', value: t => rates(t).restShare, fmt: v => pct(v), invert: true, note: 'Шкала обратная: чем ниже доля, тем насыщеннее цвет' },
}

interface Props {
  geo: RegionsGeo
  regions: Region[]
  values: Map<string, Totals>
  mode: MapMode
  onMode: (m: MapMode) => void
  onOpen: (code: string) => void
  /** субъекты выбранного федерального округа; остальные приглушаются */
  focus?: string[]
}

type Tip = { code: string; x: number; y: number; pinned?: boolean }

export function RussiaMap({ geo, regions, values, mode, onMode, onOpen, focus }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const [hoverClass, setHoverClass] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [box, setBox] = useState({ w: 1000, h: 560 })

  // Размер контейнера для удержания подсказки в пределах карты
  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const byCode = useMemo(() => new Map(regions.map(r => [r.code, r])), [regions])

  const { paths, path } = useMemo(() => {
    const proj = geoConicEqualArea().rotate([-100, 0]).parallels([52, 64]).fitExtent([[10, 10], [W - 10, H - 10]], geo)
    const path = geoPath(proj)
    return { path, paths: geo.features.map(f => ({ code: f.properties.code, d: path(f) ?? '', c: proj(geoCentroid(f)) ?? [0, 0], b: path.bounds(f) })) }
  }, [geo])

  // Значения и классы
  const m = MODES[mode]
  const { cls, edges } = useMemo(() => {
    const val = new Map<string, number>()
    for (const [code, t] of values) {
      const r = byCode.get(code)
      if (!r) continue
      const v = m.value(t, r)
      if (Number.isFinite(v) && t.rec > 0) val.set(code, v)
    }
    const sorted = [...val.values()].sort((a, b) => a - b)
    const th = [0.2, 0.4, 0.6, 0.8].map(q => quantile(sorted, q) ?? 0)
    const cls = new Map<string, number>()
    for (const [code, v] of val) {
      let i = 0
      while (i < th.length && v >= th[i]) i++
      cls.set(code, m.invert ? 4 - i : i)
    }
    const edges = [sorted[0] ?? 0, ...th, sorted[sorted.length - 1] ?? 0]
    return { cls, edges }
  }, [values, byCode, m])

  // Зум: колесо, перетаскивание, кнопки
  useEffect(() => {
    const svg = svgRef.current!
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([[0, 0], [W, H]])
      .on('zoom', e => {
        gRef.current?.setAttribute('transform', e.transform.toString())
        // Пользователь сам двигает карту: подсказка больше не совпадает с регионом
        if (e.sourceEvent) setTip(null)
      })
    zoomRef.current = z
    select(svg).call(z).on('dblclick.zoom', null)
    return () => { select(svg).on('.zoom', null) }
  }, [])

  const zoomBy = (k: number) => select(svgRef.current!).transition().duration(250).call(zoomRef.current!.scaleBy, k)
  const resetZoom = () => { setTip(null); select(svgRef.current!).transition().duration(300).call(zoomRef.current!.transform, zoomIdentity) }
  const zoomTo = useCallback((code: string) => {
    const p = paths.find(x => x.code === code)
    if (!p) return
    const [[x0, y0], [x1, y1]] = p.b
    const k = Math.min(8, 0.6 / Math.max((x1 - x0) / W, (y1 - y0) / H))
    const t = zoomIdentity.translate(W / 2, H / 2).scale(Math.max(1, k)).translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    select(svgRef.current!).transition().duration(450).call(zoomRef.current!.transform, t)
      .on('end', () => {
        const svg = svgRef.current!, wrap = wrapRef.current!
        const pt = svg.createSVGPoint(); pt.x = p.c[0]; pt.y = p.c[1]
        const sp = pt.matrixTransform(gRef.current!.getScreenCTM()!)
        const box = wrap.getBoundingClientRect()
        setTip({ code, x: sp.x - box.left, y: sp.y - box.top, pinned: true })
      })
  }, [paths])

  const showTip = useCallback((code: string, clientX: number, clientY: number) => {
    const box = wrapRef.current!.getBoundingClientRect()
    setTip(t => (t?.pinned && t.code !== code ? t : { code, x: clientX - box.left, y: clientY - box.top }))
  }, [])
  const hideTip = useCallback(() => setTip(t => (t?.pinned ? t : null)), [])

  const fills = useMemo(() => {
    const f = new Map<string, string>()
    for (const p of paths) {
      const r = byCode.get(p.code)
      if (!r?.connected) f.set(p.code, 'url(#hatch-off)')
      else if (!cls.has(p.code)) f.set(p.code, 'var(--color-map-nodata)')
      else f.set(p.code, SCALE[cls.get(p.code)!])
    }
    return f
  }, [paths, byCode, cls])

  const dimmed = useMemo(() => {
    const s = new Set<string>()
    if (focus) for (const p of paths) if (!focus.includes(p.code)) s.add(p.code)
    if (hoverClass != null) for (const p of paths) if (cls.get(p.code) !== hoverClass) s.add(p.code)
    return s
  }, [focus, hoverClass, paths, cls])

  // Поиск региона
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return regions.filter(r => r.name.toLowerCase().includes(q) || r.short.toLowerCase().includes(q)).slice(0, 8)
  }, [query, regions])
  const pick = (code: string) => { setQuery(''); setSearchOpen(false); zoomTo(code) }

  const tipRegion = tip ? byCode.get(tip.code) : null
  const tipTotals = tip ? values.get(tip.code) : null
  const legendLabel = (i: number) => {
    const a = m.invert ? edges[4 - i] : edges[i], b = m.invert ? edges[5 - i] : edges[i + 1]
    return `${m.fmt(a)} - ${m.fmt(b)}`
  }

  return (
    <section aria-labelledby="map-title" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
        <h2 id="map-title" className="font-serif text-2xl font-semibold">Карта субъектов РФ</h2>
        <div role="group" aria-label="Показатель на карте" className="flex flex-wrap rounded-md border border-line bg-bg p-0.5 md:ml-auto">
          {MAP_MODES.map(x => (
            <button key={x.id} type="button" aria-pressed={mode === x.id} onClick={() => { setHoverClass(null); onMode(x.id) }}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${mode === x.id ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'text-muted hover:bg-surface hover:text-ink'}`}>
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative border-y border-line">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none select-none" role="group" aria-label={`Карта субъектов Российской Федерации. Показатель: ${m.title}`}>
          <defs>
            <pattern id="hatch-off" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--color-map-off)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-map-off-hatch)" strokeWidth="2" />
            </pattern>
          </defs>
          <g ref={gRef}>
            <Regions paths={paths} fills={fills} dimmed={dimmed} names={byCode} onEnter={showTip} onLeave={hideTip} onOpen={onOpen} />
            {tip && <path d={path(geo.features.find(f => f.properties.code === tip.code)!) ?? ''} fill="none" stroke="var(--color-ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
          </g>
        </svg>

        {/* Поиск */}
        <div className="absolute top-3 left-3 w-64 max-w-[calc(100%-5rem)]">
          <div className="flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-2.5 shadow-pop focus-within:border-accent">
            <Search size={16} className="shrink-0 text-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setSearchOpen(true); setActive(0) }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, matches.length - 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
                if (e.key === 'Enter' && matches[active]) pick(matches[active].code)
                if (e.key === 'Escape') setSearchOpen(false)
              }}
              role="combobox" aria-expanded={searchOpen && matches.length > 0} aria-controls="map-search-list" aria-autocomplete="list"
              aria-activedescendant={matches[active] ? `opt-${matches[active].code}` : undefined}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted" placeholder="Найти регион на карте" aria-label="Найти регион на карте" />
          </div>
          {searchOpen && matches.length > 0 && (
            <ul id="map-search-list" role="listbox" className="mt-1 overflow-hidden rounded-sm border border-line bg-surface shadow-pop">
              {matches.map((r, i) => (
                <li key={r.code} id={`opt-${r.code}`} role="option" aria-selected={i === active}
                  onMouseDown={e => { e.preventDefault(); pick(r.code) }}
                  className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-accent-soft text-accent' : 'hover:bg-surface-hover'}`}>
                  {r.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Масштаб */}
        <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-sm border border-line-strong bg-surface shadow-pop">
          <button type="button" onClick={() => zoomBy(1.6)} className="grid size-9 place-items-center hover:bg-surface-hover" aria-label="Приблизить"><Plus size={18} /></button>
          <button type="button" onClick={() => zoomBy(1 / 1.6)} className="grid size-9 place-items-center border-t border-line hover:bg-surface-hover" aria-label="Отдалить"><Minus size={18} /></button>
          <button type="button" onClick={resetZoom} className="grid size-9 place-items-center border-t border-line hover:bg-surface-hover" aria-label="Показать всю Россию"><Maximize2 size={16} /></button>
        </div>

        {/* Подсказка */}
        {tip && tipRegion && (
          <div
            className={`absolute z-10 w-64 rounded-md border border-line bg-surface p-3 text-sm shadow-pop ${tip.pinned ? '' : 'pointer-events-none'}`}
            style={{ left: Math.max(4, Math.min(tip.x + 14, box.w - 270)), top: Math.max(4, Math.min(tip.y + 14, box.h - 200)) }}
            role="status"
          >
            <div className="flex items-start gap-2">
              <b className="font-semibold">{tipRegion.name}</b>
              {tip.pinned && <button type="button" onClick={() => setTip(null)} className="ml-auto -mt-1 -mr-1 rounded-sm p-1 text-muted hover:text-ink" aria-label="Закрыть подсказку"><X size={14} /></button>}
            </div>
            {!tipRegion.connected ? (
              <p className="mt-1 text-muted">Нет данных: УПЧ субъекта не подключен к ФГИС УПЧ</p>
            ) : tipTotals && tipTotals.rec > 0 ? (
              <>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                  <dt className="text-muted">Обращений</dt><dd className="text-right">{num(tipTotals.rec)}</dd>
                  <dt className="text-muted">На 10 000 жителей</dt><dd className="text-right">{MODES.count.fmt(MODES.count.value(tipTotals, tipRegion))}</dd>
                  <dt className="text-muted">Просроченные</dt><dd className="text-right">{pct(rates(tipTotals).overShare)}</dd>
                  <dt className="text-muted">Повторные</dt><dd className="text-right">{pct(rates(tipTotals).repShare)}</dd>
                  <dt className="text-muted">Права восстановлены</dt><dd className="text-right">{pct(rates(tipTotals).restShare)}</dd>
                </dl>
                <p className="mt-2 border-t border-line pt-2 text-muted">
                  {m.title}: {cls.has(tip.code) ? `класс ${(cls.get(tip.code)! + 1)} из 5` : 'нет данных'}
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted">Нет данных за выбранный период</p>
            )}
            {tip.pinned && (
              <button type="button" onClick={() => onOpen(tip.code)} className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-hover">
                Аналитика региона <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-5 py-4">
        <div>
          <div className="text-sm text-muted">{m.title}, за период</div>
          <div className="mt-1.5 flex flex-wrap" onMouseLeave={() => setHoverClass(null)}>
            {[0, 1, 2, 3, 4].map(i => (
              <button key={i} type="button" onMouseEnter={() => setHoverClass(i)} onFocus={() => setHoverClass(i)} onBlur={() => setHoverClass(null)}
                className="flex min-w-24 flex-col items-start gap-1 rounded-sm pr-1 text-left" aria-label={`Класс ${i + 1}: ${legendLabel(i)}. Подсветить регионы класса`}>
                <span className="h-3 w-full" style={{ background: SCALE[i] }} />
                <span className="text-sm whitespace-nowrap">{legendLabel(i)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5"><span className="hatch-off inline-block h-3 w-6 rounded-[2px]" />Не подключен к ФГИС</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-6 rounded-[2px] bg-map-nodata" />Нет данных за период</span>
        </div>
        {m.note && <p className="w-full text-sm text-muted">{m.note}</p>}
      </div>
    </section>
  )
}

const Regions = memo(function Regions({ paths, fills, dimmed, names, onEnter, onLeave, onOpen }: {
  paths: { code: string; d: string; c: [number, number] }[]
  fills: Map<string, string>
  dimmed: Set<string>
  names: Map<string, Region>
  onEnter: (code: string, x: number, y: number) => void
  onLeave: () => void
  onOpen: (code: string) => void
}) {
  return (
    <>
      {paths.map(p => (
        <path
          key={p.code}
          d={p.d}
          fill={fills.get(p.code)}
          opacity={dimmed.has(p.code) ? 0.28 : 1}
          stroke="var(--color-surface)"
          strokeWidth={0.7}
          vectorEffect="non-scaling-stroke"
          tabIndex={0}
          role="link"
          aria-label={`${names.get(p.code)?.name ?? ''}. Открыть аналитику региона`}
          className="cursor-pointer outline-none transition-opacity duration-150"
          onMouseMove={e => onEnter(p.code, e.clientX, e.clientY)}
          onMouseLeave={onLeave}
          onFocus={e => { const b = (e.target as SVGPathElement).getBoundingClientRect(); onEnter(p.code, b.left + b.width / 2, b.top + b.height / 2) }}
          onBlur={onLeave}
          onClick={() => onOpen(p.code)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(p.code) } }}
        />
      ))}
    </>
  )
})
