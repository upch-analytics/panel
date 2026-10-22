import type { DemoData, Region } from './types'
import type { MonthRange } from './agg'

// Карточки обращений строятся детерминированно из ячеек куба «субъект × месяц × категория».
// В каждой ячейке ровно столько поступивших, просроченных, рассмотренных, повторных и
// восстановленных, сколько в demo.json, поэтому список всегда сходится с показателями.
// Персональных данных нет: заявитель обозначен обезличенным номером.

export type Status = 'in_work' | 'overdue' | 'answered' | 'violation' | 'restored'

export const STATUS: Record<Status, { label: string; short: string; cls: string }> = {
  in_work: { label: 'На рассмотрении', short: 'На рассмотрении', cls: 'bg-accent-soft text-accent' },
  overdue: { label: 'Просрочено', short: 'Просрочено', cls: 'bg-bad-soft text-bad' },
  answered: { label: 'Рассмотрено, даны разъяснения', short: 'Даны разъяснения', cls: 'bg-bg text-ink-2' },
  violation: { label: 'Рассмотрено, нарушение подтверждено', short: 'Нарушение подтверждено', cls: 'bg-bg text-ink-2' },
  restored: { label: 'Права восстановлены', short: 'Права восстановлены', cls: 'bg-good-soft text-good' },
}

export const CHANNELS = ['Электронная форма', 'Почтовое отправление', 'Личный прием', 'Аудиообращение', 'Видеообращение'] as const
const CHANNEL_W = [0.52, 0.2, 0.17, 0.07, 0.04]

const TOPICS: Record<string, { topic: string; organ: string }[]> = {
  civil: [
    { topic: 'Жалоба на действия сотрудников полиции', organ: 'управление МВД' },
    { topic: 'Неисполнение судебного решения', organ: 'управление ФССП' },
    { topic: 'Условия содержания в учреждении уголовно-исполнительной системы', organ: 'управление ФСИН' },
    { topic: 'Нарушение права на справедливое разбирательство', organ: 'прокуратуру субъекта' },
  ],
  political: [
    { topic: 'Ограничение права на публичное мероприятие', organ: 'администрацию муниципального образования' },
    { topic: 'Нарушение избирательных прав', organ: 'избирательную комиссию субъекта' },
    { topic: 'Отказ в регистрации общественного объединения', organ: 'управление Минюста' },
  ],
  economic: [
    { topic: 'Задержка выплаты заработной платы', organ: 'государственную инспекцию труда' },
    { topic: 'Незаконное увольнение', organ: 'государственную инспекцию труда' },
    { topic: 'Нарушение прав при проверке предпринимателя', organ: 'прокуратуру субъекта' },
  ],
  social: [
    { topic: 'Отказ в назначении пенсии', organ: 'отделение Социального фонда' },
    { topic: 'Невыплата пособия на ребенка', organ: 'отделение Социального фонда' },
    { topic: 'Недоступность медицинской помощи', organ: 'министерство здравоохранения субъекта' },
    { topic: 'Обеспечение лекарственными препаратами', organ: 'министерство здравоохранения субъекта' },
    { topic: 'Реабилитация лиц с инвалидностью', organ: 'бюро медико-социальной экспертизы' },
  ],
  housing: [
    { topic: 'Переселение из аварийного жилья', organ: 'администрацию муниципального образования' },
    { topic: 'Качество коммунальных услуг', organ: 'государственную жилищную инспекцию' },
    { topic: 'Отказ в постановке на учет нуждающихся в жилье', organ: 'администрацию муниципального образования' },
    { topic: 'Обеспечение жильем детей-сирот', organ: 'министерство социальной защиты субъекта' },
  ],
  cultural: [
    { topic: 'Доступ к объектам культуры', organ: 'министерство культуры субъекта' },
    { topic: 'Обучение на родном языке', organ: 'министерство образования субъекта' },
    { topic: 'Сохранение объекта культурного наследия', organ: 'службу по охране объектов культурного наследия' },
  ],
  guarantees: [
    { topic: 'Отказ в бесплатной юридической помощи', organ: 'управление Минюста' },
    { topic: 'Отсутствие ответа на обращение в орган власти', organ: 'администрацию муниципального образования' },
    { topic: 'Неисполнение решения органа власти', organ: 'прокуратуру субъекта' },
  ],
}

