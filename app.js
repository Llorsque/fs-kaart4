/* School Map Uploader — Leaflet + SheetJS
 * Functies:
 * - Flexibele koppen voor naam/lat/lon
 * - Komma/punt decimaal
 * - Jaarfilter (multi-select) op 2022/2023, 2023/2024, 2024/2025, 2025/2026 met JA/NEE
 */
let map, markersLayer;
let originalRows = []; // bewaar ingelezen data voor herfilteren

const YEAR_KEYS = ["2022/2023", "2023/2024", "2024/2025", "2025/2026"];

function initMap(){
  map = L.map('map').setView([52.2, 5.3], 7); // Nederland
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  initFilterUI();
}

function setStatus(msg, isError=false){
  const el = document.getElementById('status');
  el.textContent = msg || '';
  el.style.color = isError ? '#ffdddd' : '#ffffff';
}

// Normaliseer getalstrings naar parseFloat-compatibel formaat.
function normalizeNumber(val){
  if (val === null || val === undefined) return NaN;
  const s = String(val).trim()
    .replace(/,/g, '.')
    .replace(/[^\d\.\-]/g, '');
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : NaN;
}

// JA/NEE normalisatie
function isYes(val){
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return ['ja','yes','y','true','1','x'].includes(s);
}

// Zoek kolommen case-insensitive met kandidatenlijst.
function findColumn(keysMap, candidates){
  for (const cand of candidates){
    const k = cand.toLowerCase();
    if (k in keysMap) return keysMap[k];
  }
  return null;
}

// Detecteer lat/lon op waardebereik
function detectLatLonFromRows(rows, keys){
  const firstRows = rows.slice(0, Math.min(rows.length, 50));
  let bestLat = null, bestLon = null;

  for (const key of keys){
    let latLike = 0, lonLike = 0;
    for (const r of firstRows){
      const v = normalizeNumber(r[key]);
      if (!Number.isFinite(v)) continue;
      if (v >= -90 && v <= 90) latLike++;
      if (v >= -180 && v <= 180) lonLike++;
    }
    if (latLike > lonLike && latLike > 0){
      bestLat = bestLat ?? key;
    } else if (lonLike >= latLike && lonLike > 0){
      bestLon = bestLon ?? key;
    }
  }
  return { lat: bestLat, lon: bestLon };
}

function resolveColumns(rows){
  if (!rows || !rows.length) return { nameKey: null, latKey: null, lonKey: null };

  const originalKeys = Object.keys(rows[0] || {});
  const keysMap = {};
  originalKeys.forEach(k => {
    if (k == null) return;
    keysMap[String(k).trim().toLowerCase()] = k;
  });

  const nameCandidates = [
    'Naam van de School','NAAM VAN DE SCHOOL','NAAM SCHOOL','Naam school',
    'Schoolnaam','School','Naam','Naam_school','Naam-van-de-school'
  ];
  const latCandidates = ['Latitude','LATITUDE','Breedtegraad','Lat','LAT','Y','y','noorderbreedte'];
  const lonCandidates = ['Longitude','LONGITUDE','Lengtegraad','Lon','LON','X','x','oosterlengte'];

  let nameKey = findColumn(keysMap, nameCandidates);
  let latKey = findColumn(keysMap, latCandidates);
  let lonKey = findColumn(keysMap, lonCandidates);

  if (!latKey || !lonKey){
    const det = detectLatLonFromRows(rows, originalKeys);
    latKey = latKey || det.lat;
    lonKey = lonKey || det.lon;
  }

  return { nameKey, latKey, lonKey };
}

function getSelectedYears(){
  const menu = document.querySelector('#yearFilter .dropdown-menu');
  const checked = Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
  return checked;
}

function anyYearIsYes(row, years){
  // Alleen filteren als er minstens één jaar geselecteerd is; anders alles tonen
  if (!years || !years.length) return true;
  for (const y of years){
    // Gebruik exact de key zoals in YEAR_KEYS, maar sta spaties toe
    const val = row[y] ?? row[String(y).trim()];
    if (isYes(val)) return true;
  }
  return false;
}

