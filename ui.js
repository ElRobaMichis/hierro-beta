/* Hierro UI. Classic script: presentation uses the existing training engine. */
const UI_VERSION = '3.14.0';
const UI_ICONS = {
 phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 computer:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
 pin:'<path d="M9 3h6l-1 7 4 4v2H6v-2l4-4-1-7zM12 16v5"/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 plan:'<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/>',
 progress:'<path d="M4 4v16h17M8 15l4-5 4 2 5-7"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="15" cy="17" r="3" fill="var(--surface)"/>',
 gym:'<path d="M4 21V5h11v16M15 10h5v11M2 21h20M8 9h3M8 13h3M8 17h3"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 play:'<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
 shield:'<path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6zM8 12l3 3 5-6"/>',
 share:'<path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8"/>',
 barbell:'<path d="M3 9v6M7 5v14M17 5v14M21 9v6M7 12h10"/>',
 edit:'<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><path d="M13.5 7.5l3 3"/>',
 moon:'<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11z"/>',
 muscle:'<path d="M5 15c-2-5-1-8 2-10l3 3-2 3 2 2c3-4 8-3 10 1 3 6-10 9-15 1z"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>'
};
function uiInlineKey(value){return esc(JSON.stringify(String(value)).slice(1,-1).replace(/'/g,"\\'"));}
function uiIcon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true" class="ui-icon">${UI_ICONS[name]||UI_ICONS.barbell}</svg>`;}
function uiAction(name,...args){return esc(name+'('+args.map(a=>JSON.stringify(a)).join(',')+')');}
function uiGo(v){return uiAction('go',v);}
function uiFocus(id){const focus=()=>document.getElementById(id)?.focus?.({preventScroll:true});if(typeof requestAnimationFrame==='function')requestAnimationFrame(focus);else focus();}
function uiFieldError(id,message){
 const input=document.getElementById(id);if(!input)return;
 input.setCustomValidity?.(message);input.reportValidity?.();input.focus?.();
 input.addEventListener?.('input',()=>input.setCustomValidity(''),{once:true});
}
function uiSaveState(){
 if(!document.querySelector)return;
 let el=document.getElementById('n-storage-warning');
 if(!window.__saveError){el?.remove();return;}
 if(!el){const host=document.querySelector('#modalhost .modal')||document.getElementById('main');host?.insertAdjacentHTML?.('afterbegin','<section id="n-storage-warning" class="n-storage-warning" role="alert"></section>');el=document.getElementById('n-storage-warning');}
 if(el)el.innerHTML=`<b>Estos cambios necesitan guardarse</b><p>${esc(window.__saveError)}</p><div class="n-actions">${uiButton('Volver a guardar','uiRetrySave()','check','secondary')}${uiButton('Descargar copia','exportBackup()','download','text')}</div>`;
 document.querySelectorAll('[data-sync-short]').forEach(n=>n.textContent='Pendiente de guardar');
}
function uiRetrySave(){if(save()){render();if(document.querySelector?.('#modalhost .modal'))closeModal();}}
function uiLoadRecovery(){
 document.getElementById('tabs').innerHTML='';document.getElementById('topbar').innerHTML='';
 document.getElementById('main').innerHTML=`<section class="n-panel n-recovery"><span class="n-eyebrow">Tus datos primero</span><h1>Vamos a recuperar tu espacio.</h1><p>No pudimos leer lo guardado. Conservamos la copia original para que puedas recuperarla.</p><div class="n-actions">${uiButton('Volver a intentar','uiRetryLoad()','arrow')}${uiButton('Descargar datos originales','uiDownloadOriginal()','download','secondary')}${uiButton('Restaurar un respaldo',"document.getElementById('recovery-file').click()",'shield','text')}</div><input id="recovery-file" type="file" accept=".json,application/json" hidden onchange="importBackup(this.files[0]);this.value=''">${uiButton('Recuperar la copia previa a una restauración','uiRestoreLocalCopy()','clock','text')}</section>`;
}
function uiRetryLoad(){db=load();if(window.__loadError){uiLoadRecovery();return;}location.reload();}
function uiDownloadOriginal(){try{const raw=localStorage.getItem(LS_KEY);if(raw)syncDownload('hierro-datos-originales.json',raw);else infoModal('No encontramos una copia','Prueba a restaurar un respaldo que hayas descargado.');}catch{infoModal('No se puede leer el almacenamiento','El navegador está bloqueando el acceso. Conserva los datos del sitio y vuelve a abrir Hierro.');}}
function uiRestoreLocalCopy(){try{const raw=localStorage.getItem(LS_KEY+'.recovery');if(!raw)throw new Error('No hay una copia anterior en este dispositivo.');const d=JSON.parse(raw);if(!validBackup(d))throw new Error('Esta copia necesita otro respaldo para recuperarse.');window.__backup=d;confirmModal('¿Recuperar la copia anterior?','Corresponde al estado previo a la última restauración.','Recuperar',applyBackup,true);}catch(e){infoModal('Copia anterior',esc(e.message));}}
const uiTabMemory={};
function uiTab(name){uxSound('tab');go({... (uiTabMemory[name]||{name})});}
function uiRememberNavigation(v){if(view.name==='history')uiTabMemory.history={...view};if(view.name==='settings')uiTabMemory.settings={...view};if(window.history?.pushState&&!window.__historyPop){try{window.history.pushState({hierroView:v},'');}catch{}}}
function uiInitNavigation(){
 if(window.__navigationReady)return;window.__navigationReady=true;
 try{window.history?.replaceState({hierroView:view},'');}catch{}
 window.addEventListener?.('popstate',event=>{if(!event.state?.hierroView)return;window.__historyPop=true;closeModal();go(event.state.hierroView);window.__historyPop=false;});
 const viewport=window.visualViewport;
 /* iOS no siempre avisa cuando el teclado se cierra: al perder el foco, al volver
    a la app o al girar se vuelve a medir, también tras la animación del teclado. */
 const recheck=()=>{uiKeyboardInset();for(const ms of [60,300,700])setTimeout(uiKeyboardInset,ms);};
 viewport?.addEventListener('resize',uiKeyboardInset);viewport?.addEventListener('scroll',uiKeyboardInset);
 for(const ev of ['focusin','focusout','visibilitychange'])document.addEventListener?.(ev,recheck);
 for(const ev of ['pageshow','orientationchange','resize','focus'])window.addEventListener?.(ev,recheck);
 uiKeyboardInset();
}
/* La barra fija sube solo mientras el teclado está de verdad abierto. Sin un campo
   de texto enfocado no puede haber teclado, así que el hueco es cero aunque el
   navegador conserve una medida vieja (pasa en iOS cuando el campo desaparece al
   redibujar la pantalla, y la barra se quedaba flotando hasta reiniciar la app). */
function uiTypingNow(){
 const el=document.activeElement;
 return !!el&&el.isConnected!==false&&(el.isContentEditable===true||el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&!/^(button|checkbox|radio|range|file|submit|reset|color|image|hidden)$/i.test(el.type||'')));
}
/* Sin teclado, la vista visible puede quedar desplazada respecto a la página: iOS lo
   hace al volver de otra app o de una notificación. La barra fija se ancla a la
   página, así que aparecía a media pantalla con contenido debajo. El desplazamiento
   se compensa moviendo la barra al borde visible y se pide a la página realinearse. */
function uiViewportShift(){
 const viewport=window.visualViewport;
 return viewport&&!uiTypingNow()?Math.max(0,Math.round(viewport.offsetTop||0)):0;
}
function uiRealignViewport(){
 const viewport=window.visualViewport,now=Date.now();
 if(!viewport||now-(window.__viewportNudge||0)<600)return;
 window.__viewportNudge=now;
 try{window.scrollTo((window.scrollX||0)+(viewport.offsetLeft||0),(window.scrollY||0)+(viewport.offsetTop||0));}catch{}
}
function uiKeyboardInset(){
 const viewport=window.visualViewport,typing=uiTypingNow();
 const raw=viewport&&typing?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
 const inset=raw>120?Math.round(raw):0;
 const shift=uiViewportShift();
 const root=document.documentElement?.style;
 root?.setProperty?.('--keyboard-inset',inset+'px');root?.setProperty?.('--viewport-shift',shift+'px');
 if(shift>0)uiRealignViewport();
 return inset;
}

const UI_LEG_GROUPS=['cuadriceps','isquios','pantorrillas'];
function uiMuscleStats(now=Date.now()){
 const counts={},entries={};let untagged=0,total=0,push=0,pull=0;
 for(const h of db.history){
  const date=Date.parse(h.date);if(!Number.isFinite(date)||date>now||date<now-14*864e5)continue;
  for(const e of h.entries){
   const m=exMeta(e.key).muscle,n=e.sets.length;
   if(PUSH_G.includes(m))push+=n;if(PULL_G.includes(m))pull+=n;
   if(date<now-7*864e5)continue;
   total+=n;
   if(!MUSCLES.some(x=>x[0]===m)){untagged+=n;continue;}
   counts[m]=(counts[m]||0)+n;
   (entries[m]||=([])).push({name:e.name,key:e.key,sets:n,date:h.date});
  }
 }
 return {counts,entries,total,untagged,push,pull,max:Math.max(1,...Object.values(counts))};
}

function uiMuscleColor(n,max){return `var(--muscle-${!n?'zero':n/max>.75?'high':n/max>.4?'medium':'low'})`;}

function uiBodySVG(back,stats){
 const c=stats.counts;
 const fill=k=>uiMuscleColor(c[k]||0,stats.max);
 const mirror=(path,key)=>`<path class="ui-muscle" fill="${fill(key)}" d="${path}"/><path class="ui-muscle" fill="${fill(key)}" d="${path}" transform="translate(180 0) scale(-1 1)"/>`;
 const broad=!!c.pierna;
 const legKey=k=>c[k]?k:broad?'pierna':k;
 // Neutral, anatomically segmented front and back. One outline, mirrored limbs.
 const base=`<path class="ui-body-base" d="M90 8C78 8 74 16 75 27L78 39 83 44 82 53 67 60C55 62 48 70 46 83L42 105 34 134 26 157 20 184 13 196 12 208 16 210 20 200 19 215 23 216 26 203 25 218 29 218 32 203 33 211 37 209 37 192 38 181 49 157 54 139 61 121 63 107 68 129 69 153 64 176 66 204 71 230 74 251 72 269 75 294 78 318 76 337 71 346 72 352 89 351 90 335 91 351 108 352 109 346 104 337 102 318 105 294 108 269 106 251 109 230 114 204 116 176 111 153 112 129 117 107 119 121 126 139 131 157 142 181 143 192 143 209 147 211 148 203 151 218 155 218 154 203 157 216 161 215 160 200 164 210 168 208 167 196 160 184 154 157 146 134 138 105 134 83C132 70 125 62 113 60L98 53 97 44 102 39 105 27C106 16 102 8 90 8Z"/>`;
 let parts='';
 parts+=mirror('M65 65C54 66 49 77 49 88L47 101 58 104 65 91 74 79Z','hombros');
 parts+=mirror('M46 139 52 144 45 166 35 184 28 182 33 161Z','antebrazos');
 if(!back){
  parts+=mirror('M85 57 71 63 79 73 88 77 88 57Z','espalda');
  parts+=mirror('M70 79C74 76 84 77 88 80L88 103 77 108 64 102 62 95Z','pecho');
  parts+=mirror('M58 105 50 106 45 127 46 138 53 136 61 116Z','biceps');
  parts+=mirror('M66 107 74 113 74 145 68 156 66 141Z','core');
  for(let i=0;i<4;i++)parts+=mirror(`M77 ${112+i*11} 88 ${110+i*11} 88 ${119+i*11} 77 ${121+i*11}Z`,'core');
  parts+=mirror('M68 159 76 151 88 158 88 170 80 179 69 170Z','core');
  parts+=mirror('M68 177C71 177 78 180 80 184L78 216 78 239 74 241 70 221 68 198Z',legKey('cuadriceps'));
  parts+=mirror('M84 180 88 176 88 204 85 231 81 243 78 238 80 216Z',legKey('cuadriceps'));
  parts+=mirror('M78 258 85 258 86 279 82 310 79 321 77 301 75 275Z',legKey('pantorrillas'));
 }else{
  parts+=mirror('M84 51 78 59 67 64 78 84 89 108 89 55Z','espalda');
  parts+=mirror('M67 85 76 90 88 112 84 143 75 148 67 122Z','espalda');
  parts+=mirror('M76 145 86 128 88 157 84 163 73 159Z','espalda');
  parts+=mirror('M53 105 59 106 62 120 55 139 47 134 47 120Z','triceps');
  parts+=mirror('M73 164C79 162 85 163 88 166L88 191C82 197 72 197 68 189L68 177Z','gluteos');
  parts+=mirror('M69 197 78 201 78 222 76 245 72 241 68 213Z',legKey('isquios'));
  parts+=mirror('M81 201 88 197 87 218 82 244 78 246 80 225Z',legKey('isquios'));
  parts+=mirror('M76 256 82 254 87 264 87 282 82 300 78 296 74 278Z',legKey('pantorrillas'));
 }
 return `<svg viewBox="0 0 180 360" role="img" aria-label="${back?'Vista posterior':'Vista frontal'}: intensidad de series por grupo; consulta las cifras debajo">${base}${parts}<path d="M90 48v112M80 329l-1 12M100 329l1 12" stroke="#80927b" stroke-width=".65" fill="none"/></svg>`;
}

function uiAtlas(compact=false){
 const s=uiMuscleStats();
 const keys=compact?MUSCLES.filter(([k])=>!UI_LEG_GROUPS.includes(k)&&k!=='antebrazos'):MUSCLES;
 const rows=keys.map(([k,l])=>{
  const specific=compact&&k==='pierna'?UI_LEG_GROUPS.reduce((n,g)=>n+(s.counts[g]||0),0):0;
  const n=(s.counts[k]||0)+specific;
  return `<button class="ui-muscle-row" onclick="${uiAction('uiMuscleDetail',k,compact)}" aria-label="${l}: ${n} series registradas"><i style="background:${n?uiMuscleColor(n,Math.max(s.max,n)):uiMuscleColor(0,s.max)};${!n?'border:1px solid #748371':''}"></i><span>${k==='pierna'&&!compact?'Pierna sin desglosar':l}${k==='pierna'&&specific?' *':''}</span><b>${n}</b></button>`;
 }).join('');
 const extra=compact&&(s.counts.antebrazos||0)>0?`<button class="ui-muscle-row" onclick="uiMuscleDetail('antebrazos')"><i style="background:${uiMuscleColor(s.counts.antebrazos,s.max)}"></i><span>Antebrazos</span><b>${s.counts.antebrazos}</b></button>`:'';
 let warnings='';
 if(!compact){
  const high=MUSCLES.filter(([k])=>(s.counts[k]||0)>20);
  if(high.length)warnings+=`<div class="note"><div class="note-t">Una mirada a tu volumen</div><div class="note-d">${high.map(([k,l])=>`${l}: ${s.counts[k]} series`).join(' · ')} en siete días. Revisa el esfuerzo y tu recuperación antes de añadir más.</div></div>`;
  if(s.push+s.pull>=24&&(s.push>s.pull*1.75||s.pull>s.push*1.75))warnings+=`<div class="note"><div class="note-t">Empuje ${s.push} · jalón ${s.pull}</div><div class="note-d">Tu registro de 14 días tiene más series de ${s.push>s.pull?'empuje':'jalón'}. Compáralo con la distribución que buscas en tu plan.</div></div>`;
 }
 return `<section class="ui-panel ui-atlas"><div class="ui-section-head"><h2>Tu semana, en el cuerpo.</h2>${compact?`<button class="ui-link" aria-label="Ver progreso muscular" onclick="go({name:'history'})">${uiIcon('arrow')}</button>`:`<span class="tiny">${s.total} series</span>`}</div><div class="ui-atlas-sub">Grupos trabajados · últimos 7 días</div><div class="ui-bodies"><div class="ui-body-wrap">${uiBodySVG(false,s)}<small>Frente</small></div><div class="ui-body-wrap">${uiBodySVG(true,s)}<small>Espalda</small></div></div><div class="ui-atlas-legend"><span>Sin registro</span><i style="background:var(--muscle-zero);border:1px solid #748371"></i><i style="background:var(--muscle-low)"></i><i style="background:var(--muscle-medium)"></i><i style="background:var(--muscle-high)"></i><span>Más series</span></div><div class="ui-atlas-list">${rows}${extra}</div><p class="ui-atlas-note">${s.total?'Toca un grupo para ver sus ejercicios. El color compara series registradas, no recuperación.':'Tu mapa se iluminará al registrar tus primeras series.'}${s.counts.pierna?' «Pierna» colorea la zona general, sin asignar series a cada músculo.':''}${compact&&UI_LEG_GROUPS.some(g=>s.counts[g])?' * Incluye los grupos específicos de pierna.':''}${s.untagged?` ${s.untagged} series sin grupo asignado.`:''}</p>${warnings}</section>`;
}

function uiMuscleDetail(key,includeLegDetails=true){
 const s=uiMuscleStats(),keys=key==='pierna'&&includeLegDetails?['pierna',...UI_LEG_GROUPS]:[key];
 const title=key==='pierna'&&!includeLegDetails?'Pierna sin desglosar':MUSCLES.find(m=>m[0]===key)?.[1]||key;
 const list=keys.flatMap(k=>(s.entries[k]||[]).map(e=>({...e,group:k}))).sort((a,b)=>b.date.localeCompare(a.date));
 const total=list.reduce((n,e)=>n+e.sets,0);
 openModal(`<h2>${esc(title)}</h2><p class="muted">${total} ${total===1?'serie registrada':'series registradas'} en los últimos 7 días.</p>${list.length?list.map(e=>`<div class="ui-muscle-detail"><b>${esc(exBaseName(e.name))}</b><span>${e.sets} serie${e.sets===1?'':'s'} · ${fmtDate(e.date)}${key==='pierna'?' · '+(MUSCLES.find(x=>x[0]===e.group)?.[1]||e.group):''}</span></div>`).join(''):'<p class="muted">No hay series asignadas a este grupo. Puedes elegir el grupo muscular desde la ficha de cada ejercicio.</p>'}<p class="hint">Se cuenta el grupo principal que asignaste al ejercicio. Los músculos secundarios no suman series automáticamente.</p><button class="btn" style="margin-top:20px" onclick="closeModal()">Listo</button>`);
}


function uiValidSet(key,st){
 const corp=['corporal','tiempo'].includes(exMeta(key).type);
 const blank=st.w===''||st.w===undefined||st.w===null;
 const weight=blank&&corp?0:Number(st.w),reps=Number(st.r);
 return (!blank||corp)&&Number.isFinite(weight)&&weight>=0&&Number.isInteger(reps)&&reps>0;
}

function uiLoadDiffers(key,plan){
 if(!plan)return false;
 // Tower labels retain their native precision; stored kg are rounded to .001.
 const available=plan.kind==='placas'?toKgEx(key,plan.stack.value):plan.total;
 return Math.abs(available-plan.target)>.000501 && fmtWEx(key,available)!==fmtWEx(key,plan.target);
}
function uiLoadStrip(xi){
 const ex=db.active.exercises[xi],key=ex.key;
 if(exMeta(key).type!=='normal')return '';
 const target=targetWeight(ex);if(!(target>0))return '';
 const p=loadPlan(key,target);if(!p)return '';
 let label,number,detail='',closest;
 if(p.kind==='placas'){
  label='Pon el pin en';number=`Placa ${p.stack.index}`;
  if(ex.sugg&&Math.abs(target-ex.sugg.w)>.000501)label='Montaje para tu carga escrita';
  detail=`${fmtStackNum(p.stack.plateValue)} ${p.stack.unit} de torre`;
  if(p.stack.extra>0)detail+=` + ${fmtStackNum(p.stack.extra)} ${p.stack.unit} de ajuste fino`;
  closest=`${fmtStackNum(p.stack.value)} ${p.stack.unit}`;
 }else if(p.kind==='mancuerna'){
  label=p.points===1?'Una mancuerna':'En cada mano';number=`${fmtW(p.dumbbell)} <small>${uLabel()}</small>`;
  closest=`${fmtWEx(key,p.total)} ${uLabelEx(key)}${p.points===2?' entre las dos':''}`;
 }else{
  label=p.points===1?'En un solo lado':p.points===2?'En cada lado':`En cada uno de ${p.points} pitones`;
  number=p.perPoint.length?pointTextHTML(p.perPoint):'Sin discos';
  closest=`${fmtWEx(key,Math.max(0,p.total-p.base))} ${uLabelEx(key)}${p.base>0?' en discos':''}`;
 }
 const differs=uiLoadDiffers(key,p),total=differs?`Más cercano: ${closest}`:p.kind==='placas'?`Total: ${closest}`:'';
 const spoken=`Ver montaje. ${label}: ${number.replace(/<[^>]+>/g,'')}${detail?'. '+detail:''}${total?'. '+total:''}`;
 return `<button class="ui-load-card" aria-label="${esc(spoken)}" onclick="showLoad(${xi})"><span class="ui-load-heading"><span class="ui-load-label">${label}</span><span class="ui-load-link"><span>Ver montaje</span>${uiIcon('chevron')}</span></span><span class="ui-load-number">${number}</span>${detail?`<span class="ui-load-detail">${detail}</span>`:''}${total?`<span class="ui-load-nearest">${total}</span>`:''}</button>`;
}

function uiRefreshLoad(xi){
 const el=document.getElementById('ui-load-'+xi);if(el){const before=el.querySelector?.('.ui-load-number')?.textContent||'';el.innerHTML=uiLoadStrip(xi);uxLoadChanged(el,before);}
}

function uiIsDismissAction(action){
 const a=String(action||'').trim().replace(/;\s*$/,'');
 return a==='closeModal()'||/^uiReturnTo(?:Finish|Receipt)\(/.test(a);
}

/* Device preferences stay local and work without downloaded libraries. */
function uiResolvedTheme(preference,systemDark){return preference==='dark'||(preference!=='light'&&systemDark)?'dark':'light';}
function uiApplyAppearance(){
 if(!document.documentElement)return;
 const root=document.documentElement,theme=uiResolvedTheme(db.settings.theme,!!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
 root.dataset.theme=theme;root.dataset.motion=db.settings.motion==='off'?'off':'on';
 if(db.settings.motion==='off'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)document.getAnimations?.().forEach(animation=>animation.cancel());
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#111b17':'#f4f3ec');
}
function uiSetPreference(key,value,button){
 if(!['theme','sound','vibration','motion'].includes(key))return;
 if(key==='theme'?!['system','light','dark'].includes(value):!['on','off'].includes(value))return;
 db.settings[key]=value;save();
 if(key==='sound'&&value==='on')unlockAudio();
 if(button){button.classList.toggle('on',value==='on');button.setAttribute('aria-checked',String(value==='on'));button.setAttribute('onclick',`uiSetPreference('${key}','${value==='on'?'off':'on'}',this)`);}
 uiApplyAppearance();
 if(key==='theme'){
  document.querySelectorAll?.('[data-theme-choice]').forEach(el=>{const on=el.dataset.themeChoice===value;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on));});
  if(view.name==='exercise')drawChart();
 }
}
function uiMotionKey(){
 const s=db.active;
 return [view.name,view.id,view.key,view.section,view.kind,view.exTab,view.progressTab,view.name==='session'&&s?`${sessionOpenIdx()}:${!!s.uiRest}:${uiCurrentSet(s.exercises[sessionOpenIdx()]||{sets:[]})}:${s.exercises[sessionOpenIdx()]?.warmup?.phase}:${s.exercises[sessionOpenIdx()]?.warmup?.completed}`:''].join('|');
}
function uiAnimateView(){
 const key=uiMotionKey(),changed=window.__motionView!==key;window.__motionView=key;
 if(!changed||db.settings.motion==='off'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const main=document.getElementById('main');
 main?.getAnimations?.().forEach(animation=>animation.cancel());
 // Keep the interactive surface in place while the new content appears.
 if(!uxEnterView(main))main?.animate?.([{opacity:.35},{opacity:1}],{duration:180,easing:'ease-out'});
}
function uiAppearance(){
 return `<div class="n-detail-grid"><section class="n-panel"><span class="n-eyebrow">Tu ambiente</span><h2>La luz que te acompaña.</h2><p>Elige cómo quieres ver Hierro. «Sistema» sigue la apariencia de tu dispositivo.</p><div class="n-theme-options">${[['system','Sistema','settings'],['light','Claro','sun'],['dark','Oscuro','moon']].map(([v,label,icon])=>`<button type="button" data-theme-choice="${v}" class="${db.settings.theme===v?'on':''}" aria-pressed="${db.settings.theme===v}" onclick="uiSetPreference('theme','${v}')">${uiIcon(icon)}<span>${label}</span></button>`).join('')}</div></section><aside class="n-panel">${uiToggle('Animaciones suaves','Transiciones breves entre pantallas y al completar ejercicios. Se respeta el movimiento reducido del sistema.',db.settings.motion!=='off',`uiSetPreference('motion','${db.settings.motion==='off'?'on':'off'}',this)`)}<p class="hint">Los campos permanecen quietos mientras registras una serie.</p></aside></div>`;
}
async function uiTestCues(){
 await unlockAudio();
 const result=beep('finish'),status=document.getElementById('n-cue-test');
 if(status)status.textContent=result.sound?'Aviso reproducido. Ajusta el volumen multimedia de tu dispositivo.':result.vibration?'Se envió el aviso de vibración.':'Activa el sonido para probar el aviso; la vibración depende del dispositivo.';
}
function uiDismissLabel(label,action,hasForm=false){
 if(/minimizar cronómetro/i.test(label))return 'Minimizar cronómetro';
 if(/^uiReturnToReceipt\(/.test(String(action||'')))return 'Volver al detalle';
 if(/^uiReturnToFinish\(/.test(String(action||'')))return 'Volver al resumen';
 return hasForm||/cancelar/i.test(label)||String(action||'').startsWith('stopSetTimer(false)')?'Cancelar':'Cerrar';
}
function uiArrangeActions(root){
 if(!root?.querySelectorAll)return;
 const selector='.modal:not(.full),.modal form,.modal section,.n-panel,.n-gym-card,.n-hero,.n-plan';
 const parents=[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
 const isAction=el=>el?.matches('button.n-primary,button.n-secondary,button.n-text,button.n-danger,button.btn,button.n-dismiss');
 for(const parent of parents){
  let group=[];
  const flush=()=>{
   if(group.length>1){
    const box=document.createElement('div');box.className='n-actions';
    group[0].before(box);for(const button of group){button.style.removeProperty('margin-top');box.append(button);}
   }
   group=[];
  };
  for(const child of [...parent.children]){if(isAction(child))group.push(child);else flush();}
  flush();
 }
}
function uiSetupModal(){
 if(!document.querySelector)return;
 const modal=document.querySelector('#modalhost .modal');if(!modal)return;
 if(!window.__modalReturnFocus?.isConnected)window.__modalReturnFocus=document.activeElement;
 if(!modal.classList.contains('full')){
  const dismiss=[...modal.querySelectorAll('button')].filter(el=>uiIsDismissAction(el.getAttribute('onclick')));
  const seen=new Set();
  for(const button of dismiss){
   const action=String(button.getAttribute('onclick')).trim().replace(/;\s*$/,'');
   if(seen.has(action)){button.remove();continue;}seen.add(action);
   const label=uiDismissLabel(button.textContent,action,!!button.closest('form'));
   button.className='n-dismiss';button.type='button';button.style.removeProperty('margin-top');
   button.innerHTML=(label.startsWith('Volver al ')?uiIcon('back'):'')+'<span>'+label+'</span>';
   button.setAttribute('aria-label',label);
   modal.append(button);
  }
  if(!dismiss.length)modal.insertAdjacentHTML('beforeend','<button class="n-dismiss" type="button" onclick="closeModal()"><span>Cerrar</span></button>');
 }
 uiArrangeActions(modal);
 if(!modal.classList.contains('full')){
  const exits=[...modal.querySelectorAll('.n-dismiss')];
  if(exits.length){const footer=document.createElement('div');footer.className='n-modal-footer';for(const exit of exits)footer.append(exit);modal.append(footer);}
  modal.querySelectorAll('.n-actions:empty').forEach(el=>el.remove());
 }
 uiFormSemantics(modal);uiSaveState();
 const heading=modal.querySelector('h1,h2');if(heading){heading.id='ui-dialog-title';modal.setAttribute('aria-labelledby',heading.id);}
 modal.tabIndex=-1;
 uiSyncModalState();
 modal.focus({preventScroll:true});
 modal.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();closeModal();return;}
  if(e.key!=='Tab')return;
  const nodes=[...modal.querySelectorAll('button:not([disabled]),input:not([type="hidden"]),select,textarea,a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=nodes[0],last=nodes[nodes.length-1];
  if(!first){e.preventDefault();return;}
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal)){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===modal)){e.preventDefault();first.focus();}
 });
}

function uiSyncModalState(){
 if(!document.querySelector)return;
 const open=!!document.querySelector('#modalhost .modal');
 for(const id of ['app','tabs']){const el=document.getElementById(id);if(el)el.inert=open;}
 if(open){
  if(window.__modalOverflow===undefined)window.__modalOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
 }else if(window.__modalOverflow!==undefined){
  document.body.style.overflow=window.__modalOverflow;delete window.__modalOverflow;
 }
}
function uiCloseModal(){
 if(!document.querySelector)return;
 uiSyncModalState();
 if(window.__shareCardURL){URL.revokeObjectURL(window.__shareCardURL);delete window.__shareCardURL;}
 const previous=window.__modalReturnFocus;window.__modalReturnFocus=null;
 if(previous?.isConnected)previous.focus({preventScroll:true});
 if(db.active?.setTimer&&view.name==='session'){const label=document.querySelector('#main button[onclick^="startSetTimer("] span');if(label)label.textContent='Retomar cronómetro';}
 if(view.name==='session'&&!db.active)go({name:'home'});
}

function uiSuggestionInfo(xi){
 const sugg=db.active?.exercises[xi]?.sugg;if(!sugg)return;
 openModal(`<h2>Tu siguiente paso</h2>${verdictHTML(sugg,true)}<p class="n-proposal-help">Aplicar la propuesta rellena el peso y ${exMeta(db.active.exercises[xi].key).type==='tiempo'?'los segundos':'las repeticiones'} del borrador. Pulsa Registrar serie cuando hayas terminado de hacerla; entonces empieza el descanso.</p><button class="btn quiet" style="margin-top:24px" onclick="closeModal()">Volver al entrenamiento</button>`);
}

function uiUseSuggestion(xi){
 const ex=db.active?.exercises[xi];if(!ex||!ex.sugg)return;
 const si=uiCurrentSet(ex);if(si<0)return;
 const st=ex.sets[si];
 if(uiProposalMatches(ex,st))return;
 window.__proposalUndo={ex,st,context:uiProposalContext(ex),previous:{w:st.w,r:st.r,wkg:st.wkg,totalKg:st.totalKg,autoWeightKg:st.autoWeightKg}};
 st.w=inputWEx(ex.key,kgToTyped(ex.key,ex.sugg.w));st.r=String(ex.sugg.reps);
 delete st.wkg;delete st.totalKg;
 st.autoWeightKg=ex.sugg.w;
 window.__proposalUndo.applied={w:st.w,r:st.r};
 db.active.open=xi;save();render();
 const status=document.getElementById('n-draft-status');if(status)status.textContent='Propuesta preparada. Registra al terminar la serie.';
 uxSound('pop');
}
function uiProposalMatches(ex,st){
 return !!ex?.sugg&&String(st?.w??'').trim()!==''&&String(st?.r??'').trim()!==''&&Math.abs(Number(st.w)-Number(inputWEx(ex.key,kgToTyped(ex.key,ex.sugg.w))))<1e-9&&Number(st.r)===ex.sugg.reps;
}
function uiCanUndoProposal(ex){
 const u=window.__proposalUndo;
 return !!u&&u.ex===ex&&u.context===uiProposalContext(ex)&&ex.sets[uiCurrentSet(ex)]===u.st&&!u.st.done&&u.st.w===u.applied.w&&u.st.r===u.applied.r;
}
function uiProposalContext(ex){return JSON.stringify([db.settings.gymId,exUnit(ex.key),exMeta(ex.key).type,effEquip(ex.key),effPoints(ex.key),discosOffset(ex.key)]);}
function uiUndoProposal(xi){
 const ex=db.active?.exercises[xi];if(!uiCanUndoProposal(ex))return;
 const {st,previous}=window.__proposalUndo;
 for(const key of ['w','r','wkg','totalKg','autoWeightKg']){if(previous[key]===undefined)delete st[key];else st[key]=previous[key];}
 delete window.__proposalUndo;save();render();
 const status=document.getElementById('n-draft-status');if(status)status.textContent='Borrador anterior recuperado.';
}
function uiProposalAction(xi){
 const ex=db.active.exercises[xi],matches=uiProposalMatches(ex,ex.sets[uiCurrentSet(ex)]);
 return `<div class="n-proposal-actions"><button class="n-text" id="n-fill-proposal" aria-label="${matches?'Propuesta aplicada':'Aplicar propuesta'}" onclick="uiUseSuggestion(${xi})" ${matches?'disabled':''}><span>${matches?'Aplicada':'Aplicar'}</span>${uiIcon(matches?'check':'copy')}</button>${uiCanUndoProposal(ex)?uiButton('Deshacer',uiAction('uiUndoProposal',xi),'back','text'):''}</div>`;
}
function uiRefreshSuggestionAction(xi){
 const ex=db.active?.exercises[xi],si=ex?uiCurrentSet(ex):-1;
 const button=document.getElementById('n-fill-proposal');if(!button||si<0)return;
 const matches=uiProposalMatches(ex,ex.sets[si]);
 button.disabled=matches;
 button.innerHTML='<span>'+(matches?'Aplicada':'Aplicar')+'</span>'+uiIcon(matches?'check':'copy');
 button.setAttribute?.('aria-label',matches?'Propuesta aplicada':'Aplicar propuesta');
 const status=document.getElementById('n-draft-status');if(status)status.textContent='';
 const undo=button.parentElement?.querySelector('button:last-child');
 if(undo&&undo!==button&&!uiCanUndoProposal(ex))undo.remove();
}

function uiAddRest(){
 if(!db.active)return;
 const remaining=Math.max(0,(restUntil||0)-Date.now());
 restUntil=Date.now()+remaining+30000;
 db.active.restDuration=(remaining+30000)/1000;db.active.restUntil=restUntil;save();tickRest();
}


function uiProgressTab(tab){go({...view,progressTab:tab});}

async function uiShareSession(id,source='finish'){
 const rec=db.history.find(h=>h.id===id);if(!rec)return;uxSound('shutter');
 const origin=document.querySelector?.('#modalhost .modal');
 const cv=document.createElement('canvas');cv.width=1080;cv.height=1350;
 const ctx=cv.getContext('2d'),vol=sessionVolume(rec.entries),sets=rec.entries.reduce((n,e)=>n+e.sets.length,0),prs=rec.prs||[];
 const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#e9b897');bg.addColorStop(.55,'#eee3ca');bg.addColorStop(1,'#f4f3ec');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
 ctx.fillStyle='#285c46';ctx.font='800 44px system-ui';ctx.fillText('hierro.',84,120);
 ctx.fillStyle='#687363';ctx.font='22px system-ui';ctx.fillText(fmtDate(rec.date),84,175);
 ctx.fillStyle='#20372f';ctx.font='600 70px system-ui';ctx.fillText(rec.deload?'Recargar también':'Hoy te lo',84,320);ctx.fillText(rec.deload?'es avanzar.':'ganaste.',84,403);
 ctx.fillStyle='#855727';ctx.font='22px system-ui';ctx.fillText(rec.routineName.slice(0,55).toUpperCase(),84,505);
 const measure=uiSessionMeasure(rec.entries);
 const number=vol>0?fmtInt(fromKg(vol)):String(measure.value);
 let size=142;ctx.font=`600 ${size}px system-ui`;while(ctx.measureText(number).width>900){size-=4;ctx.font=`600 ${size}px system-ui`;}
 ctx.fillStyle='#20372f';ctx.fillText(number,77,702);
 ctx.font='30px system-ui';ctx.fillStyle='#536257';ctx.fillText(vol>0?`${uLabel()} movidos`:measure.unit==='s'?'segundos registrados':'repeticiones registradas',84,770);
 ctx.strokeStyle='#20372f25';ctx.beginPath();ctx.moveTo(84,844);ctx.lineTo(996,844);ctx.stroke();
 const stats=[[fmtDurShort(rec.duration),'DURACIÓN'],[String(sets),'SERIES'],[String(rec.entries.length),'EJERCICIOS']];
 stats.forEach(([v,l],i)=>{ctx.fillStyle='#20372f';ctx.font='500 43px system-ui';ctx.fillText(v,84+i*310,935);ctx.fillStyle='#687363';ctx.font='18px system-ui';ctx.fillText(l,84+i*310,980);});
 ctx.fillStyle='#855727';ctx.font='23px system-ui';ctx.fillText(prs.length?`${prs.length} ${prs.length===1?'nueva marca personal':'nuevas marcas personales'}`:rec.deload?'Tu próxima sesión empieza con recuperar.':'La constancia se construye una sesión a la vez.',84,1104);
 ctx.fillStyle='#687363';ctx.font='19px system-ui';ctx.fillText('MI ESFUERZO CUENTA.  /  HIERRO',84,1248);
 cv.toBlob(blob=>{
  // A late image export must not reopen a sheet the person already left.
  if(origin&&!origin.isConnected)return;
  if(!blob){infoModal('No se pudo crear la tarjeta','Inténtalo de nuevo desde el resumen de tu sesión.');return;}
  if(window.__shareCardURL)URL.revokeObjectURL(window.__shareCardURL);
  const url=URL.createObjectURL(blob);window.__shareCardURL=url;
  openModal(`<h2>Tu esfuerzo, para llevar.</h2><p class="muted">Guarda esta imagen y compártela donde quieras.</p><img class="ui-share-preview" src="${url}" width="1080" height="1350" alt="Tarjeta de ${esc(rec.routineName)}: ${vol>0?fmtInt(fromKg(vol))+' '+uLabel()+' movidos':measure.value+(measure.unit==='s'?' segundos':' repeticiones')}, ${sets} ${sets===1?'serie':'series'}"><a class="btn" href="${url}" download="hierro-${rec.date.slice(0,10)}.png">${uiIcon('download')} Descargar imagen</a><p class="hint">También puedes mantener pulsada la imagen para guardarla.</p><button class="btn ghost" style="margin-top:12px" onclick="${uiAction(source==='diary'?'uiReturnToReceipt':'uiReturnToFinish',rec.id)}">${source==='diary'?'Volver al detalle':'Volver al resumen'}</button>`);
 },'image/png');
}


function uiReturnToFinish(id){const rec=db.history.find(h=>h.id===id);if(!rec)return;closeModal();openFullModal(finishScreenHTML(rec,rec.prs||[],''));}
function uiReturnToReceipt(id){closeModal();uiReceipt(id);}

function uiSessionMeasure(entries){
 const reps=sessionReps(entries.filter(e=>exMeta(e.key).type!=='tiempo'));
 if(reps>0)return {value:reps,unit:'reps'};
 const seconds=entries.filter(e=>exMeta(e.key).type==='tiempo').reduce((n,e)=>n+e.sets.reduce((v,st)=>v+st.r,0),0);
 return {value:seconds,unit:seconds>0?'s':'reps'};
}


Object.assign(UI_ICONS,{
 plate:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M6 8v8M18 8v8"/>',
 dumbbell:'<rect x="3" y="7" width="5" height="10" rx="1.5"/><rect x="16" y="7" width="5" height="10" rx="1.5"/><path d="M8 12h8M1 10v4M23 10v4"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 user:'<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
 back:'<path d="m14 5-7 7 7 7"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 up:'<path d="m6 15 6-6 6 6"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
 trash:'<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 10v7M14 10v7"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
 stack:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14M5 13h14M5 18h14M12 10v1"/>',
 book:'<path d="M3 4h6c2 0 3 1 3 3v14M21 4h-6c-2 0-3 1-3 3M3 4v15h5c2 0 4 2 4 2s2-2 4-2h5V4"/>',
 heart:'<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 5 2 10 8 15 6-5 12-10 8-15z"/>'
});

/* Presentation rebuilt around preparation, one-set training and reflection. */
function uiBrand(){return `<span class="n-brand">${uiIcon('barbell')}hierro</span>`;}
function uiGymButton(){return `<button class="n-gym" onclick="gymPickerModal()" aria-label="Cambiar de gimnasio: ${esc(db.gym.name)}">${uiIcon('gym')}<span>${esc(db.gym.name)}</span>${uiIcon('down')}</button>`;}
function uiButton(label,action,icon='arrow',kind='primary'){return `<button type="button" class="n-${kind}" onclick="${action}"><span>${label}</span>${uiIcon(icon)}</button>`;}
function uiRow(title,sub,action,icon='chevron',prefix=''){return `<button class="n-row" onclick="${action}">${prefix}<span class="grow"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</span>${uiIcon(icon)}</button>`;}
function uiBack(label,action){return `<button class="n-back" onclick="${action}">${uiIcon('back')} ${label}</button>`;}
function uiTitle(eyebrow,title,side=''){return `<div class="n-heading"><div><div class="n-eyebrow">${eyebrow}</div><h1>${title}</h1></div>${side}</div>`;}
function uiResume(){
 if(!db.active)return '';
 const s=db.active,done=s.exercises.reduce((n,e)=>n+e.sets.filter(st=>st.done).length,0);
 return uiRow(esc(s.routineName),`${done} ${done===1?'serie confirmada':'series confirmadas'} · continuar sesión`,uiGo({name:'session'}),'arrow',`<span class="n-row-icon">${uiIcon('play')}</span>`);
}
function uiTop(){
 const top=document.getElementById('topbar');top.className='app';top.style.display='';
 if(document.body.dataset)document.body.dataset.view=view.name;
 const local=typeof syncBadge==='function'?syncBadge():`<span class="n-local"><i></i>En tu dispositivo</span>`;
 let h='';
 if(view.name==='session'&&db.active){top.innerHTML=uiSessionHead();return;}
 if(view.name==='home')h=uiTitle(new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'}),'Un rato para ti.  <br>Un paso más fuerte.',uiGymButton());
 else if(view.name==='history')h=uiTitle('Tu esfuerzo, en perspectiva','Cada sesión deja huella.');
 else if(view.name==='settings'){
 const names={notifications:'Avisos que te acompañan',session:'Preferencias de sesión',appearance:'Tu apariencia',data:'Tus datos, contigo',help:'Aprender con Hierro',gyms:'Tus lugares',sync:'Tu espacio, contigo.'};
  h=view.section?uiBack('Tu espacio',uiGo({name:'settings'}))+uiTitle('A tu manera',names[view.section]||'Tu espacio'):uiTitle('Tu espacio','Hecho a tu manera.');
 } else if(view.name==='splits')h=uiBack('Entrenar',uiGo({name:'home'}))+uiTitle('Organizar entrenamiento','Tu plan, a tu ritmo.');
 else if(view.name==='split'){
  const sp=db.splits.find(s=>s.id===view.id);
  h=uiBack('Tus planes',uiGo({name:'splits'}))+uiTitle(sp?.active?'Plan activo':'Plan guardado',esc(sp?.name||'Plan'),uiButton('Opciones',uiAction('uiPlanOptions',view.id),'more','text'));
 } else if(view.name==='routine'){
  const r=db.routines.find(r=>r.id===view.id);
  h=uiBack(view.dayFrom==='home'?'Tus días':'Volver al plan',uiGo(view.dayFrom==='home'?{name:'home'}:r?.split?{name:'split',id:r.split}:{name:'splits'}))+uiTitle('Tu día de entrenamiento',esc(r?.name||'Día'),uiButton('Opciones',uiAction('uiDayOptions',view.id),'more','text'));
 } else if(view.name==='exercise'){
  const back=view.from==='session'?{name:'session'}:view.from==='history'?{name:'history'}:view.from==='gym'?{name:'gym',kind:'machines'}:view.rid?{name:'routine',id:view.rid,dayFrom:view.dayFrom}:{name:'home'};
  h=uiBack(view.from==='session'?'Volver a la sesión':view.from==='history'?(view.receiptId?'Volver al diario':view.historyReturn?.progressTab==='exercises'?'Volver a ejercicios':'Volver a Evolución'):view.from==='gym'?'Volver a montajes':'Volver al día',(view.from==='history'?'uiBackToProgress()':uiGo(back)))+uiTitle(MUSCLES.find(m=>m[0]===exMeta(view.key).muscle)?.[1]||'Tu ejercicio',esc(exBaseName(view.exname||view.key)));
 } else if(view.name==='gym')h=uiBack(view.inventoryReturn?'Volver al ejercicio':'Mis gimnasios',uiGo(view.inventoryReturn||{name:'settings',section:'gyms'}))+uiTitle('Equipo de este gimnasio',esc(db.gym.name),uiGymButton());
 top.innerHTML=`<div class="n-mobile-brand">${uiBrand()}${local}</div>${h}`;
}
function uiTabs(){
 const active=view.name==='history'||view.from==='history'?'history':['settings','gym'].includes(view.name)?'settings':'home';
 const nav=[['home','barbell','Entrenar'],['history','progress','Evolución'],['settings','user','Tú']].map(([id,ic,label])=>`<button class="${active===id?'on':''}" ${active===id?'aria-current="page"':''} onclick="${uiAction('uiTab',id)}">${uiIcon(ic)}<span>${label}</span></button>`).join('');
 const tabs=document.getElementById('tabs');tabs.setAttribute?.('aria-label','Navegación principal');
 tabs.innerHTML=`<div class="n-nav-inner">${uiBrand()}<div class="n-nav-links">${nav}</div>${typeof syncBadge==='function'?syncBadge():'<span class="n-local"><i></i>En tu dispositivo</span>'}</div>`;
}
function uiWeek(){
 const w=weekStats(),today=new Date();today.setHours(0,0,0,0);
 const days=Array.from({length:7},(_,i)=>{
  const d=new Date(today);d.setDate(d.getDate()-6+i);const end=new Date(d);end.setDate(end.getDate()+1);
  const logged=db.history.some(h=>new Date(h.date)>=d&&new Date(h.date)<end);
  return `<div class="n-week-day ${logged?'done':''} ${i===6?'is-today':''}"><span>${['D','L','M','M','J','V','S'][d.getDay()]}</span><b role="img" aria-label="${esc(d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric'}))}: ${logged?'entrenaste':'sin sesión'}">${logged?uiIcon('check'):d.getDate()}</b></div>`;
 }).join('');
 return `<section class="n-panel n-consistency"><div class="n-section-head"><h2>Estás construyendo algo.</h2>${uiIcon('progress')}</div><div class="n-week-stat"><strong>${w.sessions}</strong><p>${w.sessions===1?'vez que hiciste':'veces que hiciste'} <br>espacio en siete días</p></div><div class="n-week">${days}</div><p>${w.sets} series registradas. <br>${w.sessions?'Tu constancia ya tiene forma.':'Tu primera sesión empieza contigo.'}</p>${uiButton('Ver mi evolución',uiGo({name:'history'}),'arrow','text')}</section>`;
}
function uiHome(){
 const sp=activeSplit(),nx=nextDay();let hero='';
 if(db.active){
  hero=`<section class="n-hero"><span class="n-eyebrow">Tu sesión sigue aquí</span><h2>${esc(db.active.routineName)}</h2><p>Retoma la serie en la que te quedaste.</p><span class="n-tag">${window.__saveError?'Pendiente de guardar':'Guardada en este dispositivo'}</span>${uiButton('Continuar',uiGo({name:'session'}))}</section>`;
 }else if(typeof syncForeign!=='undefined'&&syncForeign){
  hero=syncForeignCard();
 }else if(nx?.routine.exercises.length){
  const r=nx.routine;
  hero=`<section class="n-hero">${uiIcon('barbell')}<span class="n-eyebrow">Tu siguiente entrenamiento</span><h2>${esc(r.name)}</h2><p>${r.exercises.length} ejercicio${r.exercises.length===1?'':'s'} · ${esc(sp.name)}</p><span class="n-tag">Día ${nx.idx+1} de ${nx.total}</span>${uiButton('Empezar',uiAction('uiBeginSession',r.id))}</section>`;
 }else{
  hero=`<section class="n-hero">${uiIcon('barbell')}<span class="n-eyebrow">Empieza con lo que ya haces</span><h2>Tu primer <br>paso.</h2><p>Prepara un día con tus ejercicios. La próxima carga se construye con tu registro.</p>${uiButton(nx?'Añadir ejercicios':'Crear mi primer día',nx?uiGo({name:'routine',id:nx.routine.id,edit:true}):'promptNewRoutine()','plus')}${uiButton('Tengo un plan para importar',uiGo({name:'splits'}),'download','text')}</section>`;
 }
 const fat=systemicFatigue(),fh=failureHabit();
 const review=fat||fh?`<button class="n-advice" onclick="uiTrainingReview()">${uiIcon('moon')}<span><b>Antes de tu próxima sesión</b><small>${fat?'Algunos ejercicios bajaron en tus últimos registros.':'Tu registro muestra varias sesiones al fallo.'}</small></span>${uiIcon('chevron')}</button>`:'';
 const days=uiDaysOverview(sp);
 return `<div class="n-home-grid n-home-with-days">${hero}${days}${uiWeek()}</div>${review}${days?'':`<div class="n-home-footer"><p><b>Tu plan, a tu ritmo.</b> <br>Organiza los días que funcionan para ti.</p>${uiButton('Organizar',uiGo({name:'splits'}),'plan','text')}</div>`}`;
}
function uiChooseDay(){
 const days=splitRoutines(activeSplit()?.id);
 openModal(`<h2>¿Qué día quieres ver?</h2><p class="muted">Mira lo que viene en cualquiera de tus días. Tú eliges cuándo entrenarlo.</p>${days.map((r,i)=>{const p=uiDayForecast(r);return uiRow(esc(r.name),esc(uiDaySummary(p)),`closeModal();${uiAction('uiOpenDay',r.id,view.name==='home'?'home':'plan')}`,'chevron',`<span class="n-number">${i+1}</span>`);}).join('')}${uiButton('Ver todos mis planes',`closeModal();${uiGo({name:'splits'})}`,'plan','text')}${uiButton('Cerrar','closeModal()','close','secondary')}`);
}
function uiTrainingReview(){
 const fat=systemicFatigue(),fh=failureHabit();
 openModal(`<h2>Escucha también el registro.</h2>${fat?`<section class="n-note"><h3>${fat.regressed} de ${fat.evaluated} ejercicios bajaron</h3><p>Revisa cómo te sientes y considera una descarga desde la preparación del día.</p>${uiButton('Entendido · ocultar 10 días','dismissFatigue();closeModal()','check','text')}</section>`:''}${fh?`<section class="n-note"><h3>Varias sesiones al fallo</h3><p>Registraste RIR 0 en ${fh.failSessions} sesiones recientes. Revisa si coincide con la intención de tu plan.</p>${uiButton('Entendido · ocultar 14 días','dismissRIR();closeModal()','check','text')}</section>`:''}${uiButton('Volver','closeModal()','back','secondary')}`);
}

/* A day is prepared first; editing is an explicit, separate mode. */
function uiPlans(){
 const cards=[...db.splits].sort((a,b)=>Number(!!b.active)-Number(!!a.active)).map(sp=>`<section class="n-plan ${sp.active?'active':''}"><span class="n-eyebrow">${sp.active?'Entrenando ahora':'En tu biblioteca'}</span><h2>${esc(sp.name)}</h2><p>${splitRoutines(sp.id).length} día${splitRoutines(sp.id).length===1?'':'s'} · ${nSesiones(splitSessions(sp.id).length)} registradas</p>${uiButton('Abrir plan',uiGo({name:'split',id:sp.id}))}</section>`).join('');
 return `${view.notice?`<p class="n-inline-status" role="status">${uiIcon('check')}${esc(view.notice)}</p>`:''}<div class="n-plan-grid">${cards||`<section class="n-panel"><h2>Un día para empezar.</h2><p>Puedes construir tu plan a partir de los ejercicios que ya haces.</p>${uiButton('Crear primer día','promptNewRoutine()','plus')}</section>`}</div><div class="n-toolbar">${uiButton('Nuevo plan','promptNewSplit()','plus','secondary')}${uiButton('Importar plan',"document.getElementById('splitfile').click()",'download','secondary')}</div><input type="file" id="splitfile" accept=".json,application/json" hidden onchange="importSplitFile(this.files[0]);this.value=''">`;
}
function uiPlanDay(r,i,days){
 const name=esc(r.name),number=`<span class="n-number">${String(i+1).padStart(2,'0')}</span>`;
 if(!view.sort)return `<div class="n-plan-day">${uiRow(name,`${r.exercises.length} ${r.exercises.length===1?'ejercicio':'ejercicios'}`,uiGo({name:'routine',id:r.id}),'chevron',number)}</div>`;
 return `<section class="n-day-order-card" aria-label="Ordenar ${name}"><div class="n-day-order-name">${number}<div><b>${name}</b><small>${r.exercises.length} ${r.exercises.length===1?'ejercicio':'ejercicios'}</small></div></div><div class="n-day-order-actions"><button aria-label="Subir ${name}" ${i===0?'disabled':''} onclick="${uiAction('moveRoutine',r.id,-1)}">${uiIcon('up')}<span>Subir</span></button><button aria-label="Bajar ${name}" ${i===days.length-1?'disabled':''} onclick="${uiAction('moveRoutine',r.id,1)}">${uiIcon('down')}<span>Bajar</span></button><button class="n-day-remove" aria-label="Quitar ${name}" onclick="${uiAction('deleteRoutine',r.id)}">${uiIcon('trash')}<span>Quitar</span></button></div></section>`;
}
function uiPlan(){
 const sp=db.splits.find(x=>x.id===view.id);if(!sp)return uiPlans();const days=splitRoutines(sp.id);
 return `<div class="n-editor-grid"><section><div class="n-section-head"><h2>La secuencia de tus días</h2><span class="n-eyebrow">${days.length} días</span></div>${view.sort?'<p class="n-edit-hint">Cambia el orden con las flechas. Quitar un día conserva todo su historial.</p>':''}${days.map((r,i)=>uiPlanDay(r,i,days)).join('')||'<p class="muted">Añade el primer día a este plan.</p>'}<div class="n-toolbar">${uiButton('Añadir día',uiAction('uiNewDay',sp.id),'plus','secondary')}${days.length?uiButton(view.sort?'Terminar orden':'Ordenar y quitar días','view.sort=!view.sort;render()',view.sort?'check':'plan','text'):''}</div></section><aside class="n-panel n-plan-aside"><span class="n-eyebrow">Una secuencia, sin prisa</span><h2>Tú decides cuándo.</h2><p>El siguiente día sigue al último que completaste. No necesitas entrenar en fechas fijas.</p><div class="n-action-stack">${!sp.active?uiButton('Usar este plan',uiAction('activateSplit',sp.id),'check'):days.length?uiButton('Elegir día para hoy','uiChooseDay()','arrow','secondary'):''}${uiButton('Reglas de este plan',uiAction('uiPlanRules',sp.id),'settings','text')}</div></aside></div>`;
}
function uiPlanRules(id){const sp=db.splits.find(s=>s.id===id);if(!sp)return;openModal(`<h2>Reglas de ${esc(sp.name)}</h2><p class="muted">Los rangos y series de cada ejercicio se personalizan desde su ficha.</p>${uiToggle('Fallo a propósito','El plan incluye llegar al fallo; no mostrar el aviso por hábito de RIR 0.',!!sp.failOk,`uiTogglePlanFailure('${uiInlineKey(id)}',this)`)}${uiButton('Cerrar','closeModal()','close','secondary')}`);}
function uiTogglePlanFailure(id,button){const sp=db.splits.find(s=>s.id===id);if(!sp)return;sp.failOk=!sp.failOk;save();button?.classList.toggle('on',sp.failOk);button?.setAttribute('aria-checked',String(sp.failOk));}
function uiPlanOptions(id){openModal(`<h2>Opciones del plan</h2>${uiRow('Cambiar nombre','',`closeModal();${uiAction('promptRenameSplit',id)}`,'edit')}${uiRow('Exportar plan','Días y configuraciones',`closeModal();${uiAction('exportSplit',id)}`,'share')}${uiRow('Eliminar plan','Conserva las sesiones del historial',`closeModal();${uiAction('deleteSplit',id)}`,'trash')}${uiButton('Volver','closeModal()','back','secondary')}`);}
function uiNewDay(splitId){window.__newDaySplit=splitId;openModal(`<h2>Un nuevo día</h2><p class="muted">Después elegirás sus ejercicios.</p><form class="stack" onsubmit="uiCreateDay(event)"><label class="field"><span>Nombre del día</span><input type="text" id="newroutine" required maxlength="100" placeholder="Ej. Torso A" autocomplete="off"></label><button class="btn" type="submit">Crear y añadir ejercicios</button><button class="btn ghost" type="button" onclick="closeModal()">Cancelar</button></form>`);}
function uiCreateDay(ev){ev.preventDefault();const name=document.getElementById('newroutine').value.trim();if(!name)return;const sp=db.splits.find(s=>s.id===window.__newDaySplit)||activeSplit();if(!sp){createRoutine(ev);return;}const r={id:uid(),name,split:sp.id,exercises:[]};db.routines.push(r);save();closeModal();go({name:'routine',id:r.id,edit:true});uiLibrary(r.id);}
/* A forecast reads the existing coach in the viewed plan, even while another
   plan has a session running. Always restore the engine's context afterward. */
function uiDayForecast(r){
 const previous=ctxSplitOverride;ctxSplitOverride=r.split||null;
 try{
  const items=r.exercises.map(ex=>{
   const key=ex.key,m=exMeta(key),range=effRange(key),suggestion=computeSuggestion(key),both=lastEntries(key),last=both.ctx||both.any;
   const work=last?workWeight(last.entry.sets):null;
   const series=last?last.entry.sets.map((s,i)=>({...s,index:i+1})).filter(s=>s.w===work):[];
   const complete=series.filter(s=>s.r>=range.hi).length;
   const remaining=series.reduce((sum,s)=>sum+Math.max(0,range.hi-s.r),0);
   const tolerated=series.length>=4&&complete===series.length-1;
   let state='new',label='Primera referencia',icon='spark';
   if(suggestion){
    const t=suggestion.type;
    if(t==='back'){state='back';label='Retomar';icon='moon';}
    else if(t==='deload'){state='ease';label=m.type==='asistido'?'Más asistencia':'Ajustar carga';icon='down';}
    else if(t==='hold'){state='hold';label='Consolidar';icon='shield';}
    else if(t==='up'){
     if(m.type==='tiempo'){state='time';label='Sumar tiempo';icon='clock';}
     else if(m.type==='asistido'&&work>0){state='assist';label=suggestion.w===0?'Sin asistencia':'Menos asistencia';icon='progress';}
     else if(m.type==='corporal'||work===0){state='body';label='Sumar reps';icon='progress';}
     else if(suggestion.w>work+1e-9){state='load';label='Subir carga';icon='progress';}
     else {state='equipment';label='Revisar el salto';icon='plate';}
    }else{state=m.type==='tiempo'?'seconds':'reps';label=m.type==='tiempo'?'Sumar tiempo':m.type==='asistido'?'Misma ayuda · suma reps':m.type==='normal'&&work>0?'Mismo peso · suma reps':'Sumar reps';icon=m.type==='tiempo'?'clock':'plus';}
   }
   const ready=['load','assist','time','body'].includes(state),atTop=series.length>0&&complete===series.length;
   let proof=!last?'Tu primera sesión pondrá aquí el punto de partida.':atTop?'Rango completo. Ese trabajo ya está hecho.':`${complete} de ${series.length} series en el tope del rango.`;
   if(last&&!atTop&&remaining===1)proof=`A ${m.type==='tiempo'?'un segundo':'una rep'} de completar el rango.`;
   if(tolerated)proof=`${complete} de ${series.length} series en el tope. El motor admite la más baja.`;
   const load=suggestion?uiForecastLoad(key,suggestion,m):null;
   return {ex,key,type:m.type,range,suggestion,last,work,series,complete,remaining,tolerated,atTop,state,label,icon,ready,proof,load,notes:exerciseNotes(key),otherPlan:!!last&&!both.ctx&&!!r.split,count:suggestion?.sets||splitSetsOverride(key)||1};
  });
  return {routine:r,items,ready:items.filter(x=>x.ready).length,building:items.filter(x=>['reps','seconds'].includes(x.state)).length,holding:items.filter(x=>x.state==='hold').length,adjusting:items.filter(x=>['ease','back','equipment'].includes(x.state)).length,fresh:items.filter(x=>x.state==='new').length,complete:items.filter(x=>x.atTop).length,near:items.filter(x=>x.remaining===1&&!x.ready&&!['back','ease'].includes(x.state)).length,sets:items.reduce((n,x)=>n+x.count,0)};
 }finally{ctxSplitOverride=previous;}
}
function uiForecastLoad(key,s,m){
 const timed=m.type==='tiempo',body=m.type==='corporal'||s.w===0;
 const value=timed||body?String(s.reps):fmtWEx(key,s.w),unit=timed?'s':body?'reps':uLabelEx(key);
 let caption=timed?'objetivo por serie':body?(m.type==='asistido'?'sin asistencia':'objetivo por serie'):m.type==='asistido'?'de asistencia':'carga total';
 let setup='';const p=m.type==='normal'&&s.w>0?loadPlan(key,s.w):null;
 if(p?.kind==='placas')setup=`Placa ${p.stack.index}${stackExtraLabel(p.stack)}`;
 else if(p?.kind==='mancuerna'){setup=`${fmtW(p.dumbbell)} ${uLabel()} ${p.points===1?'en una mano':'en cada mano'}`;caption=p.points===1?'una mancuerna':'total de las dos mancuernas';}
 else if(p){const weights=p.perPoint.length?pointTextHTML(p.perPoint):'Sin discos';setup=`${weights} ${p.points===1?'en el soporte':p.points===2?'por lado':`en cada uno de ${p.points} soportes`}`;if(p.base>0)caption=p.kind==='barra'?'total, incluida la barra':'total, incluido el aparato';}
 if(timed&&s.w>0)setup=`Con ${fmtWEx(key,s.w)} ${uLabelEx(key)} de lastre`;
 if(m.type==='corporal'&&s.w>0)setup=`Con ${fmtWEx(key,s.w)} ${uLabelEx(key)} de lastre`;
 return {value,unit,caption,setup};
}
function uiDaySummary(p){
 if(!p.items.length)return 'Tu día, por construir';
 const reps=p.items.filter(x=>x.state==='reps').length,seconds=p.items.filter(x=>x.state==='seconds').length;
 return [[p.ready,'para avanzar'],[reps,'para sumar reps'],[seconds,'para sumar tiempo'],[p.holding,'por consolidar'],[p.adjusting,'para ajustar o retomar'],[p.fresh,'sin registro']].filter(([n])=>n).map(([n,t])=>`${n} ${t}`).join(' · ');
}
function uiOpenDay(id,origin){
 const r=db.routines.find(x=>x.id===id);if(!r)return;
 go({name:'routine',id,dayFrom:origin||view.dayFrom||'plan'});
}
function uiDaysOverview(sp){
 if(!sp)return '';const days=splitRoutines(sp.id);if(!days.length)return '';
 const next=nextDay()?.routine.id;
 return `<section class="n-days-home" aria-labelledby="n-days-title"><div class="n-section-head"><div><span class="n-eyebrow">${esc(sp.name)}</span><h2 id="n-days-title">Tus días. <span>Lo que viene.</span></h2></div>${uiButton('Organizar',uiGo({name:'splits'}),'plan','text')}</div><p>Abre cualquiera y mira tu próximo paso.</p><div class="n-day-deck">${days.map((r,i)=>{
  const p=uiDayForecast(r),count=p.ready||p.near||p.complete;
  const subtitle=p.ready?`${p.ready===1?'ejercicio para':'ejercicios para'} avanzar`:p.near?`${p.near===1?'ejercicio a un paso':'ejercicios a un paso'} del tope`:p.complete?`${p.complete===1?'rango completo':'rangos completos'}`:p.fresh===p.items.length?'Tu primera referencia te espera.':'Cada serie está construyendo el siguiente paso.';
  return `<button class="n-day-tile ${p.ready?'has-next-step':''}" onclick="${uiAction('uiOpenDay',r.id,'home')}"><span class="n-day-tile-top"><span>${String(i+1).padStart(2,'0')}</span>${r.id===next?'<span class="n-day-next">Siguiente</span>':uiIcon('arrow')}</span><h3>${esc(r.name)}</h3><span class="n-day-tile-count">${count?`<b>${count}</b>`:uiIcon(p.items.length?'spark':'plus')}<span>${p.items.length?subtitle:'Añade tus ejercicios'}</span></span><span class="n-day-tile-bottom">${r.exercises.length} ejercicios · Ver próxima sesión</span></button>`;
 }).join('')}</div></section>`;
}
function uiDayNavigator(r){
 const days=splitRoutines(r.split);if(days.length<2)return '';
 const next=nextDay()?.routine.id;
 return `<label class="n-day-selector field"><span>Consultar otro día</span><select aria-label="Día de este plan" onchange="uiOpenDay(this.value)">${days.map(d=>`<option value="${esc(d.id)}" ${d.id===r.id?'selected':''}>${esc(d.name)}${d.id===next?' · Siguiente':''}</option>`).join('')}</select></label>`;
}
function uiForecastCard(p,r,i){
 const s=p.suggestion,timed=p.type==='tiempo',unit=timed?'s':'reps';
 const lastLabel=p.last?`${fmtDateShort(p.last.session.date)}${p.work>0?' · '+fmtWEx(p.key,p.work)+' '+uLabelEx(p.key)+(p.type==='asistido'?' de ayuda':['corporal','tiempo'].includes(p.type)?' de lastre':' totales'):''}`:'';
 const repsBased=timed||p.type==='corporal'||p.work===0,oldReps=Math.max(0,...p.series.map(st=>st.r));
 const change=s?(repsBased?s.reps-oldReps:s.w-p.work):0;
 const delta=s&&change?`${change>0?'+':'−'}${repsBased?Math.abs(change):fmtWEx(p.key,Math.abs(change))} ${repsBased?unit:uLabelEx(p.key)}${p.type==='asistido'&&p.work>0?' de ayuda':''}`:'';
 const reason=p.state==='equipment'?'El motor propone avanzar, pero el inventario deja la propuesta en el mismo peso. Revisa el equipo disponible desde la ficha antes de aumentar.':p.tolerated?s?.why.replace('en todas las series','en las series que el motor toma como referencia'):s?.why;
 return `<article class="n-forecast ${p.ready?'is-ready':''}" aria-labelledby="n-forecast-${i}"><div class="n-forecast-head"><span class="n-number">${String(i+1).padStart(2,'0')}</span><button id="n-forecast-${i}" class="n-forecast-title" onclick="${uiAction('openExercise',r.id,p.ex.id)}" aria-label="${esc(p.ex.name)}: ver evolución y ajustes"><h3>${esc(exBaseName(p.ex.name))}</h3>${uiIcon('chevron')}</button></div><span class="n-forecast-state state-${p.state}">${uiIcon(p.icon)}${p.label}</span>${s?`<div class="n-forecast-target"><div><strong>${p.load.value}</strong><span>${p.load.unit}</span></div>${delta?`<span class="n-forecast-delta">${delta}</span>`:''}</div><p class="n-forecast-prescription">${p.count} ${p.count===1?'serie':'series'}${!timed&&p.load.unit!=='reps'?` · apunta a <b>${s.reps} reps</b>`:` · ${p.load.caption}`}</p>${!timed&&p.load.unit!=='reps'?`<span class="n-forecast-caption">${p.load.caption}</span>`:''}${p.load.setup?`<div class="n-forecast-setup">${uiIcon('barbell')}<span>${p.load.setup}</span></div>`:''}`:`<div class="n-forecast-first">Tu punto <br>de partida.</div><p class="n-forecast-prescription">${p.count} ${p.count===1?'serie':'series'} · rango ${p.range.lo}–${p.range.hi} ${unit}</p><p class="n-forecast-caption">Registra lo que hagas. La próxima propuesta partirá de ahí.</p>`}<div class="n-range-story"><div class="n-range-heading"><span>${p.last?'Último registro':'Aún sin registro'}</span>${p.last?`<time datetime="${esc(p.last.session.date)}">${lastLabel}</time>`:''}</div>${p.last?`<div class="n-range-series">${p.series.map(st=>`<div class="n-range-set ${st.r>=p.range.hi?'is-full':''}"><span>S${st.index}</span><b>${st.r}${st.r>=p.range.hi?uiIcon('check'):''}</b><span class="n-range-track" role="meter" aria-label="Serie ${st.index}: ${st.r} ${unit}; tope ${p.range.hi}" aria-valuemin="0" aria-valuemax="${p.range.hi}" aria-valuenow="${Math.min(st.r,p.range.hi)}"><i style="width:${Math.min(100,Math.max(0,st.r/p.range.hi*100))}%"></i></span></div>`).join('')}</div><div class="n-range-scale"><span>${timed?'Segundos':'Repeticiones'} · rango ${p.range.lo}–${p.range.hi}</span><span>Tope ${p.range.hi}</span></div>`:''}<p class="n-range-proof">${p.atTop?uiIcon('check'):p.remaining===1?uiIcon('spark'):''}<span>${p.proof}</span></p>${p.last&&p.series.length<p.last.entry.sets.length?'<small>Se muestran las series al peso de trabajo; hubo otras cargas en ese registro.</small>':''}${p.otherPlan?'<small>Referencia tomada de otro plan.</small>':''}</div>${p.notes?`<p class="n-forecast-note">${uiIcon('pin')}<span>${esc(p.notes)}</span></p>`:''}${reason?`<details class="n-forecast-why"><summary>Por qué esta propuesta${uiIcon('down')}</summary><p>${reason}</p>${p.tolerated?'<p>Con cuatro o más series al mismo peso, el motor permite que la peor quede por debajo. El registro de arriba muestra cada serie tal como la hiciste.</p>':''}${s.sets!==p.last.entry.sets.length?`<p>La próxima sesión propone ${s.sets} series; en este registro hiciste ${p.last.entry.sets.length}.</p>`:''}</details>`:''}</article>`;
}
function uiRoutineCards(r){
 return uiDayForecast(r).items.map(({ex,range,count},i)=>{
  const m=exMeta(ex.key);
  return `<div class="n-exercise-row ${view.sort?'is-sorting':''}">${uiRow(esc(exBaseName(ex.name)),`${count} ${count===1?'serie':'series'} · ${range.lo}–${range.hi} ${m.type==='tiempo'?'s':'reps'} · ${MUSCLES.find(x=>x[0]===m.muscle)?.[1]||'Sin grupo'}`,uiAction('openExercise',r.id,ex.id),'chevron',`<span class="n-number">${String(i+1).padStart(2,'0')}</span>`)}${view.sort?`<div class="n-row-edit">${view.sort?`<button aria-label="Subir ${esc(ex.name)}" ${i===0?'disabled':''} onclick="${uiAction('moveEx',r.id,i,-1)}">${uiIcon('up')}</button><button aria-label="Bajar ${esc(ex.name)}" ${i===r.exercises.length-1?'disabled':''} onclick="${uiAction('moveEx',r.id,i,1)}">${uiIcon('down')}</button>`:''}<button aria-label="Quitar ${esc(ex.name)} del día" onclick="${uiAction('removeExercise',r.id,ex.id)}">${uiIcon('trash')}</button></div>`:''}</div>`;
 }).join('');
}
function uiRoutine(){
 const r=db.routines.find(x=>x.id===view.id);if(!r)return uiHome();
 const p=uiDayForecast(r),headline=p.ready?'Tu esfuerzo abre <br>el siguiente paso.':p.near?'El siguiente paso <br>está muy cerca.':p.fresh===p.items.length?'Aquí empieza <br>lo que viene.':'Cada serie cuenta. <br>La próxima, también.';
 const hero=r.exercises.length?`<section class="n-day-hero"><div class="n-day-hero-copy"><span class="n-eyebrow">La próxima vez</span><h2>${headline}</h2><p>${uiDaySummary(p)}.</p><div class="n-day-highlights">${p.complete?`<span>${uiIcon('check')} ${p.complete} ${p.complete===1?'rango completo':'rangos completos'}</span>`:''}${p.near?`<span>${uiIcon('spark')} ${p.near} ${p.near===1?'ejercicio a un paso':'ejercicios a un paso'}</span>`:''}<span>${p.items.length} ${p.items.length===1?'ejercicio':'ejercicios'} · ${p.sets} ${p.sets===1?'serie propuesta':'series propuestas'}</span></div></div><div class="n-day-start">${uiGymButton()}${uiButton(db.active?'Continuar sesión':'Empezar este día',uiAction('uiBeginSession',r.id),'play')}<p>La propuesta se actualiza con tu registro y el equipo de este gimnasio.</p></div></section>`:'';
 return `${uiDayNavigator(r)}${hero}<section class="n-day-exercises"><div class="n-section-head"><h2>${view.sort?'Ordena tu día':'Tu próxima sesión'}</h2>${r.exercises.length?uiButton(view.sort?'Terminar orden':'Ordenar y quitar','view.sort=!view.sort;render()',view.sort?'check':'list','text'):''}</div>${view.sort?'<p class="n-edit-hint">Usa las flechas para cambiar el orden. Quitar un ejercicio conserva su historial.</p>':''}${view.sort?uiRoutineCards(r):p.items.length?`<div class="n-forecast-grid">${p.items.map((x,i)=>uiForecastCard(x,r,i)).join('')}</div>`:'<div class="n-empty"><h2>Dale forma a este día.</h2><p>Busca un ejercicio que ya usas o crea uno nuevo.</p></div>'}<div class="n-toolbar">${uiButton('Añadir ejercicios',uiAction('uiLibrary',r.id),'plus','secondary')}${r.exercises.length?uiButton('Hacer una descarga',uiAction('uiDeload',r.id),'moon','text'):''}</div></section>`;
}

function uiDeload(rid){confirmModal('Una sesión para recuperar','Se propondrá cerca de un 10 % menos de carga y la mitad de series. Esta sesión no modifica tu progresión normal ni compite por récords.','Empezar descarga',()=>uiBeginSession(rid,true),true);}
function uiDayOptions(id){openModal(`<h2>Opciones del día</h2>${uiRow('Cambiar nombre','',`closeModal();${uiAction('promptRenameRoutine',id)}`,'edit')}${uiRow('Copiar o mover a otro plan','',`closeModal();${uiAction('promptMoveRoutine',id)}`,'plan')}${uiRow('Eliminar día','Su historial se conserva',`closeModal();${uiAction('deleteRoutine',id)}`,'trash')}${uiButton('Volver','closeModal()','back','secondary')}`);}
function uiLibrary(rid=null){
 window.__libraryRid=rid;
 openModal(`<h2>Añadir ejercicio</h2><p class="muted">Reutiliza uno de tus ejercicios o escribe un nombre nuevo.</p><label class="field"><span>Buscar o crear</span><input id="n-ex-search" type="search" placeholder="Ej. Press de banca" autocomplete="off" oninput="uiLibraryResults()"></label><p id="n-library-status" class="hint" role="status"></p><div id="n-ex-results"></div>${!rid?`<label class="n-check-label"><input type="checkbox" id="n-add-routine" checked> Añadir también al día del plan</label>`:''}${uiButton('Volver','closeModal()','back','secondary')}`);
 uiLibraryResults();
}
function uiLibraryResults(){
 const query=document.getElementById('n-ex-search').value.trim(),rid=window.__libraryRid;
 const used=rid?db.routines.find(r=>r.id===rid)?.exercises:db.active?.exercises;
 const names=[...allExerciseNames()].filter(([k,info])=>!used?.some(e=>e.key===k)&&exKey(info.name).includes(exKey(query))).slice(0,20);
 const items=names.map(([key,info])=>uiRow(esc(info.name),`${MUSCLES.find(m=>m[0]===exMeta(key).muscle)?.[1]||'Sin grupo'} · ${EQUIP[effEquip(key)]?.label||'Equipo por definir'}`,uiAction('uiLibraryAdd',info.name),'plus')).join('');
 const exact=allExerciseNames().has(exKey(query));
 document.getElementById('n-ex-results').innerHTML=`${query&&!exact?uiRow(`Crear «${esc(query)}»`,'Ejercicio nuevo',uiAction('uiLibraryAdd',query),'plus'):''}${items||(!query?'<p class="hint">Los ejercicios que crees aparecerán aquí para reutilizarlos.</p>':'<p class="hint">Si ya está en este día, no se añadirá otra vez.</p>')}`;
}
function uiLibraryAdd(name,config=null){
 const rid=window.__libraryRid,key=exKey(name);if(!key)return;
 if(!config&&!allExerciseNames().has(key)){uiCreateExerciseForm(name);return;}
 const routine=rid?db.routines.find(x=>x.id===rid):null;
 if(rid?(!routine||routine.exercises.some(e=>e.key===key)):(!db.active||db.active.exercises.some(e=>e.key===key)))return;
 if(!commitChange(()=>{
 if(config){const meta=exMeta(key);meta.type=config.type;meta.equip=config.equip;}
 if(rid){
  const r=db.routines.find(x=>x.id===rid);if(!r||r.exercises.some(e=>e.key===key))return;
  r.exercises.push({id:uid(),name:allExerciseNames().get(key)?.name||name,key});
 }else{
  if(!db.active||db.active.exercises.some(e=>e.key===key))return;
  if(document.getElementById('n-add-routine')?.checked){const r=db.routines.find(r=>r.id===db.active.routineId);if(r&&!r.exercises.some(e=>e.key===key))r.exercises.push({id:uid(),key,name});}
  const sg=computeSuggestion(key),sugg=db.active.deload?deloadSugg(key,sg):sg;
  db.active.exercises.push({key,name,sugg,sets:Array.from({length:sugg?.sets||splitSetsOverride(key)||1},()=>({w:'',r:'',rir:''}))});
  db.active.open=db.active.exercises.length-1;uiResetRest();
 }
 const m=exMeta(key);if(!config&&/assisted|asistid/i.test(name))m.type='asistido';if(!m.muscle)m.muscle=guessMuscle(name)||null;if(!m.equip)m.equip=guessEquip(name)||null;
 }))return;
 render();if(rid){uiLibrary(rid);document.getElementById('n-library-status').textContent=name+' añadido. Puedes elegir otro.';uiFocus('n-ex-search');}else closeModal();
}

/* The active screen is a single set. Confirming it changes to the rest phase. */
function uiCreateExerciseForm(name){
 window.__newExerciseName=name;
 const type=/plancha|plank|hang|colgar|isom[eé]tric/i.test(name)?'tiempo':/asistid|assisted/i.test(name)?'asistido':'normal';
 const equip=guessEquip(name)||(type==='tiempo'?'nada':'barra');
 openModal(`<h2>${esc(name)}</h2><p class="muted">Elige cómo lo registrarás. Puedes ajustarlo después.</p><form class="stack" onsubmit="uiCreateLibraryExercise(event)"><label class="field"><span>Cómo mides la serie</span><select id="n-new-type">${[['normal','Peso y repeticiones'],['tiempo','Segundos'],['corporal','Repeticiones · peso corporal'],['asistido','Asistencia y repeticiones']].map(([v,l])=>`<option value="${v}" ${v===type?'selected':''}>${l}</option>`).join('')}</select></label><label class="field"><span>Equipo</span><select id="n-new-equip">${EQUIP_KEYS.map(k=>`<option value="${k}" ${k===equip?'selected':''}>${EQUIP[k].label}</option>`).join('')}</select></label><button class="btn" type="submit">Añadir a este día</button><button class="btn ghost" type="button" onclick="uiLibrary(window.__libraryRid)">Volver a la búsqueda</button></form>`);
}
function uiCreateLibraryExercise(event){event.preventDefault();uiLibraryAdd(window.__newExerciseName,{type:document.getElementById('n-new-type').value,equip:document.getElementById('n-new-equip').value});}
function uiSessionHead(){
 const s=db.active,done=s.exercises.reduce((n,e)=>n+e.sets.filter(st=>st.done).length,0),total=s.exercises.reduce((n,e)=>n+e.sets.length,0);
 return `<div class="n-session-top">${uiButton('Minimizar',uiGo({name:'home'}),'down','text')}<div><b>${esc(s.routineName)}</b><span id="clock">${fmtClock(Math.floor((Date.now()-s.start)/1000))}</span>${s.deload?'<span> · Descarga</span>':''}</div>${uiButton('Terminar','askFinish()','check','text')}</div><div class="n-session-track" role="progressbar" aria-label="Series confirmadas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${total?done/total*100:0}%"></i></div>`;
}
function uiProposalTitle(ex){
 const type=exMeta(ex.key).type,sg=ex.sugg;
 if(sg.label)return sg.label;
 if(type==='tiempo')return ['up','reps'].includes(sg.type)?'Suma tiempo':sg.type==='hold'?'Consolida tu duración':'Tu siguiente duración';
 if(type==='asistido')return sg.type==='up'?'Reduce la ayuda':sg.type==='reps'?'Suma una repetición':'Tu siguiente paso';
 if(type==='corporal'&&sg.type==='up')return 'Suma repeticiones';
 return {up:'Puedes subir de peso',reps:'Suma una repetición',hold:'Consolida esta carga',deload:'Un paso más ligero',sets:'Revisa tus series'}[sg.type]||'Tu siguiente paso';
}
function uiProposalValue(ex){
 const type=exMeta(ex.key).type,sg=ex.sugg,w=fmtWEx(ex.key,kgToTyped(ex.key,sg.w));
 if(type==='tiempo')return `${sg.reps} s${sg.w>0?` · ${w} ${uLabelEx(ex.key)} de lastre`:''}`;
 if(type==='corporal'&&!sg.w)return `${sg.reps} reps`;
 return `${w} ${uLabelEx(ex.key)}${type==='asistido'?' de ayuda':''} · ${sg.reps} reps`;
}
/* Antes de empezar: ¿el gimnasio activo es donde estás? Con ubicaciones guardadas se
   pregunta al teléfono, como mucho 4 s y con salida inmediata; sin ellas decide el historial. */
function uiBeginSession(rid,deload=false){
 if(db.active||db.gyms.length<2||(typeof syncForeign!=='undefined'&&syncForeign)){startSession(rid,deload);return;}
 const token=window.__gymCheck=uid();
 if(!db.gyms.some(g=>validGeo(g.geo))){uiGymCheckResolve(token,rid,deload,null,false);return;}
 /* la marca va en el párrafo: el título lo renombra la accesibilidad del diálogo */
 openModal(`<h2>Comprobando tu gimnasio…</h2><p class="muted" data-gym-check="${token}">Vemos si sigues en «${esc(db.gym.name)}». Tarda unos segundos como mucho.</p>${uiButton(`Empezar en ${esc(db.gym.name)}`,uiAction('uiGymCheckAnswer',token,rid,!!deload,''),'play')}`);
 locateOnce(4000,false).then(pos=>uiGymCheckResolve(token,rid,deload,pos,true));
}
function uiGymCheckResolve(token,rid,deload,pos,waited){
 if(window.__gymCheck!==token)return;
 /* si la persona cerró la comprobación, una lectura tardía no abre ni empieza nada */
 if(waited&&!String(document.getElementById('modalhost')?.innerHTML||'').includes(`data-gym-check="${token}"`)){window.__gymCheck=null;return;}
 const d=gymCheckDecision(pos);
 if(!d){window.__gymCheck=null;closeModal();startSession(rid,deload);return;}
 const here=esc(db.gym.name),there=esc(d.gym.name);
 openModal(`<h2>${d.kind==='geo'?`Parece que estás en «${there}».`:`¿Entrenas hoy en «${here}»?`}</h2><p class="muted">${d.kind==='geo'?`Tu ubicación queda a unos ${d.meters} m de ese gimnasio, pero el activo es «${here}».`:`El gimnasio activo es «${here}», pero tus últimas sesiones fueron en «${there}».`} Las cargas propuestas y el montaje dependen del gimnasio.</p>${uiButton(`Cambiar a ${there} y empezar`,uiAction('uiGymCheckAnswer',token,rid,!!deload,d.gym.id),'play')}${uiButton(`Seguir en ${here}`,uiAction('uiGymCheckAnswer',token,rid,!!deload,''),'arrow','secondary')}`);
}
function uiGymCheckAnswer(token,rid,deload,gymId){
 if(window.__gymCheck!==token)return;window.__gymCheck=null;closeModal();
 if(gymId&&gymId!==db.settings.gymId)setActiveGym(gymId);
 startSession(rid,deload);
}
function uiCurrentSet(ex){return ex.sets.findIndex(st=>!st.done);}
/* lo que cargaste la última vez en este ejercicio, para elegir con referencia */
function uiLastEntry(key){
 let last=null;const split=db.active?.splitId||db.routines.find(r=>r.id===db.active?.routineId)?.split;
 withSplitContext(split,()=>{last=lastEntry(key);});
 return last&&last.entry.sets.length?last:null;
}
function uiLastLoad(xi){
 const ex=db.active.exercises[xi],last=uiLastEntry(ex.key);if(!last)return '';
 return `<div class="n-last-load"><span><small>Última vez · ${esc(fmtDateShort(last.session.date))}</small><b>${esc(setsLine(ex.key,last.entry.sets))}</b></span></div>`;
}
function uiSetDisplay(key,st){return `${st.w!==''?fmtWEx(key,recordedSetKg(key,st))+' '+uLabelEx(key)+' total':'—'} × ${st.r!==''?esc(st.r):'—'}${exMeta(key).type==='tiempo'?' s':''}`;}
function uiSetProposal(xi,hasPrevious){
 const ex=db.active.exercises[xi];
 return `<div class="n-set-proposal"><button class="n-set-target" onclick="uiSuggestionInfo(${xi})" aria-label="Ver propuesta: ${esc(uiProposalValue(ex))}"><span>${esc(uiProposalTitle(ex))}</span><strong>${uiProposalValue(ex)}${uiIcon('info')}</strong></button>${hasPrevious?'':uiProposalAction(xi)}</div>`;
}
function uiSession(){
 const s=db.active;if(!s.exercises.length)return `<div class="n-empty">${uiGymButton()}<h2>Empieza con un ejercicio.</h2><p>Tu sesión está guardada. Añade lo que vas a entrenar.</p>${uiButton('Añadir ejercicio','uiLibrary()','plus')}</div>`;
 const xi=sessionOpenIdx(),ex=s.exercises[xi],si=uiCurrentSet(ex),m=exMeta(ex.key),r=effRange(ex.key),complete=si<0;
 const resting=!!s.uiRest,preparing=!resting&&!complete&&warmupRequired(xi);
 const title=`<div class="n-ex-heading"><div><span class="n-eyebrow">Ejercicio ${String(xi+1).padStart(2,'0')} / ${String(s.exercises.length).padStart(2,'0')}</span><h1>${esc(exBaseName(ex.name))}</h1></div><button class="n-round" aria-label="Ver cola de ejercicios" onclick="uiSessionQueue()">${uiIcon('list')}</button></div>`;
 let work='';
 if(preparing){
  work=uiWarmup(xi);
 }else if(resting){
  const rem=Math.max(0,Math.ceil(((restUntil||0)-Date.now())/1000));
  const nextIndex=complete?s.exercises.findIndex((e,i)=>i!==xi&&!exDone(e)):xi;
  const nextCopy=nextIndex>=0?pushNextCopy(s,nextIndex):{body:'Todo listo para terminar y guardar.'};
  const restOrigin=Math.max(0,s.exercises.findIndex(e=>e.key===s.restKey));
  work=`<div class="n-rest-phase"><span id="n-rest-announcement" class="sr-only" role="status"></span><div class="n-rest-status">${uiIcon('check')}Serie guardada</div><div class="rest ${rem?'on':'done'}" id="rest"><span id="restlabel">${rem?'Descansando':'Descanso listo'}</span><strong id="resttime">${rem?fmtClock(rem):'¡Vamos!'}</strong><div class="rest-track"><div id="restfill" class="rest-fill"></div></div></div><p>Respira. La siguiente puede esperar.</p>${uiButton('+30 segundos','uiAddRest()','plus','text')}<div class="n-rest-next"><span class="n-number">${complete?uiIcon('check'):si+1}</span><div><b>${complete?'Ejercicio completo':`Siguiente: serie ${si+1} de ${ex.sets.length}`}</b><small>${esc(nextCopy.body)}</small></div></div>${uiButton(rem?'Saltar descanso':'Continuar','uiContinue()')}${uiButton('Corregir la última serie',uiAction('uiEditSet',restOrigin,Math.max(0,s.exercises[restOrigin].sets.findLastIndex(st=>st.done))),'edit','text')}</div>`;
 }else if(complete){
  const next=s.exercises.findIndex((e,i)=>i!==xi&&!exDone(e));
  work=`<section class="n-ex-complete"><span class="n-complete-mark">${uiIcon('check')}</span><h2>Una más, hecha.</h2><p>${ex.sets.length} series de ${esc(exBaseName(ex.name))} confirmadas.</p>${uiButton(next<0?'Terminar sesión':`Siguiente: ${esc(exBaseName(s.exercises[next].name))}`,next<0?'askFinish()':uiAction('uiSelectExercise',next))}${uiButton('Añadir otra serie',uiAction('uiAddSet',xi),'plus','text')}</section>`;
 }else{
  const st=ex.sets[si],corp=['corporal','tiempo'].includes(m.type),repsLabel=m.type==='tiempo'?'Segundos':'Repeticiones';
  const weightLabel=effEquip(ex.key)==='mancuerna'&&effPoints(ex.key)===2?'Total de las dos':discosOffset(ex.key)>0?'Discos totales':m.type==='asistido'?'Ayuda':corp?'Lastre opcional':'Peso';
  const offset=discosOffset(ex.key),hint=offset>0?'Sin '+(effEquip(ex.key)==='barra'?'la barra':'el aparato'):effEquip(ex.key)==='mancuerna'&&effPoints(ex.key)===2?'Suma ambas manos':m.type==='asistido'?'Menos ayuda = más esfuerzo':corp?'Vacío = sin lastre':uLabelEx(ex.key);
  const prev=ex.sets.slice(0,si).reverse().find(x=>x.done);
  work=`<div class="n-current-label"><span class="n-eyebrow">Serie ${si+1} de ${ex.sets.length}</span>${prev?uiButton('Repetir anterior',uiAction('uiRepeatSet',xi),'copy','text'):''}</div>${ex.sugg?uiSetProposal(xi,!!prev):`<p class="n-first-hint">${corp?'Registra lo que completes.':'Elige una carga para tu rango.'}</p>`}${uiLastLoad(xi)}<div id="ui-load-${xi}">${uiLoadStrip(xi)}</div><div class="n-set-fields" id="set-${xi}-${si}"><div class="n-set-field"><label for="n-weight">${weightLabel} · ${uLabelEx(ex.key)}</label><input id="n-weight" aria-label="${weightLabel} · ${uLabelEx(ex.key)} · serie ${si+1}" aria-describedby="n-weight-help" type="number" min="0" inputmode="decimal" step="any" placeholder="${corp?'0':'—'}" value="${esc(st.w??'')}" oninput="this.setCustomValidity('');setVal(${xi},${si},'w',this.value)"><div class="n-stepper"><button aria-label="Reducir peso" onclick="uiStep(${xi},${si},'w',-1)">−</button><small id="n-weight-help">${hint}</small><button aria-label="Aumentar peso" onclick="uiStep(${xi},${si},'w',1)">+</button></div></div><div class="n-set-field"><label for="n-reps">${repsLabel}</label><input id="n-reps" aria-label="${repsLabel} de la serie ${si+1}" type="number" min="1" step="1" inputmode="numeric" placeholder="—" value="${esc(st.r??'')}" oninput="this.setCustomValidity('');setVal(${xi},${si},'r',this.value)"><div class="n-stepper"><button aria-label="Reducir ${repsLabel.toLowerCase()}" onclick="uiStep(${xi},${si},'r',-1)">−</button><small>Rango <span>${r.lo}–${r.hi}</span></small><button aria-label="Aumentar ${repsLabel.toLowerCase()}" onclick="uiStep(${xi},${si},'r',1)">+</button></div></div></div>${m.type==='tiempo'?`<div class="n-time-tools">${uiButton(s.setTimer?.key===ex.key&&s.setTimer.si===si?'Retomar cronómetro':'Medir esta serie',uiAction('startSetTimer',xi,si),'clock','text')}<span class="n-time-help">Por tiempo: no se usa RIR.</span></div>`:`<div class="n-rir"><span>Reps en reserva</span><button id="n-rir-choice" aria-label="Repeticiones en reserva: ${st.rir!==''&&st.rir!==undefined?esc(st.rir):'por anotar'}" aria-required="true" onclick="uiRIR(${xi},${si})">${st.rir!==''&&st.rir!==undefined?`${Number(st.rir)>=5?'5+':esc(st.rir)}`:'Elegir'}${uiIcon('chevron')}</button></div>`}<div class="n-record-dock">${uiButton('Registrar serie',uiAction('uiLogSet',xi,si),'check')}<span class="n-save-status" id="n-draft-status" role="status"></span></div>`;
 }
 const logged=ex.sets.map((st,i)=>st.done?`<button class="n-set-chip" onclick="uiEditSet(${xi},${i})" aria-label="Editar serie ${i+1}: ${uiSetDisplay(ex.key,st)}"><span>${i+1}</span>${uiSetDisplay(ex.key,st)}${uiIcon('check')}</button>`:'').join('');
 return `<div class="n-focus">${title}${exerciseNotes(ex.key)&&!resting&&!complete?`<button class="n-session-note" onclick="editExNotes(${xi})" aria-label="Editar tu nota: ${esc(exerciseNotes(ex.key))}">${uiIcon('pin')}<span><small>${m.gymNotes?esc(db.gym.name):'Tu nota'}</small><strong>${esc(exerciseNotes(ex.key))}</strong></span>${uiIcon('edit')}</button>`:''}${work}${typeof pushActive==='function'&&pushActive()&&(resting||preparing)?`<p class="n-push-session" data-push-status role="status">${esc(pushMessage)}</p>`:''}${!resting&&logged?`<div class="n-logged-sets"><span class="n-eyebrow">Ya hiciste · carga total</span><div>${logged}</div></div>`:''}<div class="n-session-tools">${uiButton('Ejercicio',uiAction('uiSessionOptions',xi),'more','text')}${uiGymButton()}</div><div class="vschip" id="vs-${xi}"></div></div>`;
}
function uiWarmup(xi){
 const ex=db.active.exercises[xi],w=ensureWarmup(xi),key=ex.key;
 if(w.phase==='setup')return `<section class="n-warmup n-warmup-setup"><span class="n-eyebrow">Primero, la preparación</span><h2>Preparemos tu carga.</h2><p>Aún no tenemos un peso de referencia. Elige con cuánto planeas trabajar y calcularemos la aproximación.</p>${uiWarmupTargetForm(xi)}<small>Las series de trabajo aparecen después del calentamiento.</small></section>`;
 const p=w.plan,resting=w.phase==='rest',step=p.steps[w.completed],last=w.completed>=p.steps.length;
 const journey=`<ol class="n-warmup-journey" aria-label="Progreso del calentamiento">${p.steps.map((st,i)=>`<li class="${i<w.completed?'is-done':i===w.completed&&!resting?'is-current':''}" ${i===w.completed&&!resting?'aria-current="step"':''}><span>${i<w.completed?uiIcon('check'):i+1}</span><small>Calentar</small></li>`).join('')}<li><span>${uiIcon('barbell')}</span><small>Trabajo</small></li></ol>`;
 let body='';
 if(resting){
  const rem=Math.max(0,Math.ceil((w.restUntil-Date.now())/1000)),action=last?'Empezar series de trabajo':'Siguiente calentamiento';
  const restMax=warmupRestBase(w,w.completed-1)+30;
  body=`<div class="n-warmup-rest"><span class="n-warmup-status">${uiIcon('check')}Calentamiento ${w.completed} completado</span><h2 id="warmup-rest-title">${rem?'Dale un respiro.':'Preparación lista.'}</h2><div class="n-warmup-clock" role="timer" aria-label="Descanso de calentamiento"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="70" class="n-warmup-ring-track"/><circle id="warmup-ring" cx="80" cy="80" r="70" style="stroke-dashoffset:${440*(1-rem/w.restDuration)}"/></svg><strong id="warmup-time">${fmtClock(rem)}</strong><small id="warmup-clock-label" role="status">${rem?'Descanso':'A tu ritmo'}</small></div><div class="n-warmup-rest-tools"><button id="warmup-extend" class="n-text" ${w.restDuration>=restMax||!rem?'hidden':''} onclick="uiWarmupExtend(${xi},'${w.id}')">${uiIcon('plus')}Añadir 30 s</button><span id="warmup-rest-limit">${w.restDuration>=restMax?(restMax>=90?'1 min 30 s en total':'1 minuto en total'):(restMax>=90?'1 min · ampliable a 1:30':'30 s · ampliable a 1 min')}</span></div><div class="n-warmup-next"><small>Después del descanso</small><b>${last?'Tus series de trabajo':warmupStepText(key,step)}</b></div><button id="warmup-next" type="button" class="n-primary" ${rem?'disabled':''} onclick="uiWarmupNext(${xi},'${w.id}',${w.completed})"><span>${action}</span>${uiIcon('arrow')}</button><p class="n-warmup-foot">${last?'El calentamiento está hecho. Empieza cuando te sientas listo.':'El siguiente paso se habilita al terminar el descanso.'}</p></div>`;
 }else{
  const timed=!!step.seconds,corp=exMeta(key).type==='corporal'||step.easy,load=uiWarmupLoad(key,step);
  body=`<div class="n-warmup-active"><span class="n-eyebrow">Calentamiento ${w.completed+1} de ${p.steps.length}</span><h2>${w.completed?'Un paso más cerca.':'Entra en movimiento.'}</h2><div class="n-warmup-dose"><div><strong>${timed?step.seconds:step.reps}</strong><span>${timed?'segundos':'repeticiones'}</span></div>${!timed&&!corp?`<div><strong>${fmtWEx(key,step.w)}</strong><span>${uLabelEx(key)} ${step.assisted?'de ayuda':'en total'}</span></div>`:`<div class="n-warmup-easy">${uiIcon('spark')}<span>Suave<br>Sin lastre</span></div>`}</div>${load}<p class="n-warmup-guidance">${esc(p.note)}</p>${timed?`<div class="n-warmup-hold" ${w.holdUntil?'':'hidden'} id="warmup-hold"><strong id="warmup-hold-time">${step.seconds}</strong><span id="warmup-hold-label" role="status">Prepárate</span></div><button id="warmup-timed-start" class="n-secondary" ${w.holdUntil?'hidden':''} onclick="uiWarmupTimedStart(${xi},'${w.id}',${w.completed})">${uiIcon('clock')}Iniciar ${step.seconds} segundos</button>`:''}<button id="warmup-record" type="button" class="n-primary" ${timed&&!(w.holdUntil&&Date.now()>=w.holdUntil)?'disabled':''} onclick="uiWarmupRecord(${xi},'${w.id}',${w.completed})"><span>Completé este calentamiento</span>${uiIcon('check')}</button><p class="n-warmup-foot">Después, 30 segundos para respirar.</p></div>`;
 }
 return `<section class="n-warmup"><div class="n-warmup-top"><span>${uiIcon('barbell')}Preparación</span><small>Antes de tus series</small></div>${journey}${body}<div class="n-warmup-work"><div><small>Tu objetivo de trabajo</small><b>${uiWarmupWorkTarget(ex,p)}</b></div>${!resting&&!w.completed&&!['corporal','tiempo'].includes(exMeta(key).type)?`<button class="n-text" onclick="uiWarmupEditTarget(${xi})" aria-label="Ajustar carga de trabajo">${uiIcon('edit')}</button>`:''}</div><p class="n-warmup-accounting">La preparación no suma series, volumen ni récords.</p></section>`;
}
function uiWarmupWorkTarget(ex,plan){
 const m=exMeta(ex.key),r=effRange(ex.key),target=ex.sugg?.reps||`${r.lo}–${r.hi}`;
 const load=plan.W>0?`${fmtWEx(ex.key,plan.W)} ${uLabelEx(ex.key)}${m.type==='asistido'?' de ayuda':m.type==='normal'?' totales':' de lastre'} · `:'';
 return `${load}${target} ${m.type==='tiempo'?'s':'reps'}`;
}
function uiWarmupLoad(key,step){
 if(step.seconds||step.easy||exMeta(key).type==='corporal')return '';
 const p=step.assisted&&effEquip(key)==='placas'?{kind:'placas',stack:stackSnap(key,step.w)}:loadPlan(key,step.w);
 if(!p)return '';
 let art='',label='';
 if(p.kind==='placas'){
  art=stackSVG(p.stack.index,p.stack.plates||Math.max(p.stack.index+3,10),{h:106});label=`Pin en la placa <b>${p.stack.index}</b>${stackExtraLabel(p.stack)}`;
 }else if(p.kind==='mancuerna'){
  art=dumbbellSVG(p.dumbbell,{h:72});label=`${fmtW(p.dumbbell)} ${uLabel()} ${p.points===2?'en cada mano':'en una mano'}`;
 }else{
  art=p.points===2?barbellSVG(p.perPoint,{h:70,scale:.62}):postSVG(p.perPoint,{h:70,scale:.62});
  label=p.perPoint.length?`${p.points===1?'En un solo lado':'En cada lado'} · ${pointTextHTML(p.perPoint)}`:'Sin discos añadidos';
 }
 return `<div class="n-warmup-load">${art}<div>${label}</div></div>`;
}
function uiWarmupTargetForm(xi){
 const ex=db.active.exercises[xi],offset=discosOffset(ex.key),total=targetWeight(ex),m=exMeta(ex.key);
 const label=offset>0?'Discos totales':m.type==='asistido'?'Ayuda':effEquip(ex.key)==='mancuerna'&&effPoints(ex.key)===2?'Total de las dos mancuernas':'Carga de trabajo';
 return `<form class="n-warmup-target" onsubmit="uiWarmupSetTarget(event,${xi})"><label class="field"><span>${label} · ${uLabelEx(ex.key)}</span><input id="warmup-target" type="number" min="0" step="any" inputmode="decimal" required value="${Number.isFinite(total)?inputWEx(ex.key,kgToTyped(ex.key,total)):''}" placeholder="Ej. 20"></label>${offset>0?`<p class="hint">Sin ${effEquip(ex.key)==='barra'?'la barra':'el aparato'}: sus ${fmtWEx(ex.key,offset)} ${uLabelEx(ex.key)} ya están incluidos en el cálculo.</p>`:''}<button class="n-primary" type="submit"><span>Preparar calentamiento</span>${uiIcon('arrow')}</button></form>`;
}
function uiWarmupEditTarget(xi){openModal(`<h2>La carga de hoy</h2><p class="muted">Ajustaremos el calentamiento para este peso.</p>${uiWarmupTargetForm(xi)}${uiButton('Cancelar','closeModal()','close','text')}`);}
function uiWarmupSetTarget(ev,xi){
 ev.preventDefault();const ex=db.active?.exercises[xi],input=document.getElementById('warmup-target'),n=Number(input?.value);
 if(!ex||!input||input.value.trim()===''||!Number.isFinite(n)||n<0)return;
 const st=ex.sets.find(st=>!st.done);if(!st)return;
 const forced=!!ex.warmup?.forced;
 st.w=String(n);delete st.wkg;delete st.totalKg;delete st.autoWeightKg;delete ex.warmup;delete ex.warmupDone;
 if(forced)ensureWarmup(xi,true);
 db.active.lastLog=Date.now();save();closeModal();render();window.scrollTo(0,0);
}
function uiWarmupRestart(xi){ensureWarmup(xi,true);uiSelectExercise(xi);}
function uiWarmupRecord(xi,id,step){
 const ex=db.active?.exercises[xi],w=ensureWarmup(xi);
 if(!ex||!w||w.id!==id||w.phase!=='set'||w.completed!==step)return;
 if(w.plan.steps[step].seconds&&!(w.holdUntil&&Date.now()>=w.holdUntil))return;
 unlockAudio();const base=warmupRestBase(w,step);w.completed++;w.phase='rest';w.restStarted=Date.now();w.restDuration=base;w.restUntil=w.restStarted+base*1000;
 delete w.lastCue;delete w.restNotified;delete w.holdUntil;delete w.holdStarted;delete w.holdNotified;
 db.active.lastSeriesAt=db.active.lastLog=Date.now();save();render();window.scrollTo(0,0);uxSound('warmDone');uxHaptic(10);
}
function uiWarmupExtend(xi,id){
 const w=ensureWarmup(xi);if(!w||w.id!==id||w.phase!=='rest'||Date.now()>=w.restUntil)return;
 const max=warmupRestBase(w,w.completed-1)+30;if(w.restDuration>=max)return;
 w.restDuration=max;w.restUntil=w.restStarted+max*1000;delete w.lastCue;save();tickWarmup();
}
function uiWarmupNext(xi,id,completed){
 const ex=db.active?.exercises[xi],w=ensureWarmup(xi);
 if(!ex||!w||w.id!==id||w.phase!=='rest'||w.completed!==completed||Date.now()<w.restUntil)return;
 if(w.completed>=w.plan.steps.length){
  w.phase='done';w.completedAt=Date.now();ex.warmupDone=true;
  const st=ex.sets.find(st=>!st.done);
  if(st&&String(st.w??'').trim()===''&&w.plan.W!==null){
   st.w=inputWEx(ex.key,kgToTyped(ex.key,w.plan.W));
   if(ex.sugg&&Math.abs(w.plan.W-ex.sugg.w)<.000501)st.autoWeightKg=w.plan.W;
  }
 }else w.phase='set';
 delete w.restUntil;delete w.restStarted;delete w.restDuration;delete w.lastCue;delete w.restNotified;
 db.active.lastLog=Date.now();save();render();window.scrollTo(0,0);uxSound(w.phase==='done'?'ignite':'kalimba',w.completed);
}
function uiWarmupTimedStart(xi,id,step){
 const w=ensureWarmup(xi);if(!w||w.id!==id||w.phase!=='set'||w.completed!==step||w.holdUntil||!w.plan.steps[step].seconds)return;
 unlockAudio();w.holdStarted=Date.now()+3000;w.holdUntil=w.holdStarted+w.plan.steps[step].seconds*1000;
 db.active.lastLog=Date.now();save();tickWarmup();
}
/* One wall clock for the session. Updating text/controls does not remount the
   view, so seconds ticking cannot flicker or steal an input's focus. */
function tickWarmup(){
 if(!db.active?.exercises.length)return;
 const xi=sessionOpenIdx(),w=db.active.exercises[xi]?.warmup;if(!validWarmupState(w))return;
 const el=id=>view.name==='session'?document.getElementById(id):null;
 const cue=(deadline,rem)=>{
  if(rem<1||rem>3)return;
  const token=deadline+':'+rem;if(w.lastCue===token)return;
  w.lastCue=token;save();uxWarmBeep('countdown');
 };
 if(w.phase==='rest'){
  const rem=Math.max(0,Math.ceil((w.restUntil-Date.now())/1000));cue(w.restUntil,rem);
  if(!rem&&!w.restNotified){w.restNotified=true;save();uxWarmBeep();notify('Calentamiento · descanso listo',exBaseName(db.active.exercises[xi].name),'hierro-warmup');}
  const time=el('warmup-time'),next=el('warmup-next'),extend=el('warmup-extend'),ring=el('warmup-ring');
  if(time)uxText(time,fmtClock(rem));if(next)next.disabled=!!rem;
  const restMax=warmupRestBase(w,w.completed-1)+30;
  if(extend)extend.hidden=w.restDuration>=restMax||!rem;
  if(ring)ring.style.strokeDashoffset=440*(1-rem/w.restDuration);
  const title=el('warmup-rest-title'),label=el('warmup-clock-label'),limit=el('warmup-rest-limit');
  if(title)title.textContent=rem?'Dale un respiro.':'Preparación lista.';
  if(label&&label.textContent!==(rem?'Descanso':'A tu ritmo'))label.textContent=rem?'Descanso':'A tu ritmo';
  if(limit)limit.textContent=w.restDuration>=restMax?(restMax>=90?'1 min 30 s en total':'1 minuto en total'):(restMax>=90?'1 min · ampliable a 1:30':'30 s · ampliable a 1 min');
 }else if(w.phase==='set'&&w.holdUntil){
  const prep=Date.now()<w.holdStarted,end=prep?w.holdStarted:w.holdUntil,rem=Math.max(0,Math.ceil((end-Date.now())/1000));cue(end,rem);
  if(!rem&&!w.holdNotified){w.holdNotified=true;save();uxWarmBeep();}
  const box=el('warmup-hold'),time=el('warmup-hold-time'),label=el('warmup-hold-label'),start=el('warmup-timed-start'),record=el('warmup-record');
  if(box)box.hidden=false;if(time)time.textContent=rem;if(label&&label.textContent!==(prep?'Prepárate':rem?'Mantén suave':'Serie terminada'))label.textContent=prep?'Prepárate':rem?'Mantén suave':'Serie terminada';
  if(start)start.hidden=true;if(record)record.disabled=Date.now()<w.holdUntil;
 }
}
function uiLogSet(xi,si){
 const ex=db.active?.exercises[xi],st=ex?.sets[si];if(!st||st.done===true)return;
 if(warmupRequired(xi)){uiSelectExercise(xi);return;}
 if(!uiValidSet(ex.key,st)){
  const corp=['corporal','tiempo'].includes(exMeta(ex.key).type),w=Number(st.w),badW=(!corp&&String(st.w??'').trim()==='')||!Number.isFinite(w)||w<0;
  const input=document.getElementById(badW?'n-weight':'n-reps');
  if(input?.setCustomValidity){input.setCustomValidity(badW?'Escribe un peso válido, incluido 0 cuando corresponda.':'Escribe un número entero mayor que cero.');input.reportValidity();input.focus();}
  return;
 }
 /* el esfuerzo forma parte del registro: sin RIR se pide antes de confirmar */
 if(exMeta(ex.key).type!=='tiempo'&&(st.rir===''||st.rir===undefined||st.rir===null)){uiRIR(xi,si,true);return;}
 if(!commitChange(()=>{db.active.open=xi;st.done=true;delete st.autoWeightKg;st.loadContext=warmupLoadContext(ex.key);if(exMeta(ex.key).type==='tiempo')delete st.rir;if(st.w!=='')st.totalKg=recordedSetKg(ex.key,st);ex.lastWorkAt=db.active.lastSeriesAt=db.active.lastLog=Date.now();if(db.active.setTimer?.key===ex.key)delete db.active.setTimer;startRestAuto(ex.key);db.active.restKey=ex.key;db.active.uiRest=!!restUntil;})){uiSaveState();return;}
 render();window.scrollTo(0,0);uxSetLogged(xi,si);
}
function uiStep(xi,si,field,direction){
 const ex=db.active.exercises[xi],st=ex.sets[si];
 const delta=field==='r'?1:Math.max(.01,fromKgEx(ex.key,effStep(ex.key,typedToKg(ex.key,parseFloat(st.w)||0))));
 const n=parseFloat(st[field]);const next=Math.max(field==='r'?1:0,(Number.isFinite(n)?n:0)+direction*delta);
 const val=String(Math.round(next*100)/100),inp=document.getElementById(field==='w'?'n-weight':'n-reps');if(inp){inp.value=val;inp.setCustomValidity?.('');}setVal(xi,si,field,val);
 uxSound('tick',direction);uxBump(inp,direction);
}
function uiRepeatSet(xi){
 const ex=db.active.exercises[xi],si=uiCurrentSet(ex);if(si<0)return;
 const prev=ex.sets.slice(0,si).reverse().find(s=>s.done);if(!prev)return;
 for(const f of ['w','r'])if(ex.sets[si][f]==='')ex.sets[si][f]=prev[f];
 if(prev.wkg!==undefined&&ex.sets[si].w===prev.w)ex.sets[si].wkg=prev.wkg;
 save();render();
}
function uiResetRest(){restUntil=null;if(db.active){delete db.active.restUntil;delete db.active.restDuration;delete db.active.uiRest;delete db.active.restKey;}}
function uiContinue(){
 if(!db.active)return;
 const xi=sessionOpenIdx(),complete=exDone(db.active.exercises[xi]);
 const next=complete?db.active.exercises.findIndex((e,i)=>i!==xi&&!exDone(e)):xi;
 if(!commitChange(()=>{uiResetRest();if(next>=0)db.active.open=next;}))return;
 if(next<0){askFinish();return;}render();window.scrollTo(0,0);uxSound('whoosh');
}
function uiSelectExercise(xi){
 if(!db.active?.exercises[xi])return;
 db.active.open=xi;if(!save())return;closeModal();render();window.scrollTo(0,0);
}

function uiSessionQueue(){
 const s=db.active;
 openModal(`<h2>Tu sesión</h2><p class="muted">Cambia de ejercicio cuando lo necesites. Las series que llevas siguen guardadas.</p>${s.exercises.map((ex,i)=>uiRow(esc(exBaseName(ex.name)),`${ex.sets.filter(s=>s.done).length} de ${ex.sets.length} series confirmadas`,uiAction('uiSelectExercise',i),exDone(ex)?'check':'chevron',`<span class="n-number">${i+1}</span>`)).join('')}${uiButton('Añadir ejercicio','uiLibrary()','plus','secondary')}${uiButton('Volver a mi serie','closeModal()','back','text')}`);
}
function uiRIR(xi,si,andLog=false){
 if(exMeta(db.active.exercises[xi].key).type==='tiempo'){infoModal('Segundos, sin RIR','RIR cuenta repeticiones que podrías haber hecho. Para este ejercicio registra el tiempo completado; la propuesta se basa en esa duración.');return;}
 const st=db.active.exercises[xi].sets[si];
 openModal(`<h2>Repeticiones en reserva</h2><p class="muted">${andLog?'Para registrar la serie, anota el esfuerzo. ':''}Al terminar, ¿cuántas más habrías podido hacer con buena técnica?</p><div class="n-rir-grid">${[0,1,2,3,4,5].map(n=>`<button class="${String(st.rir)===String(n)?'on':''}" onclick="uiSetRIR(${xi},${si},'${n}',${andLog?'true':'false'})"><b>${n===5?'5+':n}</b><small>${n===0?'Al fallo':n===5?'Con margen':'en reserva'}</small></button>`).join('')}</div>`);
}
function uiSetRIR(xi,si,val,andLog=false){setVal(xi,si,'rir',val);closeModal();if(andLog){uiLogSet(xi,si);return;}render();uiFocus('n-rir-choice');}
function uiAddSet(xi){db.active.exercises[xi].sets.push({w:'',r:'',rir:''});uiResetRest();save();closeModal();render();}
function uiEditSet(xi,si){
 const ex=db.active?.exercises[xi],st=ex?.sets[si];if(!st)return;
 openModal(`<h2>Editar serie ${si+1}</h2><p class="muted">${esc(exBaseName(ex.name))}</p><form onsubmit="uiSaveSet(event,${xi},${si})" class="stack"><div class="n-form-pair"><label class="field"><span>Peso total · ${uLabelEx(ex.key)}</span><input id="n-edit-w" type="number" min="0" step="any" inputmode="decimal" value="${st.w===''?'':inputWEx(ex.key,recordedSetKg(ex.key,st))}"></label><label class="field"><span>${exMeta(ex.key).type==='tiempo'?'Segundos':'Repeticiones'}</span><input id="n-edit-r" type="number" min="1" step="1" inputmode="numeric" required value="${esc(st.r??'')}"></label></div>${exMeta(ex.key).type!=='tiempo'?`<label class="field"><span>RIR · opcional</span><input id="n-edit-rir" type="number" min="0" max="9" step="1" inputmode="numeric" value="${esc(st.rir??'')}"></label>`:'<p class="n-time-help">Por tiempo: registra segundos. No se usa RIR.</p>'}<p id="n-edit-error" class="n-error" role="alert"></p><button class="btn" type="submit">${st.done?'Guardar cambio':'Guardar borrador'}</button><button class="btn ghost" type="button" onclick="closeModal()">Cancelar</button></form>${uiButton('Eliminar esta serie',`uiRemoveSet(${xi},${si})`,'trash','danger')}`);
}
function uiSaveSet(ev,xi,si){
 ev.preventDefault();const ex=db.active.exercises[xi],draft={w:document.getElementById('n-edit-w').value,r:document.getElementById('n-edit-r').value,rir:exMeta(ex.key).type==='tiempo'?'':document.getElementById('n-edit-rir').value};
 if(!uiValidSet(ex.key,draft)){document.getElementById('n-edit-error').textContent='Revisa el peso y las repeticiones antes de guardar.';return;}
 if(draft.w!==''){const kg=toKgEx(ex.key,Number(draft.w));draft.totalKg=kg;draft.wkg=Math.max(0,kg-discosOffset(ex.key));draft.w=inputWEx(ex.key,draft.wkg);}
 if(!commitChange(()=>{ex.sets[si]={...draft,done:ex.sets[si].done===true};db.active.lastLog=Date.now();}))return;closeModal();render();
}
function uiRemoveSet(xi,si){
 const ex=db.active?.exercises[xi];if(!ex?.sets[si])return;
 const session=db.active.id,removed=JSON.parse(JSON.stringify(ex.sets[si]));let placeholder=false;
 if(!commitChange(()=>{ex.sets.splice(si,1);if(!ex.sets.length){placeholder=true;ex.sets.push({w:'',r:'',rir:''});}}))return;
 window.__removedSet={session,key:ex.key,si,removed,placeholder};
 closeModal();render();
}
function uiUndoRemovedSet(){
 const u=window.__removedSet,ex=db.active?.exercises.find(e=>e.key===u?.key);if(!u||!ex||db.active.id!==u.session)return;
 if(!commitChange(()=>{if(u.placeholder&&ex.sets.length===1&&ex.sets[0].w===''&&ex.sets[0].r===''&&!ex.sets[0].done)ex.sets=[];ex.sets.splice(Math.min(u.si,ex.sets.length),0,u.removed);} ))return;
 window.__removedSet=null;render();
}

function uiEditSets(xi){const ex=db.active.exercises[xi];openModal(`<h2>Series del ejercicio</h2>${ex.sets.map((st,i)=>uiRow(`Serie ${i+1}`,uiSetDisplay(ex.key,st),uiAction('uiEditSet',xi,i),'edit')).join('')}${uiButton('Añadir serie',uiAction('uiAddSet',xi),'plus','secondary')}${uiButton('Listo','closeModal()','check','text')}`);}
function uiSessionOptions(xi){
 const ex=db.active.exercises[xi];
 openModal(`<h2>${esc(exBaseName(ex.name))}</h2>${ex.sugg?uiRow('Entender la propuesta','Qué cambia y por qué',uiAction('uiSuggestionInfo',xi),'spark'):''}${uiRow('Calentamiento',ex.warmupDone?'Completado · ver detalle':ex.warmup?.phase==='skipped'?'Ver criterio de preparación':'Preparar antes de cargar',`closeModal();showWarmup(${xi})`,'barbell')}${!warmupRequired(xi)?uiRow('Series','Editar, añadir o quitar',uiAction('uiEditSets',xi),'list'):''}${uiRow('Notas','Asiento, agarre y recordatorios',`closeModal();editExNotes(${xi})`,'edit')}${uiRow('Equipo y objetivos','Ajustes de este ejercicio',`closeModal();openExFromSession(${xi},'equipment')`,'settings')}${uiRow('Quitar ejercicio de la sesión','',`closeModal();removeSessionEx(${xi})`,'trash')}${uiButton('Volver a mi serie','closeModal()','back','secondary')}`);
}

/* Exercise information is split by the decision being made. */
function uiExerciseTab(tab){go({...view,exTab:tab,configure:tab==='equipment'});}
function uiSubnav(items,current,handler){return `<div class="n-subnav ${handler==='uiProgressTab'?'n-progress-nav':''}" role="group" aria-label="Secciones">${items.map(([id,label])=>`<button aria-pressed="${current===id}" class="${current===id?'on':''}" onclick="${uiAction(handler,id)}">${label}</button>`).join('')}</div>`;}
function uiExercise(){
 const key=view.key,m=exMeta(key),tab=view.exTab||(view.from==='history'?'progress':view.configure||!m.equip?'equipment':'progress');
 return `${uiSubnav([['progress','Evolución'],['equipment','Equipo'],['targets','Objetivos']],tab,'uiExerciseTab')}<div class="n-ex-detail">${tab==='equipment'?uiEquipment(key):tab==='targets'?uiTargets(key):uiExerciseProgress(key)}</div>`;
}
function uiExerciseMetric(key,mode=(view.name==='exercise'&&view.key===key?view.chartMetric:'load')){
 const m=exMeta(key),hist=exerciseHistory(key).filter(h=>!h.deload),assist=m.type==='asistido',time=m.type==='tiempo',corp=m.type==='corporal';
 const pts=hist.map(h=>({date:h.date,v:assist?fromKgEx(key,Math.min(...h.sets.filter(s=>s.r>=effRange(key).lo).map(s=>s.w))):time||corp?Math.max(...h.sets.map(s=>s.r)):mode==='estimate'?Math.round(fromKgEx(key,bestE1RM(h.sets))*10)/10:fromKgEx(key,Math.max(...h.sets.map(s=>s.w)))})).filter(p=>Number.isFinite(p.v)&&(assist?p.v>=0:p.v>0));
 return {hist,pts,assist,time,corp,unit:time?'s':corp?'reps':uLabelEx(key),title:assist?'Tu menor asistencia':time?'Tiempo sostenido':corp?'Repeticiones':mode==='estimate'?'1RM estimado':'Carga de trabajo',best:pts.length?(assist?Math.min(...pts.map(p=>p.v)):Math.max(...pts.map(p=>p.v))):null};
}
function uiExerciseDirectory(){
 return `<section class="n-directory"><div class="n-directory-head"><div><h2>El progreso de cada ejercicio</h2><p>Todos tus ejercicios, aunque ya no estén en el plan.</p></div><label class="field"><span>Buscar ejercicio</span><input id="n-progress-search" type="search" value="${esc(view.exerciseQuery||'')}" placeholder="Ej. Press de banca" oninput="view.exerciseQuery=this.value;uiFilterExercises()"></label></div><div id="n-exercise-directory">${uiExerciseDirectoryRows(view.exerciseQuery||'')}</div></section>`;
}
function uiExerciseDirectoryRows(query=''){
 const list=[...allExerciseNames()].filter(([key,info])=>exKey(info.name).includes(exKey(query))).sort((a,b)=>a[1].name.localeCompare(b[1].name,'es'));
 if(!list.length)return `<div class="n-empty"><h2>${query?'No encontramos ese ejercicio.':'Tu primer ejercicio, tu primera referencia.'}</h2><p>${query?'Prueba con otra parte del nombre.':'Al añadir ejercicios a tu día, aparecerán aquí.'}</p></div>`;
 return list.map(([key,info])=>{
  const metric=uiExerciseMetric(key),last=metric.pts.at(-1);
  return `<button class="n-row" onclick="${uiAction('uiOpenProgress',key)}"><span class="grow"><b>${esc(info.name)}</b><small>${metric.hist.length?`${metric.hist.length} ${metric.hist.length===1?'sesión':'sesiones'} · ${metric.title}`:'Aún sin registros'}</small></span>${last?`<span class="n-directory-result"><b>${fmtNum(last.v)} ${metric.unit}</b><small>Último registro</small></span>`:''}${uiIcon('chevron')}</button>`;
 }).join('');
}
function uiFilterExercises(){const el=document.getElementById('n-exercise-directory');if(el)el.innerHTML=uiExerciseDirectoryRows(view.exerciseQuery||'');}
function uiOpenProgress(key,receiptId){
 const returnTo=view.name==='history'?{...view}:{name:'history',progressTab:'exercises'};
 closeModal();openExerciseByKey(key,'history');
 if(view.name==='exercise'){const rec=db.history.find(h=>h.id===receiptId);if(rec){view.rid=rec.routineId;view.progressPlan=historySplitId(rec);}view.exTab='progress';view.historyReturn=returnTo;view.receiptId=receiptId||null;render();}
}
function uiBackToProgress(){const receiptId=view.receiptId,back=view.historyReturn||{name:'history',progressTab:'exercises'};go(back);if(receiptId)uiReceipt(receiptId);}
function uiPickChart(index){
 const pts=window.__chartPts||[];if(!pts.length)return;
 window.__chartSelected=Math.max(0,Math.min(pts.length-1,Math.round(index)));
 const p=pts[window.__chartSelected],tip=document.getElementById('charttip'),slider=document.getElementById('n-chart-point');
 if(tip)tip.textContent=uiChartText(p);
 if(slider){slider.value=String(window.__chartSelected);slider.setAttribute?.('aria-valuetext',`${fmtDate(p.date)}: ${fmtNum(p.v)} ${window.__chartUnit}`);}
 drawChart();
}
function uiChartText(p){
 const h=exerciseHistory(view.key).find(h=>h.date===p.date);
 return `${fmtDateShort(p.date)} · ${fmtNum(p.v)} ${window.__chartUnit}${h?' · '+h.sets.map(s=>s.r+(exMeta(view.key).type==='tiempo'?' s':' reps')).join(' / '):''}`;
}
function uiChartMode(mode){view.chartMetric=mode;render();}
function uiExerciseProgress(key){
 const m=exMeta(key),metric=uiExerciseMetric(key),{hist,pts,assist,time,corp,unit,best}=metric;
 window.__chartPts=pts;window.__chartUnit=unit;window.__chartSelected=pts.length-1;window.__chartAssist=assist;
 const first=pts[0],last=pts.at(-1),sg=computeSuggestion(key),normal=!assist&&!time&&!corp;
 const real=hist.at(-1)?.sets.slice().sort((a,b)=>b.w-a.w||b.r-a.r)[0];
 const mode=normal?(view.chartMetric||'load'):'load';
 const controls=normal?`<div class="n-chart-modes" role="group" aria-label="Métrica de evolución">${[['load','Carga real'],['estimate','Fuerza estimada']].map(([v,t])=>`<button aria-pressed="${mode===v}" class="${mode===v?'on':''}" onclick="uiChartMode('${v}')">${t}</button>`).join('')}</div>`:'';
 return `<div class="n-detail-grid"><section><div class="n-metric-panel n-metric-refined">${controls}<span class="n-eyebrow">${normal&&mode==='load'?'Última carga registrada':metric.title}</span>${last?`<div class="n-metric">${fmtNum(normal&&mode==='load'?last.v:best)}<small>${unit}${normal&&mode==='load'&&real?' × '+real.r+' reps':''}</small></div><p class="n-metric-date">${fmtDate(last.date)} · ${hist.at(-1).sets.length} series${mode==='estimate'?' · estimación, no un levantamiento medido':''}</p><div class="chart"><canvas id="exchart" role="img" aria-label="${metric.title}. Usa el control inferior para consultar las sesiones."></canvas></div><div class="axis"><span>${fmtDateShort(first.date)}</span><span>${fmtDateShort(last.date)}</span></div><div class="n-chart-readout"><span>Sesión seleccionada</span><output id="charttip" aria-live="polite">${esc(uiChartText(last))}</output></div>${pts.length>1?`<label class="n-chart-scrub"><span>Toca la gráfica o desliza entre sesiones</span><input id="n-chart-point" type="range" min="0" max="${pts.length-1}" step="1" value="${pts.length-1}" aria-label="Explorar registros de ${esc(view.exname||key)}" oninput="uiPickChart(Number(this.value))"></label>`:'<p class="hint">Tu primera referencia ya está aquí.</p>'}<p class="n-chart-note">${assist?'Menos ayuda para completar el rango significa progreso.':normal&&mode==='load'?'La gráfica muestra la mayor carga real de cada sesión.':mode==='estimate'?'Estimación de fuerza a partir del peso y las repeticiones.':'Cada punto corresponde a una sesión.'} Las descargas se conservan en el diario.</p>`:'<h2>Tu primera referencia está por llegar.</h2><p>Al registrar este ejercicio verás su evolución aquí.</p>'}</div><div class="n-section-head"><h2>Últimas veces</h2></div>${[...exerciseHistory(key)].reverse().slice(0,8).map(h=>`<div class="n-history-ex"><span>${fmtDate(h.date)}${h.deload?' · Descarga':''}</span><b>${h.sets.map(s=>fmtSet(key,s)).join(' · ')}</b></div>`).join('')}</section><aside><section class="n-panel"><span class="n-eyebrow">Tu siguiente paso</span>${sg?verdictHTML(sg,true):'<p>Tu próxima propuesta partirá de lo que registres.</p>'}${uiButton('Revisar objetivos',"uiExerciseTab('targets')",'arrow','text')}</section></aside></div>`;
}
function uiNumberField(label,value,action,{unit='',placeholder='—',min=0,step='any',id=''}={}){return `<label class="field n-number-field"><span>${label}${unit?` · ${unit}`:''}</span><input ${id?`id="${id}"`:''} type="number" inputmode="${step===1?'numeric':'decimal'}" min="${min}" step="${step}" value="${esc(value??'')}" placeholder="${placeholder}" oninput="${action}"></label>`;}
function uiEquipment(key){
 const m=exMeta(key),eq=effEquip(key),points=effPoints(key);
 let details='';
 if(eq==='barra'||eq==='discos'){
  details=`<label class="field"><span>Distribución de los discos</span><select onchange="setExPoints('${uiInlineKey(key)}',Number(this.value))">${POINTS.map(([n,t])=>`<option value="${n}" ${points===n?'selected':''}>${t}</option>`).join('')}</select></label>`;
  if(eq==='barra')details+=`<label class="field"><span>Barra que usas</span><select onchange="setExBarSel('${uiInlineKey(key)}',this.value)"><option value="auto" ${!m.bar?'selected':''}>Predeterminada del gimnasio</option>${availableBars().map(b=>`<option value="${b.id}" ${m.bar===b.id?'selected':''}>${esc(b.name)} · ${fmtW(b.kg)} ${uLabel()}</option>`).join('')}</select></label>`;
  else details+=uiNumberField('Peso del aparato vacío',m.base!==null?inputW(m.base):'',`setExBase('${uiInlineKey(key)}',this.value)`,{unit:uLabel(),placeholder:'Si lo sabes'});
  details+=`<p class="n-context-note">${discosOffset(key)>0?`En la sesión anotas los discos de todos los lados. ${eq==='barra'?'La barra':'El aparato'} suma ${fmtWEx(key,discosOffset(key))} ${uLabelEx(key)} automáticamente.`:'Las cargas se calculan con los discos disponibles en este gimnasio.'}</p>`;
 }else if(eq==='mancuerna'){
  details=`<label class="field"><span>¿Cuántas usas a la vez?</span><select onchange="setExPoints('${uiInlineKey(key)}',Number(this.value))">${DB_POINTS.map(([n,t])=>`<option value="${n}" ${points===n?'selected':''}>${t}</option>`).join('')}</select></label><p class="n-context-note">${points===2?'En la sesión anotas la suma de ambas: 10 por mano = 20. El montaje te muestra cuánto tomar en cada mano.':'Anota el peso de la mancuerna que utilizas.'}</p>`;
 }else if(eq==='placas'){
  const u=m.stack?.unit==='lb'?'lb':'kg';
  details=`<div class="line"><div><b>Unidad de la máquina</b><p class="hint">La que aparece en sus placas</p></div><div class="pill-sw">${['kg','lb'].map(unit=>`<button class="${u===unit?'on':''}" aria-pressed="${u===unit}" onclick="setExStack('${uiInlineKey(key)}','unit','${unit}')">${unit}</button>`).join('')}</div></div>
    <div class="n-form-pair">${uiNumberField('Primera placa',m.stack.start,`setExStack('${uiInlineKey(key)}','start',this.value)`,{unit:u})}${uiNumberField('Salto entre placas',m.stack.step,`setExStack('${uiInlineKey(key)}','step',this.value)`,{unit:u})}</div>
    ${uiNumberField('Peso máximo de la máquina',stackCapValue(key)??'',`setExCap('${uiInlineKey(key)}',this.value)`,{unit:u,placeholder:'Si lo sabes'})}
    <p class="hint">El peso de la última placa de la torre, sin contar el ajuste fino.</p>
    <div class="n-stack-adjustment"><h3>Ajuste fino</h3><p class="hint">Peso adicional que sumas sin mover el pin: discos pequeños, una palanca o accesorios. Deja el salto vacío si no hay ajuste fino.</p>
      <div class="n-form-pair">${uiNumberField('Ajuste fino: salto',m.stack.extra,`setExStack('${uiInlineKey(key)}','extra',this.value)`,{unit:u})}${uiNumberField('Ajuste fino: máximo',m.stack.extraMax,`setExStack('${uiInlineKey(key)}','extraMax',this.value)`,{unit:u,placeholder:'Un salto'})}</div>
      <p class="hint">El máximo es la suma de todos los extras disponibles: dos discos de 1,5 lb permiten añadir hasta 3 lb.</p>
    </div><p class="n-context-note" id="stackhint">${stackHintHTML(key)}</p>`;
 }
 return `<div class="n-detail-grid"><section><div class="n-section-head"><h2>¿Con qué lo haces?</h2><span class="n-place-label">${uiIcon('gym')}${esc(db.gym.name)}</span></div><div class="n-equipment-choices">${EQUIP_KEYS.map(k=>`<button class="${m.equip===k?'on':''}" aria-pressed="${m.equip===k}" onclick="setExEquip('${uiInlineKey(key)}','${k}')">${uiIcon(k==='mancuerna'?'dumbbell':k==='placas'?'stack':k==='nada'?'user':k==='discos'?'plate':'barbell')}<b>${k==='nada'?'Sin equipo':k==='placas'?'Torre con pin':EQUIP[k].label}</b></button>`).join('')}</div><section class="n-panel n-equipment-fields">${details||'<p>Sin equipo adicional. Puedes seguir registrando y progresando.</p>'}</section></section><aside class="n-panel"><span class="n-eyebrow">De este lugar</span><h2>El equipo cambia contigo.</h2><p>Esta configuración pertenece a ${esc(db.gym.name)}. Al elegir otro gimnasio, se recupera la suya.</p>${uiButton('Ver inventario',uiAction('uiOpenInventory',eq==='mancuerna'?'dumbbells':eq==='barra'?'bars':eq==='placas'?'machines':'plates'),'gym','secondary')}${uiButton('Es otra máquina',uiAction('promptDuplicateEx',key,view.exname||key),'copy','text')}<p class="hint">Una variante de máquina lleva un historial separado.</p></aside></div>`;
}
function uiTargetScope(scope){view.targetScope=scope;render();}
function uiEditRange(key,scope){
 const a=document.getElementById('n-range-lo'),b=document.getElementById('n-range-hi'),error=document.getElementById('n-range-error');
 const lo=a.value===''?null:Number(a.value),hi=b.value===''?null:Number(b.value),m=exMeta(key),defaults=m.type==='tiempo'?TIEMPO_RANGE:goalRange();
 const lower=lo??(scope==='plan'?m.lo:null)??defaults.lo,upper=hi??(scope==='plan'?m.hi:null)??defaults.hi;
 const valid=Number.isInteger(lower)&&Number.isInteger(upper)&&lower>0&&upper>lower;
 if(error)error.textContent=valid?'':'El máximo debe ser mayor que el mínimo. Conservamos el rango anterior hasta que esté completo.';
 a.setAttribute?.('aria-invalid',String(!valid));b.setAttribute?.('aria-invalid',String(!valid));
 if(!valid)return;
 commitChange(()=>{const sp=db.splits.find(s=>s.id===ctxSplitId());if(sp&&!sp.exconf)sp.exconf={};const target=scope==='plan'&&sp?(sp.exconf[key]||={}):m;for(const [k,v] of [['lo',lo],['hi',hi]]){if(v===null)delete target[k];else target[k]=v;}refreshActiveSugg(key);});
}
function uiTargets(key){
 const m=exMeta(key),sp=db.splits.find(s=>s.id===ctxSplitId()),scope=view.targetScope==='plan'&&sp?'plan':'general',oc=scope==='plan'?(sp.exconf||{})[key]||{}:m;
 const change=scope==='plan'?'setSplitConf':'setExRange',range=m.type==='tiempo'?TIEMPO_RANGE:goalRange();
 const inputs=`<div class="n-form-pair">${uiNumberField('Rango mínimo',oc.lo,`uiEditRange('${uiInlineKey(key)}','${scope}')`,{id:'n-range-lo',placeholder:String(m.lo||range.lo),min:1,step:1})}${uiNumberField('Rango máximo',oc.hi,`uiEditRange('${uiInlineKey(key)}','${scope}')`,{id:'n-range-hi',placeholder:String(m.hi||range.hi),min:2,step:1})}</div><p id="n-range-error" class="n-sync-error" role="alert"></p>`;
 return `<div class="n-detail-grid n-aligned-details"><section class="n-panel n-detail-intro"><div class="n-section-head"><h2>Cómo mides el esfuerzo</h2></div><div class="n-type-grid">${[['normal','Peso y reps'],['asistido','Con asistencia'],['corporal','Peso corporal'],['tiempo','Por tiempo']].map(([v,l])=>`<button class="${m.type===v?'on':''}" onclick="setExType('${uiInlineKey(key)}','${v}')" aria-pressed="${m.type===v}">${l}</button>`).join('')}</div><p class="n-context-note">${m.type==='asistido'?'Se progresa reduciendo la ayuda de la máquina.':m.type==='tiempo'?'El rango indica segundos, no repeticiones.':m.type==='corporal'?'La referencia principal son tus repeticiones; el lastre es opcional.':'Completa el rango y después aumenta la carga disponible.'}</p></section><section class="n-panel n-detail-form">${sp?uiSubnav([['general','Reglas generales'],['plan','Solo este plan']],scope,'uiTargetScope'):''}<h2>${scope==='plan'?esc(sp.name):'Tu rango y descanso'}</h2><p>${scope==='plan'?'Los campos vacíos heredan las reglas generales.':'Los campos vacíos siguen tu objetivo general.'}</p>${inputs}${scope==='plan'?uiNumberField('Series previstas',oc.sets,`setSplitConf('${uiInlineKey(key)}','sets',this.value)`,{placeholder:'Automáticas',min:1,step:1}):''}<label class="field"><span>Descanso</span><select onchange="${scope==='plan'?`setSplitConf('${uiInlineKey(key)}','rest',this.value)`:`setExRest('${uiInlineKey(key)}',this.value)`}"><option value="auto" ${!oc.rest?'selected':''}>${scope==='plan'?'Heredar descanso general':'Según tus preferencias'}</option>${[45,60,90,120,150,180,240,300].map(s=>`<option value="${s}" ${Number(oc.rest)===s?'selected':''}>${fmtClock(s)}</option>`).join('')}</select></label>${scope==='general'?`<label class="field"><span>Aumento mínimo</span><select onchange="setExStep('${uiInlineKey(key)}',this.value)">${stepOptionsHTML(m.step)}</select></label>${m.type==='normal'&&effEquip(key)!=='placas'?uiNumberField('Carga máxima disponible',m.cap!=null?inputWEx(key,m.cap):'',`setExCap('${uiInlineKey(key)}',this.value)`,{unit:uLabelEx(key)}):''}`:''}</section><section class="n-panel n-detail-side-top"><label class="field"><span>Grupo muscular principal</span><select onchange="setExMuscle('${uiInlineKey(key)}',this.value)"><option value="none" ${!m.muscle||m.muscle==='none'?'selected':''}>Sin asignar</option>${MUSCLES.map(([k,l])=>`<option value="${k}" ${m.muscle===k?'selected':''}>${l}</option>`).join('')}</select></label><p class="hint">Alimenta tu mapa corporal. Puedes mantener «Pierna» o elegir un grupo más específico.</p></section><section class="n-panel n-notes n-detail-side-bottom"><label class="field"><span>Ajuste de ${esc(db.gym.name)}</span><textarea maxlength="300" placeholder="Asiento, altura de polea, accesorios…" oninput="setGymNotes('${uiInlineKey(key)}',this.value)">${esc(m.gymNotes||'')}</textarea></label><p class="hint">Se recupera al elegir este gimnasio.</p><label class="field"><span>Técnica · todos tus gimnasios</span><textarea maxlength="300" placeholder="Agarre, recorrido, ritmo…" oninput="setExNotes('${uiInlineKey(key)}',this.value)">${esc(m.notes||'')}</textarea></label><p class="hint">Se guarda automáticamente y aparece al entrenar en cualquier lugar.</p></section></div>`;
}

/* Three personal task categories, each with its own short page. */
function uiSettings(){
 const section=view.section;
 if(section==='notifications'&&typeof pushSettings==='function')return pushSettings();
 if(section==='sync'&&typeof uiSync==='function')return uiSync();
 if(section==='gyms')return uiGyms();
 if(section==='session')return uiPreferences();
 if(section==='appearance')return uiAppearance();
 if(section==='data')return uiData();
 if(section==='help')return `<div class="n-help-grid">${[['spark','Entender la progresión','Cuándo subir, repetir o descargar','coachInfo()'],['muscle','Repeticiones en reserva','Registrar el esfuerzo con RIR','rirInfo()'],['progress','Tu fuerza estimada','Qué significa el 1RM estimado','e1rmInfo()'],['user','Ejercicios asistidos','Menos ayuda, más trabajo tuyo','asistInfo()'],['shield','Usar sin conexión','Instalación y guardado local','uiOfflineInfo()'],['heart','Apple Salud','Configurar el atajo en iPhone o iPad','healthInfo()']].map(([i,t,s,a])=>`<section class="n-panel">${uiIcon(i)}<h2>${t}</h2><p>${s}</p>${uiButton('Abrir guía',a,'arrow','text')}</section>`).join('')}</div>`;
 const dsb=daysSinceBackup();
 return `<div class="n-you-grid"><aside class="n-app-identity">${uiBrand()}<span class="n-app-version">Hierro ${APP_VERSION}</span><p>Tus lugares, tu entrenamiento y lo que funciona para ti.</p></aside><section>${uiRow('Tu entrenamiento',`${esc(activeSplit()?.name||'Crea tu primer plan')}`,uiGo({name:'splits'}),'chevron',`<span class="n-row-icon">${uiIcon('barbell')}</span>`)}${uiRow('Mis gimnasios',`${esc(db.gym.name)}${db.gyms.length>1?` y ${db.gyms.length-1} más`:''}`,uiGo({name:'settings',section:'gyms'}),'chevron',`<span class="n-row-icon">${uiIcon('gym')}</span>`)}${uiRow('Preferencias de sesión','Objetivo, descanso, unidades y pantalla',uiGo({name:'settings',section:'session'}),'chevron',`<span class="n-row-icon">${uiIcon('settings')}</span>`)}${uiRow('Notificaciones','Descanso y siguiente carga, con la pantalla bloqueada',uiGo({name:'settings',section:'notifications'}),'chevron',`<span class="n-row-icon">${uiIcon('bell')}</span>`)}${uiRow('Apariencia','Claro, oscuro y animaciones',uiGo({name:'settings',section:'appearance'}),'chevron',`<span class="n-row-icon">${uiIcon('moon')}</span>`)}${uiRow('Sincronización','Tu espacio en el teléfono y la computadora',uiGo({name:'settings',section:'sync'}),'chevron',`<span class="n-row-icon">${uiIcon('shield')}</span>`)}${uiRow('Datos y respaldos',dsb===null?'Todavía no has descargado un respaldo':`Último respaldo hace ${dsb} días`,uiGo({name:'settings',section:'data'}),'chevron',`<span class="n-row-icon">${uiIcon('shield')}</span>`)}${uiRow('Aprender con Hierro','Progresión, carga y esfuerzo',uiGo({name:'settings',section:'help'}),'chevron',`<span class="n-row-icon">${uiIcon('book')}</span>`)}</section></div>`;
}
function uiToggle(label,sub,on,action,disabled=false){return `<div class="line"><div><div class="l-t">${label}</div><div class="l-d">${sub}</div></div><button class="tog ${on?'on':''}" role="switch" aria-checked="${on}" aria-label="${label}" ${disabled?'disabled':''} onclick="${action}"><i></i></button></div>`;}
function uiPreferences(){
 const rest=db.settings.rest,screen=db.settings.screenOn!=='off',notif=canNotify(),health=db.settings.health==='on';
 const vibrationAvailable=typeof navigator.vibrate==='function';
 const alerts=`<section class="n-panel n-preference-panel n-detail-side-top"><h2>Escucha tu siguiente serie.</h2>
 ${uiToggle('Sonidos del temporizador','Pitidos en los últimos 3 segundos y una señal al terminar.',db.settings.sound!=='off',`uiSetPreference('sound','${db.settings.sound==='off'?'on':'off'}',this)`)}
 ${uiToggle('Vibración',vibrationAvailable?'Un toque breve con cada aviso del temporizador.':'Este navegador no ofrece vibración; puedes usar el sonido.',vibrationAvailable&&db.settings.vibration!=='off',`uiSetPreference('vibration','${db.settings.vibration==='off'?'on':'off'}',this)`,!vibrationAvailable)}
 <div class="n-cue-actions">${uiButton('Probar aviso','uiTestCues()','play','secondary')}<p id="n-cue-test" class="hint" role="status"></p></div>
 <p class="hint">Con la app abierta, los avisos acompañan el reloj. Para recibir el fin del descanso con la pantalla bloqueada, activa Notificaciones del teléfono.</p></section>`;
 return `<div class="n-detail-grid n-aligned-details"><section class="n-panel n-detail-intro"><div class="n-section-head"><h2>Lo que buscas</h2></div><div class="n-goals">${Object.entries(GOALS).map(([k,v])=>`<button class="${db.settings.goal===k?'on':''}" onclick="setGoal('${k}')"><b>${v.label}</b><small>${v.lo}–${v.hi} reps</small></button>`).join('')}</div><p class="n-context-note">Define el rango y el descanso automático. Cada ejercicio puede tener sus propias reglas.</p></section><section class="n-panel n-detail-form"><div class="line"><div><b>Unidad de peso</b><p class="hint">Los ejercicios con torre siguen la unidad de su máquina.</p></div>${unitPillHTML()}</div><label class="field"><span>Descanso entre series</span><select onchange="setRest(this.value)"><option value="auto" ${rest==='auto'?'selected':''}>Según mi objetivo</option>${[60,90,120,150,180,240,300].map(s=>`<option value="${s}" ${String(rest)===String(s)?'selected':''}>${fmtClock(s)}</option>`).join('')}<option value="off" ${rest==='off'?'selected':''}>Sin temporizador</option></select></label><p class="hint">Comienza al registrar una serie. También puedes definirlo por ejercicio o plan.</p></section>${alerts}<section class="n-panel n-preference-panel n-detail-side-bottom">${uiRow('Notificaciones del teléfono','Descansos, recordatorios y carga del siguiente ejercicio',uiGo({name:'settings',section:'notifications'}),'bell')}${uiToggle('Pantalla encendida','Mantenerla activa durante la sesión',screen,`setScreenOn('${screen?'off':'on'}')`)}${uiToggle('Guardar en Apple Salud','Mostrar la acción al terminar · requiere un atajo',health,'toggleHealth()')}${health?uiButton('Configurar el atajo','healthInfo()','heart','text'):''}</section></div>`;
}
function uiData(){
 const dsb=daysSinceBackup();
 return `<div class="n-detail-grid"><section class="n-panel"><span class="n-eyebrow">En este dispositivo</span><h2>Tu historia merece <br>una copia.</h2><p>${db.history.length} sesiones · ${Math.max(1,Math.round(JSON.stringify(db).length/1024))} KB. <br>${dsb===null?'Aún no has descargado un respaldo.':`Último respaldo: hace ${dsb} días.`}</p>${uiButton('Descargar respaldo','exportBackup()','download')}<p class="hint">Incluye planes, historial, progreso, gimnasios y sesión en curso.</p></section><section>${uiRow('Importar un plan','Días y ejercicios de un archivo de Hierro',"go({name:'splits'});document.getElementById('splitfile').click()",'plan')}${uiRow('Restaurar respaldo','Reemplaza los datos actuales después de confirmar',"document.getElementById('backupfile').click()",'download')}${uiRow('Importar desde Hevy','Añade tu historial desde un CSV',"document.getElementById('hevyfile').click()",'download')}<p class="hint">En Hevy: Perfil → Ajustes → Export data. Una importación repetida no duplica sesiones.</p><input id="backupfile" type="file" accept=".json,application/json" hidden onchange="importBackup(this.files[0]);this.value=''"><input id="hevyfile" type="file" accept=".csv,text/csv" hidden onchange="importHevy(this.files[0]);this.value=''">${uiButton('Borrar todos mis datos','askWipe()','trash','danger')}</section></div>`;
}
async function uiOfflineInfo(){
 openModal(`<h2>Hierro sin conexión</h2><p id="n-offline-state" class="n-context-note" role="status">Comprobando la copia de la app en este dispositivo…</p><p>Puedes entrenar y guardar series sin internet. La sincronización y las notificaciones con la pantalla bloqueada necesitan conexión.</p><p class="hint">Añade Hierro a la pantalla de inicio desde el menú del navegador. Descarga un respaldo antes de borrar sus datos o cambiar de navegador.</p>${uiButton('Volver a comprobar','uiOfflineInfo()','shield','secondary')}${uiButton('Cerrar','closeModal()','close','text')}`);
 const status=document.getElementById('n-offline-state');let text='No pudimos confirmar la copia sin conexión. Abre Hierro con internet y vuelve a comprobar.';
 try{
  const worker=navigator.serviceWorker?.controller;
  if(worker){
   const result=await new Promise(resolve=>{const channel=new MessageChannel();const timeout=setTimeout(()=>{channel.port1.close();resolve(null);},3500);channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();resolve(e.data);};worker.postMessage({tipo:'consultar-offline'},[channel.port2]);});
   if(result?.ready)text=`Lista para abrir sin conexión · versión ${result.version}. Tus registros se guardan en este dispositivo.`;
  }
 }catch{}
 if(status?.isConnected)status.textContent=text;
}
function uiGymPicker(){
 openModal(`<h2>¿Dónde entrenas hoy?</h2><p class="muted">Cada lugar recuerda su equipo y sus máquinas.</p>${db.gyms.map(g=>uiRow(esc(g.name),g.id===db.settings.gymId?'Estás aquí':gymSummary(g),uiAction('pickGym',g.id),g.id===db.settings.gymId?'check':'chevron',`<span class="n-row-icon">${uiIcon('gym')}</span>`)).join('')}${uiButton('Administrar mis gimnasios',`closeModal();${uiGo({name:'settings',section:'gyms'})}`,'settings','text')}${uiButton('Volver','closeModal()','back','secondary')}`);
}
function uiGyms(){return `<div class="n-plan-grid">${db.gyms.map(g=>`<section class="n-gym-card ${g.id===db.settings.gymId?'active':''}"><span class="n-eyebrow">${g.id===db.settings.gymId?'Entrenando aquí':'Tu otro lugar'}</span>${uiIcon('gym')}<h2>${esc(g.name)}</h2><p>${gymSummary(g)}</p><div class="n-gym-counts"><span><b>${g.plates.filter(p=>p.on).length}</b>Discos</span><span><b>${g.bars.filter(b=>b.on).length}</b>Barras</span><span><b>${g.dumbbells.filter(d=>d.on).length}</b>Mancuernas</span></div>${uiButton(g.id===db.settings.gymId?'Abrir equipo':'Usar este gimnasio',uiAction('uiOpenGym',g.id),'arrow')}${uiButton('Nombre, copia y opciones',uiAction('gymEditModal',g.id),'more','text')}</section>`).join('')}</div><div class="n-toolbar n-equal-actions">${uiButton('Nuevo gimnasio','promptNewGym()','plus','secondary')}${uiButton('Importar gimnasio',"document.getElementById('gymfile').click()",'download','secondary')}</div><input type="file" id="gymfile" accept=".json,application/json" hidden onchange="importGymFile(this.files[0]);this.value=''">`;}
function uiOpenGym(id){setActiveGym(id);go({name:'gym',kind:'plates'});}
function uiGymTab(kind){view.kind=kind;render();}
function uiGym(){
 const kind=view.kind||'plates',tabs=uiSubnav([['plates','Discos'],['bars','Barras'],['dumbbells','Mancuernas'],['machines','Montajes']],kind,'uiGymTab');
 if(kind==='machines')return tabs+`<div class="n-machines">${[...allExerciseNames()].filter(([k])=>effEquip(k)&&effEquip(k)!=='nada').map(([k,inf])=>uiRow(esc(exBaseName(inf.name)),EQUIP[effEquip(k)]?.label||'',uiAction('uiOpenMachine',k),'settings')).join('')||'<div class="n-empty"><h2>Tu equipo, ejercicio a ejercicio.</h2><p>Añade ejercicios a un día y configura su máquina desde la ficha.</p></div>'}</div>`;
 let body='';
 if(kind==='dumbbells')body=`<p class="n-context-note">Toca los pesos disponibles. Cada número representa una mancuerna.</p><div class="n-rack">${db.gym.dumbbells.map((d,i)=>({d,i})).sort((a,b)=>a.d.kg-b.d.kg).map(({d,i})=>`<div class="n-rack-item"><button class="n-weight-tile ${d.on?'on':''}" aria-pressed="${!!d.on}" aria-label="Mancuerna ${fmtW(d.kg)} ${uLabel()}" onclick="toggleGym('dumbbells',${i})"><b>${fmtW(d.kg)}</b><small>${uLabel()}${d.on?' · disponible':''}</small>${d.on?uiIcon('check'):''}</button>${d.custom?`<button class="n-remove-weight" aria-label="Eliminar mancuerna ${fmtW(d.kg)}" onclick="removeGym('dumbbells',${i})">${uiIcon('trash')}</button>`:''}</div>`).join('')}</div>`;
 else if(kind==='plates')body=`<p class="n-context-note">Marca los discos que hay y cuántos pares tienes. Así se propone un montaje posible.</p><div class="n-plates-grid">${db.gym.plates.map((p,i)=>({p,i})).sort((a,b)=>b.p.kg-a.p.kg).map(({p,i})=>`<section class="n-plate-card ${p.on?'on':''}"><button class="n-plate-select" aria-pressed="${!!p.on}" aria-label="Disco ${fmtW(p.kg)} ${uLabel()}" onclick="toggleGym('plates',${i})"><span class="n-plate-art" style="--plate-color:${plateColor(p.kg)}"><i></i></span><span><b>${fmtW(p.kg)} <small>${uLabel()}</small></b><small>${p.on?`${p.pairs*2} discos disponibles`:'No disponible'}</small></span>${uiIcon(p.on?'check':'plus')}</button>${p.on?`<div class="n-plate-qty"><span>Pares</span><div class="qty"><button aria-label="Menos pares de ${fmtW(p.kg)}" onclick="setPairs(${i},-1)">−</button><span>${p.pairs}</span><button aria-label="Más pares de ${fmtW(p.kg)}" onclick="setPairs(${i},1)">+</button></div></div>`:''}${uiButton('Quitar peso',`removeGym('plates',${i})`,'trash','text')}</section>`).join('')}</div>`;
 else body=`<p class="n-context-note">La barra predeterminada se usa cuando el ejercicio no tiene otra elegida.</p><div class="n-bar-grid">${db.gym.bars.map((b,i)=>`<section class="n-bar-card ${b.on?'on':''}"><span class="n-eyebrow">${b.on&&b.def?'Tu barra predeterminada':b.on?'Disponible':'No disponible'}</span>${uiIcon('barbell')}<h2>${esc(b.name)}</h2><strong>${fmtW(b.kg)}<small>${uLabel()}</small></strong><div class="n-toolbar">${uiButton(b.on?'Desactivar':'Tengo esta barra',`toggleGym('bars',${i})`,b.on?'check':'plus','secondary')}${b.on&&!b.def?uiButton('Predeterminada',`setDefaultBar(${i})`,'check','text'):''}${uiButton('Cambiar nombre',uiAction('uiRenameBar',b.id),'edit','text')}${b.custom?uiButton('Quitar',`removeGym('bars',${i})`,'trash','text'):''}</div></section>`).join('')}</div>`;
 return `${tabs}<div class="n-inventory-unit">${unitPillHTML()}</div>${body}<div class="n-inventory-footer"><div class="n-toolbar">${uiButton(kind==='bars'?'Añadir barra':'Añadir peso',uiAction('promptGymItem',kind),'plus','secondary')}${kind==='dumbbells'?uiButton('Generar un rango','uiDumbbellRange()','list','text'):''}</div></div><div class="n-inventory-reset">${uiButton('Restaurar juego estándar',uiAction('askResetGymKind',kind),'list','text')}<p>Reemplaza esta lista por los pesos iniciales en ${uLabel()}. Te pediremos confirmar antes de cambiarla.</p></div>`;
}
function uiOpenMachine(key){if(view.inventoryReturn?.key===key){go({...view.inventoryReturn,exTab:'equipment'});return;}openExerciseByKey(key);view.exTab='equipment';view.from='gym';render();}
function uiOpenInventory(kind){go({name:'gym',kind,inventoryReturn:{...view}});}
function uiInventoryOptions(kind){askResetGymKind(kind);}
function uiRenameBar(id){
 const bar=db.gym.bars.find(b=>b.id===id);if(!bar)return;
 openModal(`<h2>Nombre de la barra</h2><p class="muted">${esc(db.gym.name)} · ${fmtW(bar.kg)} ${uLabel()}. El peso y los ejercicios que la usan se conservan.</p><form class="stack" onsubmit="${uiAction('uiSaveBarName',id).replace('(', '(event,')};return false"><label class="field"><span>Nombre</span><input id="n-bar-name" type="text" maxlength="100" required value="${esc(bar.name)}" autocomplete="off"></label><button class="btn" type="submit">Guardar nombre</button><button class="btn ghost" type="button" onclick="closeModal()">Cancelar</button></form>`);
}
function uiSaveBarName(event,id){
 event.preventDefault();const bar=db.gym.bars.find(b=>b.id===id),name=document.getElementById('n-bar-name').value.trim();
 if(!bar||!name)return;
 bar.name=name.slice(0,100);save();closeModal();render();
}
function uiDumbbellRange(){openModal(`<h2>Generar un rack</h2><p class="muted">Crea la secuencia y después desmarca los pesos que falten. Sustituye la lista actual tras confirmar.</p><div class="n-form-pair">${uiNumberField('Desde',1,'',{unit:uLabel(),id:'dbFrom'})}${uiNumberField('Hasta',24,'',{unit:uLabel(),id:'dbTo'})}${uiNumberField('Salto',1,'',{unit:uLabel(),id:'dbStep'})}</div>${uiButton('Generar lista','applyDbRange()','check')}${uiButton('Cancelar','closeModal()','back','text')}`);}

/* Reflection separates panorama, anatomy and the diary. */
function uiProgress(){
 const tab=view.progressTab||'summary';
 let content='';
 if(tab==='body')content=uiAtlas(false);
 else if(tab==='diary')content=uiDiary();
 else if(tab==='exercises')content=uiExerciseDirectory();
 else{
  const total=db.history.length,sets=db.history.reduce((n,h)=>n+h.entries.reduce((a,e)=>a+e.sets.length,0),0);
  const lifts=topLifts(5);
  content=`<div class="n-progress-grid"><section class="n-panel n-volume-panel"><span class="n-eyebrow">Tu recorrido</span><h2>${total?'Tu volumen semanal.':'Una sesión es un comienzo.'}</h2>${total?uiWeeklyChart():`<p>Registra tu entrenamiento para ver cómo cambia tu esfuerzo con el tiempo.</p>${uiButton('Ir a entrenar',uiGo({name:'home'}))}`}<div class="n-lifetime n-lifetime-compact"><span><b>${total}</b>Sesiones</span><span><b>${sets}</b>Series</span></div></section><section><div class="n-section-head"><h2>Tus referencias de fuerza</h2><span class="n-eyebrow">1RM estimado</span></div>${lifts.map(o=>`<button class="n-lift-row" onclick="${uiAction('uiOpenProgress',o.key)}"><div><b>${esc(exBaseName(o.name))}</b><small>${o.vals.length} registros</small></div>${sparkSVG(o.vals.slice(-8),'#557a45',{w:96,h:36,p:5,r:2.8})}<strong>${fmtE1RM(o.key,o.vals[o.vals.length-1])}<small>${uLabelEx(o.key)}</small></strong></button>`).join('')||'<div class="n-empty"><p>Tus gráficas aparecerán al repetir ejercicios con carga.</p></div>'}</section></div>`;
 }
 return `${uiSubnav([['summary','Panorama'],['exercises','Ejercicios'],['body','Tu cuerpo'],['diary','Diario']],tab,'uiProgressTab')}${content}`;
}
function uiWeekComparison(w,reference){
 if(!(reference.mean>0))return reference.count?'Todavía no hay una referencia de volumen con carga.':'Tu promedio aparecerá cuando cierre tu primera semana.';
 const ratio=w.vol/reference.mean,percent=Math.round(ratio*100);
 if(Math.abs(ratio-1)<.000001)return w.current?'Ya alcanzaste tu promedio semanal.':'Alcanzaste el promedio de referencia.';
 if(ratio>1)return `${w.current?'Ya superaste':'Superaste'} ${w.current?'tu promedio semanal':'el promedio de referencia'}${percent>100?` en un ${percent-100}%`:''}.`;
 return `${w.current?'Llevas':'Registraste'} ${percent===0&&w.vol>0?'menos del 1%':percent===100?'casi el 100%':`el ${percent}%`} ${w.current?'de tu promedio semanal':'del promedio de referencia'}.`;
}
function uiWeekReadout(w,reference){
 return `<div class="n-week-heading"><b>${weekLabel(w.start)}</b><span>${weekRange(w.start)}</span></div><div class="n-week-value"><strong>${fmtInt(fromKg(w.vol))}</strong><span>${uLabel()}<small>${nSesiones(w.ses)}${w.current?' · en curso':''}</small></span></div><p class="n-week-comparison ${reference.mean>0&&w.vol>=reference.mean?'is-reached':''}">${uiWeekComparison(w,reference)}</p>`;
}
function uiWeeklyChart(){
 const weeks=weeklyVolumes(8),reference=weeklyVolumeReference(weeks),max=Math.max(1,...weeks.map(w=>w.vol))*1.12;
 const selected=Number.isInteger(view.volumeWeek)?Math.max(0,Math.min(7,view.volumeWeek)):7;
 return `<div id="n-week-readout" class="n-week-readout" aria-live="polite" aria-atomic="true">${uiWeekReadout(weeks[selected],reference)}</div><div class="n-volume-chart" role="group" aria-label="Volumen de las últimas ocho semanas">${reference.mean>0?`<div class="n-volume-average" style="bottom:${reference.mean/max*100}%" aria-hidden="true"><span>Promedio</span></div>`:''}${weeks.map((w,i)=>`<button type="button" aria-label="${weekLabel(w.start)}, ${weekRange(w.start)}: ${fmtInt(fromKg(w.vol))} ${uLabel()}, ${nSesiones(w.ses)}${w.current?', semana en curso':''}" aria-pressed="${i===selected}" aria-controls="n-week-readout" style="--bar-height:${Math.max(1,w.vol/max*100)}%" onpointerenter="if(event.pointerType==='mouse')uiPickWeek(${i})" onfocus="uiPickWeek(${i})" onclick="uiPickWeek(${i})"><i></i></button>`).join('')}</div><div class="axis"><span>Hace 7 semanas</span><span>Esta semana</span></div><div class="n-week-reference"><div><span class="n-eyebrow">Tu promedio semanal</span><b>${reference.mean===null?'Aún por construir':`${fmtInt(fromKg(reference.mean))} <small>${uLabel()}</small>`}</b></div><span>${reference.count?`${reference.count===1?'Última semana completa':`Últimas ${reference.count} semanas completas`}`:'Después de tu primera semana'}</span></div><details class="n-volume-help"><summary>Cómo leer tu volumen</summary><p>Volumen = peso × repeticiones. Los ejercicios por tiempo y la asistencia quedan fuera. Promedio y media aritmética significan lo mismo: sumamos el volumen de hasta cuatro semanas completas anteriores y lo dividimos entre esas semanas.</p><p>Contamos desde la semana de tu primer registro, incluyendo las semanas sin sesiones. Esta semana sigue en curso y no entra en el promedio. Más volumen por sí solo no indica más fuerza.</p><p>Pasa el cursor, toca una barra o usa Tab para consultar cada semana aquí.</p></details>`;
}
function uiPickWeek(index){
 const weeks=weeklyVolumes(8),w=weeks[index],readout=document.getElementById('n-week-readout');
 if(!w||!readout)return;
 view.volumeWeek=index;readout.innerHTML=uiWeekReadout(w,weeklyVolumeReference(weeks));
 document.querySelectorAll('.n-volume-chart button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
}
function uiDiary(){
 const filter=view.historyFilter||'',all=[...new Map(db.history.map(h=>[h.routineId||h.routineName,h.routineName]))],list=[...db.history].filter(h=>!filter||(h.routineId||h.routineName)===filter).sort((a,b)=>b.date.localeCompare(a.date)),limit=view.histLimit||30;
 return `<div class="n-diary-head"><h2>Tu diario de entrenamiento</h2><label class="field"><span>Filtrar por día</span><select onchange="view.historyFilter=this.value;view.histLimit=30;render()"><option value="">Todos los días</option>${all.map(([id,n])=>`<option value="${esc(id)}" ${filter===id?'selected':''}>${esc(n)}</option>`).join('')}</select></label></div><div class="n-diary-list">${list.slice(0,limit).map(h=>{
  const d=new Date(h.date),sets=h.entries.reduce((n,e)=>n+e.sets.length,0),volume=sessionVolume(h.entries);
  return `<button class="n-diary-entry" onclick="${uiAction('uiReceipt',h.id)}"><span class="n-date-tile"><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString('es-MX',{month:'short'}))}</small></span><span class="grow"><b>${esc(h.routineName)}</b><small>${fmtDurShort(h.duration)} · ${sets} serie${sets===1?'':'s'}${h.deload?' · Descarga':''}${h.prs?.length?` · ${h.prs.length} ${h.prs.length===1?'marca':'marcas'}`:''}</small></span><span class="n-diary-volume">${volume>0?fmtVolShort(volume):uiSessionMeasure(h.entries).value+' '+uiSessionMeasure(h.entries).unit}</span>${uiIcon('chevron')}</button>`;
 }).join('')||'<div class="n-empty"><h2>Tu diario empieza contigo.</h2><p>Aquí aparecerán las sesiones que termines.</p></div>'}</div>${list.length>limit?`<div class="n-diary-more">${uiButton('Mostrar más sesiones','moreHistory()','plus','secondary')}</div>`:''}`;
}
function uiReceipt(id){
 const h=db.history.find(h=>h.id===id);if(!h)return;
 const prs=new Set((h.prs||[]).map(p=>p.key));
 const rows=h.entries.map(e=>`<button class="n-receipt-exercise" onclick="${uiAction('uiOpenProgress',e.key,id)}" aria-label="Ver progreso de ${esc(e.name)}"><span><b>${esc(e.name)}</b>${prs.has(e.key)?'<span class="fin-mark">PR</span>':''}${uiIcon('chevron')}</span><span class="fin-sets">${setsLine(e.key,e.sets)}</span></button>`).join('');
 openModal(`<span class="n-eyebrow">${fmtDate(h.date)}${h.deload?' · Descarga':''}</span><h2>${esc(h.routineName)}</h2><p class="muted">${fmtDurShort(h.duration)} · ${h.entries.reduce((n,e)=>n+e.sets.length,0)} ${h.entries.reduce((n,e)=>n+e.sets.length,0)===1?'serie':'series'}</p><p class="hint">Toca un ejercicio para ver su progreso.</p><div class="n-receipt">${rows}</div><div class="n-receipt-actions">${uiButton('Guardar tarjeta',uiAction('uiShareSession',id,'diary'),'share')}${uiButton('Editar sesión',`closeModal();${uiAction('editSession',id)}`,'edit','secondary')}</div><div class="n-receipt-danger">${uiButton('Eliminar sesión',`closeModal();${uiAction('deleteSession',id)}`,'trash','danger')}</div>${uiButton('Cerrar','closeModal()','close','text')}`);
}

function uiEditHistory(){
 const ed=window.__edit;if(!ed)return;
 openModal(`<h2>Corregir sesión</h2><p class="muted">${esc(ed.routineName)} · ${fmtDate(ed.date)}. Aquí se edita el peso total registrado, incluida la barra o el aparato.</p>${ed.entries.map((e,ei)=>`<section class="n-history-edit"><h3>${esc(exBaseName(e.name))}</h3>${e.sets.map((st,si)=>`<div class="n-history-set"><div class="n-section-head"><b>Serie ${si+1}</b><button class="n-round" aria-label="Quitar serie ${si+1} de ${esc(exBaseName(e.name))}" onclick="editRemoveSet(${ei},${si})">${uiIcon('trash')}</button></div><div class="n-history-inputs">${uiNumberField('Peso total',st.w,`editVal(${ei},${si},'w',this.value)`,{unit:uLabelEx(e.key)})}${uiNumberField(exMeta(e.key).type==='tiempo'?'Segundos':'Reps',st.r,`editVal(${ei},${si},'r',this.value)`,{min:1,step:1})}${exMeta(e.key).type==='tiempo'?'<p class="n-time-help">Por tiempo · sin RIR</p>':uiNumberField('RIR',st.rir,`editVal(${ei},${si},'rir',this.value)`,{step:1})}</div></div>`).join('')}${uiButton('Añadir serie',`editAddSet(${ei})`,'plus','text')}</section>`).join('')}<p id="n-history-error" class="n-error" role="alert"></p>${uiButton('Guardar cambios','uiSaveHistory()','check')}${uiButton('Cancelar','closeModal()','back','secondary')}`);
}
function uiSaveHistory(){
 const ed=window.__edit;if(!ed)return;
 if(ed.entries.some(e=>e.sets.some(s=>!uiValidSet(e.key,s)))){document.getElementById('n-history-error').textContent='Cada serie necesita un peso válido y un número entero de repeticiones o segundos. Tus cambios siguen aquí.';return;}
 saveEditedSession();
}
function uiFormSemantics(root){
 if(!root?.querySelectorAll)return;
 root.querySelectorAll('.field').forEach(field=>{const input=field.querySelector('input,textarea,select'),label=field.querySelector('span');if(input&&label&&!input.closest('label')&&!input.hasAttribute('aria-label'))input.setAttribute('aria-label',label.textContent.trim());});
 root.querySelectorAll('.pill-sw button,.n-goals button,.n-rir-options button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('on'))));
 root.querySelectorAll('select:not([aria-label])').forEach(el=>{if(!el.closest('label'))el.setAttribute('aria-label',el.closest('.line')?.querySelector('.l-t')?.textContent||'Elegir opción');});
}
function uiAfterRender(){
 uiSyncModalState();
 uiKeyboardInset();
 if(!document.querySelectorAll)return;
 uiApplyAppearance();
 uiArrangeActions(document.getElementById('main'));
 uiAnimateView();uiSaveState();
 const record=document.querySelector('.n-record-dock>.n-primary');if(record)record.id='n-record';
 const warm=document.querySelector('#warmup-record,#warmup-next');if(warm){const dock=document.createElement('div');dock.className='n-work-action';warm.before(dock);dock.append(warm);}
 document.body.dataset.workAction=record||warm?'on':'off';
 if(window.__removedSet&&db.active?.id===window.__removedSet.session)document.getElementById('main').insertAdjacentHTML('beforeend',`<div class="n-undo-bar" role="status"><span>Serie eliminada</span>${uiButton('Deshacer','uiUndoRemovedSet()','back','text')}</div>`);
 uiFormSemantics(document);
 document.querySelectorAll('[role="button"]:not(button)').forEach(el=>{el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};});
 if(db.active&&view.name!=='session'&&view.name!=='home')document.getElementById('main').insertAdjacentHTML('afterbegin',`<div class="n-minimized">${uiResume()}</div>`);
 uxAfterRender();
}

function uiWelcome(){
 const selected=window.__welcomeGoal||'ambas';
 openModal(`<div class="n-welcome-brand">${uiBrand()}</div><span class="n-eyebrow">Bienvenido a tu espacio</span><h2>Tu esfuerzo <br>merece memoria.</h2><p class="muted">Entrena, registra una serie y encuentra tu siguiente paso. Incluso sin conexión.</p><p class="n-eyebrow">¿Qué buscas?</p><div class="n-goals">${Object.entries(GOALS).map(([k,v])=>`<button type="button" data-welcome-goal="${k}" class="${selected===k?'on':''}" aria-pressed="${selected===k}" onclick="uiSelectWelcomeGoal('${k}')"><b>${v.label}</b><small>${v.lo}–${v.hi} reps</small></button>`).join('')}</div><p class="hint">Es un punto de partida. Puedes ajustarlo por ejercicio.</p>${uiButton('Crear mi primer día',"uiWelcomeContinue(false)",'plus')}${uiButton('Ya tengo un plan o un respaldo',"uiWelcomeContinue(true)",'download','text')}${uiButton('Ya tengo una clave de sincronización',"closeModal();go({name:'settings',section:'sync'});uiSyncLink()",'shield','text')}`);
}
function uiSelectWelcomeGoal(goal){
 if(!Object.keys(GOALS).includes(goal))return;
 window.__welcomeGoal=goal;
 // Keep the dialog mounted: choosing a goal must not replay its entrance,
 // move focus or reset the user's scroll position.
 document.querySelectorAll('#modalhost [data-welcome-goal]').forEach(button=>{
  const selected=button.dataset.welcomeGoal===goal;
  button.classList.toggle('on',selected);
  button.setAttribute('aria-pressed',String(selected));
 });
}
function uiWelcomeContinue(importing){db.settings.goal=window.__welcomeGoal||'ambas';save();closeModal();if(importing)go({name:'settings',section:'data'});else promptNewRoutine();}

/* =====================================================================
   Movimiento y sonido. Una capa encima de la interfaz: no cambia datos,
   cálculos ni navegación. Obedece Sonido, Vibración y Animaciones de la
   persona y «Reducir movimiento» del sistema. Los sonidos se sintetizan
   con Web Audio: no hay archivos que descargar y funcionan sin conexión.
   ===================================================================== */
let uxCueScope='';
function uxMotion(){try{return !!document.documentElement?.animate&&db.settings.motion!=='off'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}
const UX_SPRING=(()=>{
 let linear=false;try{linear=!!window.CSS?.supports?.('transition-timing-function','linear(0, 1)');}catch{}
 const make=(k,c)=>{if(!linear)return{easing:'cubic-bezier(.2,.9,.25,1.12)',duration:560};let x=0,v=0;const s=[];for(let i=0;i<1200;i++){v+=(-k*(x-1)-c*v)/120;x+=v/120;if(i%2===0)s.push(x);if(i>60&&Math.abs(x-1)<.0008&&Math.abs(v)<.01)break;}const step=Math.max(1,Math.floor(s.length/40)),p=[0];for(let i=step;i<s.length-1;i+=step)p.push(+s[i].toFixed(4));p.push(1);return{easing:`linear(${p.join(',')})`,duration:Math.round(s.length*1000/60)};};
 return {soft:make(180,20),snappy:make(380,26),bouncy:make(300,13)};
})();
function uxAnim(el,frames,o={}){
 if(!el?.animate||!uxMotion())return null;
 const opt={duration:o.duration||320,delay:o.delay||0,easing:o.easing||'cubic-bezier(.2,.8,.2,1)',fill:o.fill||'backwards'};
 if(o.spring){opt.easing=UX_SPRING[o.spring].easing;opt.duration=o.duration||UX_SPRING[o.spring].duration;}
 try{return el.animate(frames,opt);}catch{return null;}
}
function uxHaptic(pattern){try{if(db.settings.vibration!=='off'&&navigator.vibrate)navigator.vibrate(pattern);}catch{}}

/* ---------- sonido ---------- */
const UXA={ctx:null,last:{}};
function uxAudio(){
 if(db.settings.sound==='off')return null;
 const c=typeof audioCtx!=='undefined'?audioCtx:null;
 if(!c||c.state==='closed'||['createBiquadFilter','createConvolver','createDynamicsCompressor','createBuffer','createBufferSource'].some(f=>typeof c[f]!=='function'))return null;
 if(UXA.ctx!==c){
  const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=12;comp.ratio.value=3;comp.attack.value=.003;comp.release.value=.2;comp.connect(c.destination);
  const master=c.createGain();master.gain.value=.72;master.connect(comp);
  const rev=c.createConvolver(),len=Math.floor(c.sampleRate*1.8),ir=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
  rev.buffer=ir;const wet=c.createGain();wet.gain.value=.5;rev.connect(wet);wet.connect(master);
  const nb=c.createBuffer(1,c.sampleRate,c.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  Object.assign(UXA,{ctx:c,master,rev,nb});
 }
 if(c.state==='suspended')c.resume?.().catch?.(()=>{});
 return UXA;
}
Object.assign(UXA,{
 bus(send){const c=this.ctx,g=c.createGain();g.connect(this.master);if(send>0){const s=c.createGain();s.gain.value=send;g.connect(s);s.connect(this.rev);}return g;},
 tone({f,f2,type='sine',at=0,dur=.2,gain=.2,attack=.004,send=.2}){const c=this.ctx,t=c.currentTime+at+.01,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(this.bus(send));o.start(t);o.stop(t+dur+.05);},
 noise({at=0,dur=.1,gain=.1,type='bandpass',f=1000,f2,q=1,send=.1,attack}){const c=this.ctx,t=c.currentTime+at+.01,s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nb;fl.type=type;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+dur);fl.Q.value=q;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+(attack||Math.min(.012,dur/4)));g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(fl);fl.connect(g);g.connect(this.bus(send));s.start(t,Math.random()*.4);s.stop(t+dur+.05);},
 synth({f,path,at=0,dur=.5,gain=.1,type='sawtooth',detune=7,cut0=500,cut1=3200,cut2=1400,attack=.02,release=.25,send=.3,q=1,vib=0,depth=.006}){const c=this.ctx,t=c.currentTime+at+.01,end=t+dur,fl=c.createBiquadFilter(),g=c.createGain();fl.type='lowpass';fl.Q.value=q;fl.frequency.setValueAtTime(cut0,t);fl.frequency.exponentialRampToValueAtTime(cut1,t+Math.max(.03,attack*1.5));fl.frequency.exponentialRampToValueAtTime(cut2,end);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+attack);g.gain.setValueAtTime(gain,Math.max(t+attack,end-release));g.gain.exponentialRampToValueAtTime(.0001,end);fl.connect(g);g.connect(this.bus(send));
  for(const d of [-detune,detune]){const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);(path||[]).forEach(([fr,dt])=>o.frequency.exponentialRampToValueAtTime(fr,t+dt));o.detune.value=d;if(vib){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=vib;lg.gain.value=f*depth;l.connect(lg);lg.connect(o.frequency);l.start(t);l.stop(end+.05);}o.connect(fl);o.start(t);o.stop(end+.05);}},
 bell(f,at=0,gain=.1,dur=1.4,send=.4){this.tone({f,at,dur,gain,send});this.tone({f:f*2.01,at,dur:dur*.55,gain:gain*.28,send});this.tone({f:f*3.02,at,dur:dur*.28,gain:gain*.1,send});}
});
const UX_OBJ_SOUND={
 nevera:a=>{a.synth({f:110,dur:.55,gain:.035,attack:.05,release:.3,cut0:300,cut1:520,cut2:300,send:.1});a.tone({f:190,f2:90,at:.52,dur:.12,gain:.25,send:.05});a.noise({at:.52,dur:.06,gain:.18,type:'lowpass',f:800,send:.05});},
 moto:a=>a.synth({f:70,path:[[170,.25],[120,.42],[240,.75]],dur:.85,gain:.06,attack:.03,release:.2,cut0:400,cut1:1500,cut2:900,q:3,vib:28,depth:.05,send:.1}),
 caballo:a=>{a.synth({f:620,path:[[1150,.15],[900,.5],[480,.9]],dur:.9,gain:.035,attack:.04,release:.4,cut0:1200,cut1:3000,cut2:1500,q:5,vib:14,depth:.05,send:.3});[1,1.14,1.3,1.44].forEach((t,i)=>{a.tone({f:i%2?700:900,type:'triangle',at:t,dur:.04,gain:.08,send:.1});a.noise({at:t,dur:.03,gain:.06,f:2000,send:.05});});},
 coche:a=>[0,.24].forEach(t=>[400,505].forEach(f=>a.synth({f,type:'square',at:t,dur:.17,gain:.03,attack:.01,release:.05,cut0:2200,cut1:2400,cut2:2000,detune:3,send:.12}))),
 camioneta:a=>[300,380].forEach(f=>a.synth({f,type:'square',dur:.42,gain:.03,attack:.02,release:.1,cut0:1600,cut1:1900,cut2:1500,detune:4,send:.15})),
 elefante:a=>a.synth({f:330,path:[[640,.12],[520,.5]],dur:.55,gain:.05,attack:.05,release:.2,cut0:900,cut1:2600,cut2:1400,q:4,vib:9,depth:.03,send:.25}),
 trex:a=>{a.noise({dur:1.15,gain:.25,type:'lowpass',f:520,f2:170,q:4,attack:.15,send:.35});a.synth({f:90,path:[[145,.3],[58,1.1]],dur:1.15,gain:.07,attack:.12,release:.5,cut0:300,cut1:950,cut2:250,q:6,vib:18,depth:.08,send:.35});},
 autobus:a=>{[350,440].forEach(f=>a.synth({f,dur:.4,gain:.03,attack:.02,release:.1,cut0:1400,cut1:1800,cut2:1200,send:.15}));a.noise({at:.55,dur:.5,gain:.08,type:'highpass',f:3000,attack:.01,send:.2});},
 camion:a=>[185,233].forEach(f=>a.synth({f,dur:.95,gain:.05,attack:.03,release:.25,cut0:900,cut1:1300,cut2:900,send:.3})),
 avion:a=>{a.noise({dur:2.1,gain:.12,f:500,f2:3200,q:.8,attack:.7,send:.4});a.tone({f:58,f2:92,dur:2.1,gain:.12,attack:.6,send:.2});a.tone({f:1800,f2:3300,dur:2.1,gain:.012,attack:.8,send:.2});},
 ballena:a=>{a.synth({f:300,type:'sine',path:[[620,.6],[420,1.1],[260,1.9]],dur:2,gain:.08,attack:.3,release:.8,cut0:2400,cut1:2400,cut2:2400,vib:5,depth:.02,send:.8,detune:4});a.noise({at:1.25,dur:.45,gain:.05,type:'highpass',f:2000,attack:.05,send:.3});}
};
const UX_SND={
 tab:a=>a.tone({f:880,type:'triangle',dur:.05,gain:.03,send:.03}),
 tick:(a,d=1)=>{a.tone({f:d>0?2150:1680,dur:.04,gain:.07,send:.05});a.noise({dur:.014,gain:.028,type:'highpass',f:5200,send:0});},
 toggle:(a,on)=>{a.tone({f:on?660:880,dur:.06,gain:.05,send:.05});a.tone({f:on?990:600,at:.06,dur:.08,gain:.05,send:.08});},
 pop:a=>a.tone({f:520,f2:1250,dur:.1,gain:.09,send:.12,attack:.003}),
 back:a=>a.tone({f:900,f2:420,dur:.15,gain:.045,send:.05}),
 whoosh:a=>a.noise({dur:.36,gain:.07,f:380,f2:2600,q:1.3,send:.25}),
 clink:(a,p=1)=>{const b=560*p;[[1,.13,.55],[2.76,.07,.4],[5.4,.04,.24],[8.93,.025,.15]].forEach(([m,g,d])=>a.tone({f:b*m,dur:d,gain:g,send:.3,attack:.002}));a.noise({dur:.03,gain:.08,f:3200,q:.8,send:.1});},
 success:a=>{a.tone({f:170,f2:52,dur:.26,gain:.45,send:.08,attack:.002});a.noise({dur:.07,gain:.2,type:'lowpass',f:900,send:.05});UX_SND.clink(a,1.25);a.bell(1318.5,.09,.09);a.bell(1975.5,.2,.08);},
 countdown:a=>a.bell(880,0,.09,.35,.2),
 restDone:a=>[1046.5,1318.5,1568].forEach((f,i)=>a.bell(f,i*.09,.1,1.6,.45)),
 start:a=>{a.noise({dur:.5,gain:.07,f:400,f2:3800,q:1.2,attack:.4,send:.3});[587.33,739.99,880].forEach((f,i)=>a.bell(f,.45+i*.06,.07,1.3,.45));a.tone({f:120,f2:55,at:.45,dur:.4,gain:.25,send:.1});},
 kalimba:(a,i=0)=>{const f=[293.66,369.99,440,554.37,587.33,739.99][i%6];a.tone({f,dur:1.5,gain:.09,attack:.003,send:.45});a.tone({f:f*2,dur:.5,gain:.022,attack:.003,send:.4});},
 warmDone:a=>[[293.66,0],[369.99,.11],[440,.22],[587.33,.36]].forEach(([f,t])=>{a.tone({f,at:t,dur:1.6,gain:.075,attack:.003,send:.5});a.tone({f:f*2,at:t,dur:.45,gain:.018,attack:.003,send:.4});}),
 wood:a=>{a.tone({f:820,f2:690,dur:.08,gain:.07,attack:.002,send:.15});a.noise({dur:.02,gain:.02,f:1500,q:2,send:0});},
 bowl:a=>{[[1,.075,4.2],[2.76,.028,2.6],[5.4,.011,1.4]].forEach(([m,g,d])=>{a.tone({f:392*m,dur:d,gain:g,attack:.012,send:.6});a.tone({f:392*m*1.004,dur:d,gain:g*.7,attack:.012,send:.6});});},
 ignite:a=>{UX_SND.bowl(a);a.noise({dur:.75,gain:.08,f:400,f2:4200,q:1.2,attack:.65,send:.3});a.tone({f:110,f2:45,at:.75,dur:.6,gain:.4,send:.1});[587.33,739.99,880,1174.66].forEach((f,i)=>a.bell(f,.75+i*.05,.06,1.4,.45));},
 pluck:(a,i=0)=>{const f=[1046.5,1174.66,1318.5,1568,1760,2093][i%6];a.tone({f,type:'triangle',dur:.45,gain:.055,send:.35});a.bell(f*2,0,.018,.5,.4);},
 ding:(a,i=0)=>a.bell([1318.5,1568,2093,2637][i%4],0,.085,1.3,.45),
 victory:a=>{const T=1.1;
  a.noise({dur:T,gain:.11,f:300,f2:6000,q:1.6,attack:T*.95,send:.3});
  a.synth({f:110,path:[[440,T]],dur:T,gain:.045,attack:T*.9,release:.03,cut0:300,cut1:1800,cut2:3200,send:.3});
  a.tone({f:95,f2:36,at:T,dur:1.5,gain:.65,attack:.004,send:.15});a.noise({at:T,dur:.5,gain:.33,type:'lowpass',f:420,f2:80,send:.1});a.noise({at:T,dur:2.6,gain:.065,type:'highpass',f:6000,attack:.005,send:.6});
  [261.63,329.63,392,523.25].forEach(f=>a.synth({f,at:T,dur:.9,gain:.05,attack:.02,release:.5,cut0:600,cut1:3600,cut2:900,send:.35}));
  [1046.5,1318.5,1568,2093].forEach((f,i)=>a.bell(f,T+i*.04,.06,2.2,.55));
  const M=T+.55;[0,.13,.26].forEach(d=>a.synth({f:392,at:M+d,dur:.12,gain:.065,attack:.012,release:.06,cut0:700,cut1:3800,cut2:1500,send:.3}));
  [[523.25,.065],[659.25,.045],[783.99,.045]].forEach(([f,g])=>a.synth({f,at:M+.4,dur:1.8,gain:g,attack:.03,release:1.1,cut0:700,cut1:4200,cut2:1200,send:.45,vib:5.5}));
  a.bell(2093,M+.4,.05,2.4,.6);
  [130.81,196,261.63,329.63].forEach(f=>a.synth({f,at:T+.1,dur:3.4,gain:.022,attack:.6,release:2.2,cut0:300,cut1:1600,cut2:600,send:.7,detune:12}));
  const pent=[2093,2349.3,2637,3136,3520,4186];for(let i=0;i<14;i++)a.bell(pent[Math.floor(Math.random()*6)],T+.2+Math.random()*2.3,.02,.7,.7);},
 resolve:a=>{[523.25,659.25,783.99,1046.5].forEach((f,i)=>a.bell(f,i*.08,.06,2.4,.6));[261.63,392].forEach(f=>a.synth({f,dur:2.4,gain:.022,attack:.4,release:1.6,cut0:300,cut1:1200,cut2:500,send:.7,detune:10}));},
 levelUp:a=>{a.noise({dur:.45,gain:.05,f:500,f2:4200,q:1.1,attack:.35,send:.3});[523.25,659.25,783.99,1046.5].forEach((f,i)=>a.bell(f,.2+i*.07,.075,1.5,.5));[2093,2637,3136].forEach((f,i)=>a.bell(f,.55+i*.09,.022,.7,.6));},
 levelDown:a=>[[659.25,0],[523.25,.16]].forEach(([f,t])=>a.bell(f,t,.06,1.1,.45)),
 topRange:a=>{a.bell(1568,0,.08,1,.45);a.bell(2093,.11,.07,1.2,.5);},
 shutter:a=>{a.noise({dur:.04,gain:.2,type:'highpass',f:2200,send:.05});a.noise({at:.07,dur:.06,gain:.15,type:'highpass',f:1600,send:.05});},
 object:(a,k)=>UX_OBJ_SOUND[k]?.(a)
};
function uxSound(name,arg){
 const fn=UX_SND[name];if(!fn)return false;
 const now=Date.now(),key=name+(arg??'');if(now-(UXA.last[key]||0)<45)return false;
 const a=uxAudio();if(!a)return false;UXA.last[key]=now;
 try{fn(a,arg);return true;}catch{return false;}
}
/* tickWarmup avisa con los mismos tipos de beep; aquí solo cambia el timbre: el calentamiento suena más tranquilo */
function uxWarmBeep(kind){uxCueScope='warm';try{return beep(kind);}finally{uxCueScope='';}}
function uxWarmCue(){return uxCueScope==='warm';}

