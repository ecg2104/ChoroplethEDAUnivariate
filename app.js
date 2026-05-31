// ============================================================
//  app.js  —  Visualization engine
//  Do not edit unless you are modifying the tool itself.
// ============================================================

import {
  DATA_FILE, GEOGRAPHY_LABEL, FEATURE_ID_FIELD,
  FEATURE_NAME_FIELD, FEATURE_GROUP_FIELD,
  VARIABLES, DEFAULT_VARIABLE, DEFAULT_CLASSIFICATION,
  DEFAULT_BUCKETS, DEFAULT_SCHEME,
  NULL_COLOR, SELECTION_COLOR, DEEMPHASIS_OPACITY,
} from './config.js';

// ============================================================
//  COLORBREWER PALETTE CATALOGUE
//  All discrete arrays sourced from D3's built-in scheme
//  objects — Cynthia Brewer's hand-tuned values.
// ============================================================

const PALETTE_SCHEMES = {
  sequential: [
    { id: 'YlOrRd',  d3: 'schemeYlOrRd'  },
    { id: 'YlOrBr',  d3: 'schemeYlOrBr'  },
    { id: 'YlGnBu',  d3: 'schemeYlGnBu'  },
    { id: 'YlGn',    d3: 'schemeYlGn'    },
    { id: 'Reds',    d3: 'schemeReds'    },
    { id: 'RdPu',    d3: 'schemeRdPu'    },
    { id: 'Purples', d3: 'schemePurples' },
    { id: 'PuRd',    d3: 'schemePuRd'    },
    { id: 'PuBuGn',  d3: 'schemePuBuGn'  },
    { id: 'PuBu',    d3: 'schemePuBu'    },
    { id: 'OrRd',    d3: 'schemeOrRd'    },
    { id: 'Oranges', d3: 'schemeOranges' },
    { id: 'Greys',   d3: 'schemeGreys'   },
    { id: 'Greens',  d3: 'schemeGreens'  },
    { id: 'GnBu',    d3: 'schemeGnBu'    },
    { id: 'BuPu',    d3: 'schemeBuPu'    },
    { id: 'BuGn',    d3: 'schemeBuGn'    },
    { id: 'Blues',   d3: 'schemeBlues'   },
  ],
  diverging: [
    { id: 'Spectral', d3: 'schemeSpectral' },
    { id: 'RdYlGn',   d3: 'schemeRdYlGn'  },
    { id: 'RdYlBu',   d3: 'schemeRdYlBu'  },
    { id: 'RdGy',     d3: 'schemeRdGy'    },
    { id: 'RdBu',     d3: 'schemeRdBu'    },
    { id: 'PuOr',     d3: 'schemePuOr'    },
    { id: 'PRGn',     d3: 'schemePRGn'    },
    { id: 'PiYG',     d3: 'schemePiYG'    },
    { id: 'BrBG',     d3: 'schemeBrBG'    },
  ],
};

const ALL_SCHEMES = [...PALETTE_SCHEMES.sequential, ...PALETTE_SCHEMES.diverging];

function findScheme(id) {
  return ALL_SCHEMES.find(s => s.id === id);
}

function brewerColors(schemeId, k) {
  const entry = findScheme(schemeId);
  if (!entry) return d3.schemeBlues[k] || d3.schemeBlues[5];
  const arr = d3[entry.d3];
  if (!arr) return d3.schemeBlues[k] || d3.schemeBlues[5];
  const available = Object.keys(arr).map(Number).filter(n => !isNaN(n));
  if (!available.length) return d3.schemeBlues[5];
  const clamped = Math.min(Math.max(k, Math.min(...available)), Math.max(...available));
  return arr[clamped];
}

// ============================================================
//  STATE
// ============================================================

const state = {
  geojson:        null,
  currentVar:     DEFAULT_VARIABLE,
  classification: DEFAULT_CLASSIFICATION,
  buckets:        DEFAULT_BUCKETS,
  scheme:         DEFAULT_SCHEME,
  selectedIds:    new Set(),
  histRange:      null,
  mode:           null,    // 'map' | 'hist' | null
  dropdownOpen:   false,
};

// ============================================================
//  CLASSIFICATION
// ============================================================

