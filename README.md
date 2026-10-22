# Аналитическая панель ФГИС УПЧ

Интерактивный прототип аналитической панели обращений граждан для сотрудников аппаратов
Уполномоченных по правам человека. Проект хакатона, кейс Аппарата Уполномоченного по правам
человека в Российской Федерации.

**Сайт:** https://upch-analytics.github.io/panel/

> Все данные демонстрационные, сгенерированы скриптом и не являются официальной статистикой.

## Локальный запуск

```bash
npm install
npm run dev
```

Откроется http://localhost:5173/panel/

Сборка: `npm run build` (результат в `dist/`).

## Публикация

При каждом push в ветку `main` GitHub Actions собирает проект и публикует его на GitHub Pages
(`.github/workflows/deploy.yml`). В настройках репозитория: Settings → Pages → Source: GitHub Actions.

## Демонстрационные данные

Набор генерируется детерминированно (фиксированный seed), поэтому у всех одинаковые цифры:

```bash
npm run data
```

Скрипт `scripts/generate-data.mjs` пишет `public/data/demo.json`. Описание модели данных в `CLAUDE.md`.
Список субъектов, население и коды берутся из `scripts/regions-ref.mjs`.
Численность населения округлена и используется только для расчета на 10 000 жителей.

## Карта

Контуры 89 субъектов РФ лежат в `public/data/regions.geo.json` и не загружаются со сторонних сайтов.

**Источник:** данные © участники OpenStreetMap, лицензия
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

- 85 субъектов: набор [timurkanaz/Russia_geojson_OSM](https://github.com/timurkanaz/Russia_geojson_OSM),
  файл `GeoJson's/Countries/Russia_regions.geojson` (выгрузка из OSM, admin_level 4).
- Донецкая Народная Республика, Луганская Народная Республика, Запорожская и Херсонская области:
  границы административных единиц из OSM через Nominatim (relation 71973, 71971, 71980, 71022).

Сборка: файлы объединены, контуры упрощены [mapshaper](https://github.com/mbloch/mapshaper)
(`-simplify 1.5% keep-shapes weighted -clean`), затем `npm run build:geo -- <файл>` проставляет
коды субъектов по справочнику и проверяет, что найдены все 89.

Проекция: коническая равновеликая Альберса с центральным меридианом 100° в.д.
