import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DemoData, RegionsGeo } from './types'

// Пути строятся от BASE_URL, чтобы работали и локально, и на GitHub Pages
const url = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(url(file))
  if (!res.ok) throw new Error(`${file}: ответ сервера ${res.status}`)
  return res.json() as Promise<T>
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DemoData; geo: RegionsGeo }

interface Ctx { state: State; retry: () => void }
const DataContext = createContext<Ctx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([getJson<DemoData>('demo.json'), getJson<RegionsGeo>('regions.geo.json')])
      .then(([data, geo]) => alive && setState({ status: 'ready', data, geo }))
      .catch((e: Error) => alive && setState({ status: 'error', message: e.message }))
    return () => { alive = false }
  }, [attempt])

  const retry = useCallback(() => { setState({ status: 'loading' }); setAttempt(a => a + 1) }, [])
  return <DataContext.Provider value={{ state, retry }}>{children}</DataContext.Provider>
}

export function useDataState() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useDataState вне DataProvider')
  return ctx
}

/** Только для компонентов внутри DataGate: данные уже загружены */
export function useData() {
  const { state } = useDataState()
  if (state.status !== 'ready') throw new Error('Данные еще не загружены')
  return { data: state.data, geo: state.geo }
}