/* ---------- números que ruedan ---------- */
class UxRoller{
 constructor(el){this.el=el;this.slots=[];this.str=null;const t=el.textContent;el.textContent='';el.classList.add('ux-roll');this.set(t,1,true);}
 mk(ch){const el=document.createElement('span'),cur=document.createElement('span');el.className='ux-slot';cur.className='ux-ch';cur.textContent=ch;el.append(cur);return{el,ch,cur};}
 set(str,dir=1,instant=false){
  str=String(str);if(str===this.str)return;this.str=str;const quiet=instant||!uxMotion(),n=str.length,m=this.slots.length,next=[];
  for(let i=0;i<Math.max(n,m);i++){
   const ni=n-1-i,oi=m-1-i,ch=ni>=0?str[ni]:null,slot=oi>=0?this.slots[oi]:null,delay=i*24;
   if(ch!=null&&slot){next[ni]=slot;if(slot.ch!==ch)this.swap(slot,ch,dir,delay,quiet);}
   else if(ch!=null){const s=this.mk(ch);next[ni]=s;this.el.insertBefore(s.el,next[ni+1]?next[ni+1].el:null);if(!quiet)uxAnim(s.cur,[{transform:`translateY(${dir*70}%)`,opacity:0,filter:'blur(5px)'},{transform:'none',opacity:1,filter:'blur(0)'}],{spring:'soft',delay});}
   else if(slot)slot.el.remove();
  }
  this.slots=next;
 }
 swap(slot,ch,dir,delay,quiet){
  slot.ch=ch;if(quiet){slot.cur.textContent=ch;return;}
  const old=slot.cur,nw=document.createElement('span');nw.className='ux-ch';nw.textContent=ch;old.classList.add('out');slot.el.append(nw);slot.cur=nw;
  const out=uxAnim(old,[{transform:'none',opacity:1,filter:'blur(0)'},{transform:`translateY(${-dir*80}%)`,opacity:0,filter:'blur(4px)'}],{duration:260,delay,fill:'forwards',easing:'cubic-bezier(.4,0,.2,1)'});
  if(out)out.finished.then(()=>old.remove(),()=>old.remove());else old.remove();
  uxAnim(nw,[{transform:`translateY(${dir*80}%)`,opacity:0,filter:'blur(4px)'},{transform:'none',opacity:1,filter:'blur(0)'}],{spring:'soft',delay});
 }
}
/* reloj que rueda: sin animaciones, el texto se escribe tal cual */
function uxText(el,text,dir=-1){
 if(!el)return;
 if(!uxMotion()||!el.isConnected){if(el.__uxRoll){el.__uxRoll=null;el.classList?.remove('ux-roll');}el.textContent=text;return;}
 if(!el.__uxRoll)el.__uxRoll=new UxRoller(el);
 el.__uxRoll.set(text,dir);
}
/* un número que cuenta hasta su valor; al final queda exactamente el texto original */
function uxCountUp(el,{duration=750,delay=0,onStep}={}){
 const node=[...(el?.childNodes||[])].find(n=>n.nodeType===3&&/\d/.test(n.nodeValue));if(!node||!uxMotion())return;
 const text=node.nodeValue,m=text.match(/\d[\d\s  .]*(?:,\d+)?/);if(!m)return;
 const raw=m[0],sep=(raw.match(/\d([\s  .])\d{3}/)||[])[1]||'',dec=(raw.split(',')[1]||'').length;
 const target=Number(raw.replace(/[\s  .]/g,'').replace(',','.'));if(!(target>0))return;
 const format=v=>{let [i,d]=v.toFixed(dec).split('.');if(sep)i=i.replace(/\B(?=(\d{3})+(?!\d))/g,sep);return text.replace(raw,d?i+','+d:i);};
 node.nodeValue=format(0);const t0=performance.now()+delay;let last='';
 const tick=now=>{if(!node.isConnected&&!el.isConnected)return;const k=Math.max(0,Math.min(1,(now-t0)/duration)),v=target*(1-Math.pow(1-k,3)),s=k>=1?text:format(v);if(s!==last){node.nodeValue=s;last=s;onStep?.(k);}if(k<1)requestAnimationFrame(tick);};
 requestAnimationFrame(tick);
}