function classifyQuantile(values, k) {
  const sorted = [...values].sort(d3.ascending);
  const breaks = [];
  for (let i = 1; i < k; i++) breaks.push(d3.quantile(sorted, i / k));
  return [sorted[0], ...breaks, sorted[sorted.length - 1]];
}

function classifyEqual(values, k) {
  const lo = d3.min(values), hi = d3.max(values);
  const step = (hi - lo) / k;
  return d3.range(0, k + 1).map(i => lo + i * step);
}

function getBreaks(values, k, scheme) {
  if (scheme === 'equal') return classifyEqual(values, k);
  return classifyQuantile(values, k);   // default: quantile
}

function makeColorScale(schemeId, breaks, k) {
  const colors = brewerColors(schemeId, k);
  return d3.scaleThreshold()
    .domain(breaks.slice(1, breaks.length - 1))
    .range(colors);
}

// ============================================================
//  HELPERS
// ============================================================

function getVarDef()        { return VARIABLES.find(v => v.id === state.currentVar) || VARIABLES[0]; }
function featureId(f)       { return f.properties[FEATURE_ID_FIELD]; }
function getFeatureValue(f) {
  const vd = getVarDef();
  const v  = f.properties[vd.prop];
  return (v == null || v === vd.nullVal) ? null : v;
}
function getValues(features) {
  const vd = getVarDef();
  return features.map(f => f.properties[vd.prop]).filter(v => v != null && v !== vd.nullVal);
}

// ============================================================
//  MAP
// ============================================================

let mapSvg, mapG, projection, pathGen, mapBrushG, zoomBehavior, currentTransform;

function initMap() {
  mapSvg    = d3.select('#mapSvg');
  // zoomG wraps everything that should scale/pan together
  const zoomG = mapSvg.append('g').attr('class', 'zoom-root');
  mapG      = zoomG.append('g').attr('class', 'tracts');
  mapBrushG = zoomG.append('g').attr('class', 'map-brush');
  currentTransform = d3.zoomIdentity;
}

function resizeMap() {
  const el = document.getElementById('mapPane');
  const w = el.clientWidth, h = el.clientHeight;
  mapSvg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
  projection = d3.geoMercator().fitSize([w, h], state.geojson);
  pathGen    = d3.geoPath().projection(projection);
  setupZoom(w, h);
}

function setupZoom(w, h) {
  zoomBehavior = d3.zoom()
    .scaleExtent([0.5, 32])
    .translateExtent([[-w, -h], [2 * w, 2 * h]])
    .filter(event => {
      // Allow wheel always; allow drag only when Shift is NOT held
      // (Shift+drag = brush selection)
      if (event.type === 'wheel') return true;
      if (event.type === 'mousedown') return !event.shiftKey;
      return false;
    })
    .on('zoom', event => {
      currentTransform = event.transform;
      mapSvg.select('.zoom-root').attr('transform', event.transform);
    });

  mapSvg.call(zoomBehavior);
  // Don't let double-click zoom (interferes with selection)
  mapSvg.on('dblclick.zoom', null);
}

function zoomBy(factor) {
  mapSvg.transition().duration(280).call(zoomBehavior.scaleBy, factor);
}

function zoomReset() {
  mapSvg.transition().duration(380)
    .call(zoomBehavior.transform, d3.zoomIdentity);
}

function drawTracts() {
  const allVals    = getValues(state.geojson.features);
  const breaks     = getBreaks(allVals, state.buckets, state.classification);
  const colorScale = makeColorScale(state.scheme, breaks, state.buckets);

  mapG.selectAll('.tract')
    .data(state.geojson.features, featureId)
    .join('path')
    .attr('class', 'tract')
    .attr('d', pathGen)
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.3)
    .on('mousemove', onTractHover)
    .on('mouseleave', hideTooltip);

  applyTractColors(colorScale);
  drawLegend(colorScale, breaks);
}

