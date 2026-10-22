// Генерация демонстрационного набора: public/data/demo.json.
// Запуск: npm run data. Seed фиксирован, поэтому при каждом запуске результат одинаковый.
// Все значения тестовые и не являются официальной статистикой.
//
// Нижний уровень: ячейка «субъект × месяц × категория прав» с метриками:
//   rec  поступило
//   over просрочено (срок рассмотрения 30 дней нарушен)
//   done рассмотрено (завершено)
//   viol завершено с установленным нарушением прав
//   rest права восстановлены (подмножество viol)
//   rep  повторные (по ранее заявленной проблеме)
// Национальные и окружные значения в интерфейсе получаются суммированием ячеек.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { REGIONS, DISTRICTS } from './regions-ref.mjs';

// Муниципальные образования (OpenStreetMap, admin_level 6; для 4 новых субъектов список задан вручную).
// Первым идет административный центр.
const MUNIS = JSON.parse(readFileSync(new URL('./municipalities.json', import.meta.url), 'utf8'));

const SEED = 'upch-2026';
const TODAY = '2026-10-20';
const FIRST_YEAR = 2023;
const LAST_MONTH = { y: 2026, m: 10 }; // октябрь 2026, неполный: по 20 число
const PARTIAL = 20 / 31;

// Субъекты, где УПЧ субъекта не подключен к ФГИС: на карте «Нет данных»
const NOT_CONNECTED = ['83', '17', '79', '95'];

export const CATEGORIES = [
  { id: 'civil', name: 'Гражданские права', share: 0.24 },
  { id: 'political', name: 'Политические права', share: 0.05 },
  { id: 'economic', name: 'Экономические права', share: 0.12 },
  { id: 'social', name: 'Социальные права', share: 0.22 },
  { id: 'housing', name: 'Жилищные права', share: 0.16 },
  { id: 'cultural', name: 'Культурные права', share: 0.03 },
  { id: 'guarantees', name: 'Гарантии прав', share: 0.18 },
];
// Относительная частота просрочек и восстановления прав по категориям
const CAT_OVER = { civil: 1.0, political: 0.8, economic: 1.1, social: 1.15, housing: 1.3, cultural: 0.7, guarantees: 0.9 };
const CAT_REST = { civil: 0.95, political: 0.7, economic: 1.0, social: 1.15, housing: 0.85, cultural: 1.0, guarantees: 1.05 };

// Сезонность по месяцам (январь ниже, весна и осень выше)
const SEASON = [0.74, 0.93, 1.08, 1.07, 0.95, 0.98, 0.94, 0.88, 1.04, 1.12, 1.15, 1.12];
const YEAR_TREND = { 2023: 0.9, 2024: 0.96, 2025: 1.0, 2026: 1.035 };

// Регионы для сравнительного анализа проекта получают выраженный профиль
const PROFILES = {
  '38': { over: 2.4, rep: 1.15, rest: 0.92, housingGrowth: 1.35 },     // Иркутская: просрочки, рост жилищных
  '24': { over: 1.25, rep: 1.55, rest: 0.95, socialGrowth: 1.3 },       // Красноярский край: повторные
  '87': { over: 1.1, rep: 1.2, rest: 0.6, rate: 4.5 },                   // Чукотка: мало восстановленных, высокая обращаемость
  '05': { over: 1.8, rep: 1.1, rest: 0.85 },
  '64': { over: 1.6, rep: 1.0, rest: 0.95 },
  '14': { over: 1.3, rep: 1.35, rest: 0.8 },
  '47': { over: 0.6, rep: 0.9, rest: 1.2 },
  '16': { over: 0.55, rep: 0.85, rest: 1.25 },
  '78': { over: 0.8, rep: 1.0, rest: 1.15, rate: 1.25 },
  '77': { over: 0.9, rep: 1.05, rest: 1.1, rate: 1.3 },
};