/* ---------- entrada de cada vista ---------- */
const UX_TABS=['home','history','settings'];
function uxEnterView(main){
 if(!main||!uxMotion())return false;
 const tab=view.name==='history'||view.from==='history'?'history':['settings','gym'].includes(view.name)?'settings':view.name==='home'?'home':null;
 const prev=window.__uxTab;window.__uxTab=tab;
 const dx=tab&&prev&&tab!==prev?(UX_TABS.indexOf(tab)>UX_TABS.indexOf(prev)?22:-22):0;
 const items=[];
 for(const child of main.children){
  if(items.length>=14)break;
  const cs=getComputedStyle(child),inner=child.children.length>1&&/grid|flex/.test(cs.display)&&child.offsetHeight>240;
  for(const el of inner?child.children:[child]){if(el.getBoundingClientRect().top<innerHeight)items.push(el);}
 }
 items.slice(0,14).forEach((el,i)=>uxAnim(el,[{opacity:0,transform:`translate(${dx}px,16px) scale(.985)`},{opacity:1,transform:'none'}],{spring:'soft',delay:i*38}));
 main.querySelectorAll('.n-week-day.done b').forEach((b,i)=>uxAnim(b,[{transform:'scale(.4)',opacity:0},{transform:'none',opacity:1}],{spring:'bouncy',delay:260+i*70}));
 main.querySelectorAll('.n-volume-chart i').forEach((bar,i)=>uxAnim(bar,[{transform:'scaleY(0)'},{transform:'none'}],{spring:'soft',delay:120+i*45}));
 main.querySelectorAll('.n-lift-row svg path').forEach((path,i)=>{
  if(path.getAttribute('fill')&&path.getAttribute('fill')!=='none'){uxAnim(path,[{opacity:0},{opacity:1}],{duration:600,delay:500+i*60});return;}
  path.setAttribute('pathLength','1');path.style.strokeDasharray='1';const a=uxAnim(path,[{strokeDashoffset:1},{strokeDashoffset:0}],{duration:900,delay:200+i*60,easing:'cubic-bezier(.3,.7,.2,1)'});
  const clear=()=>{path.removeAttribute('pathLength');path.style.strokeDasharray='';};if(a)a.finished.then(clear,clear);else clear();
 });
 main.querySelectorAll('.n-week-stat strong,.n-week-value strong,.n-lifetime b,.n-lift-row strong,.n-day-tile-count b').forEach((el,i)=>uxCountUp(el,{delay:120+i*40}));
 uxForecastReveal(main);
 return true;
}
/* la píldora de la barra de navegación viaja de una pestaña a otra */
function uxTabs(){
 const links=document.querySelector?.('#tabs .n-nav-links'),on=links?.querySelector('button.on');if(!links||!on)return;
 const buttons=[...links.querySelectorAll('button')],idx=buttons.indexOf(on),prev=window.__uxTabIdx;window.__uxTabIdx=idx;
 if(prev===undefined||prev===idx||!uxMotion()||!buttons[prev])return;
 const box=links.getBoundingClientRect(),a=buttons[prev].getBoundingClientRect(),b=on.getBoundingClientRect(),cs=getComputedStyle(on);
 const pill=document.createElement('i');pill.className='ux-pill';pill.style.cssText=`left:${b.left-box.left}px;top:${b.top-box.top}px;width:${b.width}px;height:${b.height}px;border-radius:${cs.borderRadius};background:${cs.backgroundColor}`;
 links.classList.add('ux-moving');links.prepend(pill);
 const move=uxAnim(pill,[{transform:`translateX(${a.left-b.left}px)`,width:a.width+'px'},{transform:'none',width:b.width+'px'}],{spring:'snappy'});
 const done=()=>{pill.remove();links.classList.remove('ux-moving');};if(move)move.finished.then(done,done);else done();
 uxAnim(on.querySelector('svg'),[{transform:'none'},{transform:'translateY(-4px) scale(1.14)',offset:.4},{transform:'none'}],{duration:520,easing:'cubic-bezier(.3,.7,.2,1)'});
}
function uxAfterRender(){uxTabs();}