function applyTractColors(colorScale) {
  if (!colorScale) {
    const allVals = getValues(state.geojson.features);
    const breaks  = getBreaks(allVals, state.buckets, state.classification);
    colorScale    = makeColorScale(state.scheme, breaks, state.buckets);
  }
  const hasMapSel  = state.selectedIds.size > 0 && state.mode === 'map';
  const hasHistSel = state.histRange !== null    && state.mode === 'hist';

  mapG.selectAll('.tract')
    .attr('fill', d => {
      const v  = getFeatureValue(d);
      if (v == null) return NULL_COLOR;
      const id = featureId(d);
      if (hasMapSel)  return state.selectedIds.has(id) ? colorScale(v) : NULL_COLOR;
      if (hasHistSel) return (v >= state.histRange[0] && v <= state.histRange[1]) ? colorScale(v) : NULL_COLOR;
      return colorScale(v);
    })
    .attr('opacity', d => {
      const id = featureId(d);
      if (hasMapSel)  return state.selectedIds.has(id) ? 1 : DEEMPHASIS_OPACITY;
      if (hasHistSel) {
        const v = getFeatureValue(d);
        return (v != null && v >= state.histRange[0] && v <= state.histRange[1]) ? 1 : DEEMPHASIS_OPACITY;
      }
      return 1;
    });
}



// ============================================================
//  LASSO & RECTANGLE SELECTION
//  Shift+drag        = freehand lasso
//  Shift+Alt+drag    = rectangle
//  Both test centroid containment in projection (zoom-root) coords.
// ============================================================

let selDrag = null;   // active drag state: { mode, points, startX, startY }

function setupMapBrush() {
  // Remove any previous listeners on the SVG selection layer
  mapBrushG.selectAll('*').remove();
  mapBrushG.append('path').attr('class', 'sel-path');   // lasso / rect outline
  mapBrushG.append('rect').attr('class', 'sel-rect')    // rect fill during drag
    .attr('fill', 'rgba(80,120,255,0.06)')
    .attr('stroke', 'none')
    .style('display', 'none');

  // Listen on the SVG itself so zoom panning and lasso don't fight
  mapSvg
    .on('mousedown.sel', onSelMouseDown)
    .on('mousemove.sel', onSelMouseMove)
    .on('mouseup.sel',   onSelMouseUp);
}

function svgPoint(event) {
  // Convert screen coords → zoom-root local coords
  const el   = document.getElementById('mapPane');
  const rect = el.getBoundingClientRect();
  const sx   = event.clientX - rect.left;
  const sy   = event.clientY - rect.top;
  const t    = currentTransform || d3.zoomIdentity;
  return [(sx - t.x) / t.k, (sy - t.y) / t.k];
}

function onSelMouseDown(event) {
  if (!event.shiftKey) return;
  event.preventDefault();
  event.stopPropagation();
  const mode = event.altKey ? 'rect' : 'lasso';
  const pt   = svgPoint(event);
  selDrag = { mode, points: [pt], startX: pt[0], startY: pt[1] };
  showSelMode(mode);
}

function onSelMouseMove(event) {
  if (!selDrag) return;
  event.preventDefault();
  const pt = svgPoint(event);
  selDrag.points.push(pt);

  if (selDrag.mode === 'lasso') {
    const closed = [...selDrag.points, selDrag.points[0]];
    const d = 'M' + closed.map(p => p.join(',')).join('L') + 'Z';
    mapBrushG.select('.sel-path')
      .attr('d', d)
      .attr('fill', 'rgba(80,120,255,0.08)')
      .attr('stroke', '#4466cc')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3')
      .attr('stroke-linejoin', 'round');
  } else {
    // rectangle
    const x0 = Math.min(selDrag.startX, pt[0]);
    const y0 = Math.min(selDrag.startY, pt[1]);
    const w  = Math.abs(pt[0] - selDrag.startX);
    const h  = Math.abs(pt[1] - selDrag.startY);
    mapBrushG.select('.sel-rect')
      .style('display', null)
      .attr('x', x0).attr('y', y0).attr('width', w).attr('height', h);
    mapBrushG.select('.sel-path')
      .attr('d', `M${x0},${y0}h${w}v${h}h${-w}Z`)
      .attr('fill', 'none')
      .attr('stroke', '#4466cc')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3');
  }
}

