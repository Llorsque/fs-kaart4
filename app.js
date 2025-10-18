/* School Map Uploader — sturdy build with visible filters and Heatmap Option A */
let map, markersLayer, heatLayer;
let originalRows = [];
const YEAR_KEYS = ["2022/2023","2023/2024","2024/2025","2025/2026"];

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  bindUI();
});

function initMap(){
  map = L.map('map').setView([52.2, 5.3], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  heatLayer = L.heatLayer([], {
    radius: 40,
    blur: 28,
    maxZoom: 17,
    gradient: { 0.0: 'green', 0.5: 'yellow', 1.0: 'red' }
  });
}

function bindUI(){
  const input = document.getElementById('fileInput');
  input.addEventListener('change', e => handleFile(e.target.files[0]));

  document.querySelectorAll('input[name="viewmode"]').forEach(r => {
    r.addEventListener('change', () => { if (originalRows.length) render(); });
  });

  document.getElementById('applyFilter').addEventListener('click', () => {
    if (originalRows.length) render();
  });
}

function setStatus(msg, isError=false){
  const el = document.getElementById('status');
  el.textContent = msg || '';
  el.style.color = isError ? '#b42318' : '#0f172a';
}

function normalizeNumber(v){
  if (v == null) return NaN;
  const s = String(v).trim().replace(/,/g, '.').replace(/[^\d\.\-]/g,'');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
function isYes(v){
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return ['ja','yes','y','true','1','x'].includes(s);
}
function asCount(v){
  if (v == null || String(v).trim() === '') return 0;
  if (isYes(v)) return 1;
  const n = normalizeNumber(v);
  return Number.isFinite(n) ? n : 0;
}

function resolveColumns(rows){
  const keys = Object.keys(rows[0] || {});
  const map = {};
  keys.forEach(k => map[String(k).trim().toLowerCase()] = k);
  const get = (arr) => {
    for (const c of arr){
      const k = c.toLowerCase();
      if (k in map) return map[k];
    }
    return null;
  };
  const nameKey = get(['Naam van de School','NAAM VAN DE SCHOOL','NAAM SCHOOL','Naam school','Schoolnaam','School','Naam']);
  const latKey  = get(['Latitude','LATITUDE','Breedtegraad','Lat','LAT','Y']);
  const lonKey  = get(['Longitude','LONGITUDE','Lengtegraad','Lon','LON','X']);
  return { nameKey, latKey, lonKey };
}

function selectedYears(){
  return Array.from(document.querySelectorAll('input[name="year"]:checked')).map(i => i.value);
}

function currentMode(){
  const el = document.querySelector('input[name="viewmode"]:checked');
  return el ? el.value : 'pins';
}

function render(){
  markersLayer.clearLayers();
  if (heatLayer) heatLayer.setLatLngs([]);

  const { nameKey, latKey, lonKey } = resolveColumns(originalRows);
  if (!latKey || !lonKey){
    setStatus('Latitude/Longitude kolommen niet gevonden.', true);
    return;
  }

  const years = selectedYears();
  const mode = currentMode();
  const heatPoints = [];
  const bounds = [];

  originalRows.forEach((row, idx) => {
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
    }
    bounds.push([lat, lon]);
  });

  if (mode === 'heat'){
    // Option A: fixed 0–150, visibility floor, fallback autoscale
    const MAX_SCALE = 150;
    const MIN_INTENSITY = 0.18;

    let normalized = heatPoints.map(([lat, lon, t]) => {
      const raw = (t || 0) / MAX_SCALE;
      const intensity = Math.max(MIN_INTENSITY, Math.min(1, raw));
      return [lat, lon, intensity];
    });

    const maxI = normalized.reduce((m, p) => Math.max(m, p[2]), 0);
    if (maxI <= MIN_INTENSITY + 0.01) {
      const maxT = heatPoints.reduce((m, p) => Math.max(m, p[2]), 1);
      normalized = heatPoints.map(([lat, lon, t]) => [lat, lon, Math.min(1, (t || 0) / (maxT || 1))]);
    }

    heatLayer.setLatLngs(normalized);
    if (!map.hasLayer(heatLayer)) heatLayer.addTo(map);
  } else {
    if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
  setStatus(`Klaar — ${bounds.length} locaties.`);
}

async function handleFile(file){
  if (!file) return;
  setStatus('Bestand wordt verwerkt…');
  const ext = file.name.split('.').pop().toLowerCase();
  try {
    if (ext === 'csv'){
      const text = await file.text();
      const rows = CSVToArrayOfObjects(text);
      originalRows = rows;
      render();
      return;
    }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    originalRows = rows;
    render();
  } catch(e){
    console.error(e);
    setStatus('Fout bij lezen van bestand. Probeer opnieuw.', true);
  }
}

function CSVToArrayOfObjects(csv){
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  let d = ','; if (lines[0].includes(';') && !lines[0].includes(',')) d = ';';
  const headers = lines[0].split(d).map(h => h.trim());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].split(d);
    const obj = {};
    headers.forEach((h, ix) => obj[h] = cols[ix] !== undefined ? cols[ix].trim() : null);
    rows.push(obj);
  }
  return rows;
}
