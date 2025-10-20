/* Dashboard v2 — Year selection, KPIs, active/inactive, highlights */
let rawRows = [];
const YEARS = ["2022/2023","2023/2024","2024/2025","2025/2026"];

document.addEventListener('DOMContentLoaded', () => {
  buildYearChecks(); bindUI();
});

function bindUI(){
  document.getElementById('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));
  document.getElementById('loadSample').addEventListener('click', loadSample);
  document.getElementById('apply').addEventListener('click', refresh);
  document.getElementById('treatJaAsOne').addEventListener('change', refresh);
}

function setStatus(msg){ document.getElementById('status').textContent = msg || ''; }
function buildYearChecks(){
  const box = document.getElementById('yearChecks');
  box.innerHTML = YEARS.map(y => `<label><input type="checkbox" name="year" value="${y}"> ${y}</label>`).join('');
}

function selectedYears(){
  return Array.from(document.querySelectorAll('input[name="year"]:checked')).map(i=>i.value);
}

function normalizeNumber(v){
  if (v == null) return NaN;
  const s = String(v).trim().replace(/,/g, '.').replace(/[^0-9\.\-]/g,'');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}
function isNee(v){ if (v == null) return false; const s = String(v).trim().toLowerCase(); return s === 'nee' || s === 'no'; }
function isJa(v){ if (v == null) return false; const s = String(v).trim().toLowerCase(); return ['ja','yes','true','y','1','x'].includes(s); }
function asNumericOrNull(v, treatJaAsOne=false){
  if (v == null || String(v).trim() === '') return null;
  if (isNee(v)) return null;
  if (treatJaAsOne && isJa(v)) return 1;
  const n = normalizeNumber(v);
  return Number.isFinite(n) ? n : null;
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
    refresh();
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
    const obj = {}; headers.forEach((h,ix)=> obj[h] = (cols[ix] !== undefined ? cols[ix].trim() : null));
    rows.push(obj);
  }
  return rows;
}

function refresh(){
  const years = selectedYears();
  const treatJaAsOne = document.getElementById('treatJaAsOne').checked;

  const empty = (!rawRows.length || years.length === 0);
  document.getElementById('noticeEmpty').classList.toggle('hide', !empty);
  document.getElementById('kpiWrap').classList.toggle('hide', empty);
  document.getElementById('cards').classList.toggle('hide', empty);
  if (empty){ clearCharts(); return; }

  // Metrics per year
  const totals = {}, participants = {}, nonParticipants = {};
  YEARS.forEach(y => { totals[y]=0; participants[y]=0; nonParticipants[y]=0; });
  rawRows.forEach(row => {
    YEARS.forEach(y => {
      const val = asNumericOrNull(row[y], treatJaAsOne);
      if (val != null) {
        totals[y] += val; participants[y] += 1;
      } else {
        nonParticipants[y] += 1;
      }
    });
  });

  // Filter metrics to only selected years (for charts/KPIs)
  const selTotals = years.map(y => totals[y]);
  const selParticipants = years.map(y => participants[y]);
  const selNon = years.map(y => nonParticipants[y]);

  // KPI: total (sum across selected years)
  const totalSum = selTotals.reduce((a,b)=>a+b,0);
  setText('kpiTotal', fmt(totalSum));

  // KPI: Active/Inactive across selected years (sum of counts per year)
  setText('kpiActive', fmt(selParticipants.reduce((a,b)=>a+b,0)));
  setText('kpiInactive', fmt(selNon.reduce((a,b)=>a+b,0)));

  // KPI: YoY growth last vs previous (based on totals)
  let yoyStr = '—';
  const lastIdx = YEARS.indexOf(years[years.length-1]);
  const prevIdx = lastIdx - 1;
  if (prevIdx >= 0) {
    const lastY = YEARS[lastIdx], prevY = YEARS[prevIdx];
    const prevV = totals[prevY];
    if (prevV && prevV !== 0) {
      const delta = ((totals[lastY] - prevV) / prevV) * 100;
      yoyStr = fmt(delta,1) + '%';
    }
  }
  setText('kpiYoY', yoyStr);

  // Highlights (based on selected range)
  renderHighlights(years, treatJaAsOne);

  // Charts
  renderCharts(years, selTotals, selParticipants, selNon);

  // Preview
  renderPreview(rawRows.slice(0, 20));
}

function fmt(n, d=0){ return (n==null || Number.isNaN(n)) ? '—' : n.toLocaleString('nl-NL',{maximumFractionDigits:d,minimumFractionDigits:d}); }
function setText(id, v){ const el=document.getElementById(id); if (el) el.innerHTML = v; }