function onSelMouseUp(event) {
  if (!selDrag) return;
  const drag = selDrag;
  selDrag = null;
  hideSelMode();

  const poly = drag.mode === 'lasso'
    ? drag.points
    : (() => {
        const pt  = svgPoint(event);
        const x0  = Math.min(drag.startX, pt[0]);
        const y0  = Math.min(drag.startY, pt[1]);
        const x1  = Math.max(drag.startX, pt[0]);
        const y1  = Math.max(drag.startY, pt[1]);
        return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
      })();

  // Need at least a minimal shape
  if (poly.length < 3) {
    clearSelPath();
    return;
  }

  state.selectedIds.clear();
  state.histRange = null;
  state.mode = 'map';

  state.geojson.features.forEach(f => {
    const c = pathGen.centroid(f);
    if (!isNaN(c[0]) && d3.polygonContains(poly, c))
      state.selectedIds.add(featureId(f));
  });

  // Flash the closed shape briefly, then clear
  const pathEl = mapBrushG.select('.sel-path')
    .attr('stroke-dasharray', null)
    .attr('fill', 'rgba(80,120,255,0.10)');
  mapBrushG.select('.sel-rect').style('display', 'none');

  setTimeout(clearSelPath, 600);

  showClearBtn(state.selectedIds.size > 0);
  applyTractColors();
  drawHistogram();
  updateStatusBar();
  emitSelectionChange();
}

function clearSelPath() {
  mapBrushG.select('.sel-path').attr('d', null).attr('fill', 'none');
  mapBrushG.select('.sel-rect').style('display', 'none');
}

function showSelMode(mode) {
  const el = document.getElementById('selModeIndicator');
  el.textContent = mode === 'lasso' ? '⟡ Lasso' : '⬜ Rectangle';
  el.style.opacity = '1';
}

function hideSelMode() {
  const el = document.getElementById('selModeIndicator');
  el.style.opacity = '0';
}


// ============================================================
//  TOOLTIP
// ============================================================

function onTractHover(event, d) {
  const p    = d.properties;
  const vd   = getVarDef();
  const val  = getFeatureValue(d);
  const tip  = document.getElementById('tooltip');
  const group = FEATURE_GROUP_FIELD ? p[FEATURE_GROUP_FIELD] : null;
  const name  = p[FEATURE_NAME_FIELD] || '';
  tip.style.display = 'block';
  tip.style.left = (event.clientX + 14) + 'px';
  tip.style.top  = (event.clientY - 36) + 'px';
  tip.innerHTML =
    `${group ? `<span class="tip-group">${group}</span> · ` : ''}<span class="tip-id">${name}</span><br>` +
    `<span class="tip-label">${vd.label}</span><br>` +
    `<span class="tip-val">${val != null ? vd.fmt(val) : 'No data'}</span>`;
}
function hideTooltip() { document.getElementById('tooltip').style.display = 'none'; }

// ============================================================
//  LEGEND
// ============================================================

function drawLegend(colorScale, breaks) {
  const vd = getVarDef();
  document.getElementById('legendTitle').textContent = vd.label;
  const container = document.getElementById('legendSwatches');
  container.innerHTML = '';
  const k = state.buckets;
  const colors = colorScale.range();
  for (let i = 0; i < k; i++) {
    const lo = breaks[i], hi = breaks[i + 1];
    const label = i === k - 1 ? `${fmtBreak(lo)} +` : `${fmtBreak(lo)} – ${fmtBreak(hi)}`;
    const row = document.createElement('div');
    row.className = 'legend-row';
    row.innerHTML =
      `<span class="legend-swatch" style="background:${colors[i]}"></span>` +
      `<span class="legend-label">${label}</span>`;
    container.appendChild(row);
  }
  const nullRow = document.createElement('div');
  nullRow.className = 'legend-row';
  nullRow.innerHTML =
    `<span class="legend-swatch" style="background:${NULL_COLOR}"></span>` +
    `<span class="legend-label" style="color:#bbb">No data</span>`;
  container.appendChild(nullRow);
}

function fmtBreak(v) {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}

// ============================================================
//  COLOR SCHEME DROPDOWN
// ============================================================