const SURNAMES = ['Иванова', 'Смирнов', 'Кузнецова', 'Попов', 'Васильева', 'Петров', 'Соколова', 'Михайлов', 'Новикова', 'Федоров', 'Морозова', 'Волков', 'Алексеева', 'Лебедев', 'Семенова', 'Егоров', 'Павлова', 'Козлов', 'Степанова', 'Николаев']
const INITIALS = ['А. С.', 'Е. В.', 'И. П.', 'М. А.', 'О. Н.', 'Д. В.', 'Т. Г.', 'С. М.', 'Н. И.', 'В. А.']

export interface Appeal {
  id: string
  code: string
  month: number
  cat: string
  seq: number
  received: string
  deadline: string
  extended: boolean
  doneDate: string | null
  status: Status
  overdue: boolean
  overdueDays: number
  repeat: boolean
  channel: (typeof CHANNELS)[number] | 'Горячая линия'
  addressee: 'УПЧ в РФ' | 'УПЧ субъекта'
  topic: string
  organ: string
  muni: string
  executor: string
  applicant: string
  group: 'elderly' | 'disabled' | 'remote' | 'large' | null
}

// PRNG с прогревом (как в генераторе данных)
function hash(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}
export function rng(key: string) {
  let a = hash('upch-records:' + key)
  const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  for (let i = 0; i < 8; i++) next()
  return next
}
const pickW = <T,>(r: () => number, items: readonly T[], w: number[]) => { let x = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < items.length; i++) { x -= w[i]; if (x <= 0) return items[i] } return items[items.length - 1] }
function shuffle(n: number, r: () => number) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

const DAY = 86400000
const toDate = (s: string) => new Date(s + 'T00:00:00Z').getTime()
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10)
export const ruDate = (s: string) => s.split('-').reverse().join('.')
export const daysBetween = (a: string, b: string) => Math.round((toDate(b) - toDate(a)) / DAY)

/** Вес муниципалитета: административный центр, затем города, затем районы */
export function muniWeights(r: Region) {
  return r.munis.map((n, i) => (i === 0 ? 30 : /район|улус|кожуун/.test(n) ? 1.2 : 4) * (1 + ((hash(r.code + n) % 100) / 100)))
}

export const appealId = (code: string, ym: string, catIdx: number, seq: number) => `${code}-${ym.slice(2, 4)}${ym.slice(5, 7)}-${catIdx + 1}-${String(seq + 1).padStart(4, '0')}`

export function parseId(data: DemoData, id: string): { code: string; month: number; cat: number; seq: number } | null {
  const m = id.match(/^(\d{2})-(\d{2})(\d{2})-(\d)-(\d{4})$/)
  if (!m) return null
  const month = data.meta.months.indexOf(`20${m[2]}-${m[3]}`)
  const cat = Number(m[4]) - 1
  if (month < 0 || cat < 0 || cat >= data.meta.categories.length || !data.cube[m[1]]) return null
  return { code: m[1], month, cat, seq: Number(m[5]) - 1 }
}

const cache = new Map<string, Appeal[]>()

