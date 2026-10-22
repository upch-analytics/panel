import { useSyncExternalStore } from 'react'
import type { DemoData } from './types'
import type { Appeal } from './records'

// Обращения, созданные оператором горячей линии через форму «Создать обращение».
// Хранятся только в браузере (localStorage) и добавляются к демонстрационному реестру.
// Персональные данные заявителя (ФИО, контакты, адрес) не сохраняются: в реестре только обезличенный номер.

export interface Question { id: string; title: string; hint?: string; options: string[]; other?: boolean }

/** Вопросы анкеты обращения (бланк «Форма обращения Уполномоченному по правам человека») */
export const QUESTIONS: Question[] = [
  { id: 'goal', title: 'Чего хочет добиться заявитель?', options: ['Предложить, как улучшить работу органов власти', 'Сообщить о проблеме и получить помощь', 'Оспорить отказ, решение или бездействие чиновников', 'Узнать свои права и куда обращаться'] },
  { id: 'topic', title: 'С чем связана ситуация?', hint: 'Если подходит несколько вариантов, выберите главный. Об остальном напишите в описании.', other: true, options: [
    'Личная безопасность, унижение, свобода передвижения, раскрытие личных данных',
    'Работа и зарплата, имущество, свой бизнес, покупки и банки',
    'Пенсии и пособия, жилье, лечение и лекарства, коммунальные услуги, доступность зданий и транспорта',
    'Учеба, культура, творчество и наука, родной язык',
    'Выборы, свобода слова, собрания, участие в общественной жизни',
    'Суд, полиция, следствие, условия содержания под стражей',
  ] },
  { id: 'victims', title: 'Кто пострадал?', options: ['Только заявитель', 'Ребенок заявителя или человек, чьи интересы он представляет', 'Другой человек', 'Заявитель и еще несколько человек, всего не больше 5', 'Группа от 6 до 20 человек', 'Группа от 21 до 99 человек', '100 человек и более'] },
  { id: 'group', title: 'К какой группе относится человек, чьи права нарушены?', hint: 'Если подходит несколько вариантов, выберите тот, что связан с проблемой.', other: true, options: ['Ребенок младше 18 лет', 'Человек с инвалидностью', 'Пожилой человек', 'Участник СВО или член его семьи', 'Представитель коренного малочисленного народа России', 'Не относится к особой группе'] },
  { id: 'place', title: 'Где сейчас находится этот человек?', other: true, options: ['Дома или у родственников', 'В больнице или реабилитационном центре', 'В интернате или доме престарелых', 'В СИЗО, колонии или отделе полиции', 'В воинской части или в зоне СВО', 'У человека нет постоянного жилья', 'По адресу заявителя'] },
  { id: 'health', title: 'Как ситуация сказывается на самочувствии человека?', hint: 'Если выбран один из двух последних вариантов, подробно опишите в описании, что произошло.', other: true, options: ['Никак не сказывается', 'Человек переживает, но здоров', 'Человек остался без нужного лечения, лекарств, тепла или еды', 'Человек уже пострадал, или его состояние ухудшается', 'Человеку причиняют вред прямо сейчас, или его жизнь в опасности'] },
  { id: 'impact', title: 'Что изменилось для человека из-за этой ситуации?', other: true, options: ['Ничего, нужна информация или совет', 'Появились неудобства, но обычная жизнь идет как раньше', 'Человек не получает то, что положено по закону: деньги или услугу', 'Человек лишился жилья, работы, лечения или учебы', 'Человеку отказали в срочной медицинской помощи, его удерживают силой или унижают'] },
  { id: 'when', title: 'Когда наступят последствия, если ничего не изменится?', other: true, options: ['Уже наступают', 'В течение недели', 'В течение месяца', 'Позже, чем через месяц', 'Точной даты нет'] },
  { id: 'before', title: 'Заявитель уже обращался по этому вопросу?', hint: 'Учитываются обращения в любые органы и организации.', other: true, options: ['Нет, впервые', 'Да, ответа пока нет', 'Да, пришел отказ или ответ не помог', 'Да, 2-3 раза, проблема не решена', 'Да, больше трех раз, ничего не изменилось'] },
  { id: 'lang', title: 'Как человеку удобнее общаться?', other: true, options: ['Свободно говорит и пишет по-русски', 'Понимает по-русски с трудом, нужна помощь с переводом', 'Общается только через переводчика (язык жестов, другой язык)', 'Не может сам говорить или писать'] },
]

/** Тема бланка определяет категорию прав (оператор может изменить) */
export const TOPIC_CAT = ['civil', 'economic', 'social', 'cultural', 'political', 'guarantees']

/** Ответы, при которых обращение помечается срочным */
export const URGENT: Record<string, number[]> = { health: [3, 4], impact: [4], when: [0] }

export interface CreatedAppeal extends Appeal {
  created: true
  description: string
  urgent: boolean
  /** Ответы анкеты: вопрос → текст ответа */
  answers: { q: string; a: string }[]
  /** Кто обращается: за себя, представитель, коллективно */
  who: string
}

const KEY = 'upch-created-appeals'
let cache: CreatedAppeal[] | null = null
const subs = new Set<() => void>()

function read(): CreatedAppeal[] {
  if (cache) return cache
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { cache = [] }
  return cache!
}

export function saveCreated(a: CreatedAppeal) {
  cache = [a, ...read()]
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* хранилище недоступно: обращение живет до перезагрузки */ }
  subs.forEach(f => f())
}

export function useCreated(): CreatedAppeal[] {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, read)
}

export const findCreated = (id: string) => read().find(a => a.id === id) ?? null

const addDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10)

export interface NewAppealInput {
  code: string
  cat: string
  topic: string
  settlement: string
  description: string
  urgent: boolean
  repeat: boolean
  group: Appeal['group']
  answers: { q: string; a: string }[]
  who: string
}

export function buildAppeal(data: DemoData, input: NewAppealInput): CreatedAppeal {
  const region = data.regions.find(r => r.code === input.code)!
  const month = data.meta.months.length - 1
  const ym = data.meta.months[month]
  const ci = data.meta.categories.findIndex(c => c.id === input.cat)
  const n = read().length
  const today = data.meta.today
  return {
    id: `${input.code}-${ym.slice(2, 4)}${ym.slice(5, 7)}-${ci + 1}-${String(9001 + n)}`,
    code: input.code, month, cat: input.cat, seq: 9000 + n,
    received: today, deadline: addDays(today, 30), extended: false, doneDate: null,
    status: 'in_work', overdue: false, overdueDays: 0, repeat: input.repeat,
    channel: 'Горячая линия',
    // Если УПЧ субъекта не подключен к системе, обращение адресуется УПЧ в РФ
    addressee: region.connected ? 'УПЧ субъекта' : 'УПЧ в РФ',
    topic: input.topic, organ: 'определяется при рассмотрении', muni: input.settlement || region.munis[0] || region.name,
    executor: 'Не назначен', applicant: `З-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
    group: input.group,
    created: true, description: input.description, urgent: input.urgent, answers: input.answers, who: input.who,
  }
}