// PRNG: mulberry32 от хэша ключа, чтобы каждая ячейка не зависела от порядка обхода
function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function rng(key) {
  let a = hash(SEED + ':' + key);
  const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // Прогрев: первые значения для близких ключей хуже перемешаны
  for (let i = 0; i < 8; i++) next();
  return next;
}
// Целое число с ожиданием mean: округление со случайной дробью
const draw = (r, mean) => { const f = Math.floor(mean); return f + (r() < mean - f ? 1 : 0); };
// Биномиальное приближение: сколько из n попадет в долю p
const part = (r, n, p) => { let k = 0; const q = Math.min(Math.max(p, 0), 1); if (n < 40) { for (let i = 0; i < n; i++) if (r() < q) k++; return k; } return Math.min(n, Math.max(0, Math.round(n * q + (r() - 0.5) * 2 * Math.sqrt(n * q * (1 - q))))); };

const months = [];
for (let y = FIRST_YEAR; y <= LAST_MONTH.y; y++) for (let m = 1; m <= 12; m++) {
  if (y === LAST_MONTH.y && m > LAST_MONTH.m) break;
  months.push(`${y}-${String(m).padStart(2, '0')}`);
}

const regions = REGIONS.map(ref => {
  const r = rng('region:' + ref.code);
  const p = PROFILES[ref.code] || {};
  const connected = !NOT_CONNECTED.includes(ref.code);
  // Обращений на 10 000 жителей в год: 3-11, логнормально
  const rate = (4.2 * Math.exp((r() - 0.5) * 0.9)) * (p.rate || 1);
  // У регионов с профилем отклонение задано профилем, у остальных небольшой случайный разброс
  const jitter = (w) => (Object.keys(p).length ? 1 + (r() - 0.5) * 0.08 : Math.exp((r() - 0.5) * w));
  const overBase = 0.04 * jitter(0.3) * (p.over || 1);
  const repBase = 0.105 * jitter(0.24) * (p.rep || 1);
  const violBase = 0.36 + (r() - 0.5) * 0.12;
  const restBase = 0.5 * jitter(0.2) * (p.rest || 1);
  const trend = 1 + (r() - 0.5) * 0.08; // собственная динамика региона за год
  // Структура по категориям: базовые доли с региональным отклонением
  const catW = CATEGORIES.map(c => c.share * Math.exp((r() - 0.5) * 0.5));
  const sumW = catW.reduce((a, b) => a + b, 0);
  const executors = Math.max(3, Math.round(ref.pop / 140 + r() * 3));
  const groups = { elderly: 0.18 + r() * 0.12, disabled: 0.08 + r() * 0.07, remote: ['87', '14', '83', '89', '49', '41', '24'].includes(ref.code) ? 0.2 + r() * 0.15 : 0.03 + r() * 0.06, large: 0.04 + r() * 0.04 };
  return { ref, connected, rate, overBase, repBase, violBase, restBase, trend, catShare: catW.map(w => w / sumW), executors, groups, p };
});