/** Все обращения одной ячейки */
export function cellAppeals(data: DemoData, region: Region, mi: number, ci: number): Appeal[] {
  const key = `${region.code}:${mi}:${ci}`
  const hit = cache.get(key)
  if (hit) return hit
  const nc = data.meta.categories.length
  const arr = data.cube[region.code]
  if (!arr) return []
  const base = (mi * nc + ci) * 6
  const [rec, over, done, viol, rest, rep] = arr.slice(base, base + 6)
  const r = rng(key)
  const ym = data.meta.months[mi]
  const today = data.meta.today
  const isPartial = ym === data.meta.partialMonth
  const dim = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()
  const lastDay = isPartial ? Number(today.slice(8, 10)) : dim

  // Дни поступления; просроченные поступили не позже чем за 31 день до сегодня
  const latest = toDate(today) - 31 * DAY
  const days = Array.from({ length: rec }, () => 1 + Math.floor(r() * lastDay))
  // Рассмотрены в первую очередь поступившие раньше; остальные подмножества случайные, но фиксированные
  const pDone = shuffle(rec, r).sort((x, y) => days[x] - days[y])
  const doneSet = new Set(pDone.slice(0, done))
  const violList = pDone.slice(0, done).slice(0, viol)
  const violSet = new Set(violList)
  const restSet = new Set(violList.slice(0, rest))
  // Просроченные: в первую очередь нерассмотренные, затем рассмотренные с нарушением срока
  const pOver = shuffle(rec, r).sort((a, b) => Number(doneSet.has(a)) - Number(doneSet.has(b)))
  const overSet = new Set(pOver.slice(0, over))
  const repSet = new Set(shuffle(rec, r).slice(0, rep))

  const cat = data.meta.categories[ci].id
  const topics = TOPICS[cat]
  const mw = muniWeights(region)
  const out: Appeal[] = []
  const order = days.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d || a.i - b.i)
  order.forEach(({ i }, seq) => {
    let recv = toDate(`${ym}-${String(days[i]).padStart(2, '0')}`)
    const isOver = overSet.has(i), isDone = doneSet.has(i)
    if (isOver && recv > latest) recv = Math.max(toDate(`${ym}-01`), latest - Math.floor(r() * 10) * DAY)
    const received = fmt(recv)
    let deadline = recv + 30 * DAY
    let extended = false
    let doneT: number | null = null
    if (isDone) {
      doneT = isOver ? deadline + (1 + Math.floor(r() * 35)) * DAY : recv + (4 + Math.floor(r() * 26)) * DAY
      doneT = Math.min(doneT, toDate(today))
      if (!isOver && doneT > deadline) doneT = deadline
    } else if (!isOver && deadline < toDate(today)) {
      // Срок истек, но обращение не просрочено: срок рассмотрения продлен
      deadline += 30 * DAY; extended = true
      if (deadline < toDate(today)) deadline = toDate(today) + (3 + Math.floor(r() * 20)) * DAY
    }
    const overdueDays = isOver ? Math.max(1, Math.round(((doneT ?? toDate(today)) - deadline) / DAY)) : 0
    const status: Status = !isDone ? (isOver ? 'overdue' : 'in_work') : restSet.has(i) ? 'restored' : violSet.has(i) ? 'violation' : 'answered'
    const t = topics[Math.floor(r() * topics.length)]
    const g = r()
    out.push({
      id: appealId(region.code, ym, ci, seq),
      code: region.code, month: mi, cat, seq, received,
      deadline: fmt(deadline), extended,
      doneDate: doneT ? fmt(doneT) : null,
      status, overdue: isOver, overdueDays, repeat: repSet.has(i),
      channel: pickW(r, CHANNELS, CHANNEL_W),
      addressee: r() < 0.32 ? 'УПЧ в РФ' : 'УПЧ субъекта',
      topic: t.topic, organ: t.organ,
      muni: pickW(r, region.munis.length ? region.munis : [region.short], region.munis.length ? mw : [1]),
      executor: `${SURNAMES[(hash(region.code) + Math.floor(r() * region.executors)) % SURNAMES.length]} ${INITIALS[Math.floor(r() * INITIALS.length)]}`,
      applicant: `З-${String(hash(`${key}:${i}`) % 1000000).padStart(6, '0')}`,
      group: g < region.groups.elderly ? 'elderly' : g < region.groups.elderly + region.groups.disabled ? 'disabled' : g < region.groups.elderly + region.groups.disabled + region.groups.remote ? 'remote' : null,
    })
  })
  cache.set(key, out)
  return out
}

export interface Scope { range: MonthRange; codes?: string[]; cats?: string[] }

/** Обращения в заданных границах (субъекты, месяцы, категории) */
export function scopeAppeals(data: DemoData, s: Scope): Appeal[] {
  const out: Appeal[] = []
  const codes = s.codes ?? Object.keys(data.cube)
  const byCode = new Map(data.regions.map(r => [r.code, r]))
  data.meta.categories.forEach((c, ci) => {
    if (s.cats?.length && !s.cats.includes(c.id)) return
    for (const code of codes) {
      const region = byCode.get(code)
      if (!region?.connected) continue
      for (let m = s.range.from; m <= s.range.to; m++) for (const a of cellAppeals(data, region, m, ci)) out.push(a)
    }
  })
  return out
}

export function findAppeal(data: DemoData, id: string): Appeal | null {
  const p = parseId(data, id)
  if (!p) return null
  const region = data.regions.find(r => r.code === p.code)!
  return cellAppeals(data, region, p.month, p.cat)[p.seq] ?? null
}

