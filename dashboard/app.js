/* Dashboard Scholen — totals, participants, YoY growth */
let rawRows = [];
const YEARS = ["2022/2023","2023/2024","2024/2025","2025/2026"];

document.addEventListener('DOMContentLoaded', () => {
  bindUI();
});

function bindUI(){
  document.getElementById('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));
  document.getElementById('loadSample').addEventListener('click', loadSample);
  document.getElementById('recalc').addEventListener('click', recalc);
}

function setStatus(msg){ document.getElementById('status').textContent = msg || ''; }

function normalizeNumber(v){
  if (v == null) return NaN;
  const s = String(v).trim().replace(/,/g, '.').replace(/[^0-9\.\-]/g,'');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
function isNee(v){ if (v == null) return false; const s = String(v).trim().toLowerCase(); return s === 'nee' || s === 'no'; }
function isJa(v){ if (v == null) return false; const s = String(v).trim().toLowerCase(); return s === 'ja' || s === 'yes' || s === 'true' || s === 'y' || s === '1' || s === 'x'; }

function asNumericOrNull(v, treatJaAsOne=false, ignoreZero=false){
  if (v == null || String(v).trim() === '') return null;
  if (isNee(v)) return null;
  if (treatJaAsOne && isJa(v)) return 1;
  const n = normalizeNumber(v);
  if (!Number.isFinite(n)) return null;
  if (ignoreZero && n === 0) return null;
  return n;
}

async function handleFile(file){
  if (!file) return;
  setStatus('Bestand wordt verwerkt…');
  const ext = file.name.split('.').pop().toLowerCase();
  try{
    if (ext === 'csv'){
      const text = await file.text();
      rawRows = csvToRows(text);
    } else {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    }
    setStatus('');
    recalc();
  }catch(e){
    console.error(e);
    setStatus('Kon het bestand niet lezen.');
  }
}

function csvToRows(csv){
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  let d = ','; if (lines[0].includes(';') && !lines[0].includes(',')) d = ';';
  const headers = lines[0].split(d).map(h => h.trim());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].split(d);
    const obj = {};
    headers.forEach((h,ix)=> obj[h] = (cols[ix] !== undefined ? cols[ix].trim() : null));
    rows.push(obj);
  }
  return rows;
}

function recalc(){
  if (!rawRows.length){ setStatus('Nog geen data.'); return; }
  const treatJaAsOne = document.getElementById('treatJaAsOne').checked;
  const ignoreZero = document.getElementById('ignoreZero').checked;

  const totals = {};
  const participants = {};
  YEARS.forEach(y => { totals[y]=0; participants[y]=0; });

  rawRows.forEach(row => {
    YEARS.forEach(y => {
      const n = asNumericOrNull(row[y], treatJaAsOne, ignoreZero);
      if (n != null){
        totals[y] += n;
        participants[y] += 1;
      }
    });
  });

  // YoY growth % (based on totals)
  const yoy = {};
  for (let i=0;i<YEARS.length;i++){
    const y = YEARS[i];
    const prev = YEARS[i-1];
    if (i===0 || totals[prev] === 0){
      yoy[y] = null;
    } else {
      yoy[y] = ((totals[y] - totals[prev]) / totals[prev]) * 100;
    }
  }

  // Overall growth (first -> last)
  const firstY = YEARS[0], lastY = YEARS[YEARS.length-1];
  const overall = (totals[firstY]===0) ? null : ((totals[lastY] - totals[firstY]) / totals[firstY]) * 100;

  // KPI cards
  renderKPIs(totals, participants, yoy, overall);

  // Charts
  renderCharts(totals, participants, yoy);

  // Preview
  renderPreview(rawRows.slice(0, 20));
}

function renderKPIs(totals, participants, yoy, overall){
  const wrap = document.getElementById('kpis');
  const fmt = (n, d=0) => (n==null || Number.isNaN(n)) ? '—' : n.toLocaleString('nl-NL', { maximumFractionDigits: d, minimumFractionDigits: d });
  const items = [];
  items.push(card('Totaal laatste jaar', fmt(totals["2025/2026"])));

  const lastY = "2025/2026", prevY = "2024/2025";
  const deltaAbs = (totals[lastY] ?? 0) - (totals[prevY] ?? 0);
  const deltaPct = (totals[prevY] ? (deltaAbs / totals[prevY] * 100) : null);
  items.push(card('Verschil j/j (laatste vs vorig)', `${fmt(deltaAbs)} <span class="delta ${deltaClass(deltaPct)}">(${fmt(deltaPct,1)}%)</span>`));

  items.push(card('Deelnemende scholen (laatste jaar)', fmt(participants[lastY])));
  items.push(card('Groei eerste → laatste', `<span class="delta ${deltaClass(overall)}">${fmt(overall,1)}%</span>`));

  wrap.innerHTML = items.join('');

  function card(label, valueHTML){
    return `<div class="kpi"><div class="label">${label}</div><div class="value">${valueHTML}</div></div>`;
  }
  function deltaClass(p){
    if (p == null) return 'flat';
    if (p > 0) return 'up';
    if (p < 0) return 'down';
    return 'flat';
  }
}

let chartTotals, chartParticipants, chartYoY;
function renderCharts(totals, participants, yoy){
  const labels = YEARS;
  const totalsData = labels.map(y => totals[y]);
  const partData = labels.map(y => participants[y]);
  const yoyData = labels.map(y => yoy[y] == null ? null : +yoy[y].toFixed(2));

  // Totals (bar)
  if (chartTotals) chartTotals.destroy();
  chartTotals = new Chart(document.getElementById('chartTotals'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Totaal', data: totalsData }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Participants (bar)
  if (chartParticipants) chartParticipants.destroy();
  chartParticipants = new Chart(document.getElementById('chartParticipants'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Scholen', data: partData }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  // YoY % (line)
  if (chartYoY) chartYoY.destroy();
  chartYoY = new Chart(document.getElementById('chartYoY'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Groei % j/j', data: yoyData, spanGaps: true }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      tension: 0.25,
      scales: { y: { ticks: { callback: v => v + '%' } } }
    }
  });
}

function renderPreview(rows){
  const wrap = document.getElementById('tablePreview');
  if (!rows.length){ wrap.innerHTML = '<em>Geen rijen in voorvertoning.</em>'; return; }
  const keys = Object.keys(rows[0]);
  let html = '<table><thead><tr>' + keys.map(k=>`<th>${k}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(r => {
    html += '<tr>' + keys.map(k=>`<td>${r[k] ?? ''}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function loadSample(){
  const rows = [
    { 'NAAM SCHOOL': 'A', 'LONGITUDE': '5,10', 'LATITUDE': '52,10', '2022/2023': 10, '2023/2024': 8, '2024/2025': 'NEE', '2025/2026': 5 },
    { 'NAAM SCHOOL': 'B', 'LONGITUDE': '5,20', 'LATITUDE': '52,20', '2022/2023': 55, '2023/2024': 'NEE','2024/2025': 'NEE','2025/2026': 22 },
    { 'NAAM SCHOOL': 'C', 'LONGITUDE': '5,30', 'LATITUDE': '52,30', '2022/2023': 'NEE', '2023/2024': 12, '2024/2025': 14, '2025/2026': 0 },
    { 'NAAM SCHOOL': 'D', 'LONGITUDE': '5,40', 'LATITUDE': '52,40', '2022/2023': 30, '2023/2024': 25, '2024/2025': 10, '2025/2026': 'NEE' }
  ];
  rawRows = rows;
  recalc();
}