function buildDropdown() {
  const inner = document.getElementById('colorDropdownInner');
  inner.innerHTML = '';

  ['sequential', 'diverging'].forEach(family => {
    const header = document.createElement('div');
    header.className = 'dd-family-label';
    header.textContent = family === 'sequential' ? 'Sequential' : 'Diverging';
    inner.appendChild(header);

    PALETTE_SCHEMES[family].forEach(scheme => {
      const row = document.createElement('div');
      row.className = 'dd-row' + (scheme.id === state.scheme ? ' dd-row--active' : '');
      row.dataset.schemeId = scheme.id;

      const k = Math.min(Math.max(state.buckets, 3), 9);
      const colors = brewerColors(scheme.id, k);
      colors.forEach(c => {
        const s = document.createElement('span');
        s.className = 'dd-swatch';
        s.style.background = c;
        row.appendChild(s);
      });

      row.addEventListener('click', () => {
        onSchemeChange(scheme.id);
        closeDropdown();
      });
      inner.appendChild(row);
    });
  });

  updateDivergeWarning();
}

function refreshDropdownSwatches() {
  const k = Math.min(Math.max(state.buckets, 3), 9);
  document.querySelectorAll('.dd-row').forEach(row => {
    const id = row.dataset.schemeId;
    const colors = brewerColors(id, k);
    row.innerHTML = '';
    colors.forEach(c => {
      const s = document.createElement('span');
      s.className = 'dd-swatch';
      s.style.background = c;
      row.appendChild(s);
    });
    row.classList.toggle('dd-row--active', id === state.scheme);
  });
}

function updateColorBtn() {
  // Refresh the mini swatch strip on the toolbar button
  const wrap = document.getElementById('colorBtnSwatches');
  wrap.innerHTML = '';
  const k = Math.min(Math.max(state.buckets, 3), 9);
  const colors = brewerColors(state.scheme, k);
  colors.forEach(c => {
    const s = document.createElement('span');
    s.className = 'btn-swatch';
    s.style.background = c;
    wrap.appendChild(s);
  });
}

function updateDivergeWarning() {
  const vd          = getVarDef();
  const isDiverging = PALETTE_SCHEMES.diverging.some(s => s.id === state.scheme);
  document.getElementById('divergeWarning').style.display =
    (isDiverging && !vd.diverge) ? 'block' : 'none';
}

function openDropdown() {
  // Position dropdown below the colorBtn
  const btn  = document.getElementById('colorBtn');
  const dd   = document.getElementById('colorDropdown');
  const rect = btn.getBoundingClientRect();
  const toolbarRect = document.getElementById('toolbar').getBoundingClientRect();
  dd.style.left = (rect.left - toolbarRect.left) + 'px';
  dd.classList.add('open');
  document.getElementById('colorBtn').classList.add('open');
  state.dropdownOpen = true;
}

function closeDropdown() {
  document.getElementById('colorDropdown').classList.remove('open');
  document.getElementById('colorBtn').classList.remove('open');
  state.dropdownOpen = false;
}

function toggleDropdown() {
  state.dropdownOpen ? closeDropdown() : openDropdown();
}

// ============================================================
//  HISTOGRAM
// ============================================================

const HIST_BINS = 30;
const HM = { top: 24, right: 14, bottom: 44, left: 48 };
let histSvg, histG, histW, histH, xScale, yScale;