/** Ранее поданные обращения того же заявителя по той же проблеме (для повторных) */
export function relatedAppeals(data: DemoData, a: Appeal): Appeal[] {
  if (!a.repeat) return []
  const r = rng(`rel:${a.id}`)
  const region = data.regions.find(x => x.code === a.code)!
  const ci = data.meta.categories.findIndex(c => c.id === a.cat)
  const out: Appeal[] = []
  const n = 1 + Math.floor(r() * 2)
  for (let k = 0; k < n; k++) {
    const m = a.month - 2 - Math.floor(r() * 10) - k * 3
    if (m < 0) break
    const cell = cellAppeals(data, region, m, ci).filter(x => x.status !== 'in_work' && x.status !== 'overdue')
    if (cell.length) out.push(cell[Math.floor(r() * cell.length)])
  }
  return out
}

export interface TimelineEvent { date: string; text: string; tone?: 'good' | 'bad' }

export function timeline(a: Appeal, today: string): TimelineEvent[] {
  const r = rng(`tl:${a.id}`)
  const add = (d: number) => fmt(toDate(a.received) + d * DAY)
  const ev: TimelineEvent[] = [
    { date: a.received, text: `Поступило: ${a.channel.toLowerCase()}` },
    { date: add(1), text: `Зарегистрировано, адресат: ${a.addressee}` },
    { date: add(2), text: `Назначен исполнитель: ${a.executor}` },
    { date: add(4 + Math.floor(r() * 3)), text: `Направлен запрос в ${a.organ}` },
    { date: add(15 + Math.floor(r() * 8)), text: `Поступил ответ на запрос в ${a.organ}` },
  ]
  if (a.extended) ev.push({ date: add(29), text: 'Срок рассмотрения продлен на 30 дней' })
  if (a.overdue) ev.push({ date: add(31), text: 'Нарушен срок рассмотрения', tone: 'bad' })
  if (a.doneDate) {
    const text = a.status === 'restored' ? 'Рассмотрено: нарушенные права восстановлены' : a.status === 'violation' ? 'Рассмотрено: нарушение подтверждено, направлены рекомендации' : 'Рассмотрено: заявителю даны разъяснения'
    ev.push({ date: a.doneDate, text, tone: a.status === 'restored' ? 'good' : undefined })
  }
  return ev.filter(e => e.date <= (a.doneDate ?? today)).sort((x, y) => x.date.localeCompare(y.date))
}

export function documents(a: Appeal): string[] {
  const r = rng(`doc:${a.id}`)
  const docs = ['Обращение заявителя.pdf']
  if (r() < 0.6) docs.push('Копия ответа органа власти.pdf')
  if (r() < 0.35) docs.push('Фотоматериалы.zip')
  if (a.channel === 'Аудиообращение') docs.push('Аудиозапись обращения.mp3')
  if (a.channel === 'Видеообращение') docs.push('Видеозапись обращения.mp4')
  if (a.doneDate) docs.push('Ответ заявителю.pdf')
  return docs
}

export function summary(a: Appeal): string {
  const r = rng(`sum:${a.id}`)
  // Тема уже в заголовке карточки, поэтому суть описывает обстоятельства, а не повторяет тему
  const lead = [
    `Заявитель (${a.muni}) сообщает, что обращался в ${a.organ}, но вопрос не решен.`,
    `Заявитель (${a.muni}) указывает, что ${a.organ.startsWith('администрац') ? 'администрация' : 'орган власти'} не дал ответа по существу.`,
    `Заявитель (${a.muni}) считает, что его права нарушены, и прикладывает документы.`,
  ][Math.floor(r() * 3)]
  const ask = ['Просит оказать содействие в восстановлении нарушенных прав.', 'Просит провести проверку и принять меры.', 'Просит разъяснить порядок защиты своих прав.'][Math.floor(r() * 3)]
  return `${lead} ${a.repeat ? 'Ранее заявитель уже обращался по этому вопросу. ' : ''}${ask}`
}

export function result(a: Appeal): string {
  switch (a.status) {
    case 'restored': return `По итогам рассмотрения и обращения в ${a.organ} нарушенные права заявителя восстановлены.`
    case 'violation': return `Нарушение прав подтверждено. В ${a.organ} направлено заключение с рекомендациями, исполнение на контроле.`
    case 'answered': return 'Нарушение прав не установлено. Заявителю даны разъяснения о способах защиты прав.'
    case 'overdue': return `Рассмотрение не завершено, срок нарушен на ${a.overdueDays} дн.`
    default: return 'Рассмотрение продолжается.'
  }
}
