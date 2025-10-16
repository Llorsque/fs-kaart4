/* School Map Uploader — Leaflet + SheetJS
 * Vereist kolommen: Naam van de School, Longitude, Latitude
 */
let map, markersLayer;

function initMap(){
  map = L.map('map').setView([52.2, 5.3], 7); // Nederland中心
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function setStatus(msg, isError=false){
  const el = document.getElementById('status');
  el.textContent = msg || '';
  el.style.color = isError ? '#ffdddd' : '#ffffff';
}

function parseRowsToMarkers(rows){
  markersLayer.clearLayers();
  const bounds = [];
  let count = 0;

  rows.forEach((row, idx) => {
    const name = row['Naam van de School'];
    const lonRaw = row['Longitude'];
    const latRaw = row['Latitude'];

    if (name == null || lonRaw == null || latRaw == null) return;

    const lon = parseFloat(String(lonRaw).toString().replace(',', '.'));
    const lat = parseFloat(String(latRaw).toString().replace(',', '.'));

    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      const m = L.marker([lat, lon]).bindPopup(`<strong>${String(name)}</strong>`);
      m.addTo(markersLayer);
      bounds.push([lat, lon]);
      count++;
    }
  });

  if (count === 0){
    setStatus('Geen geldige rijen gevonden. Controleer kolomnamen en coördinaten.', true);
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
      parseRowsToMarkers(rows);
      return;
    }

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    parseRowsToMarkers(rows);
  } catch (e){
    console.error(e);
    setStatus('Er ging iets mis bij het lezen van het bestand. Controleer het formaat en probeer opnieuw.', true);
  }
}

// Eenvoudige CSV parser → array of objects (kolomnamen uit eerste regel)
function CSVToArrayOfObjects(csv){
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].split(','); // basic; voor complex CSV gebruik bij voorkeur .xlsx
    const obj = {};
    headers.forEach((h, idx) => obj[h] = cols[idx] !== undefined ? cols[idx].trim() : null);
    rows.push(obj);
  }
  return rows;
}

function loadSample(){
  // Kleine ingebouwde dataset als fallback (Amsterdam / Leeuwarden / Groningen)
  const rows = [
    { 'Naam van de School': 'OBS De Start', 'Longitude': 4.8952, 'Latitude': 52.3702 },
    { 'Naam van de School': 'CBS De Wissel', 'Longitude': 5.7999, 'Latitude': 53.2012 },
    { 'Naam van de School': 'RSG Noorderhoek', 'Longitude': 6.5665, 'Latitude': 53.2194 },
  ];
  parseRowsToMarkers(rows);
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  const input = document.getElementById('fileInput');
  input.addEventListener('change', (e) => handleFile(e.target.files[0]));
  document.getElementById('loadSample').addEventListener('click', loadSample);
});