function initHistogram() {
  histSvg = d3.select('#histSvg');
  recalcHistDims();
  histG = histSvg.append('g').attr('transform', `translate(${HM.left},${HM.top})`);
  histG.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${histH})`);
  histG.append('g').attr('class', 'y-axis');
  histG.append('text').attr('class', 'x-axis-label')
    .attr('text-anchor', 'middle').attr('y', histH + 38)
    .style('font-size', '11px').style('fill', '#888');

  histG.append('text').attr('class', 'y-axis-label')
    .attr('text-anchor', 'middle')
    .attr('transform', `rotate(-90)`)
    .attr('x', -histH / 2)
    .attr('y', -HM.left + 12)
    .style('font-size', '10px')
    .style('fill', '#aaa')
    .text('tracts');

  setupHistBrush();
}

function recalcHistDims() {
  const el = document.getElementById('histPane');
  histW = el.clientWidth  - HM.left - HM.right;
  histH = el.clientHeight - HM.top  - HM.bottom;
  histSvg.attr('width', el.clientWidth).attr('height', el.clientHeight)
    .attr('viewBox', `0 0 ${el.clientWidth} ${el.clientHeight}`);
}

function drawHistogram() {
  const allFeatures = state.geojson.features;
  const selFeatures = state.mode === 'map' && state.selectedIds.size > 0
    ? allFeatures.filter(f => state.selectedIds.has(featureId(f))) : null;

  const allVals = getValues(allFeatures);
  const selVals = selFeatures ? getValues(selFeatures) : null;
  const lo = d3.min(allVals), hi = d3.max(allVals);

  xScale = d3.scaleLinear().domain([lo, hi]).range([0, histW]).nice();
  const binner  = d3.bin().domain(xScale.domain()).thresholds(xScale.ticks(HIST_BINS));
  const allBins = binner(allVals);
  const selBins = selVals ? binner(selVals) : null;

  yScale = d3.scaleLinear()
    .domain([0, d3.max(allBins, b => b.length)]).nice().range([histH, 0]);

  // ── Axes ──
  histG.select('.x-axis').call(
    d3.axisBottom(xScale).ticks(5).tickFormat(v => {
      if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(0)+'M';
      if (Math.abs(v) >= 1e3) return (v/1e3).toFixed(0)+'k';
      return v;
    })
  ).selectAll('text').style('font-size', '10px');

  histG.select('.y-axis').call(d3.axisLeft(yScale).ticks(4))
    .selectAll('text').style('font-size', '10px');

  histG.select('.x-axis-label').attr('x', histW / 2).text(getVarDef().label);
  histG.select('.y-axis-label')
    .attr('x', -histH / 2)
    .attr('y', -HM.left + 12);

  // ── Get current color scale for bar coloring ──
  const allValsForScale = getValues(state.geojson.features);
  const breaks    = getBreaks(allValsForScale, state.buckets, state.classification);
  const colorScale = makeColorScale(state.scheme, breaks, state.buckets);

  // ── Full-population bars (class-colored or greyed when selection active) ──
  histG.selectAll('.bar-all').data(allBins).join('rect')
    .attr('class', 'bar-all')
    .attr('x',      d => xScale(d.x0) + 1)
    .attr('width',  d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
    .attr('y',      d => yScale(d.length))
    .attr('height', d => histH - yScale(d.length))
    .attr('fill',   d => selBins ? '#bbb' : colorScale((d.x0 + d.x1) / 2))
    .attr('opacity', selBins ? 0.3 : 0.85);

  // ── Selection overlay bars (orange) ──
  histG.selectAll('.bar-sel').data(selBins || []).join('rect')
    .attr('class', 'bar-sel')
    .attr('x',      d => xScale(d.x0) + 1)
    .attr('width',  d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
    .attr('y',      d => yScale(d.length))
    .attr('height', d => histH - yScale(d.length))
    .attr('fill',   SELECTION_COLOR)
    .attr('opacity', 0.85);

  // ── Hist-brush highlight mode ──
  if (state.mode === 'hist' && state.histRange) {
    const [r0, r1] = state.histRange;
    histG.selectAll('.bar-all')
      .attr('fill',    d => {
        const inRange = d.x0 >= r0 && d.x1 <= r1 + 0.001;
        return inRange ? colorScale((d.x0 + d.x1) / 2) : '#bbb';
      })
      .attr('opacity', d => d.x0 >= r0 && d.x1 <= r1 + 0.001 ? 0.9 : 0.2);
  }

  setupHistBrush();
  drawStats(allVals, selVals);
}



function setupHistBrush() {
  if (!histG) return;
  histG.selectAll('.hist-brush').remove();
  const brush = d3.brushX()
    .extent([[0, 0], [histW, histH]])
    .on('end', onHistBrush);
  histG.append('g').attr('class', 'hist-brush').call(brush);
}

function onHistBrush(event) {
  if (!event.selection) {
    if (state.mode === 'hist') clearSelection();
    return;
  }
  const [x0, x1] = event.selection.map(xScale.invert);
  state.histRange = [x0, x1];
  state.selectedIds.clear();
  state.mode = 'hist';
  state.geojson.features.forEach(f => {
    const v = getFeatureValue(f);
    if (v != null && v >= x0 && v <= x1) state.selectedIds.add(featureId(f));
  });
  showClearBtn(true);
  applyTractColors();
  updateStatusBar();
  emitSelectionChange();
  // Re-color with class colors in range, grey outside
  const _bv    = getValues(state.geojson.features);
  const _brks  = getBreaks(_bv, state.buckets, state.classification);
  const _cscale = makeColorScale(state.scheme, _brks, state.buckets);
  histG.selectAll('.bar-all')
    .attr('opacity', d => d.x0 >= x0 && d.x1 <= x1 + 0.001 ? 0.9 : 0.2)
    .attr('fill',    d => d.x0 >= x0 && d.x1 <= x1 + 0.001
      ? _cscale((d.x0 + d.x1) / 2) : '#bbb');
}

// ============================================================
//  SELECTION EVENT
//  Fires on document whenever selection changes so parent
//  pages or future web component wrappers can react.
// ============================================================

function emitSelectionChange() {
  const allVals = getValues(state.geojson.features);
  const selFeatures = state.geojson.features
    .filter(f => state.selectedIds.has(featureId(f)));
  const selVals = getValues(selFeatures);

  const detail = {
    selectedIds: [...state.selectedIds],
    count:       state.selectedIds.size,
    total:       state.geojson.features.length,
    mode:        state.mode,         // 'map' | 'hist' | null
    variable:    state.currentVar,
    stats: state.selectedIds.size > 0 ? {
      all:       calcStats(allVals),
      selection: calcStats(selVals),
    } : null,
  };

  document.dispatchEvent(new CustomEvent('selectionchange', {
    detail,
    bubbles:  true,
    composed: true,   // crosses shadow DOM boundary when we get there
  }));
}

// ============================================================
//  SUMMARY STATISTICS PANEL
// ============================================================

function calcStats(vals) {
  if (!vals || !vals.length) return null;
  const sorted = [...vals].sort(d3.ascending);
  const n      = sorted.length;
  const mean   = d3.mean(sorted);
  const median = d3.median(sorted);
  const min    = sorted[0];
  const max    = sorted[n - 1];
  const stddev = d3.deviation(sorted);
  return { n, mean, median, min, max, stddev };
}

function drawStats(allVals, selVals) {
  const panel = document.getElementById('statsPanel');
  if (!selVals || !selVals.length) {
    panel.style.display = 'none';
    return;
  }

  const vd  = getVarDef();
  const all = calcStats(allVals);
  const sel = calcStats(selVals);
  if (!all || !sel) { panel.style.display = 'none'; return; }

  function pctDiff(selV, allV) {
    if (!allV) return '—';
    const d = ((selV - allV) / Math.abs(allV)) * 100;
    const sign = d >= 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}%`;
  }

  function fmtV(v) { return vd.fmt(v); }

  const rows = [
    { label: 'Count',   all: all.n.toLocaleString(),      sel: sel.n.toLocaleString(),      pct: pctDiff(sel.n, all.n) },
    { label: 'Mean',    all: fmtV(all.mean),               sel: fmtV(sel.mean),               pct: pctDiff(sel.mean, all.mean) },
    { label: 'Median',  all: fmtV(all.median),             sel: fmtV(sel.median),             pct: pctDiff(sel.median, all.median) },
    { label: 'Std dev', all: fmtV(all.stddev),             sel: fmtV(sel.stddev),             pct: pctDiff(sel.stddev, all.stddev) },
    { label: 'Min',     all: fmtV(all.min),                sel: fmtV(sel.min),                pct: '—' },
    { label: 'Max',     all: fmtV(all.max),                sel: fmtV(sel.max),                pct: '—' },
  ];

  panel.innerHTML = `
    <div class="stats-header">
      <span class="stats-title">Summary statistics</span>
      <span class="stats-col-head stats-col-all">All ${GEOGRAPHY_LABEL}s</span>
      <span class="stats-col-head stats-col-sel">Selection</span>
      <span class="stats-col-head stats-col-pct">Δ vs all</span>
    </div>
    ${rows.map(r => `
      <div class="stats-row">
        <span class="stats-label">${r.label}</span>
        <span class="stats-val stats-col-all">${r.all}</span>
        <span class="stats-val stats-col-sel">${r.sel}</span>
        <span class="stats-pct ${parseFloat(r.pct) > 0 ? 'pos' : parseFloat(r.pct) < 0 ? 'neg' : ''}">${r.pct}</span>
      </div>`).join('')}
  `;
  panel.style.display = 'block';
}

