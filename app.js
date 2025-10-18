let map, markersLayer, heatLayer; let originalRows=[]; const YEAR_KEYS=["2022/2023","2023/2024","2024/2025","2025/2026"];
function initMap(){map=L.map('map').setView([52.2,5.3],7);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);markersLayer=L.layerGroup().addTo(map);heatLayer = L.heatLayer([], { radius: 40, blur: 28, maxZoom: 17, gradient: { 0.0: 'green', 0.5: 'yellow', 1.0: 'red' } });initFilterUI();initViewToggle();}
function normalizeNumber(v){if(v==null)return NaN;const s=String(v).trim().replace(/,/g,'.').replace(/[^\d\.\-]/g,'');const n=parseFloat(s);return Number.isFinite(n)?n:NaN;}
function isYes(v){if(v==null)return false;const s=String(v).trim().toLowerCase();return ['ja','yes','y','true','1','x'].includes(s);}
function asCount(v){if(v==null||String(v).trim()==='')return 0;if(isYes(v))return 1;const n=normalizeNumber(v);return Number.isFinite(n)?n:0;}
function resolveColumns(rows){const keys=Object.keys(rows[0]||{});const m={};keys.forEach(k=>m[String(k).trim().toLowerCase()]=k);const get=(arr)=>{for(const c of arr){const k=c.toLowerCase();if(k in m) return m[k];}return null;};const nameKey=get(['Naam van de School','NAAM VAN DE SCHOOL','NAAM SCHOOL','Naam school','Schoolnaam','School','Naam']);const latKey=get(['Latitude','LATITUDE','Breedtegraad','Lat','LAT','Y']);const lonKey=get(['Longitude','LONGITUDE','Lengtegraad','Lon','LON','X']);return {nameKey,latKey,lonKey};}
function getSelectedYears(){const menu=document.querySelector('#yearFilter .dropdown-menu');if(!menu)return[];return Array.from(menu.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.value);}
function currentViewMode(){const el=document.querySelector('input[name=viewmode]:checked');return el?el.value:'pins';}
function parseRowsToLayers(rows){markersLayer.clearLayers();if(heatLayer)heatLayer.setLatLngs([]);const {nameKey,latKey,lonKey}=resolveColumns(rows);const years=getSelectedYears();const mode=currentViewMode();const bounds=[];const heatPoints=[];rows.forEach((row,idx)=>{const lon=normalizeNumber(row[lonKey]);const lat=normalizeNumber(row[latKey]);if(!Number.isFinite(lon)||!Number.isFinite(lat))return;let total=0;if(years.length){years.forEach(y=>total+=asCount(row[y]));if(total<=0)return;}else{YEAR_KEYS.forEach(y=>total+=asCount(row[y]));if(total<=0)total=1;}if(mode==='pins'){const name=nameKey?row[nameKey]:`Locatie ${idx+1}`;L.marker([lat,lon]).bindPopup(`<strong>${String(name??'')}</strong>`).addTo(markersLayer);}else{heatPoints.push([lat,lon,total]);}bounds.push([lat,lon]);});if(mode==='heat'){
  const MAX_SCALE=150;
  const MIN_INTENSITY=0.18;
  let normalized=heatPoints.map(([lat,lon,t])=>{
    const raw=(t||0)/MAX_SCALE;
    const intensity=Math.max(MIN_INTENSITY, Math.min(1, raw));
    return [lat,lon,intensity];
  });
  const maxI=normalized.reduce((m,p)=>Math.max(m,p[2]),0);
  if(maxI<=MIN_INTENSITY+0.01){
    const maxT=heatPoints.reduce((m,p)=>Math.max(m,p[2]),1);
    normalized=heatPoints.map(([lat,lon,t])=>[lat,lon, Math.min(1,(t||0)/(maxT||1))]);
  }
  heatLayer.setLatLngs(normalized);
  if(!map.hasLayer(heatLayer))heatLayer.addTo(map);
  const legend=document.getElementById('heatLegend');
  if(legend){
    legend.style.display='block';
    const minSpan=legend.querySelector('[data-legend-min]');
    const maxSpan=legend.querySelector('[data-legend-max]');
    if(minSpan)minSpan.textContent='0';
    if(maxSpan)maxSpan.textContent='150';
  }
}else{if(map.hasLayer(heatLayer))map.removeLayer(heatLayer);const legend=document.getElementById('heatLegend');if(legend)legend.style.display='none';}if(bounds.length)map.fitBounds(bounds,{padding:[30,30]});}
async function handleFile(file){if(!file)return;const ext=file.name.split('.').pop().toLowerCase();try{if(ext==='csv'){const text=await file.text();const rows=CSVToArrayOfObjects(text);originalRows=rows;parseRowsToLayers(originalRows);}else{const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array'});const sheet=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet,{defval:null});originalRows=rows;parseRowsToLayers(originalRows);}}catch(e){console.error(e);}}
function CSVToArrayOfObjects(csv){const lines=csv.split(/\r?\n/).filter(l=>l.trim().length);if(!lines.length)return[];let d=',';if(lines[0].includes(';')&&!lines[0].includes(','))d=';';const headers=lines[0].split(d).map(h=>h.trim());const rows=[];for(let i=1;i<lines.length;i++){const cols=lines[i].split(d);const obj={};headers.forEach((h,ix)=>obj[h]=cols[ix]!==undefined?cols[ix].trim():null);rows.push(obj);}return rows;}
function initFilterUI(){const wrap=document.getElementById('yearFilter');const toggle=wrap.querySelector('.dropdown-toggle');const menu=wrap.querySelector('.dropdown-menu');const selEl=document.getElementById('yearSelection');toggle.addEventListener('click',()=>{const opened=menu.classList.toggle('open');toggle.setAttribute('aria-expanded', opened?'true':'false');});document.getElementById('selectAll').addEventListener('click',()=>{menu.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=true);updateSelectionLabel(selEl,menu);});document.getElementById('selectNone').addEventListener('click',()=>{menu.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false);updateSelectionLabel(selEl,menu);});document.getElementById('applyFilter').addEventListener('click',()=>{updateSelectionLabel(selEl,menu);menu.classList.remove('open');if(originalRows.length){parseRowsToLayers(originalRows);}});menu.querySelectorAll('input[type=checkbox]').forEach(c=>{c.addEventListener('change',()=>updateSelectionLabel(selEl,menu));});function updateSelectionLabel(el,menu){const checked=Array.from(menu.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.value);if(checked.length===0)el.textContent='(niets)';else if(checked.length===YEAR_KEYS.length)el.textContent='(alles)';else el.textContent=YEAR_KEYS.filter(y=>checked.includes(y)).join(', ');}const input=document.getElementById('fileInput');input.addEventListener('change',(e)=>handleFile(e.target.files[0]));}
function initViewToggle(){document.querySelectorAll('input[name=viewmode]').forEach(r=>{r.addEventListener('change',()=>{if(originalRows.length){parseRowsToLayers(originalRows);}});});}
document.addEventListener('DOMContentLoaded',()=>initMap());