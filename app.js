/* Heatmap scale 10–170, 'NEE' or number per year, colored pins by thresholds */
let map, markersLayer, heatLayer = null;
let originalRows = [];
const YEAR_KEYS = ["2022/2023","2023/2024","2024/2025","2025/2026"];

// Pin color thresholds (edit as you like)
const PIN_THRESHOLDS = { low: 40, high: 100 };
const PIN_COLORS = { low: '#16a34a', mid: '#f59e0b', high: '#ef4444' }; // green, orange, red

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  bindUI();
});

function initMap(){
  map = L.map('map').setView([52.2, 5.3], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function ensureHeatLayer(){
  if (typeof L === 'undefined' || typeof L.heatLayer !== 'function'){
    setStatus('Heatmap plugin (leaflet-heat) kon niet worden geladen.', true);
    return false;
  }
  if (!heatLayer){
    heatLayer = L.heatLayer([], { radius: 40, blur: 28, maxZoom: 17, gradient: { 0.0: 'green', 0.5: 'yellow', 1.0: 'red' } });
  }
  if (!map.hasLayer(heatLayer)) heatLayer.addTo(map);
  return true;
}

function bindUI(){
  document.getElementById('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));
  document.querySelectorAll('input[name="viewmode"]').forEach(r => r.addEventListener('change', () => { if (originalRows.length) render(); }));
  document.getElementById('applyFilter').addEventListener('click', () => { if (originalRows.length) render(); });
  document.getElementById('loadSample').addEventListener('click', loadSample);
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
function isYes(v){ if (v == null) return false; const s = String(v).trim().toLowerCase(); return ['ja','yes','y','true','1','x'].includes(s); }
function isNee(v){ if (v == null) return false; const s = String(v).trim().toLowerCase(); return s === 'nee' || s === 'no'; }
function asNumericOrNull(v){
  if (v == null || String(v).trim() === '') return null;
  if (isNee(v)) return null;
  if (isYes(v)) return 1; // for safety, if someone still uses JA
  const n = normalizeNumber(v);
  return Number.isFinite(n) ? n : null;
}

function resolveColumns(rows){
  const keys = Object.keys(rows[0] || {});
  const map = {}; keys.forEach(k => map[String(k).trim().toLowerCase()] = k);
  const get = arr => { for (const c of arr){ const k = c.toLowerCase(); if (k in map) return map[k]; } return null; };
  const nameKey = get(['Naam van de School','NAAM VAN DE SCHOOL','NAAM SCHOOL','Naam school','Schoolnaam','School','Naam']);
  const latKey  = get(['Latitude','LATITUDE','Breedtegraad','Lat','LAT','Y']);
  const lonKey  = get(['Longitude','LONGITUDE','Lengtegraad','Lon','LON','X']);
  return { nameKey, latKey, lonKey };
}

function selectedYears(){ return Array.from(document.querySelectorAll('input[name="year"]:checked')).map(i => i.value); }
function currentMode(){ const el = document.querySelector('input[name="viewmode"]:checked'); return el ? el.value : 'pins'; }

function colorForTotal(total){
  if (total == null) return PIN_COLORS.low;
  if (total > PIN_THRESHOLDS.high) return PIN_COLORS.high;
  if (total >= PIN_THRESHOLDS.low) return PIN_COLORS.mid;
  return PIN_COLORS.low;
}

function render(){
  markersLayer.clearLayers();
  if (heatLayer && map.hasLayer(heatLayer)) { heatLayer.setLatLngs([]); map.removeLayer(heatLayer); }

  const { nameKey, latKey, lonKey } = resolveColumns(originalRows);
  if (!latKey || !lonKey){ setStatus('Latitude/Longitude kolommen niet gevonden.', true); return; }

  const years = selectedYears();
  const mode = currentMode();
  const heatPoints = []; const bounds = [];

  originalRows.forEach((row, idx) => {
    const lon = normalizeNumber(row[lonKey]); const lat = normalizeNumber(row[latKey]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

    // 1) verzamel waarden per geselecteerd jaar (NEE -> null, getal -> number)
    const perYear = {};
    let hasAnyNumber = false;
    let total = 0;
    const iterYears = years.length ? years : YEAR_KEYS;
    iterYears.forEach(y => {
      const val = asNumericOrNull(row[y]);
      perYear[y] = (val == null) ? 'NEE' : val;
      if (val != null){
        hasAnyNumber = true;
        total += (typeof val === 'number' ? val : 0);
      }
    });

    // 2) Opnemen als er in ≥1 geselecteerd jaar een getal staat (ook 0 is toegestaan)
    if (!hasAnyNumber) return;

    if (mode === 'pins'){
      const name = nameKey ? row[nameKey] : `Locatie ${idx+1}`;
      const color = colorForTotal(total);
      const marker = L.circleMarker([lat, lon], {
        radius: 8, weight: 1.5, color: color, fillColor: color, fillOpacity: 0.85
      });
      const details = YEAR_KEYS.map(y => `<li>${y}: <strong>${perYear[y] !== undefined ? perYear[y] : (asNumericOrNull(row[y]) ?? 'NEE')}</strong></li>`).join('');
      marker.bindPopup(`<div style="min-width:220px"><strong>${String(name ?? '')}</strong><ul style="padding-left:1rem; margin:.4rem 0 0">${details}</ul><div style="margin-top:.4rem; color:#64748b">Totaal (geselecteerd): <strong>${total}</strong></div></div>`);
      marker.addTo(markersLayer);
    } else {
      heatPoints.push([lat, lon, total]);
    }
    bounds.push([lat, lon]);
  });

  if (mode === 'heat'){
    if (!ensureHeatLayer()) return;
    // Fixed scale 10–170 with a small visibility floor
    const MIN_SCALE = 10, MAX_SCALE = 170, MIN_INTENSITY = 0.18;
    let normalized = heatPoints.map(([lat,lon,t]) => {
      const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (t || 0)));
      const intensity = Math.max(MIN_INTENSITY, (clamped - MIN_SCALE) / (MAX_SCALE - MIN_SCALE));
      return [lat,lon,intensity];
    });
    // fallback autoscale als álles op de vloer ligt
    const maxI = normalized.reduce((m,p)=>Math.max(m,p[2]),0);
    if (maxI <= MIN_INTENSITY + 0.01){
      const maxT = heatPoints.reduce((m,p)=>Math.max(m,p[2]),1);
      normalized = heatPoints.map(([lat,lon,t]) => [lat,lon, Math.min(1,(t||0)/(maxT||1))]);
    }
    heatLayer.setLatLngs(normalized || []); heatLayer.redraw(); if (!map.hasLayer(heatLayer)) heatLayer.addTo(map);
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [30,30] });
  setStatus(`Klaar — ${bounds.length} locaties.`);
}

async function handleFile(file){
  if (!file) return; setStatus('Bestand wordt verwerkt…');
  const ext = file.name.split('.').pop().toLowerCase();
  try{
    if (ext === 'csv'){ const text = await file.text(); const rows = CSVToArrayOfObjects(text); originalRows = rows; render(); return; }
    const data = await file.arrayBuffer(); const wb = XLSX.read(data, { type: 'array' }); const sheet = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }); originalRows = rows; render();
  }catch(e){ console.error(e); setStatus('Fout bij lezen van bestand.', true); }
}