// ============================================================
//  STATUS & CONTROLS
// ============================================================

function updateStatusBar() {
  const total = state.geojson.features.length;
  const sel   = state.selectedIds.size;
  document.getElementById('statusText').textContent = sel > 0
    ? `${sel.toLocaleString()} of ${total.toLocaleString()} ${GEOGRAPHY_LABEL}s selected`
    : `${total.toLocaleString()} ${GEOGRAPHY_LABEL}s · drag map or histogram to select`;
}

function showClearBtn(show) {
  document.getElementById('clearBtn').style.display = show ? 'inline-block' : 'none';
}

function clearSelection() {
  state.selectedIds.clear();
  state.histRange = null;
  state.mode = null;
  showClearBtn(false);
  applyTractColors();
  drawHistogram();
  updateStatusBar();
  document.getElementById('statsPanel').style.display = 'none';
  emitSelectionChange();
}

function onVarChange(id) {
  state.currentVar = id;
  clearSelection();
  drawTracts();
  drawHistogram();
  updateDivergeWarning();
}

function onSchemeChange(id) {
  state.scheme = id;
  // Update active row in dropdown
  document.querySelectorAll('.dd-row').forEach(r =>
    r.classList.toggle('dd-row--active', r.dataset.schemeId === id)
  );
  updateColorBtn();
  updateDivergeWarning();
  clearSelection();
  drawTracts();
  drawHistogram();
}