/* ---------- lo que viene: cada propuesta se revela al verla ---------- */
let uxRevealNext=0;
function uxSparks(el){
 if(!el||!uxMotion())return;el.style.position='relative';
 for(let i=0;i<9;i++){const s=document.createElement('i'),a=i/9*Math.PI*2,d=26+Math.random()*14;s.className='ux-spark';el.append(s);
  const anim=uxAnim(s,[{transform:'translate(-50%,-50%) scale(.4)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(1)`,opacity:0}],{duration:700,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
  if(anim)anim.finished.then(()=>s.remove(),()=>s.remove());else s.remove();}
}
function uxRevealCard(card){
 const now=Date.now(),start=Math.max(0,uxRevealNext-now);uxRevealNext=now+start+650;
 const state=card.querySelector('.n-forecast-state'),up=card.classList.contains('is-ready'),down=!!state&&/state-(ease|back)/.test(state.className);
 card.querySelectorAll('.n-range-track i').forEach((bar,i)=>uxAnim(bar,[{transform:'scaleX(0)'},{transform:'none'}],{duration:650,delay:start+i*110,easing:'cubic-bezier(.3,.7,.2,1)'}));
 card.querySelectorAll('.n-range-set.is-full b svg').forEach((check,i)=>uxAnim(check,[{transform:'scale(0)',opacity:0},{transform:'none',opacity:1}],{spring:'bouncy',delay:start+300+i*110}));
 const strong=card.querySelector('.n-forecast-target strong'),delta=card.querySelector('.n-forecast-delta');
 if(!strong||(!up&&!down))return;
 const m=(delta?.textContent||'').match(/([+−-])\s*([\d.,]+)/),to=strong.textContent.trim();
 if(m&&/^[\d.,]+$/.test(to)){
  const n=v=>Number(v.replace(/\./g,'').replace(',','.')),dec=(to.split(',')[1]||'').length,sign=m[1]==='+'?1:-1;
  let from=(n(to)-sign*n(m[2])).toFixed(Math.max(dec,(m[2].split(',')[1]||'').length)).replace('.',',');
  if(from.includes(',')&&!to.includes(','))from=from.replace(/,0+$/,'');
  const roll=new UxRoller(strong);roll.set(from,1,true);
  setTimeout(()=>{if(!strong.isConnected)return;roll.set(to,sign);uxSound(up?'levelUp':'levelDown');if(up)uxHaptic([10,30,18]);},start+700);
 }else setTimeout(()=>{if(card.isConnected)uxSound(up?'levelUp':'levelDown');},start+700);
 uxAnim(delta,[{transform:'scale(.3)',opacity:0},{transform:'none',opacity:1}],{spring:'bouncy',delay:start+850});
 if(up){setTimeout(()=>{if(delta?.isConnected)uxSparks(delta);},start+900);state?.classList.add('ux-lit');}
}
function uxForecastReveal(main){
 const cards=[...main.querySelectorAll('.n-forecast')];if(!cards.length||typeof IntersectionObserver!=='function')return;
 uxRevealNext=Date.now()+450;
 const io=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){io.unobserve(e.target);uxRevealCard(e.target);}},{threshold:.45});
 cards.forEach(c=>io.observe(c));
}