function renderHighlights(selYears, treatJaAsOne){
  const wrap = document.getElementById('highlights');
  const yrIdx = selYears.map(y=>YEARS.indexOf(y)).sort((a,b)=>a-b);

  // Build per-school values
  const bySchool = []; // { name, values: {year: number|null} }
  rawRows.forEach(row => {
    const name = row['NAAM SCHOOL'] || row['Naam school'] || row['School'] || 'Onbekend';
    const values = {};
    YEARS.forEach(y => values[y] = asNumericOrNull(row[y], treatJaAsOne));
    bySchool.push({ name, values });
  });

  let topAbs = null; // max value across selected years
  let topRise = null; // biggest positive delta between consecutive years in selection
  let topFall = null; // biggest negative delta
  let dropouts = []; // schools active in prev year but NEE in current (for last selected year only)

  // absolute highest
  bySchool.forEach(s => {
    selYears.forEach(y => {
      const v = s.values[y];
      if (v != null){
        if (!topAbs || v > topAbs.v) topAbs = { school: s.name, year: y, v };
      }
    });
  });

  // rises & falls over selected consecutive pairs
  for (let i=1;i<yrIdx.length;i++){
    const yPrev = YEARS[yrIdx[i-1]], yCurr = YEARS[yrIdx[i]];
    bySchool.forEach(s => {
      const a = s.values[yPrev], b = s.values[yCurr];
      if (a != null && b != null){
        const delta = b - a;
        if (!topRise || delta > topRise.delta) topRise = { school:s.name, from:yPrev, to:yCurr, delta };
        if (!topFall || delta < topFall.delta) topFall = { school:s.name, from:yPrev, to:yCurr, delta };
      }
    });
  }

  // dropouts for the most recent selected year (compared to its prev global year)
  if (yrIdx.length){
    const lastIdx = yrIdx[yrIdx.length-1];
    const prevIdx = lastIdx - 1;
    if (prevIdx >= 0){
      const yPrev = YEARS[prevIdx], yCurr = YEARS[lastIdx];
      bySchool.forEach(s => {
        const a = s.values[yPrev], b = s.values[yCurr];
        if (a != null && b == null){
          dropouts.push(s.name);
        }
      });
    }
  }

  // render
  const items = [];
  items.push(tile('Absoluut hoogste aantal', topAbs ? `${topAbs.school} — ${fmt(topAbs.v)} (${topAbs.year})` : '—'));
  items.push(tile('Grootste stijger (j/j)', topRise ? `${topRise.school} — +${fmt(topRise.delta)} (${topRise.from} → ${topRise.to})` : '—'));
  items.push(tile('Grootste daler (j/j)', topFall ? `${topFall.school} — ${fmt(topFall.delta)} (${topFall.from} → ${topFall.to})` : '—'));
  items.push(tile('Uitvallers (laatste vergeleken met jaar ervoor)', dropouts.length ? dropouts.slice(0,8).join(', ') + (dropouts.length>8 ? ` … (+${dropouts.length-8})` : '') : '—'));
  wrap.innerHTML = items.join('');

  function tile(title, body){ return `<div class="hl"><b>${title}</b><div>${body}</div></div>`; }
}

let chartTotals, chartYoY, chartActive;
function clearCharts(){ if(chartTotals) chartTotals.destroy(); if(chartYoY) chartYoY.destroy(); if(chartActive) chartActive.destroy(); }

function renderCharts(selYears, selTotals, selParticipants, selNon){
  clearCharts();
  // Totals
  chartTotals = new Chart(document.getElementById('chartTotals'), {
    type: 'bar',
    data: { labels: selYears, datasets: [{ label: 'Totaal', data: selTotals }] },
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });

  // YoY% for the selected years
  const yoyData = [];
  for(let i=0;i<selYears.length;i++){
    if(i===0){ yoyData.push(null); continue; }
    const prev = selTotals[i-1];
    const curr = selTotals[i];
    let pct = null;
    if (prev && prev !== 0) pct = ((curr - prev)/prev)*100;
    yoyData.push(pct!=null ? +pct.toFixed(2) : null);
  }
  chartYoY = new Chart(document.getElementById('chartYoY'), {
    type: 'line',
    data: { labels: selYears, datasets: [{ label:'Groei % j/j', data: yoyData, spanGaps:true }] },
    options: { responsive:true, plugins:{ legend:{ display:false } }, tension:.25, scales:{ y:{ ticks:{ callback:v=>v+'%' } } } }
  });

  // Active vs Inactive
  chartActive = new Chart(document.getElementById('chartActive'), {
    type: 'bar',
    data: { labels: selYears, datasets: [{ label:'Actief', data: selParticipants }, { label:'Niet-actief', data: selNon }] },
    options: { responsive:true, plugins:{ tooltip:{mode:'index',intersect:false} }, scales:{ y:{ beginAtZero:true } } }
  });
}

function renderPreview(rows){
  const wrap = document.getElementById('tablePreview');
  if (!rows.length){ wrap.innerHTML = '<em>Geen rijen in voorvertoning.</em>'; return; }
  const keys = Object.keys(rows[0]);
  let html = '<table><thead><tr>' + keys.map(k=>`<th>${k}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(r => { html += '<tr>' + keys.map(k=>`<td>${r[k] ?? ''}</td>`).join('') + '</tr>'; });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function loadSample(){
  const rows = [
    { 'NAAM SCHOOL': 'A', 'LONGITUDE': '5,10', 'LATITUDE': '52,10', '2022/2023': 10, '2023/2024': 8, '2024/2025': 'NEE', '2025/2026': 5 },
    { 'NAAM SCHOOL': 'B', 'LONGITUDE': '5,20', 'LATITUDE': '52,20', '2022/2023': 55, '2023/2024': 'NEE','2024/2025': 'NEE','2025/2026': 22 },
    { 'NAAM SCHOOL': 'C', 'LONGITUDE': '5,30', 'LATITUDE': '52,30', '2022/2023': 'NEE', '2023/2024': 12, '2024/2025': 14, '2025/2026': 0 },
    { 'NAAM SCHOOL': 'D', 'LONGITUDE': '5,40', 'LATITUDE': '52,40', '2022/2023': 30, '2023/2024': 25, '2024/2025': 10, '2025/2026': 'NEE' },
    { 'NAAM SCHOOL': 'E', 'LONGITUDE': '5,00', 'LATITUDE': '52,00', '2022/2023': 12, '2023/2024': 9, '2024/2025': 0, '2025/2026': 3 },
    { 'NAAM SCHOOL': 'F', 'LONGITUDE': '4,90', 'LATITUDE': '52,05', '2022/2023': 0, '2023/2024': 'NEE', '2024/2025': 'NEE', '2025/2026': 'NEE' }
  ];
  rawRows = rows;
  refresh();
}
