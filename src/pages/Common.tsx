import { Link } from 'react-router-dom'

// Общие элементы страниц: заголовок и страница «не найдено»

export function PageTitle({ children, sub, eyebrow, hero }: { children: string; sub?: string; eyebrow?: string; hero?: boolean }) {
  if (hero) {
    // Темная вводная плашка главной: заголовок раздела на фоне мягких пятен акцентного цвета
    return (
      <section className="relative mt-5 mb-5 overflow-hidden rounded-xl bg-menu px-6 py-7 text-white sm:px-9 sm:py-8">
        <div aria-hidden="true" className="absolute -top-28 -right-24 size-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,var(--color-cobalt-300),var(--color-cobalt-600)_45%,var(--color-navy-800)_80%)] opacity-90" />
        <div aria-hidden="true" className="absolute top-24 right-40 size-[180px] rounded-full bg-[radial-gradient(circle_at_40%_40%,var(--color-cobalt-100),var(--color-cobalt-600)_60%)] opacity-50 blur-xl" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-navy-900)_35%,rgb(29_43_69/0.55)_70%,transparent)]" />
        <div className="relative grid max-w-[720px] gap-3">
          {eyebrow && <span className="eyebrow text-cobalt-300">{eyebrow}</span>}
          <h1 className="font-display text-[28px] leading-[1.04] font-medium tracking-[-0.03em] sm:text-[40px]">{children}</h1>
          {sub && <p className="text-menu-muted">{sub}</p>}
        </div>
      </section>
    )
  }
  return (
    <div className="mt-5 mb-4">
      <h1 className="font-display text-4xl font-medium tracking-[-0.03em]">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
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
