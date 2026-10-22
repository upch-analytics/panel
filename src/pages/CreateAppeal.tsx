import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Phone, Send } from 'lucide-react'
import { useData } from '../data/load'
import { buildAppeal, QUESTIONS, saveCreated, TOPIC_CAT, URGENT, type CreatedAppeal } from '../data/created'
import { ruDate } from '../data/records'
import { PageTitle } from './Common'

// Создание обращения оператором горячей линии по бланку «Форма обращения Уполномоченному по правам человека».
// Четыре шага: заявитель, ситуация, описание, проверка. Каждый вариант ответа оформлен кликабельной плашкой.

const STEPS = ['Заявитель', 'Ситуация', 'Описание', 'Проверка и отправка'] as const

const CONTACTS = ['Телефон', 'Электронная почта', 'Почтовый адрес']
const REPLY = ['По электронной почте', 'По почте', 'Иной способ']
const CLARIFY = ['Да, по телефону', 'Да, по электронной почте', 'Только выбранным способом получения ответа']
const WHO = ['За себя: права заявителя нарушены или затронуты', 'Как представитель другого человека', 'Коллективно: от имени нескольких граждан', 'Другое']
const RELATION = ['Ребенок', 'Супруг или супруга', 'Родитель', 'Другой родственник', 'Подопечный или недееспособный человек', 'Представитель по доверенности', 'Иное']
const COLLECTIVE = ['Заявитель и еще несколько человек, всего не больше 5', 'Группа от 6 до 20 человек', 'Группа от 21 до 99 человек', '100 человек и более', 'Точное количество неизвестно']

/** Плашка-вариант: радиокнопка или флажок, вся площадь кликабельна */
function Tile({ type, name, checked, onChange, children }: { type: 'radio' | 'checkbox'; name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 text-sm transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
      checked ? 'border-accent bg-accent-soft text-ink shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line-strong bg-surface hover:border-faint hover:bg-surface-hover'}`}>
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className={`mt-px grid size-5 shrink-0 place-items-center border ${type === 'radio' ? 'rounded-full' : 'rounded-[5px]'} ${checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface'}`} aria-hidden="true">
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  )
}

function Input({ label, required, error, wide, ...rest }: { label: string; required?: boolean; error?: string; wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium">{label}{required && <span className="text-bad"> *</span>}</span>
      <input {...rest} aria-invalid={!!error} className={`h-10 rounded-full border bg-surface px-4 text-[15px] outline-none focus:border-accent ${error ? 'border-bad' : 'border-line-strong'}`} />
      {error && <span className="text-sm text-bad">{error}</span>}
    </label>
  )
}

function Block({ title, hint, error, children, id }: { title: string; hint?: string; error?: string; children: ReactNode; id?: string }) {
  return (
    <fieldset id={id} className="min-w-0 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left w-full font-semibold">{title}</legend>
      {hint && <p className="clear-left pt-1 text-sm text-muted">{hint}</p>}
      {error && <p className="clear-left pt-1 text-sm font-medium text-bad" role="alert">{error}</p>}
      <div className="clear-left pt-3">{children}</div>
    </fieldset>
  )
}

type Errors = Partial<Record<string, string>>

