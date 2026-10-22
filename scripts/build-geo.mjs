// Сборка public/data/regions.geo.json из упрощенного GeoJSON (как его получить: README, раздел «Карта»).
// Запуск: node scripts/build-geo.mjs <упрощенный.geojson>
// Проставляет код субъекта по справочнику, проверяет полноту и приводит кольца к порядку d3.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { geoArea } from 'd3-geo';
import { REGIONS } from './regions-ref.mjs';

const src = process.argv[2];
if (!src) { console.error('Укажите путь к упрощенному GeoJSON'); process.exit(1); }

const geo = JSON.parse(readFileSync(src, 'utf8'));
const byOsm = new Map(REGIONS.map(r => [r.osm, r]));
const seen = new Set();

const round = c => typeof c[0] === 'number' ? [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000] : c.map(round);

const features = geo.features.map(f => {
  const ref = byOsm.get(f.properties.name);
  if (!ref) throw new Error(`Нет в справочнике: ${f.properties.name}`);
  if (seen.has(ref.code)) throw new Error(`Повтор: ${ref.code}`);
  seen.add(ref.code);
  const out = { type: 'Feature', properties: { code: ref.code }, geometry: { ...f.geometry, coordinates: round(f.geometry.coordinates) } };
  // d3-geo ждет внешние кольца по часовой стрелке; иначе полигон трактуется как «весь мир минус регион»
  if (geoArea(out) > 2 * Math.PI) {
    const g = out.geometry;
    if (g.type === 'Polygon') g.coordinates.forEach(r => r.reverse());
    else g.coordinates.forEach(p => p.forEach(r => r.reverse()));
  }
  return out;
});

const missing = REGIONS.filter(r => !seen.has(r.code)).map(r => r.name);
if (missing.length) throw new Error(`Нет контура: ${missing.join(', ')}`);

features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/regions.geo.json', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`Готово: ${features.length} субъектов`);
