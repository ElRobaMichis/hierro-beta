/* Hierro browser adapter. Training always commits locally before any network I/O. */
const HIERRO_SYNC_URL = 'https://hierro-beta-sync.agustinmedrano01.workers.dev';
let hierroSync=null,syncDevice='',syncForeign=null,syncApplying=false,syncTimer=null,syncReady=false,syncTabOwner=true,syncTabRelease=null;
let syncInspectionToken=0;
let syncInspection=null,syncLinkMode='merge',syncChoices={},syncSavedRaw=null,syncStorageIssue=null;
let syncConnecting=false,syncRetryAt=0;

function syncStore(){
  let connection;
  const open=()=>connection||(connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open(LS_KEY+'.sync',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('private');
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>reject(new Error('No se puede abrir el almacenamiento privado de sincronización.'));
    request.onblocked=()=>reject(new Error('Cierra otras pestañas de Hierro y vuelve a intentarlo.'));
  }));
  return {
    async get(){const d=await open();return new Promise((resolve,reject)=>{const r=d.transaction('private').objectStore('private').get('account');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});},
    async set(value){const d=await open();return new Promise((resolve,reject)=>{const tx=d.transaction('private','readwrite');if(value===null)tx.objectStore('private').delete('account');else tx.objectStore('private').put(value,'account');tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(new Error('No hay espacio para guardar la copia de seguridad de sincronización. Descarga un respaldo y libera espacio.'));});}
  };
}
function syncRead(){const raw=localStorage.getItem(LS_KEY);return HierroSyncCore.project(raw?JSON.parse(raw):db,syncDevice,syncForeign);}
function syncBusy(next,current){
  if(db.active?.localOnly)return true;
  if(!syncTabOwner)return true;
  if(document.getElementById('modalhost')?.children.length)return true;
  const el=document.activeElement;
  if(el&&el.matches('input,textarea,select,[contenteditable=true]'))return true;
  // Receiving training/equipment changes during a workout could change the
  // meaning of a typed weight. Keep the base unchanged and receive after it ends.
  if(db.active){
    const a={...next,active:null},b={...current,active:null};
    if(!HierroSyncCore.equal(a,b))return true;
  }
  return false;
}
function syncApply(doc){
  const C=HierroSyncCore;C.validate(doc);
  const before=db,foreign=syncForeign;
  const next=C.clone(doc);delete next.schema;
  for(const k of C.LOCAL_SETTINGS)if(db.settings[k]!==undefined)next.settings[k]=db.settings[k];
  const owns=doc.active?.owner===syncDevice;
  if(owns&&doc.active.gymId)next.settings.gymId=doc.active.gymId;
  if(!next.gyms.some(g=>g.id===next.settings.gymId))next.settings.gymId=next.gyms[0]?.id;
  next.settings.unit=next.gyms.find(g=>g.id===next.settings.gymId)?.unit||'kg';
  next.active=owns?C.clone(doc.active.session):null;
  syncApplying=true;
  try{
    db=normalize(next);applyGymMachines(db.gym);
    rebuildProgress(false);migratePRs(false);
    const raw=JSON.stringify(db);localStorage.setItem(LS_KEY,raw);syncSavedRaw=raw;
    syncForeign=doc.active&&!owns?C.clone(doc.active):null;
    restUntil=db.active?.restUntil||null;invalidatePlates();
  }catch(e){db=before;syncForeign=foreign;throw new Error('No pudimos guardar los cambios recibidos. Tu información anterior sigue aquí; descarga un respaldo y libera espacio.');}
  finally{syncApplying=false;}
  if((view.name==='routine'&&!db.routines.some(r=>r.id===view.id))||(view.name==='split'&&!db.splits.some(s=>s.id===view.id))||(view.name==='session'&&!db.active))view={name:'home'};
  render();
}
function syncBadge(){return `<span class="n-local n-sync-badge"><i></i><span data-sync-short>${esc(hierroSync?.state?.key?syncShortStatus():'En tu dispositivo')}</span></span>`;}
function syncShortStatus(){if(window.__saveError)return 'Pendiente de guardar';return {synced:'Sincronizado',working:'Sincronizando',pending:'Cambios pendientes',offline:'Guardado aquí',waiting:'Cambios por recibir',conflict:'Revisar cambios',error:'Revisar sincronización'}[hierroSync?.status]||'En tu dispositivo';}
function syncNotify(){
  if(typeof pushChanged==='function')pushChanged();
  if(['offline','error'].includes(hierroSync?.status))syncRetryAt=Date.now()+60000;
  if(hierroSync?.status==='synced')syncRetryAt=0;
  document.querySelectorAll('[data-sync-short]').forEach(el=>el.textContent=syncShortStatus());
  document.querySelectorAll('[data-sync-status]').forEach(el=>el.textContent=hierroSync?.message||'En este dispositivo');
  document.querySelectorAll('[data-sync-last]').forEach(el=>el.textContent=syncLastLabel());
  document.querySelectorAll('[data-sync-review]').forEach(el=>{el.hidden=!hierroSync?.pending;});
  document.querySelectorAll('.n-sync-badge').forEach(el=>el.dataset.status=hierroSync?.status||'local');
}
function syncLastLabel(){const t=hierroSync?.state?.lastSync;return t?'Última sincronización: '+new Date(t).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Los cambios se guardan primero en este dispositivo.';}
function syncSchedule(delay=2200){clearTimeout(syncTimer);if(!syncReady||!hierroSync?.state?.key||!syncTabOwner)return;if(navigator.onLine===false){hierroSync.emit('offline','Sin conexión. Tus cambios se enviarán al volver.');return;}syncTimer=setTimeout(()=>hierroSync.sync(),Math.max(delay,syncRetryAt-Date.now()));}
function syncBeforeSave(){
  if(!syncReady||syncApplying)return true;
  if(!syncTabOwner)return false;
  const actual=localStorage.getItem(LS_KEY);
  if(actual!==syncSavedRaw&&syncSavedRaw&&actual){
    // The edit lock covers new versions. This also protects against an older
    // still-open tab that does not know about that lock.
    const merged=HierroSyncCore.merge(JSON.parse(syncSavedRaw),JSON.parse(JSON.stringify(db)),JSON.parse(actual));
    if(merged.conflicts.length){syncStorageIssue={local:JSON.parse(JSON.stringify(db)),other:JSON.parse(actual),base:JSON.parse(syncSavedRaw)};syncShowTabConflict();return false;}
    db=normalize(merged.value);invalidatePlates();
  }
  return true;
}
function syncSaved(){
  if(syncApplying)return;
  syncSavedRaw=localStorage.getItem(LS_KEY);
  if(hierroSync?.state?.key&&hierroSync.status!=='conflict')hierroSync.emit('pending','Cambios guardados; pendientes de enviar');
  syncSchedule();
}
async function syncAcquireTab(){
  if(!navigator.locks?.request)return;
  navigator.locks.request(LS_KEY+'.editor',{ifAvailable:true},async lock=>{
    if(!lock){syncTabOwner=false;syncTabNotice();return;}
    syncTabOwner=true;document.getElementById('sync-tab-notice')?.remove();
    for(const id of ['topbar','main','tabs']){const el=document.getElementById(id);if(el)el.inert=false;}
    await new Promise(resolve=>syncTabRelease=resolve);
  }).catch(()=>{});
}
function syncTabNotice(){
  if(document.getElementById('sync-tab-notice'))return;
  const panel=document.createElement('section');panel.id='sync-tab-notice';panel.className='n-sync-tab-notice';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','sync-tab-title');
  panel.innerHTML=`<div class="n-panel"><span class="n-eyebrow">Una pestaña a la vez</span><h2 id="sync-tab-title">Hierro ya está abierta.</h2><p>Continúa en la otra pestaña de este navegador. Si quieres usar esta, cierra la otra y vuelve a intentar.</p>${uiButton('Usar esta pestaña','syncRetryTab()','arrow')}</div>`;
  document.body.appendChild(panel);for(const id of ['topbar','main','tabs']){const el=document.getElementById(id);if(el)el.inert=true;}panel.querySelector('button').focus();
}
async function syncRetryTab(){await syncAcquireTab();setTimeout(()=>{if(syncTabOwner){const raw=localStorage.getItem(LS_KEY);if(raw){db=normalize(JSON.parse(raw));syncSavedRaw=raw;render();}syncSchedule(50);}},100);}
function syncShowTabConflict(){
  openModal(`<h2>Otra pestaña guardó cambios.</h2><p class="muted">Conservamos ambas versiones para que puedas revisarlas. Descarga primero la copia de esta pestaña y después abre la que se guardó.</p>${uiButton('Descargar esta copia','syncDownloadTabCopy()','download')}${uiButton('Abrir la copia guardada','syncUseSavedTab()','arrow','secondary')}`);
}
function syncDownloadTabCopy(){if(syncStorageIssue)syncDownload('hierro-copia-de-esta-pestana.json',JSON.stringify(syncStorageIssue.local,null,2),'application/json');}
function syncUseSavedTab(){if(!syncStorageIssue)return;db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));syncSavedRaw=localStorage.getItem(LS_KEY);syncStorageIssue=null;closeModal();render();syncSchedule(50);}
function syncDownload(name,content,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function syncInit(){
  // QR secrets use a fragment, never a query parameter, and are removed before
  // UI or network work. External referrers cannot receive the recovery key.
  const match=location.hash.match(/^#vincular=(.+)$/);let linkKey='';
  if(match){try{linkKey=decodeURIComponent(match[1]);}catch{}history.replaceState(null,'',location.pathname+location.search);}
  try{
    if(!crypto?.subtle||!globalThis.indexedDB)throw new Error('Este navegador no ofrece el almacenamiento y cifrado necesarios. Prueba con una versión actualizada de Safari, Orion, Chrome o Firefox.');
    syncDevice=localStorage.getItem(LS_KEY+'.device')||crypto.randomUUID();localStorage.setItem(LS_KEY+'.device',syncDevice);
    syncSavedRaw=localStorage.getItem(LS_KEY);
    hierroSync=new HierroSyncEngine.Engine({url:HIERRO_SYNC_URL,store:syncStore(),adapter:{read:syncRead,apply:syncApply,busy:syncBusy,enabled:()=>syncTabOwner&&!syncStorageIssue,notify:syncNotify}});
    const state=await hierroSync.load();
    if(state?.key&&state.base?.active?.owner!==syncDevice)syncForeign=HierroSyncCore.clone(state.base?.active||null);
    syncReady=true;await syncAcquireTab();syncNotify();
    if(syncForeign&&!db.active)render();
    window.addEventListener('online',()=>{syncRetryAt=0;syncSchedule(100);});
    window.addEventListener('offline',()=>{if(hierroSync.state?.key)hierroSync.emit('offline','Sin conexión. Tus cambios se enviarán al volver.');});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncSchedule(150);});
    document.addEventListener('focusout',()=>syncSchedule(800));
    window.addEventListener('pagehide',()=>{syncTabRelease?.();syncTabRelease=null;});
    window.addEventListener('pageshow',e=>{if(e.persisted)syncAcquireTab();});
    window.addEventListener('storage',e=>{
      if(e.key!==LS_KEY||!syncTabOwner||!e.newValue||e.newValue===syncSavedRaw)return;
      if(!document.getElementById('modalhost')?.children.length&&!document.activeElement?.matches('input,textarea,select')&&!db.active){db=normalize(JSON.parse(e.newValue));syncSavedRaw=e.newValue;render();syncSchedule(100);}
    });
    setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine!==false)syncSchedule(100);},15000);
    if(linkKey){closeModal();go({name:'settings',section:'sync'});uiSyncLink(linkKey);}
    else syncSchedule(300);
  }catch(e){syncStorageIssue={message:e.message};syncNotify();}
}
function uiSync(){
  const connected=!!hierroSync?.state?.key;
  if(syncStorageIssue?.message)return `<section class="n-panel"><h2>La sincronización necesita atención.</h2><p>${esc(syncStorageIssue.message)}</p><p>Tu entrenamiento sigue guardándose en este dispositivo.</p>${uiButton('Descargar respaldo','exportBackup()','download')}</section>`;
  if(!connected)return `<div class="n-detail-grid n-sync-grid"><section class="n-panel n-sync-intro"><div class="n-sync-devices">${uiIcon('phone')}${uiIcon('arrow')}${uiIcon('computer')}</div><span class="n-eyebrow">Tu esfuerzo te acompaña</span><h2>Un mismo espacio.<br>En todos tus dispositivos.</h2><p>Crea tus días con el teclado. Entrena con tu teléfono. Tus planes, gimnasios, notas y sesiones viajan contigo.</p><div class="n-sync-actions">${uiButton('Crear mi espacio','uiSyncCreate()','plus')}${uiButton('Ya tengo una clave','uiSyncLink()','arrow','secondary')}</div>${hierroSync?.state?.checkpoints?.length?uiButton('Recuperar una copia anterior','uiSyncCheckpoints()','shield','text'):''}<p data-sync-error class="n-sync-error" role="alert"></p></section><section class="n-sync-explain"><div><b>Funciona sin conexión</b><p>Guarda aquí y sincroniza al abrir Hierro con internet. Tu computadora puede estar apagada.</p></div><div><b>Una clave, sin contraseña</b><p>Vincula otro dispositivo con tu clave o su QR. Guárdala: quien la tenga puede abrir tu espacio.</p></div><div><b>Tu información, cifrada</b><p>Los datos se cifran en el dispositivo antes de enviarse. Sin correo, anuncios ni suscripción.</p></div></section></div>`;
  return `<div class="n-detail-grid n-sync-grid"><section class="n-panel n-sync-intro"><span class="n-eyebrow">Tu espacio está vinculado</span><h2>Sigues justo<br>donde te quedaste.</h2><div class="n-sync-state"><i></i><strong data-sync-status role="status">${esc(hierroSync.message)}</strong></div><p data-sync-last>${esc(syncLastLabel())}</p><p>Se sincronizan planes, ejercicios, equipo, notas e historial. Puedes continuar una sesión en otro dispositivo. La apariencia y los avisos se eligen en cada uno.</p><div class="n-sync-actions">${uiButton('Vincular otro dispositivo','uiSyncRecovery()','plus')}${uiButton('Sincronizar ahora','uiSyncNow()','arrow','secondary')}</div><button type="button" class="n-primary" data-sync-review ${hierroSync.pending?'':'hidden'} onclick="uiSyncConflicts()">Revisar cambios</button><p data-sync-error class="n-sync-error" role="alert"></p></section><section class="n-sync-explain"><div><b>Sincronización automática</b><p>Con Hierro abierta, los cambios llegan en unos segundos. Si estás escribiendo o entrenando, esperamos para actualizar la pantalla.</p></div><div><b>Tu clave está guardada aquí</b><p>Puedes consultarla para vincular otro dispositivo. Si la pierdes y ya no tienes ninguno vinculado, no podremos recuperar tu espacio.</p></div>${uiRow('Copias de seguridad locales','Antes de recibir o resolver cambios','uiSyncCheckpoints()','shield')}${uiButton('Desvincular este dispositivo','uiSyncDisconnect()','back','text')}</section></div>`;
}
function syncUIError(e){const el=document.querySelector?.('#modalhost [data-sync-error]')||document.querySelector?.('[data-sync-error]');if(el)el.textContent=e.message||String(e);else infoModal('Sincronización',esc(e.message||String(e)));}
async function uiSyncCreate(){
  if(!syncReady){syncUIError(new Error('Espera un momento a que se prepare el almacenamiento.'));return;}
  if(!HIERRO_SYNC_URL){syncUIError(new Error('El servicio se está preparando. Podrás crear tu espacio cuando esté disponible.'));return;}
  if(hierroSync.running||hierroSync.state?.key||syncConnecting)return;
  syncConnecting=true;
  try{if(!save())throw new Error('Guarda o descarga tus datos antes de activar la sincronización.');await hierroSync.create();render();uiSyncRecovery(true);}catch(e){syncUIError(e);}finally{syncConnecting=false;}
}
function uiSyncRecovery(created=false){
  const key=hierroSync?.state?.key;if(!key)return;
  openModal(`<span class="n-eyebrow">${created?'Tu espacio ya tiene clave':'Vincula otro dispositivo'}</span><h2>Tu llave para volver.</h2><p class="muted">Escanea el QR con la cámara del otro teléfono o abre Hierro → Tú → Sincronización y pega esta clave.</p><div id="sync-qr" class="n-sync-qr" aria-label="QR privado para vincular tu espacio"></div><label class="field"><span>Clave de recuperación · mantenla privada</span><textarea id="sync-recovery-key" class="n-sync-key" readonly rows="3" spellcheck="false">${esc(key)}</textarea></label><div class="n-sync-actions">${uiButton('Copiar clave','uiSyncCopyKey()','copy','secondary')}${uiButton('Guardar clave','uiSyncDownloadKey()','download','secondary')}</div>${!hierroSync.state.created?'<p class="n-sync-error">Tu clave está guardada aquí. Falta enviar la primera copia: mantén Hierro abierta con internet antes de vincular otro dispositivo.</p>':''}<p class="hint" id="sync-key-message" role="status">Guárdala en tu gestor de contraseñas o en un lugar seguro. No la publiques ni la envíes a desconocidos.</p>${uiButton('Listo','uiSyncRecoveryDone()','check')}`);
  if(typeof qrcodegen!=='undefined'){
    const url=new URL(location.pathname,location.origin);url.hash='vincular='+key;
    const qr=qrcodegen.QrCode.encodeText(url.href,qrcodegen.QrCode.Ecc.MEDIUM);let path='';
    for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))path+=`M${x+4},${y+4}h1v1h-1z `;
    document.getElementById('sync-qr').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size+8} ${qr.size+8}" role="img" aria-label="Escanea para vincular tu espacio"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="#13261f"/></svg>`;
  }
}
async function uiSyncCopyKey(){try{await navigator.clipboard.writeText(hierroSync.state.key);document.getElementById('sync-key-message').textContent='Clave copiada. Pégala solo en otro dispositivo tuyo.';}catch{const el=document.getElementById('sync-recovery-key');el.focus();el.select();document.getElementById('sync-key-message').textContent='Seleccionamos la clave para que la copies.';}}
function uiSyncDownloadKey(){syncDownload('hierro-clave-privada.txt','Clave privada de Hierro Beta\n\n'+hierroSync.state.key+'\n\nGuárdala en un lugar seguro. Esta clave permite abrir y modificar tu espacio.\nhttps://elrobamichis.github.io/hierro-beta/\n');}
function uiSyncLink(prefill=''){
  if(hierroSync?.state?.key){infoModal('Este dispositivo ya está vinculado','Desvincúlalo desde Sincronización antes de usar otra clave. Tus entrenamientos se conservarán aquí.');return;}
  syncInspectionToken++;syncInspection=null;syncChoices={};
  openModal(`<h2>Vuelve a tu espacio.</h2><p class="muted">En tu otro dispositivo: Tú → Sincronización → Vincular otro dispositivo.</p><form onsubmit="uiSyncInspect(event)"><label class="field"><span>Tu clave de recuperación</span><textarea class="n-sync-key" id="sync-link-key" required rows="3" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="hr1.…">${esc(prefill)}</textarea></label><p data-sync-error class="n-sync-error" role="alert"></p><button type="submit" class="n-primary"><span>Buscar mi espacio</span>${uiIcon('arrow')}</button></form>`);
}
async function uiSyncInspect(event){
  event?.preventDefault();const button=event?.target.querySelector('button'),key=document.getElementById('sync-link-key')?.value.trim();
  if(!syncReady){syncUIError(new Error('Se está preparando el almacenamiento. Vuelve a intentar en un momento.'));return;}if(!key)return;const token=++syncInspectionToken;if(button)button.disabled=true;
  try{
    const inspected=await hierroSync.inspect(key);if(token!==syncInspectionToken)return;syncInspection=inspected;syncChoices={};
    const cloud=syncInspection.remote,local=syncRead();
    openModal(`<span class="n-eyebrow">Encontramos tu espacio</span><h2>Todo listo para volver.</h2><div class="n-sync-comparison"><section><b>En la nube</b><p>${syncCounts(cloud)}</p></section><section><b>En este dispositivo</b><p>${syncCounts(local)}</p></section></div><p class="muted">Antes de cambiar nada, guardamos una copia de lo que tienes aquí. Elige cómo quieres vincularlo.</p><div class="n-sync-actions">${uiButton('Traer mis datos de la nube',"uiSyncConfirmLink('replace')",'download')}${uiButton('Combinar con lo que tengo aquí',"uiSyncConfirmLink('merge')",'plus','secondary')}</div><p class="hint">Al combinar, se suman los registros distintos y revisas cualquier cambio que coincida.</p><p data-sync-error class="n-sync-error" role="alert"></p>`);
  }catch(e){if(token===syncInspectionToken)syncUIError(e);}finally{if(button)button.disabled=false;}
}
function syncCounts(doc){return `${doc.routines.length} ${doc.routines.length===1?'día':'días'} · ${doc.history.length} ${doc.history.length===1?'sesión':'sesiones'}<br>${doc.gyms.length} ${doc.gyms.length===1?'gimnasio':'gimnasios'}`;}
async function uiSyncConfirmLink(mode){
  if(!syncInspection||syncConnecting)return;syncLinkMode=mode;syncConnecting=true;
  try{
    if(hierroSync.keys&&hierroSync.keys.id!==syncInspection.keys.id&&typeof pushDisconnect==='function')await pushDisconnect();
    const result=await hierroSync.link(syncInspection,mode,syncChoices);
    if(result.conflicts?.length){uiSyncConflictDialog(result.conflicts,true);return;}
    syncInspection=null;syncChoices={};closeModal();go(window.__syncReturn||{name:'settings',section:'sync'});delete window.__syncReturn;syncSchedule(100);
  }catch(e){syncUIError(e);}finally{syncConnecting=false;}
}
function syncConflictLabel(conflict){
  const p=conflict.path.split('/').slice(1).map(s=>s.replace(/~1/g,'/').replace(/~0/g,'~'));
  const groups={routines:'Día',history:'Sesión',gyms:'Gimnasio',splits:'Plan',exmeta:'Ejercicio',settings:'Preferencia',active:'Sesión en curso'};
  const names={name:'Nombre',notes:'Técnica general',gymNotes:'Ajuste de este gimnasio',lo:'Rango mínimo',hi:'Rango máximo',exercises:'Ejercicios',sets:'Series',active:'Plan activo',rest:'Descanso',plates:'Discos',bars:'Barras',dumbbells:'Mancuernas',machines:'Máquinas',cap:'Peso máximo',step:'Incremento',stack:'Torre',entries:'Series registradas','$order':'Orden'};
  const list=db[p[0]],item=Array.isArray(list)?list.find(x=>x.id===p[1]):null;
  const who=item?.name||item?.routineName||(p[0]==='exmeta'?p[1]:'');
  return [groups[p[0]]||'Cambio',who,names[p.at(-1)]||''].filter(Boolean).join(' · ');
}
function syncConflictValue(v){
  if(v===undefined||v===null)return 'Eliminado / sin valor';
  if(typeof v==='boolean')return v?'Activado':'Desactivado';
  if(typeof v!=='object')return String(v).slice(0,250);
  if(Array.isArray(v))return v.map(x=>typeof x==='object'?(x.name||`${x.w??''} × ${x.r??''}`):x).join(' · ').slice(0,250)||'Lista vacía';
  if(v.session)return `${v.session.routineName} · ${v.session.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0)} series confirmadas`;
  if(v.routine&&v.split)return `${v.routine.name} · ${v.split.name}`;
  if(v.active&&v.gym)return `${v.active.session.routineName} · ${v.gym.name}`;
  return JSON.stringify(v).slice(0,250);
}
function uiSyncConflicts(){if(hierroSync?.pending)uiSyncConflictDialog(hierroSync.pending.conflicts,false);}
function uiSyncConflictDialog(conflicts,linking){
  window.__syncConflicts=conflicts;
  openModal(`<span class="n-eyebrow">Cuidemos ambas versiones</span><h2>Elige qué quieres conservar.</h2><p class="muted">Se cambió lo mismo en dos dispositivos. Los demás cambios se combinan. Guardamos copias antes de aplicar tu elección.</p><div class="n-sync-conflicts">${conflicts.map((c,i)=>`<fieldset><legend>${esc(syncConflictLabel(c))}</legend><label><input type="radio" name="sync-choice-${i}" value="local" ${syncChoices[c.path]==='local'?'checked':''} onchange="syncChoose(${i},this.value)"><span><b>Este dispositivo</b><small>${esc(syncConflictValue(c.local))}</small></span></label><label><input type="radio" name="sync-choice-${i}" value="remote" ${syncChoices[c.path]==='remote'?'checked':''} onchange="syncChoose(${i},this.value)"><span><b>La otra copia</b><small>${esc(syncConflictValue(c.remote))}</small></span></label></fieldset>`).join('')}</div><p data-sync-error class="n-sync-error" role="alert"></p>${uiButton('Guardar mis elecciones',`uiSyncResolve(${linking})`,'check')}`);
}
function syncChoose(i,value){const c=window.__syncConflicts?.[i];if(c&&['local','remote'].includes(value))syncChoices[c.path]=value;}
async function uiSyncResolve(linking){
  if(window.__syncConflicts?.some(c=>!syncChoices[c.path])){syncUIError(new Error('Elige una versión para cada cambio.'));return;}
  if(linking){await uiSyncConfirmLink(syncLinkMode);return;}
  const choices={...syncChoices};closeModal();await hierroSync.resolve(choices);render();if(hierroSync.pending)uiSyncConflicts();
}
async function uiSyncNow(){if(!hierroSync)return;await hierroSync.sync();syncNotify();}
function syncForeignCard(){return syncForeign?`<section class="n-hero"><span class="n-eyebrow">Empezaste en otro dispositivo</span><h2>${esc(syncForeign.session.routineName)}</h2><p>Tu sesión está guardada en tu espacio. Puedes traerla aquí y continuar con tus series.</p>${uiButton('Continuar en este dispositivo','uiSyncClaim()','play')}</section>`:'';}
function syncOfferContinue(rid,deload){openModal(`<h2>Hay una sesión en otro dispositivo.</h2><p class="muted">${esc(syncForeign?.session.routineName||'Tu sesión')} sigue allí. Puedes traerla con internet o registrar otro entrenamiento aquí y compartir el historial al terminar.</p>${uiButton('Continuar la otra sesión','closeModal();uiSyncClaim()','play')}${rid?uiButton('Entrenar aquí por separado',uiAction('startSession',rid,!!deload,true),'plus','secondary'):''}`);}
async function uiSyncClaim(){
  try{if(db.active)throw new Error('Termina la sesión de este dispositivo antes de traer otra.');if(await hierroSync.claim(syncDevice))go({name:'session'});else{render();syncSchedule(100);}}catch(e){infoModal('No se pudo traer la sesión',esc(e.message));}
}
function uiSyncDisconnect(){
  const pending=hierroSync?.status!=='synced';
  confirmModal('¿Desvincular este dispositivo?',`${pending?'Hay cambios pendientes. Sincroniza o descarga un respaldo si quieres llevarlos contigo. ':''}Tus planes e historial se conservan aquí. La copia en la nube y los demás dispositivos siguen vinculados.`, 'Desvincular',async()=>{
    try{if(typeof pushDisconnect==='function')await pushDisconnect();await hierroSync.disconnect();syncForeign=null;closeModal();render();}catch(e){syncUIError(e);}
  });
}
function uiSyncCheckpoints(){
  const list=hierroSync?.state?.checkpoints||[];
  openModal(`<h2>Copias de seguridad.</h2><p class="muted">Conservamos hasta tres copias en este navegador antes de recibir o resolver cambios. Descarga la que necesites; no incluye tu clave privada.</p>${list.map((c,i)=>uiRow(esc(c.label),new Date(c.at).toLocaleString('es-MX')+' · '+c.doc.history.length+' sesiones',`uiSyncDownloadCheckpoint(${i})`,'download')).join('')||'<p class="hint">Aún no ha sido necesario guardar una copia.</p>'}`);
}
function uiSyncDownloadCheckpoint(i){
  const c=hierroSync?.state?.checkpoints?.[i];if(!c)return;
  const out=HierroSyncCore.clone(c.doc);delete out.schema;out.active=out.active?.session||null;out.progress={};out.settings.gymId=out.gyms[0]?.id;out.settings.unit=out.gyms[0]?.unit||'kg';
  const machines=out.gyms[0]?.machines||{};for(const [key,m] of Object.entries(machines))out.exmeta[key]={...out.exmeta[key],...m};
  syncDownload('hierro-copia-'+new Date(c.at).toISOString().slice(0,10)+'.json',JSON.stringify(out,null,2),'application/json');
}
function syncConfirmRestore(){
  confirmModal('¿Restaurar en tu espacio vinculado?','Este respaldo reemplazará tus datos de entrenamiento aquí y los cambios se enviarán a tus otros dispositivos. Guardaremos antes una copia de seguridad local.', 'Restaurar y sincronizar',async()=>{
    try{if(!validBackup(window.__backup))throw new Error('El respaldo está incompleto. Tus datos se conservan.');await hierroSync.checkpoint(syncRead(),'Antes de restaurar respaldo');const foreign=syncForeign;syncForeign=null;syncApplying=true;const ok=restoreBackupData(window.__backup);syncApplying=false;if(!ok){syncForeign=foreign;return;}window.__backup=null;syncSaved();closeModal();go({name:db.active?'session':'home'});syncSchedule(100);}catch(e){syncApplying=false;syncUIError(e);}
  },true);
}
function syncConfirmWipe(){
  confirmModal('¿Borrar los datos de este dispositivo?','Primero lo desvincularemos. Tus datos de la nube y de los demás dispositivos se conservan. Descarga un respaldo si tienes cambios pendientes.', 'Desvincular y borrar aquí',async()=>{
    try{if(typeof pushDisconnect==='function')await pushDisconnect();await hierroSync.disconnect();syncForeign=null;localStorage.removeItem(LS_KEY);syncSavedRaw=null;db=load();closeModal();go({name:'home'});}catch(e){syncUIError(e);}
  },true);
}

function uiSyncRecoveryDone(){closeModal();if(window.__syncReturn){const next=window.__syncReturn;delete window.__syncReturn;go(next);}}