export function CreateAppeal() {
  const { data } = useData()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState<CreatedAppeal | null>(null)
  const [tried, setTried] = useState<Set<number>>(new Set())

  // Сведения о заявителе: используются только для проверки полноты и в реестр не сохраняются
  const [fio, setFio] = useState('')
  const [birth, setBirth] = useState('')
  const [contacts, setContacts] = useState<string[]>([])
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [region, setRegion] = useState('')
  const [settlement, setSettlement] = useState('')
  const [address, setAddress] = useState({ index: '', street: '', house: '', block: '', flat: '' })
  const [reply, setReply] = useState('')
  const [replyOther, setReplyOther] = useState('')
  const [clarify, setClarify] = useState<string[]>([])
  const [who, setWho] = useState('')
  const [whoOther, setWhoOther] = useState('')
  const [repName, setRepName] = useState('')
  const [relation, setRelation] = useState('')
  const [collective, setCollective] = useState('')

  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [others, setOthers] = useState<Record<string, string>>({})
  const [description, setDescription] = useState('')
  const [catOverride, setCatOverride] = useState('')

  const regions = useMemo(() => [...data.regions].sort((a, b) => a.name.localeCompare(b.name, 'ru')), [data])
  const regionObj = data.regions.find(r => r.code === region)
  const answerText = (id: string) => {
    const q = QUESTIONS.find(x => x.id === id)!
    const i = answers[id]
    if (i === undefined) return ''
    return i === q.options.length ? `Другое: ${others[id] || 'не указано'}` : q.options[i]
  }
  const topicIdx = answers.topic
  const autoCat = topicIdx !== undefined && topicIdx < TOPIC_CAT.length ? TOPIC_CAT[topicIdx] : ''
  const cat = catOverride || autoCat
  const urgent = Object.entries(URGENT).some(([id, idx]) => idx.includes(answers[id]))
  const repeat = answers.before !== undefined && answers.before >= 1 && answers.before <= 4

  const errors = useMemo(() => {
    const e: Errors[] = [{}, {}, {}, {}]
    if (fio.trim().split(/\s+/).length < 2) e[0].fio = 'Укажите фамилию и имя заявителя'
    if (birth && !/^(19|20)\d\d$/.test(birth)) e[0].birth = 'Год рождения: четыре цифры, например 1958'
    if (!contacts.length) e[0].contacts = 'Отметьте хотя бы один способ связи'
    if (contacts.includes('Телефон') && phone.replace(/\D/g, '').length < 10) e[0].phone = 'Укажите телефон: не меньше 10 цифр'
    if (contacts.includes('Электронная почта') && !/^\S+@\S+\.\S+$/.test(email)) e[0].email = 'Укажите адрес электронной почты'
    if (!region) e[0].region = 'Выберите регион'
    if (contacts.includes('Почтовый адрес') && (!settlement.trim() || !address.street.trim() || !address.house.trim())) e[0].address = 'Для ответа по почте укажите населенный пункт, улицу и дом'
    if (!reply) e[0].reply = 'Выберите способ получения ответа'
    if (!who) e[0].who = 'Укажите, от чьего имени обращение'
    if (who === WHO[1] && (!repName.trim() || !relation)) e[0].rep = 'Укажите ФИО человека, чьи права затронуты, и кем он приходится заявителю'
    if (who === WHO[2] && !collective) e[0].collective = 'Укажите количество заявителей'
    for (const id of ['goal', 'topic', 'victims']) if (answers[id] === undefined) e[1][id] = 'Выберите вариант'
    if (description.trim().length < 30) e[2].description = 'Опишите ситуацию подробнее: не меньше 30 символов'
    if (!cat) e[2].cat = 'Выберите категорию прав'
    return e
  }, [fio, birth, contacts, phone, email, region, settlement, address, reply, who, repName, relation, collective, answers, description, cat])
  const stepOk = (i: number) => Object.keys(errors[i]).length === 0
  const err = (i: number, k: string) => (tried.has(i) ? errors[i][k] : undefined)

  const go = (i: number) => { setStep(i); window.scrollTo({ top: 0 }) }
  const next = () => {
    setTried(t => new Set(t).add(step))
    if (stepOk(step)) go(step + 1)
  }
  const submit = () => {
    setTried(new Set([0, 1, 2, 3]))
    const bad = [0, 1, 2].find(i => !stepOk(i))
    if (bad !== undefined) { go(bad); return }
    const whoText = who === WHO[3] ? `Другое: ${whoOther || 'не указано'}` : who === WHO[1] ? `${WHO[1]} (${relation.toLowerCase()})` : who === WHO[2] ? `${WHO[2]} (${collective.toLowerCase()})` : who
    const grp = answers.group === 1 ? 'disabled' : answers.group === 2 ? 'elderly' : answers.place === 5 ? 'remote' : null
    const a = buildAppeal(data, {
      code: region, cat, settlement: settlement.trim(),
      topic: topicIdx !== undefined && topicIdx < TOPIC_CAT.length ? QUESTIONS[1].options[topicIdx].split(',')[0] : `Обращение: ${others.topic || 'иная тема'}`,
      description: description.trim(), urgent, repeat, group: grp, who: whoText,
      answers: QUESTIONS.filter(q => answers[q.id] !== undefined).map(q => ({ q: q.title, a: answerText(q.id) })),
    })
    saveCreated(a)
    setDone(a)
    window.scrollTo({ top: 0 })
  }
  const reset = () => window.location.reload()

  if (done) {
    return (
      <>
        <PageTitle>Обращение зарегистрировано</PageTitle>
        <section className="card max-w-3xl p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={28} className="mt-0.5 shrink-0 text-good" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold">Номер обращения <span className="num">{done.id}</span></p>
              <p className="mt-1 text-muted">Поступило {ruDate(done.received)} через горячую линию. Срок ответа до {ruDate(done.deadline)}. Адресат: {done.addressee}. Обращение добавлено в реестр со статусом «На рассмотрении».</p>
              {done.urgent && <p className="mt-2 font-medium text-bad">Обращение отмечено как срочное: передайте его дежурному специалисту.</p>}
              <p className="mt-2 text-sm text-muted">Демонстрационный режим: обращение сохранено только в этом браузере, персональные данные заявителя не сохраняются.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to={`/appeals/${done.id}`} className="inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">Открыть карточку обращения</Link>
            <Link to={`/appeals?region=${done.code}`} className="inline-flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-5 py-2.5 font-semibold hover:bg-surface-hover">Обращения региона</Link>
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-sm px-5 py-2.5 font-semibold text-accent hover:bg-accent-soft">Создать еще одно</button>
          </div>
        </section>
      </>
    )
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  const grid = 'grid gap-2 sm:grid-cols-2'

  return (
    <>
      <PageTitle sub="Форма обращения Уполномоченному по правам человека: заполняется оператором горячей линии со слов заявителя">Создать обращение</PageTitle>

      <div className="mb-5 flex items-start gap-3 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm">
        <Phone size={18} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
        <p><b className="font-semibold text-bad">Если кому-то грозит опасность прямо сейчас</b>, предложите заявителю позвонить 112. Обращение не заменяет вызов экстренных служб.</p>
      </div>

      <nav aria-label="Шаги заполнения" className="mb-5">
        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((s, i) => {
            const bad = tried.has(i) && !stepOk(i)
            return (
              <li key={s}>
                <button type="button" onClick={() => go(i)} aria-current={step === i ? 'step' : undefined}
                  className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${step === i ? 'border-accent bg-surface shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line bg-surface/70 hover:bg-surface'}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${bad ? 'bg-bad text-white' : step === i ? 'bg-accent text-white' : tried.has(i) ? 'bg-good text-white' : 'bg-bg text-muted'}`}>
                    {bad ? '!' : tried.has(i) && step !== i ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="text-sm font-semibold">{s}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <form onSubmit={e => { e.preventDefault(); if (step < 3) next(); else submit() }} noValidate className="card flex flex-col gap-6 p-5 sm:p-6">
        {step === 0 && (
          <>
            <Block title="Сведения о заявителе" hint="Нужны для регистрации обращения, направления ответа и обратной связи.">
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <Input label="Фамилия, имя, отчество заявителя" required value={fio} onChange={e => setFio(e.target.value)} error={err(0, 'fio')} autoComplete="off" />
                <Input label="Год рождения" inputMode="numeric" maxLength={4} value={birth} onChange={e => setBirth(e.target.value.replace(/\D/g, ''))} error={err(0, 'birth')} />
              </div>
            </Block>
            <Block title="Как связаться с заявителем?" hint="Отметьте все подходящие способы." error={err(0, 'contacts')}>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTACTS.map(c => <Tile key={c} type="checkbox" name="contacts" checked={contacts.includes(c)} onChange={() => toggle(contacts, setContacts, c)}>{c}</Tile>)}
              </div>
              {(contacts.includes('Телефон') || contacts.includes('Электронная почта')) && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {contacts.includes('Телефон') && <Input label="Телефон" required type="tel" value={phone} onChange={e => setPhone(e.target.value)} error={err(0, 'phone')} placeholder="+7" />}
                  {contacts.includes('Электронная почта') && <Input label="Электронная почта" required type="email" value={email} onChange={e => setEmail(e.target.value)} error={err(0, 'email')} />}
                </div>
              )}
            </Block>
            <Block title="Регион и адрес" error={err(0, 'address')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-sm font-medium">Регион<span className="text-bad"> *</span></span>
                  <select className="select h-10" value={region} onChange={e => setRegion(e.target.value)} aria-invalid={!!err(0, 'region')}>
                    <option value="">Выберите регион</option>
                    {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </select>
                  {err(0, 'region') && <span className="text-sm text-bad">{err(0, 'region')}</span>}
                  {regionObj && !regionObj.connected && <span className="text-sm text-mid">УПЧ субъекта не подключен к ФГИС УПЧ: обращение будет адресовано Уполномоченному в РФ.</span>}
                </label>
                <Input label="Город или населенный пункт" value={settlement} onChange={e => setSettlement(e.target.value)} list="munis" />
                <datalist id="munis">{regionObj?.munis.map(m => <option key={m} value={m} />)}</datalist>
              </div>
              {contacts.includes('Почтовый адрес') && (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-[1fr_3fr_1fr_1fr_1fr]">
                  <Input label="Индекс" inputMode="numeric" maxLength={6} value={address.index} onChange={e => setAddress({ ...address, index: e.target.value.replace(/\D/g, '') })} />
                  <Input label="Улица" required value={address.street} onChange={e => setAddress({ ...address, street: e.target.value })} />
                  <Input label="Дом" required value={address.house} onChange={e => setAddress({ ...address, house: e.target.value })} />
                  <Input label="Корпус" value={address.block} onChange={e => setAddress({ ...address, block: e.target.value })} />
                  <Input label="Квартира" value={address.flat} onChange={e => setAddress({ ...address, flat: e.target.value })} />
                </div>
              )}
            </Block>
            <Block title="Предпочтительный способ получения ответа" error={err(0, 'reply')}>
              <div className="grid gap-2 sm:grid-cols-3">
                {REPLY.map(c => <Tile key={c} type="radio" name="reply" checked={reply === c} onChange={() => setReply(c)}>{c}</Tile>)}
              </div>
              {reply === 'Иной способ' && <div className="mt-3 max-w-md"><Input label="Какой способ, если допускается" value={replyOther} onChange={e => setReplyOther(e.target.value)} /></div>}
            </Block>
            <Block title="Можно ли связаться с заявителем для уточнения обстоятельств?">
              <div className="grid gap-2 sm:grid-cols-3">
                {CLARIFY.map(c => <Tile key={c} type="checkbox" name="clarify" checked={clarify.includes(c)} onChange={() => toggle(clarify, setClarify, c)}>{c}</Tile>)}
              </div>
            </Block>
            <Block title="Заявитель обращается" error={err(0, 'who')}>
              <div className={grid}>
                {WHO.map(c => <Tile key={c} type="radio" name="who" checked={who === c} onChange={() => setWho(c)}>{c}</Tile>)}
              </div>
              {who === WHO[3] && <div className="mt-3 max-w-md"><Input label="Уточните" value={whoOther} onChange={e => setWhoOther(e.target.value)} /></div>}
            </Block>
            {who === WHO[1] && (
              <Block title="Обращение за другого человека" error={err(0, 'rep')}>
                <div className="max-w-xl"><Input label="ФИО человека, чьи права затронуты" required value={repName} onChange={e => setRepName(e.target.value)} /></div>
                <p className="mt-4 mb-2 text-sm font-medium">Кем он приходится заявителю</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {RELATION.map(c => <Tile key={c} type="radio" name="relation" checked={relation === c} onChange={() => setRelation(c)}>{c}</Tile>)}
                </div>
              </Block>
            )}
            {who === WHO[2] && (
              <Block title="Количество заявителей" error={err(0, 'collective')}>
                <div className={grid}>
                  {COLLECTIVE.map(c => <Tile key={c} type="radio" name="collective" checked={collective === c} onChange={() => setCollective(c)}>{c}</Tile>)}
                </div>
              </Block>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-muted">Если пострадала группа людей, в вопросах о пострадавших, местонахождении, самочувствии, последствиях и способе общения отвечайте о людях, чьи права затронуты. Обязательны вопросы 1-3.</p>
            {QUESTIONS.map((q, qi) => (
              <Block key={q.id} id={`q-${q.id}`} title={`${qi + 1}. ${q.title}`} hint={q.hint} error={err(1, q.id)}>
                <div className={grid}>
                  {q.options.map((o, oi) => <Tile key={o} type="radio" name={q.id} checked={answers[q.id] === oi} onChange={() => setAnswers({ ...answers, [q.id]: oi })}>{o}</Tile>)}
                  {q.other && <Tile type="radio" name={q.id} checked={answers[q.id] === q.options.length} onChange={() => setAnswers({ ...answers, [q.id]: q.options.length })}>Другое</Tile>}
                </div>
                {q.other && answers[q.id] === q.options.length && <div className="mt-3 max-w-xl"><Input label="Уточните" value={others[q.id] ?? ''} onChange={e => setOthers({ ...others, [q.id]: e.target.value })} /></div>}
              </Block>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            {urgent && (
              <div className="flex items-start gap-3 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-sm" role="status">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
                <p><b className="font-semibold text-bad">Обращение будет отмечено как срочное</b> по ответам о самочувствии и последствиях. Подробно опишите, что именно произошло.</p>
              </div>
            )}
            <Block title="Описание ситуации" hint="Со слов заявителя: что произошло и когда. Если известно, кто отвечает за решение проблемы, укажите это.">
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={9} aria-invalid={!!err(2, 'description')} aria-label="Описание ситуации"
                className={`w-full rounded-md border bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent ${err(2, 'description') ? 'border-bad' : 'border-line-strong'}`} />
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-bad">{err(2, 'description')}</span>
                <span className="text-muted">{description.trim().length} симв.</span>
              </div>
            </Block>
            <Block title="Категория прав" hint={autoCat ? 'Определена по теме обращения. Измените, если ситуация относится к другой категории.' : 'Тема указана как «Другое»: выберите категорию.'} error={err(2, 'cat')}>
              <div className="grid gap-2 sm:grid-cols-4">
                {data.meta.categories.map(c => <Tile key={c.id} type="radio" name="cat" checked={cat === c.id} onChange={() => setCatOverride(c.id)}>{c.name}{autoCat === c.id && <span className="block text-xs text-muted">по теме обращения</span>}</Tile>)}
              </div>
            </Block>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-muted">Проверьте сведения и зарегистрируйте обращение. Нажмите на раздел, чтобы исправить.</p>
            {[
              { i: 0, title: 'Заявитель', rows: [['ФИО', fio], ['Год рождения', birth], ['Связь', [contacts.includes('Телефон') && phone, contacts.includes('Электронная почта') && email, contacts.includes('Почтовый адрес') && 'почтовый адрес'].filter(Boolean).join(', ')], ['Регион', regionObj?.name ?? ''], ['Населенный пункт', settlement], ['Ответ', reply === 'Иной способ' ? replyOther || reply : reply], ['Обращается', who]] },
              { i: 1, title: 'Ситуация', rows: QUESTIONS.map((q, qi) => [`${qi + 1}. ${q.title}`, answerText(q.id)]) },
              { i: 2, title: 'Описание', rows: [['Категория прав', data.meta.categories.find(c => c.id === cat)?.name ?? ''], ['Срочность', urgent ? 'срочное' : 'обычное'], ['Описание', description]] },
            ].map(s => (
              <button key={s.i} type="button" onClick={() => go(s.i)} className="rounded-md border border-line p-4 text-left hover:border-accent hover:bg-surface-hover">
                <span className="flex items-center gap-2 font-semibold">{s.title}{!stepOk(s.i) && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">не заполнено</span>}<span className="ml-auto text-sm font-medium text-accent">Изменить</span></span>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(10rem,18rem)_1fr]">
                  {s.rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 break-words whitespace-pre-line">{v || <span className="text-faint">не указано</span>}</dd></div>)}
                </dl>
              </button>
            ))}
            <p className="text-sm text-muted">В реестр попадут ответы анкеты, описание, регион и категория. ФИО и контакты заявителя в прототипе не сохраняются: в реестре указывается обезличенный номер.</p>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-5 py-2.5 font-semibold hover:bg-surface-hover">
              <ArrowLeft size={17} aria-hidden="true" /> Назад
            </button>
          )}
          {tried.has(step) && !stepOk(step) && <p className="text-sm font-medium text-bad" role="alert">Заполните отмеченные поля</p>}
          {step < 3 ? (
            <button type="submit" className="ml-auto inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">
              Далее: {STEPS[step + 1].toLowerCase()} <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className="ml-auto inline-flex items-center gap-2 rounded-sm bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover">
              <Send size={17} aria-hidden="true" /> Зарегистрировать обращение
            </button>
          )}
        </div>
      </form>
    </>
  )
}
