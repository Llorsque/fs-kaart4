/* Minimal app with Pins & Heatmap, year filter, and number parsing */
let map, markersLayer, heatLayer, heatLegendEl;
let originalRows = [];
const YEAR_KEYS = ["2022/2023", "2023/2024", "2024/2025", "2025/2026"];

function initMap(){
  map = L.map('map').setView([52.2, 5.3], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  heatLayer = L.heatLayer([], { radius: 25, blur: 18, maxZoom: 17 });
  initFilterUI();
  initViewToggle();
  initLegend();
}

function initLegend(){
  const wrap = document.querySelector('.map-wrap') || document.body;
  heatLegendEl = document.createElement('div');
  heatLegendEl.className = 'heat-legend';
  heatLegendEl.innerHTML = '<div>Schaal: laag → hoog</div><div class="bar"></div>';
  wrap.appendChild(heatLegendEl);
  heatLegendEl.style.display = 'none';
}

function normalizeNumber(val){
  if (val === null || val === undefined) return NaN;
  const s = String(val).trim().replace(/,/g, '.').replace(/[^\d\.\-]/g, '');
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : NaN;
}
function isYes(val){
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return ['ja','yes','y','true','1','x'].includes(s);
}
function asCount(val){
  if (val === null || val === undefined || String(val).trim() === '') return 0;
  if (isYes(val)) return 1;
  const n = normalizeNumber(val);
  return Number.isFinite(n) ? n : 0;
}

function getSelectedYears(){
  const menu = document.querySelector('#yearFilter .dropdown-menu');
  if (!menu) return [];
  return Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
}

function currentViewMode(){
  const el = document.querySelector('input[name="viewmode"]:checked');
  return el ? el.value : 'pins';
}

function getHeaderMap(rows){
  const keys = Object.keys(rows[0] || {});
  const mapKeys = {};
  keys.forEach(k => mapKeys[String(k).trim().toLowerCase()] = k);
  return mapKeys;
}
function getScaleOverride(rows){
  const mapKeys = getHeaderMap(rows);
  const minKey = mapKeys['schaal_min'] || mapKeys['scale_min'] || null;
  const maxKey = mapKeys['schaal_max'] || mapKeys['scale_max'] || null;
  let sMin = null, sMax = null;
  if (minKey){
    for (const r of rows){
      const v = normalizeNumber(r[minKey]);
      if (Number.isFinite(v)){ sMin = v; break; }
    }
  }
  if (maxKey){
    for (const r of rows){
      const v = normalizeNumber(r[maxKey]);
      if (Number.isFinite(v)){ sMax = v; break; }
    }
  }
  if (Number.isFinite(sMin) && Number.isFinite(sMax) && sMax > sMin){
    return { min: sMin, max: sMax };
  }
  return null;
}
function resolveColumns(rows){
  const keys = Object.keys(rows[0] || {});
  const mapKeys = {};
  keys.forEach(k => mapKeys[String(k).trim().toLowerCase()] = k);
  const find = (arr) => arr.map(s => s.toLowerCase()).find(k => k in mapKeys);
  const nameKey = mapKeys[find(['Naam van de School','NAAM VAN DE SCHOOL','NAAM SCHOOL','Naam school','Schoolnaam','School','Naam'])] || null;
  const latKey = mapKeys[find(['Latitude','LATITUDE','Breedtegraad','Lat','LAT','Y'])] || null;
  const lonKey = mapKeys[find(['Longitude','LONGITUDE','Lengtegraad','Lon','LON','X'])] || null;
  return { nameKey, latKey, lonKey };
}

function parseRowsToLayers(rows){
  if (!rows || !rows.length) return;
  markersLayer.clearLayers();
  if (heatLayer) heatLayer.setLatLngs([]);

  const { nameKey, latKey, lonKey } = resolveColumns(rows);
  const years = getSelectedYears();
  const mode = currentViewMode();
  const bounds = [];
  let count = 0;
  const heatPoints = [];
  let maxTotal = 0;

  rows.forEach((row, idx) => {
    const lon = normalizeNumber(row[lonKey]);
    const lat = normalizeNumber(row[latKey]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

    let total = 0;
    if (years.length){
      years.forEach(y => total += asCount(row[y]));
      if (total <= 0) return;
    } else {
      YEAR_KEYS.forEach(y => total += asCount(row[y]));
      if (total <= 0) total = 1;
    }

    if (mode === 'pins'){
      const name = nameKey ? row[nameKey] : `Locatie ${idx+1}`;
      L.marker([lat, lon]).bindPopup(`<strong>${String(name ?? '')}</strong>`).addTo(markersLayer);
    } else {
      heatPoints.push([lat, lon, total]);
      if (total > maxTotal) maxTotal = total;
    }
    bounds.push([lat, lon]);
    count++;
  });

  if (mode === 'heat'){
    const normalized = heatPoints.map(([lat, lon, t]) => [lat, lon, maxTotal > 0 ? (t/maxTotal) : 0.5]);
    heatLayer.setLatLngs(normalized);
    if (!map.hasLayer(heatLayer)) heatLayer.addTo(map);
    heatLegendEl.style.display = 'block';
  } else {
    if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
    heatLegendEl.style.display = 'none';
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
}

async function handleFile(file){
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  try{
    if (ext === 'csv'){
      const text = await file.text();
      const rows = CSVToArrayOfObjects(text);
      originalRows = rows;
      parseRowsToLayers(originalRows);
    } else {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
      originalRows = rows;
      parseRowsToLayers(originalRows);
    }
  }catch(e){ console.error(e); }
}

function CSVToArrayOfObjects(csv){
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  let delimiter = ',';
  if (lines[0].includes(';') && !lines[0].includes(',')) delimiter = ';';
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].split(delimiter);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = cols[idx] !== undefined ? cols[idx].trim() : null);
    rows.push(obj);
  }
  return rows;
}