function parseRowsToMarkers(rows){
  markersLayer.clearLayers();
  const bounds = [];
  let count = 0;

  const { nameKey, latKey, lonKey } = resolveColumns(rows);

  if (!latKey || !lonKey){
    setStatus('Kon kolommen voor Latitude/Longitude niet vinden. Controleer de koppen of waarden.', true);
    return;
  }

  const selectedYears = getSelectedYears();

  rows.forEach((row, idx) => {
    // Filteren op jaar
    if (!anyYearIsYes(row, selectedYears)) return;

    const name = nameKey ? row[nameKey] : `Locatie ${idx+1}`;
    const lon = normalizeNumber(row[lonKey]);
    const lat = normalizeNumber(row[latKey]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

    const m = L.marker([lat, lon]).bindPopup(`<strong>${String(name ?? '')}</strong>`);
    m.addTo(markersLayer);
    bounds.push([lat, lon]);
    count++;
  });

  if (count === 0){
    setStatus('Geen locaties voor de huidige filter. Pas je selectie aan.', true);
    return;
  }

  if (bounds.length){
    map.fitBounds(bounds, { padding: [30, 30] });
  }
  setStatus(`Klaar! ${count} locaties geplaatst.`);
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
      parseRowsToMarkers(originalRows);
      return;
    }

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    originalRows = rows;
    parseRowsToMarkers(originalRows);
  } catch (e){
    console.error(e);
    setStatus('Er ging iets mis bij het lezen van het bestand. Controleer het formaat en probeer opnieuw.', true);
  }
}

// CSV parser (basic)
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

// UI voor filter dropdown
function initFilterUI(){
  const wrap = document.getElementById('yearFilter');
  const toggle = wrap.querySelector('.dropdown-toggle');
  const menu = wrap.querySelector('.dropdown-menu');
  const selEl = document.getElementById('yearSelection');

  toggle.addEventListener('click', () => {
    const opened = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', opened ? 'true' : 'false');
  });

  document.getElementById('selectAll').addEventListener('click', () => {
    menu.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = true);
    updateSelectionLabel(selEl, menu);
  });
  document.getElementById('selectNone').addEventListener('click', () => {
    menu.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
    updateSelectionLabel(selEl, menu);
  });
  document.getElementById('applyFilter').addEventListener('click', () => {
    updateSelectionLabel(selEl, menu);
    menu.classList.remove('open');
    if (originalRows.length){
      parseRowsToMarkers(originalRows);
    }
  });

  menu.querySelectorAll('input[type="checkbox"]').forEach(c => {
    c.addEventListener('change', () => updateSelectionLabel(selEl, menu));
  });

  function updateSelectionLabel(el, menu){
    const checked = Array.from(menu.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
    if (checked.length === 0) el.textContent = '(niets)';
    else if (checked.length === YEAR_KEYS.length) el.textContent = '(alles)';
    else el.textContent = checked.join(', ');
  }
}

function loadSample(){
  // Voorbeelddata met jaar-kolommen en JA/NEE
  const rows = [
    { 'NAAM SCHOOL': 'OBS De Start', 'LONGITUDE': '4,8952', 'LATITUDE': '52,3702', '2022/2023':'JA','2023/2024': 'NEE','2024/2025':'JA','2025/2026':'NEE' },
    { 'NAAM SCHOOL': 'CBS De Wissel', 'LONGITUDE': '5,7999', 'LATITUDE': '53,2012', '2022/2023':'NEE','2023/2024': 'JA','2024/2025':'NEE','2025/2026':'JA' },
    { 'NAAM SCHOOL': 'RSG Noorderhoek', 'LONGITUDE': '6,5665', 'LATITUDE': '53,2194', '2022/2023':'NEE','2023/2024': 'NEE','2024/2025':'NEE','2025/2026':'JA' },
  ];
  originalRows = rows;
  parseRowsToMarkers(originalRows);
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  const input = document.getElementById('fileInput');
  input.addEventListener('change', (e) => handleFile(e.target.files[0]));
  document.getElementById('loadSample').addEventListener('click', loadSample);
});