function onClassificationChange(scheme) {
  state.classification = scheme;
  clearSelection();
  drawTracts();
  drawHistogram();
}

function onBucketChange(k) {
  state.buckets = +k;
  clearSelection();
  drawTracts();
  drawHistogram();
  refreshDropdownSwatches();
  updateColorBtn();
}

// ============================================================
//  INIT
// ============================================================

async function init() {
  document.getElementById('loadingMsg').style.display = 'flex';
  try {
    const res = await fetch(DATA_FILE);
    if (!res.ok) throw new Error(`Could not load ${DATA_FILE} — HTTP ${res.status}`);
    state.geojson = await res.json();
  } catch (err) {
    document.getElementById('loadingMsg').innerHTML =
      `<span style="color:#c0392b">⚠ ${err.message}</span>`;
    return;
  }
  document.getElementById('loadingMsg').style.display = 'none';

  // Variable selector
  const varSel = document.getElementById('varSelect');
  varSel.innerHTML = '';
  VARIABLES.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id; opt.textContent = v.label;
    if (v.id === DEFAULT_VARIABLE) opt.selected = true;
    varSel.appendChild(opt);
  });

  document.getElementById('schemeSelect').value = DEFAULT_CLASSIFICATION;
  document.getElementById('bucketSelect').value = String(DEFAULT_BUCKETS);

  varSel.addEventListener('change', e => onVarChange(e.target.value));
  document.getElementById('schemeSelect').addEventListener('change', e => onClassificationChange(e.target.value));
  document.getElementById('bucketSelect').addEventListener('change', e => onBucketChange(e.target.value));
  document.getElementById('clearBtn').addEventListener('click', clearSelection);

  // Color button & dropdown
  document.getElementById('colorBtn').addEventListener('click', e => {
    e.stopPropagation();
    toggleDropdown();
  });
  document.addEventListener('click', e => {
    if (state.dropdownOpen &&
        !document.getElementById('colorDropdown').contains(e.target) &&
        !document.getElementById('colorBtn').contains(e.target)) {
      closeDropdown();
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.dropdownOpen) closeDropdown();
  });

  initMap();
  resizeMap();
  drawTracts();
  setupMapBrush();

  // Zoom button wiring
  document.getElementById('zoomIn').addEventListener('click',    () => zoomBy(2));
  document.getElementById('zoomOut').addEventListener('click',   () => zoomBy(0.5));
  document.getElementById('zoomReset').addEventListener('click', () => zoomReset());

  // Show shift-drag hint the first time user zooms in
  let hintShown = false;
  zoomBehavior.on('zoom.hint', event => {
    if (!hintShown && event.transform.k > 1.5) {
      hintShown = true;
      const hint = document.getElementById('shiftHint');
      hint.classList.add('visible');
      setTimeout(() => hint.classList.remove('visible'), 3000);
    }
  });

  initHistogram();
  drawHistogram();
  updateStatusBar();

  buildDropdown();
  updateColorBtn();
}

window.addEventListener('DOMContentLoaded', init);