const NM = 6; // метрик в ячейке
const cube = {};
for (const R of regions) {
  if (!R.connected) continue;
  const arr = [];
  // Один поток случайных чисел на субъект, ячейки обходятся в фиксированном порядке
  const r = rng(`cells:${R.ref.code}`);
  months.forEach((ym, mi) => {
    const [y, m] = ym.split('-').map(Number);
    const isPartial = y === LAST_MONTH.y && m === LAST_MONTH.m;
    // Сколько месяцев до сегодняшней даты: свежие обращения еще на рассмотрении
    const age = (LAST_MONTH.y - y) * 12 + (LAST_MONTH.m - m);
    const doneShare = age >= 3 ? 0.995 : age === 2 ? 0.97 : age === 1 ? 0.82 : 0.38;
    const yearsFrom2025 = y - 2025 + (m - 6.5) / 12;
    const growth = YEAR_TREND[y] * Math.pow(R.trend, yearsFrom2025);
    const monthly = R.ref.pop / 10 * R.rate / 12 * SEASON[m - 1] * growth * (isPartial ? PARTIAL : 1);
    CATEGORIES.forEach((c, ci) => {
      let catMul = 1;
      if (c.id === 'housing' && R.p.housingGrowth && y === 2026) catMul = R.p.housingGrowth;
      if (c.id === 'social' && R.p.socialGrowth && y === 2026) catMul = R.p.socialGrowth;
      const rec = draw(r, monthly * R.catShare[ci] * catMul * (0.85 + r() * 0.3));
      const yearOver = y === 2026 ? 1.08 : y === 2025 ? 1.0 : 0.95;
      // Срок 30 дней: в текущем месяце просрочек еще нет, в прошлом только у поступивших до 20 числа
      const over = part(r, rec, R.overBase * CAT_OVER[c.id] * yearOver * (age === 0 ? 0 : age === 1 ? 0.65 : 1));
      const done = part(r, rec, doneShare);
      const viol = part(r, done, R.violBase);
      const yearRest = y === 2026 ? 1.03 : 1.0;
      const rest = part(r, viol, R.restBase * CAT_REST[c.id] * yearRest);
      const repMul = (c.id === 'social' && R.p.socialGrowth && y === 2026) ? 1.25 : 1;
      const rep = part(r, rec, R.repBase * repMul);
      arr.push(rec, over, done, viol, rest, rep);
    });
  });
  cube[R.ref.code] = arr;
}

// Оценка обращений из неподключенных субъектов, которые не попали в систему (для метрики охвата)
const notRegisteredEstimate = regions.filter(R => !R.connected)
  .reduce((s, R) => s + R.ref.pop / 10 * 4.2 * YEAR_TREND[2026] * (9 + PARTIAL) / 12, 0);

const out = {
  meta: {
    demo: true,
    note: 'Демонстрационные данные. Не являются официальной статистикой.',
    seed: SEED,
    today: TODAY,
    months,
    partialMonth: months[months.length - 1],
    partialFraction: PARTIAL,
    metrics: ['rec', 'over', 'done', 'viol', 'rest', 'rep'],
    categories: CATEGORIES.map(({ id, name }) => ({ id, name })),
    districts: DISTRICTS,
    responseDays: 30,
    notRegisteredEstimate2026: Math.round(notRegisteredEstimate),
  },
  regions: regions.map(R => ({
    code: R.ref.code, iso: R.ref.iso, name: R.ref.name, short: R.ref.short, district: R.ref.district, pop: R.ref.pop,
    connected: R.connected, executors: R.executors, munis: MUNIS[R.ref.code] ?? [],
    groups: Object.fromEntries(Object.entries(R.groups).map(([k, v]) => [k, Math.round(v * 1000) / 1000])),
  })),
  cube,
};

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/demo.json', JSON.stringify(out));

// Контрольная сводка
const idx = (mi, ci, k) => (mi * CATEGORIES.length + ci) * NM + k;
const sum = (filter, k) => Object.values(cube).reduce((s, a) => s + months.reduce((t, ym, mi) => filter(ym) ? t + CATEGORIES.reduce((u, _, ci) => u + a[idx(mi, ci, k)], 0) : t, 0), 0);
const cur = ym => ym >= '2026-01';
const prev = ym => ym >= '2025-01' && ym <= '2025-10';
const rec = sum(cur, 0), recPrev = sum(prev, 0);
console.log(`Субъектов: ${regions.length}, подключено: ${regions.filter(r => r.connected).length}, месяцев: ${months.length}`);
console.log(`2026 (по 20.10): поступило ${rec}, 2025 (янв-окт): ${recPrev}, просрочено ${(sum(cur, 1) / rec * 100).toFixed(1)}%, повторные ${(sum(cur, 5) / rec * 100).toFixed(1)}%, права восстановлены ${(sum(cur, 4) / sum(cur, 3) * 100).toFixed(1)}%`);
