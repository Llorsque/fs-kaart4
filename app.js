/* Stable pins + heatmap (10–170), full popups */
let map, markersLayer, heatLayer=null;
let originalRows=[];
const YEARS=["2022/2023","2023/2024","2024/2025","2025/2026"];

// Pin color by total
const PIN_THRESHOLDS={ low:40, high:100 };
const PIN_COLORS={ low:'#16a34a', mid:'#f59e0b', high:'#ef4444' };

document.addEventListener('DOMContentLoaded',()=>{initMap();bindUI();});

function initMap(){
  map=L.map('map').setView([52.2,5.3],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
  markersLayer=L.layerGroup().addTo(map);
}
function ensureHeatLayer(){
  if(typeof L==='undefined'||typeof L.heatLayer!=='function'){ setStatus('Heatmap plugin (leaflet-heat) kon niet worden geladen.', true); return false; }
  if(!heatLayer){
    heatLayer=L.heatLayer([], {radius:40, blur:28, maxZoom:17, gradient:{0.0:'green',0.5:'yellow',1.0:'red'}});
  }
  if(!map.hasLayer(heatLayer)) heatLayer.addTo(map);
  return true;
}

function bindUI(){
  document.getElementById('fileInput').addEventListener('change',e=>handleFile(e.target.files[0]));
  document.querySelectorAll('input[name="viewmode"]').forEach(r=>r.addEventListener('change',()=>{ if(originalRows.length) render(); }));
  document.getElementById('applyFilter').addEventListener('click',()=>{ if(originalRows.length) render(); });
  document.getElementById('loadSample').addEventListener('click',loadSample);
}

function setStatus(msg,isError=false){ const el=document.getElementById('status'); el.textContent=msg||''; el.style.color=isError?'#b42318':'#64748b'; }

function normalizeNumber(v){ if(v==null) return NaN; const s=String(v).trim().replace(/,/g,'.').replace(/[^\d\.\-]/g,''); const n=parseFloat(s); return Number.isFinite(n)?n:NaN; }
function isNee(v){ if(v==null) return false; const s=String(v).trim().toLowerCase(); return s==='nee'||s==='no'; }
function asNumericOrNull(v){ if(v==null||String(v).trim()==='') return null; if(isNee(v)) return null; const n=normalizeNumber(v); return Number.isFinite(n)?n:null; }

function resolveColumns(rows){
  if(!rows.length) return {nameKey:null, latKey:null, lonKey:null};
  const keys=Object.keys(rows[0]||{}); const map={}; keys.forEach(k=>map[String(k).trim().toLowerCase()]=k);
  const get=arr=>{ for(const c of arr){ const k=c.toLowerCase(); if(k in map) return map[k]; } return null; };
  const nameKey=get(['Naam van de School','NAAM VAN DE SCHOOL','NAAM SCHOOL','Naam school','Schoolnaam','School','Naam']);
  const latKey=get(['Latitude','LATITUDE','Breedtegraad','Lat','LAT','Y']); const lonKey=get(['Longitude','LONGITUDE','Lengtegraad','Lon','LON','X']);
  return {nameKey,latKey,lonKey};
}

function selectedYears(){ return Array.from(document.querySelectorAll('input[name="year"]:checked')).map(i=>i.value); }
function mode(){ const el=document.querySelector('input[name="viewmode"]:checked'); return el?el.value:'pins'; }

function pinColor(total){ if(total>PIN_THRESHOLDS.high) return PIN_COLORS.high; if(total>=PIN_THRESHOLDS.low) return PIN_COLORS.mid; return PIN_COLORS.low; }

function render(){
  markersLayer.clearLayers();
  if(heatLayer && map.hasLayer(heatLayer)){ heatLayer.setLatLngs([]); map.removeLayer(heatLayer); }

  const {nameKey,latKey,lonKey}=resolveColumns(originalRows);
  if(!latKey||!lonKey){ setStatus('Latitude/Longitude kolommen niet gevonden.', true); return; }

  const years = selectedYears();
  const m = mode();
  const heat=[], bounds=[];

  originalRows.forEach((row, idx)=>{
    const lon=normalizeNumber(row[lonKey]); const lat=normalizeNumber(row[latKey]);
    if(!Number.isFinite(lon)||!Number.isFinite(lat)) return;

    const iter = years.length? years:YEARS;
    const perYear = {};
    let include=false, total=0;
    iter.forEach(y=>{
      const val=asNumericOrNull(row[y]);
      perYear[y] = (val==null? 'NEE' : val);
      if(val!=null){ include=true; total += val; }
    });
    if(!include) return;

    if(m==='pins'){
      const name = nameKey? row[nameKey] : `Locatie ${idx+1}`;
      const color = pinColor(total);
      const marker=L.circleMarker([lat,lon],{radius:8,weight:1.5,color,fillColor:color,fillOpacity:.9});
      const details = YEARS.map(y=> `<li>${y}: <strong>${(asNumericOrNull(row[y])??'NEE')}</strong></li>`).join('');
      marker.bindPopup(`<div style="min-width:240px"><strong>${String(name??'')}</strong><ul style="padding-left:1rem;margin:.4rem 0 0">${details}</ul><div style="margin-top:.45rem;color:#64748b">Totaal (geselecteerd): <strong>${total}</strong></div></div>`);
      marker.addTo(markersLayer);
    }else{
      heat.push([lat,lon,total]);
    }
    bounds.push([lat,lon]);
  });

  if(m==='heat'){
    if(!ensureHeatLayer()) return;
    const MIN=10, MAX=170, FLOOR=0.12;
    // Add to map first, then set data to avoid getSize null errors
    if(!map.hasLayer(heatLayer)) heatLayer.addTo(map);
    const pts = heat.map(([lat,lon,t])=>{
      const clamped=Math.max(MIN, Math.min(MAX, (t||0)));
      const intensity=Math.max(FLOOR, (clamped-MIN)/(MAX-MIN));
      return [lat,lon,intensity];
    });
    heatLayer.setLatLngs(pts || []);
    heatLayer.redraw();
  }

  if(bounds.length) map.fitBounds(bounds,{padding:[30,30]});
  setStatus(`Klaar — ${bounds.length} locaties.`);
}

async function handleFile(file){
  if(!file) return; setStatus('Bestand wordt verwerkt…');
  const ext=file.name.split('.').pop().toLowerCase();
  try{
    if(ext==='csv'){ const text=await file.text(); const rows=CSVToArrayOfObjects(text); originalRows=rows; render(); return; }
    const data=await file.arrayBuffer(); const wb=XLSX.read(data,{type:'array'}); const sheet=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(sheet,{defval:null}); originalRows=rows; render();
  }catch(e){ console.error(e); setStatus('Fout bij lezen van bestand.', true); }
}

function CSVToArrayOfObjects(csv){
  const lines=csv.split(/\r?\n/).filter(l=>l.trim().length); if(!lines.length) return [];
  let d=','; if(lines[0].includes(';')&&!lines[0].includes(',')) d=';';
  const headers=lines[0].split(d).map(h=>h.trim()); const rows=[];
  for(let i=1;i<lines.length;i++){ const cols=lines[i].split(d); const obj={}; headers.forEach((h,ix)=>obj[h]=cols[ix]!==undefined?cols[ix].trim():null); rows.push(obj); }
  return rows;
}

function loadSample(){
  const rows=[
    { 'NAAM SCHOOL':'School A','LONGITUDE':'5,30','LATITUDE':'52,40','2022/2023':12,'2023/2024':15,'2024/2025':'NEE','2025/2026':20 },
    { 'NAAM SCHOOL':'School B','LONGITUDE':'5,10','LATITUDE':'52,20','2022/2023':'NEE','2023/2024':8,'2024/2025':'NEE','2025/2026':5 },
    { 'NAAM SCHOOL':'School C','LONGITUDE':'4,90','LATITUDE':'52,10','2022/2023':55,'2023/2024':'NEE','2024/2025':'NEE','2025/2026':'NEE' },
    { 'NAAM SCHOOL':'School D','LONGITUDE':'5,50','LATITUDE':'52,50','2022/2023':30,'2023/2024':25,'2024/2025':10,'2025/2026':0 }
  ];
  originalRows=rows; render();
}
