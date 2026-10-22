// Общая карта для набросков этапа 1. Данные демонстрационные, детерминированные.
// Контуры: OpenStreetMap (ODbL) через timurkanaz/Russia_geojson_OSM + Nominatim для 4 новых субъектов.

(function () {
  const NOT_CONNECTED = ['Ненецкий АО', 'Республика Тыва', 'Херсонская обл.', 'Еврейская АО'];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }

  // Демонстрационные значения по региону
  function demo(name) {
    const r = hash(name), r2 = hash(name + 'x'), r3 = hash(name + 'y');
    const per10k = 3 + r * 9;
    const overdue = 1.8 + Math.pow(r2, 1.6) * 8.5;
    const repeat = 7 + r3 * 13;
    const restored = 8 + hash(name + 'z') * 19;
    const count = Math.round(200 + per10k * 40 + hash(name + 'c') * 1400);
    return { per10k, overdue, repeat, restored, count };
  }

  const MODES = {
    count:    { label: 'Обращений на 10 000 жителей', get: d => d.per10k, fmt: v => v.toFixed(1).replace('.', ','), invert: false },
    overdue:  { label: 'Доля просроченных, %',        get: d => d.overdue, fmt: v => v.toFixed(1).replace('.', ',') + '%', invert: false },
    repeat:   { label: 'Доля повторных, %',           get: d => d.repeat, fmt: v => v.toFixed(1).replace('.', ',') + '%', invert: false },
    restored: { label: 'Права восстановлены, %',      get: d => d.restored, fmt: v => v.toFixed(1).replace('.', ',') + '%', invert: true },
  };

  // d3 ждет внешние кольца по часовой стрелке; при обратном порядке площадь > полусферы
  function rewind(f) {
    if (d3.geoArea(f) > 2 * Math.PI) {
      const g = f.geometry;
      if (g.type === 'Polygon') g.coordinates.forEach(r => r.reverse());
      else g.coordinates.forEach(p => p.forEach(r => r.reverse()));
    }
    return f;
  }

  window.UPCHMap = async function (opts) {
    const { svgEl, legendEl, tipEl, scale, noData = '#C9CCD2', hatch = '#9AA1AB', stroke = '#FFFFFF', hoverStroke = '#1E2733', initialMode = 'overdue', onSelect } = opts;
    const geo = await fetch('regions.geojson').then(r => r.json());
    geo.features.forEach(rewind);
    geo.features.forEach(f => { f.d = NOT_CONNECTED.includes(f.properties.name) ? null : demo(f.properties.name); });

    const svg = d3.select(svgEl);
    const W = svgEl.clientWidth || 900, H = svgEl.clientHeight || 520;
    svg.attr('viewBox', `0 0 ${W} ${H}`);

    const defs = svg.append('defs');
    const pat = defs.append('pattern').attr('id', 'nc-' + svgEl.id).attr('width', 6).attr('height', 6)
      .attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)');
    pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', noData);
    pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', hatch).attr('stroke-width', 2);

    const proj = d3.geoConicEqualArea().rotate([-100, 0]).parallels([52, 64]).fitExtent([[8, 8], [W - 8, H - 8]], geo);
    const path = d3.geoPath(proj);
    const g = svg.append('g');
    const paths = g.selectAll('path').data(geo.features).join('path')
      .attr('d', path).attr('stroke', stroke).attr('stroke-width', 0.6).attr('vector-effect', 'non-scaling-stroke')
      .attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', f => f.properties.name)
      .style('cursor', 'pointer');

    const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    let mode = initialMode, colorOf, thresholds;

    function classOf(v) { let i = 0; while (i < thresholds.length && v >= thresholds[i]) i++; return i; }

    function render() {
      const m = MODES[mode];
      const vals = geo.features.filter(f => f.d).map(f => m.get(f.d)).sort(d3.ascending);
      thresholds = [0.2, 0.4, 0.6, 0.8].map(q => d3.quantile(vals, q));
      const cols = m.invert ? scale.slice().reverse() : scale;
      colorOf = f => f.d ? cols[classOf(m.get(f.d))] : `url(#nc-${svgEl.id})`;
      paths.transition().duration(250).attr('fill', colorOf);
      if (legendEl) {
        const edges = [vals[0], ...thresholds, vals[vals.length - 1]];
        legendEl.innerHTML =
          `<div class="lg-title">${m.label}${m.invert ? ' <span class="lg-note">чем ниже, тем темнее</span>' : ''}</div>` +
          `<div class="lg-row">` + cols.map((c, i) =>
            `<div class="lg-cell"><span class="lg-sw" style="background:${c}"></span><span class="lg-lab">${m.fmt(edges[i])} - ${m.fmt(edges[i + 1])}</span></div>`).join('') +
          `<div class="lg-cell"><span class="lg-sw lg-nd"></span><span class="lg-lab">Нет данных</span></div></div>`;
      }
    }

    paths.on('mouseenter focus', function (e, f) {
      d3.select(this).raise().attr('stroke', hoverStroke).attr('stroke-width', 1.8);
      if (!tipEl) return;
      const d = f.d, m = MODES[mode];
      const cls = d ? `класс ${classOf(m.get(d)) + 1} из 5` : '';
      tipEl.innerHTML = d
        ? `<b>${f.properties.name}</b><dl>
            <dt>Обращений</dt><dd>${d.count.toLocaleString('ru-RU')}</dd>
            <dt>Просрочено</dt><dd>${MODES.overdue.fmt(d.overdue)}</dd>
            <dt>Повторные</dt><dd>${MODES.repeat.fmt(d.repeat)}</dd>
            <dt>Права восстановлены</dt><dd>${MODES.restored.fmt(d.restored)}</dd></dl>
            <div class="tip-cls">${m.label}: ${cls}</div>`
        : `<b>${f.properties.name}</b><div class="tip-cls">Нет данных: УПЧ субъекта не подключен к ФГИС</div>`;
      tipEl.hidden = false;
    }).on('mousemove', function (e) {
      if (!tipEl) return;
      const box = tipEl.parentElement.getBoundingClientRect();
      let x = e.clientX - box.left + 14, y = e.clientY - box.top + 14;
      if (x + 240 > box.width) x -= 260;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    }).on('mouseleave blur', function () {
      d3.select(this).attr('stroke', stroke).attr('stroke-width', 0.6);
      if (tipEl) tipEl.hidden = true;
    }).on('click', (e, f) => onSelect && onSelect(f.properties.name));

    render();
    return {
      setMode(m) { mode = m; render(); },
      zoomBy(k) { svg.transition().duration(200).call(zoom.scaleBy, k); },
      reset() { svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity); },
    };
  };
})();