function initFilterUI(){
  const input = document.getElementById('fileInput');
  if (input) input.addEventListener('change', (e) => handleFile(e.target.files[0]));

  const wrap = document.getElementById('yearFilter');
  if (!wrap) return;
  const toggle = wrap.querySelector('.dropdown-toggle');
  const menu = wrap.querySelector('.dropdown-menu');
  const selEl = document.getElementById('yearSelection');

  if (toggle && menu){
    toggle.addEventListener('click', () => {
      const opened = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
    });
  }

  const selectAll = document.getElementById('selectAll');
  const selectNone = document.getElementById('selectNone');
  const applyFilter = document.getElementById('applyFilter');

  selectAll && selectAll.addEventListener('click', () => {
    menu.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = true);
    updateSelectionLabel(selEl, menu);
  });
  selectNone && selectNone.addEventListener('click', () => {
    menu.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    updateSelectionLabel(selEl, menu);
  });
  applyFilter && applyFilter.addEventListener('click', () => {
    updateSelectionLabel(selEl, menu);
    menu.classList.remove('open');
    if (originalRows.length) parseRowsToLayers(originalRows);
  });

  menu.querySelectorAll('input[type="checkbox"]').forEach(c => {
    c.addEventListener('change', () => updateSelectionLabel(selEl, menu));
  });

  function updateSelectionLabel(el, menu){
    const checked = Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
    if (!el) return;
    if (checked.length === 0) el.textContent = '(niets)';
    else if (checked.length === YEAR_KEYS.length) el.textContent = '(alles)';
    else el.textContent = YEAR_KEYS.filter(y => checked.includes(y)).join(', ');
  }
}

function initViewToggle(){
  document.querySelectorAll('input[name="viewmode"]').forEach(r => {
    r.addEventListener('change', () => {
      if (originalRows.length) parseRowsToLayers(originalRows);
    });
  });
}

// Expose loadSample if present
window.loadSample = function(){
  const rows = [
    { 'NAAM SCHOOL': 'OBS De Start', 'LONGITUDE': '4,8952', 'LATITUDE': '52,3702', '2022/2023': 12,'2023/2024': 'NEE','2024/2025': 25,'2025/2026': 7 },
    { 'NAAM SCHOOL': 'CBS De Wissel', 'LONGITUDE': '5,7999', 'LATITUDE': '53,2012', '2022/2023': 'JA','2023/2024': 30,'2024/2025': 'NEE','2025/2026': 15 },
    { 'NAAM SCHOOL': 'RSG Noorderhoek', 'LONGITUDE': '6,5665', 'LATITUDE': '53,2194', '2022/2023': 0,'2023/2024': 0,'2024/2025': 'NEE','2025/2026': 42 },
  ];
  originalRows = rows;
  parseRowsToLayers(originalRows);
}

document.addEventListener('DOMContentLoaded', initMap);