function CSVToArrayOfObjects(csv){
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length); if (!lines.length) return [];
  let d = ','; if (lines[0].includes(';') && !lines[0].includes(',')) d = ';';
  const headers = lines[0].split(d).map(h => h.trim()); const rows = [];
  for (let i=1;i<lines.length;i++){ const cols = lines[i].split(d); const obj = {}; headers.forEach((h,ix)=>obj[h]=cols[ix]!==undefined?cols[ix].trim():null); rows.push(obj); }
  return rows;
}

function loadSample(){
  const rows = [
    { 'NAAM SCHOOL': 'Test A', 'LONGITUDE': '4,90', 'LATITUDE': '52,37', '2022/2023': 'NEE', '2023/2024': 12, '2024/2025': 0,  '2025/2026': 'NEE' },
    { 'NAAM SCHOOL': 'Test B', 'LONGITUDE': '5,12', 'LATITUDE': '52,10', '2022/2023': 55,   '2023/2024': 'NEE','2024/2025': 'NEE','2025/2026': 'NEE' },
    { 'NAAM SCHOOL': 'Test C', 'LONGITUDE': '5,30', 'LATITUDE': '52,40', '2022/2023': 22,   '2023/2024': 18, '2024/2025': 'NEE', '2025/2026': 7 }
  ];
  originalRows = rows; render();
}
