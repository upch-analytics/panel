import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { CheckCircle2, X } from 'lucide-react'

// Уведомление о демонстрационном действии (напомнить, продлить срок)

const Ctx = createContext<(text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null)
  const { pathname } = useLocation()
  // Уведомление относится к действию на текущей странице: при переходе оно закрывается
  useEffect(() => { setText(null) }, [pathname])
  const show = useCallback((t: string) => {
    setText(t)
    window.setTimeout(() => setText(cur => (cur === t ? null : cur)), 5000)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
        {text && (
          <div className="pointer-events-auto flex items-start gap-3 rounded-md border border-line bg-surface p-4 shadow-pop">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-good" aria-hidden="true" />
            <p className="text-sm">{text}</p>
            <button type="button" onClick={() => setText(null)} className="-m-1 rounded-sm p-1 text-muted hover:text-ink" aria-label="Закрыть уведомление"><X size={16} /></button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
