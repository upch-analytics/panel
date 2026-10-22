import { THRESHOLDS as T } from '../data/rules'

const x = (v: number) => v.toFixed(2).replace(/0$/, '').replace('.', ',')
const pp = (v: number) => `${(v * 100).toFixed(1).replace('.', ',').replace(',0', '')} п.п.`

/** Раскрывающееся пояснение: как считаются отклонения и уровни внимания (те же пороги, что в rules.ts) */
export function Methodology() {
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer font-medium text-accent underline underline-offset-4 hover:text-accent-hover">Как формируются оценки</summary>
      <div className="mt-2 max-w-[75ch] space-y-1.5 text-ink-2">
        <p>Регион сравнивается со средним по России за тот же период и по той же категории прав. Оценивается, только если за период не меньше {T.minRec} обращений, а отклонение статистически устойчиво (z-оценка не меньше {T.minZ}).</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Доля просроченных: средний уровень при превышении в {x(T.overdue.medium)} раза, высокий в {x(T.overdue.high)} раза, разница не меньше {pp(T.overdue.minDiff)}. Считается по обращениям, срок ответа по которым уже наступил.</li>
          <li>Доля повторных: средний уровень при превышении в {x(T.repeat.medium)} раза, высокий в {x(T.repeat.high)} раза, разница не меньше {pp(T.repeat.minDiff)}.</li>
          <li>Доля восстановленных прав: от завершенных дел с установленным нарушением; средний уровень ниже {x(T.restored.medium)} от средней, высокий ниже {x(T.restored.high)}.</li>
          <li>Рост числа обращений сам по себе нарушением не считается: он зависит от населения и доступности Уполномоченного.</li>
        </ul>
      </div>
    </details>
  )
}
