import { Link } from 'react-router-dom'

// Общие элементы страниц: заголовок и страница «не найдено»

export function PageTitle({ children, sub }: { children: string; sub?: string }) {
  return (
    <div className="mt-5 mb-4">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{children}</h1>
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