/* ---------- sesión ---------- */
function uxBump(el,dir=1){uxAnim(el,[{transform:'none'},{transform:`translateY(${dir>0?-3:3}px) scale(1.04)`,offset:.35},{transform:'none'}],{duration:320,easing:'cubic-bezier(.3,.7,.2,1)'});}
function uxSetLogged(xi,si){
 uxSound('success');uxHaptic([14,40,26]);
 const rest=document.getElementById('rest')||document.querySelector?.('.n-rest-phase');
 uxAnim(rest,[{transform:'scale(.92)',opacity:0},{transform:'none',opacity:1}],{spring:'bouncy'});
 /* llegar al tope del rango es la antesala de subir: se nota en el momento */
 const ex=db.active?.exercises?.[xi],st=ex?.sets?.[si];if(!ex||!st||exMeta(ex.key).type==='asistido')return;
 const hi=effRange(ex.key).hi,r=Number(st.r);if(!(r>=hi))return;
 const done=ex.sets.filter(s=>s.done),all=done.length===ex.sets.length&&done.every(s=>Number(s.r)>=hi);
 const unit=exMeta(ex.key).type==='tiempo'?'s':'reps',status=document.querySelector?.('.n-rest-status');
 if(status&&!document.querySelector('.ux-top-chip')){status.insertAdjacentHTML('afterend',`<div class="ux-top-row"><span class="ux-top-chip" role="status">${uiIcon('spark')}<span>${all?'Todas tus series en el tope del rango':`Tope del rango: ${r} ${unit}`}</span></span></div>`);uxAnim(document.querySelector('.ux-top-chip'),[{transform:'scale(.6)',opacity:0},{transform:'none',opacity:1}],{spring:'bouncy',delay:260});}
 setTimeout(()=>uxSound(all?'levelUp':'topRange'),all?380:300);
}
function uxRestDone(){
 const rest=document.getElementById('rest');
 uxAnim(rest,[{transform:'scale(1)'},{transform:'scale(1.05)',offset:.35},{transform:'none'}],{spring:'bouncy',duration:700});
}
function uxLoadChanged(el,before){
 if(!before)return;const now=el?.querySelector?.('.ui-load-number')?.textContent||'';if(now===before)return;
 uxAnim(el.querySelector('.ui-load-number'),[{opacity:0,transform:'translateY(8px)',filter:'blur(4px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{spring:'soft'});
 uxSound('clink',now.length>before.length?.95:1.3);
}

/* ---------- el póster final ---------- */
const UX_OBJ_ART=(()=>{
 const C='#fffefa',D='#d7dccf',K='rgba(29,51,41,.6)',L='#d8ef96',wheel=(x,y,r=6.5)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#1d3329" stroke="${C}" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="2.2" fill="${L}"/>`;
 return {
  nevera:`<rect x="24" y="3" width="22" height="41" rx="3" fill="${C}"/><path d="M24 17h22" stroke="#9aa39a" stroke-width="1.5"/><rect x="41" y="7" width="2" height="7" rx="1" fill="#1d3329"/><rect x="41" y="21" width="2" height="10" rx="1" fill="#1d3329"/><circle cx="30" cy="10" r="1.8" fill="${L}"/>`,
  moto:`<circle cx="14" cy="34" r="9" fill="none" stroke="${C}" stroke-width="4"/><circle cx="56" cy="34" r="9" fill="none" stroke="${C}" stroke-width="4"/><path d="M14 34 L27 21 H43 L56 34" fill="none" stroke="${C}" stroke-width="3.5" stroke-linejoin="round"/><path d="M26 21 C29 13 42 13 45 21Z" fill="${L}"/><rect x="16" y="16" width="13" height="4" rx="2" fill="${C}"/><path d="M46 22 L50 11 H56" fill="none" stroke="${C}" stroke-width="3" stroke-linecap="round"/>`,
  caballo:`<ellipse cx="31" cy="22" rx="17" ry="8.5" fill="${C}"/><path d="M42 20 L51 6 L58 8 L51 25Z" fill="${C}"/><path d="M51 4 L64 9 L63 14 L54 13Z" fill="${C}"/><path d="M49 8 L43 19" stroke="${D}" stroke-width="3" stroke-linecap="round"/><g fill="${C}"><rect x="17" y="27" width="3.6" height="18" rx="1.5"/><rect x="23" y="27" width="3.6" height="18" rx="1.5"/><rect x="38" y="27" width="3.6" height="18" rx="1.5"/><rect x="44" y="26" width="3.6" height="19" rx="1.5"/></g><path d="M15 19 C8 21 7 31 9 37" fill="none" stroke="${D}" stroke-width="4" stroke-linecap="round"/>`,
  coche:`<path d="M5 34 V26 C5 23 7 22 10 21 L20 19 L28 11 C30 9 32 8 35 8 H48 C51 8 53 9 55 11 L61 19 C64 20 66 22 66 26 V34 Z" fill="${C}"/><path d="M30 18 L35 11 H44 V18Z" fill="${K}"/><path d="M47 11 H50 C52 11 53 12 54 13 L57 18 H47Z" fill="${K}"/><rect x="62" y="24" width="4" height="3" rx="1" fill="${L}"/>${wheel(18,34)}${wheel(54,34)}`,
  camioneta:`<rect x="3" y="19" width="29" height="14" rx="2" fill="${D}"/><path d="M30 33 V11 C30 9 31 8 33 8 H46 C48 8 49 9 50 10 L56 19 H63 C65 19 67 21 67 23 V33 Z" fill="${C}"/><path d="M34 11 H45 L50 18 H34Z" fill="${K}"/>${wheel(15,34)}${wheel(55,34)}`,
  elefante:`<g fill="${C}"><ellipse cx="28" cy="21" rx="19" ry="14"/><circle cx="49" cy="16" r="10.5"/><rect x="13" y="26" width="7" height="17" rx="2.5"/><rect x="22" y="28" width="7" height="15" rx="2.5"/><rect x="33" y="28" width="7" height="15" rx="2.5"/><rect x="41" y="26" width="7" height="17" rx="2.5"/></g><path d="M57 18C62 24 62 33 58 39c-1 2 2 3 3 1" fill="none" stroke="${C}" stroke-width="5.5" stroke-linecap="round"/><path d="M45 9c-7 0-9 14-1 18 5-2 6-15 1-18z" fill="${D}"/><circle cx="52" cy="13.5" r="1.4" fill="#1d3329"/><path d="M54 22c3 2 6 2 8 0" fill="none" stroke="${L}" stroke-width="2" stroke-linecap="round"/>`,
  trex:`<path d="M3 27 C13 25 21 19 31 18 C37 17 43 17 47 19 C49 25 46 31 40 33 C34 35 27 33 21 32 C15 31 9 30 3 27Z" fill="${C}"/><path d="M43 4 H60 C63 4 66 6 66 9 V12 C66 14 64 15 62 15 H53 L50 20 H43 Z" fill="${C}"/><path d="M29 31 L27 45 H34 L35 32Z" fill="${C}"/><path d="M38 32 L40 45 H47 L44 31Z" fill="${D}"/><circle cx="56" cy="8.5" r="1.4" fill="#1d3329"/><path d="M20 20 l3-4 l2 3 l3-4 l2 3 l3-4 l2 3" fill="${L}"/>`,
  autobus:`<rect x="3" y="7" width="64" height="27" rx="4" fill="${C}"/><g fill="${K}"><rect x="7" y="11" width="8" height="9" rx="1.5"/><rect x="17" y="11" width="8" height="9" rx="1.5"/><rect x="27" y="11" width="8" height="9" rx="1.5"/><rect x="37" y="11" width="8" height="9" rx="1.5"/><rect x="47" y="11" width="8" height="9" rx="1.5"/><path d="M58 11 H63 C64 11 64 12 64 13 V22 H58Z"/></g><rect x="3" y="25" width="64" height="3" fill="${L}"/>${wheel(15,35,6)}${wheel(55,35,6)}`,
  camion:`<rect x="2" y="5" width="47" height="27" rx="2" fill="${C}"/><rect x="2" y="24" width="47" height="3" fill="${L}"/><path d="M51 33 V15 C51 13 52 12 54 12 H60 L67 22 V33 Z" fill="${D}"/>${wheel(10,35,5)}${wheel(21,35,5)}${wheel(41,35,5)}${wheel(60,35,5)}`,
  avion:`<path d="M5 8 L10 8 L20 21 H12Z" fill="${D}"/><path d="M3 25 C3 22 7 20 13 20 H56 C62 20 67 23 68 26 C67 29 62 31 56 31 H12 C6 31 3 28 3 25Z" fill="${C}"/><path d="M27 27 L42 27 L30 43 H24Z" fill="${D}"/><g fill="${K}"><circle cx="18" cy="24" r="1.1"/><circle cx="23" cy="24" r="1.1"/><circle cx="28" cy="24" r="1.1"/><circle cx="33" cy="24" r="1.1"/><circle cx="38" cy="24" r="1.1"/><circle cx="43" cy="24" r="1.1"/><circle cx="48" cy="24" r="1.1"/></g><path d="M8 28 H60" stroke="${L}" stroke-width="1.6"/>`,
  ballena:`<path d="M5 28 C5 18 17 12 33 12 C47 12 57 18 59 26 C60 30 57 34 49 35 C39 37 19 37 11 34 C7 33 5 31 5 28Z" fill="${C}"/><path d="M57 27 C61 22 63 18 68 15 C67 20 67 23 69 26 C66 27 63 28 60 31Z" fill="${C}"/><circle cx="14" cy="25" r="1.4" fill="#1d3329"/><path d="M22 11 C20 6 17 5 14 5 M22 11 C24 6 27 5 30 5 M22 11 V3" fill="none" stroke="${L}" stroke-width="2" stroke-linecap="round"/>`
 };
})();
const UX_OBJ_WORDS=[['camioneta',/camioneta/i],['nevera',/nevera/i],['moto',/\bmoto/i],['caballo',/caballo/i],['coche',/coche/i],['elefante',/elefante/i],['trex',/T-Rex/i],['autobus',/autob[uú]s/i],['camion',/cami[oó]n/i],['avion',/avi[oó]n/i],['ballena',/ballena/i]];
function uxLikeKey(text){return (UX_OBJ_WORDS.find(([,re])=>re.test(text))||[])[0]||null;}
function uxLikeArt(key,extra=''){return UX_OBJ_ART[key]&&UX_OBJ_SOUND[key]?`<svg class="ux-like-ic${extra}" viewBox="0 0 70 48" aria-hidden="true">${UX_OBJ_ART[key]}</svg>`:'';}
let uxPosterTimers=[];
function uxConfetti(bursts){
 if(!uxMotion()||!document.body)return;
 const cv=document.createElement('canvas');cv.className='ux-confetti';cv.setAttribute('aria-hidden','true');document.body.append(cv);
 const dpr=Math.min(2,window.devicePixelRatio||1),W=innerWidth,H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;
 const ctx=cv.getContext('2d');if(!ctx){cv.remove();return;}ctx.scale(dpr,dpr);
 const col=['#d8ef96','#fffefa','#86bb86','#e3b75a','#b9e27d'],parts=[];
 for(const [x,y,n,spread,power,angle] of bursts)for(let i=0;i<n;i++){const a=(angle??-Math.PI/2)+(Math.random()-.5)*spread,v=power*(.55+Math.random()*.6);parts.push({x:x*W,y:y*H,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:Math.random()*6,vr:(Math.random()-.5)*.3,w:5+Math.random()*6,h:8+Math.random()*8,c:col[i%5],round:Math.random()<.3,life:1,flip:Math.random()*6});}
 const loop=()=>{ctx.clearRect(0,0,W,H);let alive=0;
  for(const p of parts){if(p.life<=0||p.y>H+30)continue;alive++;p.vy+=.26;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.flip+=.2;if(p.y>H*.8)p.life-=.02;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,p.life));ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;if(p.round){ctx.beginPath();ctx.arc(0,0,p.w/2,0,Math.PI*2);ctx.fill();}else{ctx.scale(1,Math.cos(p.flip));ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);}ctx.restore();}
  if(alive)requestAnimationFrame(loop);else cv.remove();};
 requestAnimationFrame(loop);
}
function uxCelebrate(rec,prs){
 uxPosterTimers.forEach(clearTimeout);uxPosterTimers=[];
 const poster=document.querySelector?.('#modalhost .fin-poster');if(!poster)return;
 /* la comparación vive en la frase del póster o, con récords, en su primera estadística */
 const lead=poster.querySelector('.fin-poster-like'),like=lead&&uxLikeKey(lead.textContent)?lead:[...poster.querySelectorAll('.fin-poster-stats>div')].find(d=>uxLikeKey(d.textContent)),likeKey=like?uxLikeKey(like.textContent):null;
 if(like&&likeKey&&!like.querySelector('.ux-like-ic'))like.insertAdjacentHTML(like===lead?'afterbegin':'beforeend',uxLikeArt(likeKey,like===lead?'':' sm'));
 const calm=!!rec?.deload,big=!calm&&prs?.length>0;
 uxSound(calm?'bowl':big?'victory':'resolve');
 if(!uxMotion())return;
 const at=(ms,fn)=>uxPosterTimers.push(setTimeout(()=>{if(poster.isConnected)fn();},ms));
 const impact=big?1400:650,num=poster.querySelector('.fin-poster-n b');
 if(num){const small=/^\d{1,2}$/.test(num.textContent.trim());
  if(big&&small){const n=+num.textContent.trim();num.textContent='0';for(let i=1;i<=n;i++)at(impact-(n-i)*260,()=>{num.textContent=String(i);uxAnim(num,[{transform:'translateY(40%)',opacity:0},{transform:'none',opacity:1}],{spring:'snappy'});if(i<n)uxSound('tick',1);});}
  else uxCountUp(num,{duration:impact,delay:0});}
 uxAnim(poster.querySelector('.fin-poster-head'),[{opacity:0},{opacity:1}],{duration:500,delay:200});
 at(impact,()=>{
  uxAnim(num,[{transform:'scale(1)'},{transform:'scale(1.25)',offset:.25},{transform:'none'}],{spring:'bouncy',duration:900});
  uxAnim(poster,[{boxShadow:'0 0 0 0 rgba(216,239,150,.0)'},{boxShadow:'0 0 60px 6px rgba(216,239,150,.55)',offset:.2},{boxShadow:'0 0 0 0 rgba(216,239,150,0)'}],{duration:1400,easing:'ease-out'});
  if(!calm)uxConfetti(big?[[.05,1,80,1,19,-Math.PI/2+.35],[.95,1,80,1,19,-Math.PI/2-.35],[.5,.35,50,6.2,9]]:[[.5,.4,45,6.2,7]]);
  uxHaptic(big?[45,35,70,35,140]:[30]);
 });
 poster.querySelectorAll('.fin-poster-bodies .lit').forEach((p,i)=>uxAnim(p,[{opacity:.15},{opacity:1}],{duration:500,delay:impact+250+i*60}));
 poster.querySelectorAll('.fin-poster-row').forEach((row,i)=>{uxAnim(row,[{opacity:0,transform:'translateX(-18px)'},{opacity:1,transform:'none'}],{spring:'soft',delay:impact+450+i*200});if(big)at(impact+450+i*200,()=>uxSound('ding',i));});
 if(like){if(like===lead)uxAnim(like,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{spring:'soft',delay:impact+300});const ic=like.querySelector('.ux-like-ic');if(ic&&likeKey){uxAnim(ic,[{transform:'scale(.2) rotate(-18deg)',opacity:0},{transform:'none',opacity:1}],{spring:'bouncy',delay:impact+(big?1500:700)});at(impact+(big?1500:700),()=>uxSound('object',likeKey));}}
 uxAnim(poster.querySelector('.fin-poster-stats'),[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{spring:'soft',delay:impact+350});
}

/* ---------- toques en toda la app ---------- */
if(typeof document!=='undefined'&&document.addEventListener){
 document.addEventListener('pointerdown',()=>{try{if(db.settings.sound!=='off')unlockAudio();}catch{}},true);
 document.addEventListener('click',ev=>{
  const t=ev.target?.closest?.('.tog[role=switch],.n-goals button,.n-rir-grid button,.n-theme-options button');if(!t)return;
  if(t.matches('.tog'))setTimeout(()=>uxSound('toggle',t.getAttribute('aria-checked')==='true'||t.classList.contains('on')),0);
  else uxSound('tick',1);
 });
}
