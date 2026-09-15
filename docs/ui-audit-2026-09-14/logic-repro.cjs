#!/usr/bin/env node
'use strict';

/* Auditoría local, sin dependencias ni red. NO importa un perfil del usuario.
 * Lee los scripts actuales; ejecuta sus funciones en VM con datos sintéticos.
 * Por defecto imprime JSON. --out nombre-nuevo.json crea SOLO un archivo nuevo
 * junto a este script (wx); jamás sobreescribe un resultado anterior.
 * Los identificadores F01..F31 corresponden al informe ORIGINAL de 32 puntos.
 * Una detección positiva reproduce el defecto; NO significa que la app pase.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
const assert = require('node:assert/strict');

const AUDIT_DIR = fs.realpathSync(__dirname);
const ROOT = fs.realpathSync(path.resolve(AUDIT_DIR, '../..'));
assert.equal(path.basename(AUDIT_DIR), 'ui-audit-2026-09-14');
assert.equal(path.basename(path.dirname(AUDIT_DIR)), 'docs');
const FILES = ['index.html', 'ui.js', 'sync-core.js', 'sync-engine.js', 'sync.js', 'push-core.js', 'push.js'];
const raw = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f))]));
const source = Object.fromEntries(FILES.map(f => [f, raw[f].toString('utf8')]));
const sha = b => createHash('sha256').update(b).digest('hex');
const inputHashes = Object.fromEntries(FILES.map(f => [f, sha(raw[f])]));
const clone = x => x === undefined ? null : JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b) => Math.abs(a - b) < 0.001;
const START = Date.parse('2026-09-14T18:00:00.000Z');
const requested = [1,2,3,4,5,6,7,8,10,12,13,14,18,20,21,22,23,24,28,31];
const contexts = [];

// Only the final IIFE is omitted. No application function body is rewritten.
const blocks = [...source['index.html'].matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(blocks.length, 1, 'Expected one inline application script');
const inline = blocks[0][1];
const initMarker = '(function init(){';
assert.equal(inline.split(initMarker).length, 2, 'Startup marker must be unique');
assert.match(inline.slice(inline.indexOf(initMarker)), /\}\)\(\);\s*$/);
const inlineLine = source['index.html'].slice(0, blocks[0].index + '<script>'.length).split('\n').length;
const application = inline.slice(0, inline.indexOf(initMarker));

function ref(file, anchor, note) {
  const lines = source[file].split('\n');
  const i = lines.findIndex(l => l.includes(anchor));
  assert.ok(i >= 0, 'Source anchor absent: ' + file + ' / ' + anchor);
  return { file, line: i + 1, anchor, ...(note ? { note } : {}) };
}

function makeHarness() {
  let now = START, seed = 101, nextTimer = 1;
  const timers = new Map(), storage = new Map(), nodes = new Map();
  const evidence = { storageReads:0, storageWrites:0, storageFailures:0, blockedNetwork:0,
    timerCallbacks:0, fileReads:0, modalHTML:[], notifications:[], console:[] };
  const faults = { read:false, write:false };
  const reads = [];
  const decode = s => String(s).replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  class Element {
    constructor(id) {
      this.id=id; this.value=''; this.textContent=''; this.checked=false; this.disabled=false;
      this.style={setProperty(){},removeProperty(){}}; this.dataset={}; this.children=[];
      this.classList={contains:()=>false,add(){},remove(){},toggle(){}};
      this._html=''; this._owned=[]; this.inert=false; this.tagName='DIV';
    }
    set innerHTML(html) {
      for (const id of this._owned) nodes.delete(id);
      this._owned=[]; this._html=String(html);
      if(this.id==='modalhost') evidence.modalHTML.push(this._html);
      // Minimal field extraction. This is NOT an HTML parser/layout engine.
      for(const m of this._html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
        const n=new Element(m[3]); n.tagName=m[1].toUpperCase();
        const v=/\bvalue="([^"]*)"/.exec(m[2]); if(v)n.value=decode(v[1]);
        if(n.tagName==='TEXTAREA') n.value=decode(this._html.slice(m.index+m[0].length).split('</textarea>')[0]);
        n.checked=/\bchecked\b/.test(m[2]); nodes.set(n.id,n); this._owned.push(n.id);
      }
    }
    get innerHTML(){return this._html;}
    focus(){} select(){} addEventListener(){} setAttribute(k,v){this[k]=v;}
    getAttribute(k){return this[k]??null;} remove(){nodes.delete(this.id);}
    setCustomValidity(v){this.validityMessage=v;} reportValidity(){return !this.validityMessage;}
    querySelector(){return null;} querySelectorAll(){return [];}
    getClientRects(){return [];} scrollIntoView(){}
  }
  for(const id of ['app','topbar','main','tabs','modalhost','toasthost']) nodes.set(id,new Element(id));
  const document = {
    visibilityState:'visible', activeElement:null,
    body:new Element('body'), documentElement:new Element('html'),
    getElementById:id=>nodes.get(id)||null,
    querySelector:s=>/^#[\w-]+$/.test(s)?nodes.get(s.slice(1))||null:null,
    querySelectorAll:()=>[], addEventListener(){}, createElement:()=>new Element(''),
  };
  class FakeDate extends Date {
    constructor(...a){super(...(a.length?a:[now]));}
    static now(){return now;}
  }
  class FakeNotification {
    static permission='granted';
    constructor(title,options){evidence.notifications.push({title,...clone(options)});}
    static requestPermission(){return Promise.resolve(this.permission);}
  }
  class FakeFileReader {
    readAsText(file){evidence.fileReads++; reads.push(()=>{if(file.fail){this.onerror?.();return;}this.result=file.text;this.onload?.();});}
  }
  function schedule(fn,ms,interval) { assert.equal(typeof fn,'function'); const id=nextTimer++; timers.set(id,{fn,ms,interval}); return id; }
  const deny = () => {evidence.blockedNetwork++; throw new Error('NETWORK_DISABLED_BY_AUDIT');};
  const sandbox = {
    document, navigator:{onLine:false}, Date:FakeDate, TextEncoder, TextDecoder,
    crypto:webcrypto, Uint8Array, ArrayBuffer, DataView, AbortController,
    atob:s=>Buffer.from(s,'base64').toString('binary'), btoa:s=>Buffer.from(s,'binary').toString('base64'),
    URL, Notification:FakeNotification, FileReader:FakeFileReader,
    localStorage:{
      getItem(k){evidence.storageReads++;if(faults.read){evidence.storageFailures++;throw new Error('Synthetic read failure');}return storage.get(k)??null;},
      setItem(k,v){evidence.storageWrites++;if(faults.write){evidence.storageFailures++;const e=new Error('Synthetic quota failure');e.name='QuotaExceededError';throw e;}storage.set(k,String(v));},
      removeItem:k=>storage.delete(k),
    },
    setInterval:(fn,ms)=>schedule(fn,ms,true), clearInterval:id=>timers.delete(id),
    setTimeout:(fn,ms)=>schedule(fn,ms,false), clearTimeout:id=>timers.delete(id),
    fetch:async()=>deny(), XMLHttpRequest:deny, WebSocket:deny,
    console:Object.fromEntries(['log','warn','error','info'].map(k=>[k,(...args)=>evidence.console.push({level:k,text:args.map(String).join(' ')})])),
    scrollY:0, pageYOffset:0, scrollTo(_x,y){sandbox.scrollY=y;}, addEventListener(){},
    location:{href:'https://audit.invalid/',protocol:'https:',hostname:'audit.invalid',reload:deny,replace:deny},
  };
  sandbox.window=sandbox; sandbox.globalThis=sandbox;
  const ctx=vm.createContext(sandbox,{name:'hierro-synthetic-audit',codeGeneration:{strings:false,wasm:false}});
  const run=code=>vm.runInContext(code,ctx,{timeout:10000,filename:'audit-scenario.vm.js'});
  sandbox.__auditRandom=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  run('Math.random=__auditRandom;');
  for(const f of ['ui.js','sync-core.js','sync-engine.js','sync.js','push-core.js','push.js'])
    vm.runInContext(source[f],ctx,{timeout:10000,filename:f});
  vm.runInContext(application,ctx,{timeout:10000,filename:'index.html',lineOffset:inlineLine-1});
  run(`
    let auditRenderCalls=0, auditRenderMode='record';
    const auditOriginalRender=render;
    render=function(){auditRenderCalls++;if(auditRenderMode==='home')document.getElementById('main').innerHTML=uiHome();};
    const AUDIT_KEY='press de prueba', AUDIT_OTHER='remo de prueba';
    let auditState={};
    function auditBase(){
      db=normalize({settings:{goal:'hipertrofia',unit:'kg',notify:'off',sound:'off',vibration:'off',rest:'90'},
        splits:[{id:'plan-a',name:'Plan A sintético',active:true,exconf:{[AUDIT_KEY]:{sets:3}}},
                {id:'plan-b',name:'Plan B sintético',active:false,exconf:{[AUDIT_KEY]:{sets:2}}}],
        routines:[{id:'dia-a',name:'Día A sintético',split:'plan-a',exercises:[{id:'ex-a',key:AUDIT_KEY,name:'Press de prueba'}]},
                  {id:'dia-b',name:'Día B sintético',split:'plan-b',exercises:[{id:'ex-b',key:AUDIT_KEY,name:'Press de prueba'}]}],
        history:[],exmeta:{[AUDIT_KEY]:{type:'normal',equip:'nada',notes:'',muscle:'pecho'}},progress:{},active:null});
      view={name:'home'};restUntil=null;syncForeign=null;hierroSync=null;syncReady=false;syncDevice='audit-device';
      auditState={};save();
    }
    function auditHistory(id,w=40,r=10,rid='dia-a',key=AUDIT_KEY,date='2026-09-12T18:00:00.000Z'){
      const rr=db.routines.find(x=>x.id===rid);
      return {id,routineId:rid,routineName:rr?.name||'Día sintético',date,duration:600,
        entries:[{key,name:allExerciseNames().get(key)?.name||key,sets:[{w,r,rir:2}]}]};
    }
    function auditDraft(xi=0,w='40',r='10',si=0){setVal(xi,si,'w',w);setVal(xi,si,'r',r);setVal(xi,si,'rir','2');}
    auditBase();
  `);
  const h={ctx,run,read:code=>clone(run(code)),evidence,faults,storage,nodes,document,
    now:()=>now,advance:ms=>{assert.ok(ms>=0);now+=ms;},
    setTime:t=>{assert.ok(t>=now);now=t;},
    tick(id,count=1,elapsedEach=1000){for(let i=0;i<count;i++){const t=timers.get(id);assert.ok(t,'Timer absent: '+id);now+=elapsedEach;evidence.timerCallbacks++;if(!t.interval)timers.delete(id);t.fn();}},
    intervals:()=>[...timers].filter(([,t])=>t.interval).map(([id])=>id),
    completeReads(){while(reads.length)reads.shift()();},
    modal:()=>nodes.get('modalhost').innerHTML,
    async settle(){for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));},
    importBackup(data){ctx.auditFile={text:JSON.stringify(data)};run('importBackup(auditFile)');h.completeReads();},
    // Complete preparation through the CURRENT UI handlers, with a fake clock.
    prepare(xi=0){
      for(let n=0;n<24;n++){
        const w=h.read('ensureWarmup('+xi+')');
        if(!w||['done','skipped'].includes(w.phase))return;
        assert.notEqual(w.phase,'setup','Set a valid work weight before preparation');
        if(w.phase==='set'){
          if(w.plan.steps[w.completed].seconds){run('uiWarmupTimedStart('+xi+','+JSON.stringify(w.id)+','+w.completed+')');h.setTime(h.read('db.active.exercises['+xi+'].warmup.holdUntil'));}
          run('uiWarmupRecord('+xi+','+JSON.stringify(w.id)+','+w.completed+')');
        }else if(w.phase==='rest'){
          h.setTime(Math.max(now,w.restUntil));
          run('uiWarmupNext('+xi+','+JSON.stringify(w.id)+','+w.completed+')');
        }else throw new Error('Unexpected warmup phase '+w.phase);
      }
      throw new Error('Preparation did not terminate');
    },
    start(){run("startSession('dia-a');auditDraft();");},
    logged(){h.start();h.prepare();run('uiLogSet(0,0)');assert.equal(run('db.active.exercises[0].sets[0].done'),true);},
  };
  contexts.push(h);
  return h;
}

const cases=[];
async function scenario(id,title,refs,scope,body){
  const item={id,title,status:'pending',scope,sources:refs,checks:[],controls:[],observations:{}};
  const api={
    h:makeHarness,
    check(label,ok,value){item.checks.push({label,passed:!!ok,...(value===undefined?{}:{value:clone(value)})});},
    control(label,ok,value){item.controls.push({label,passed:!!ok,...(value===undefined?{}:{value:clone(value)})});},
    observe(name,value){item.observations[name]=clone(value);},
  };
  try{await body(api);item.status=item.controls.some(x=>!x.passed)?'harness_control_failed':item.checks.length&&item.checks.every(x=>x.passed)?'reproduced':'not_reproduced';}
  catch(e){item.status='harness_error';item.error={name:e.name,message:e.message,stack:e.stack};}
  cases.push(item);
}

async function main(){
  await scenario('F01','El final anuncia guardado aunque falle el almacenamiento',[
    ref('index.html','function save()'),ref('index.html','function finishSession()'),ref('index.html','openFullModal(finishScreenHTML')],
    'QuotaExceededError simulado en localStorage; preparación y registro reales. No simula una cuota real del navegador.',async t=>{
      const h=t.h();h.logged();const durable=h.storage.get('hierro.v1');h.faults.write=true;h.run('finishSession()');
      const state=h.read('({active:db.active,history:db.history.length})');
      t.observe('after',state);
      t.check('El aviso de fallo existió',h.evidence.modalHTML.some(x=>x.includes('No se pudo guardar')));
      t.check('El final sustituye el aviso y afirma que la sesión está guardada',h.modal().includes('sesión guardada en tu dispositivo'));
      t.check('Memoria finalizada pero el almacenamiento conserva el borrador anterior',state.active===null&&state.history===1&&h.storage.get('hierro.v1')===durable);
      h.faults.write=false;t.observe('afterReload',h.read('({active:!!load().active,history:load().history.length})'));
      const c=t.h();c.logged();c.run('finishSession()');
      t.control('Sin fallo la misma ruta persiste una sesión finalizada',c.read('load().history.length')===1&&c.read('load().active')===null);
    });

  await scenario('F02','Carga dañada o inaccesible vuelve silenciosamente a datos vacíos',[
    ref('index.html','function load()')], 'No demuestra borrado físico por load(); demuestra sustitución en memoria sin aviso.',t=>{
      const h=t.h();h.run("db.history.push(auditHistory('h-a'));save()");const valid=h.storage.get('hierro.v1');
      t.control('Una copia válida se carga',h.read('load().history.length')===1);
      h.storage.set('hierro.v1','{synthetic-invalid-json');const before=h.evidence.modalHTML.length;
      t.observe('malformed',h.read('({history:load().history.length,routines:load().routines.length})'));
      t.check('JSON inválido devuelve base vacía sin aviso',h.read('load().history.length')===0&&h.evidence.modalHTML.length===before);
      t.control('load no ha borrado el texto dañado',h.storage.get('hierro.v1')==='{synthetic-invalid-json');
      h.storage.set('hierro.v1',valid);h.faults.read=true;t.check('Error de lectura también devuelve vacío',h.read('load().history.length')===0);
      h.faults.read=false;t.control('Retirar el fallo recupera el historial intacto',h.read('load().history.length')===1);
    });

  await scenario('F03','Restaurar valida arrays exteriores pero persiste historial inválido',[
    ref('index.html','function importBackup('),ref('index.html','function applyBackup('),ref('ui.js','function uiMuscleStats(')],
    'FileReader de memoria. La confirmación y la escritura son reales. Se ejecuta uiHome para comprobar el fallo posterior con código de presentación real.',t=>{
      const h=t.h();const malformed={routines:[],history:[null]};h.importBackup(malformed);
      t.control('Se llegó a la confirmación de restauración',h.modal().includes('Restaurar este respaldo'));
      h.run("auditRenderMode='home'");let error=null;try{h.run('window.__confirmFn()');}catch(e){error={message:e.message,stack:e.stack};}
      const persisted=JSON.parse(h.storage.get('hierro.v1'));
      t.check('Acepta y guarda history:[null]',persisted.history.length===1&&persisted.history[0]===null);
      t.check('La presentación real falla después de escribir',!!error&&/ui\.js|index\.html/.test(error.stack));t.observe('renderError',error);
      const c=t.h();const valid=c.read('db');c.importBackup(valid);c.run("auditRenderMode='home';window.__confirmFn()");
      t.control('Misma ruta y uiHome aceptan el respaldo válido',c.read('db.routines.length')===2&&c.nodes.get('main').innerHTML.length>0);
      c.importBackup({history:[]});t.control('Falta del array routines se rechaza antes de aplicar',c.modal().includes('Archivo no válido'));
    });

  await scenario('F04','Cambiar series del plan B redimensiona una sesión del plan A',[
    ref('index.html','function setSplitConf('),ref('index.html','function syncActiveSets(')],
    'Se usan go y setSplitConf reales; solo el render general está sustituido por un registrador.',t=>{
      const h=t.h();h.run("startSession('dia-a');go({name:'exercise',key:AUDIT_KEY,rid:'dia-b'});setSplitConf(AUDIT_KEY,'sets','5')");
      const got=h.read('({sessionPlan:db.routines.find(r=>r.id===db.active.routineId).split,a:db.splits[0].exconf[AUDIT_KEY].sets,b:db.splits[1].exconf[AUDIT_KEY].sets,activeSets:db.active.exercises[0].sets.length})');t.observe('after',got);
      t.check('A conserva 3 en configuración pero su sesión pasa a 5 por editar B',got.a===3&&got.b===5&&got.activeSets===5&&got.sessionPlan==='plan-a');
      const c=t.h();c.run("startSession('dia-a');go({name:'exercise',key:AUDIT_KEY,rid:'dia-a'});setSplitConf(AUDIT_KEY,'sets','4')");
      t.control('Editar el propio plan sí debe redimensionar la sesión',c.read('db.active.exercises[0].sets.length')===4);
      c.run("db.active.exercises[0].sets[3].w='12';setSplitConf(AUDIT_KEY,'sets','1')");
      t.control('El protector de borradores escritos sigue funcionando',c.read('db.active.exercises[0].sets.length')===4);
    });

  await scenario('F05','Mover un día cambia el plan del historial y el contexto activo',[
    ref('index.html','function doMoveRoutine('),ref('index.html','function historySplitId('),ref('index.html','function ctxSplitId(')],
    'La reasignación histórica se observa por historySplitId; no modifica las series históricas.',t=>{
      const h=t.h();h.run("db.splits[0].exconf[AUDIT_KEY].rest=60;db.splits[1].exconf[AUDIT_KEY].rest=180;db.history.push(auditHistory('h-a'));startSession('dia-a')");
      const before=h.read('({historyPlan:historySplitId(db.history[0]),rest:restSecs(AUDIT_KEY),entries:db.history[0].entries})');
      h.run("window.__moveTo='plan-b';window.__moveCopy=false;doMoveRoutine('dia-a')");
      const after=h.read('({historyPlan:historySplitId(db.history[0]),rest:restSecs(AUDIT_KEY),entries:db.history[0].entries})');
      t.observe('before',before);t.observe('after',after);
      t.check('Historial y descanso activo pasan a B',before.historyPlan==='plan-a'&&after.historyPlan==='plan-b'&&before.rest===60&&after.rest===180);
      t.control('Los valores del historial no fueron inventados o cambiados por el harness',same(before.entries,after.entries));
      const c=t.h();c.run("db.history.push(auditHistory('h-a'));window.__moveTo='plan-b';window.__moveCopy=true;doMoveRoutine('dia-a')");
      t.control('Copiar conserva la atribución del original',c.read('historySplitId(db.history[0])')==='plan-a'&&c.read('db.routines.length')===3);
    });

  await scenario('F06','Inventario o unidad cambian el peso físico de un borrador',[
    ref('index.html','function setDefaultBar('),ref('index.html','function setUnit('),ref('index.html','function recordedSetKg('),ref('index.html','function setExBarSel(')],
    'Borradores de barra sin confirmar. Controles con cambio por ejercicio y con serie confirmada; no se atribuye el fallo a todas las conversiones.',t=>{
      const h=t.h();h.run("exMeta(AUDIT_KEY).equip='barra';db.gym.bars=[{id:'b20',w:20,on:true,def:true},{id:'b15',w:15,on:true,def:false}];startSession('dia-a');auditDraft(0,'10')");
      const before=h.read('recordedSetKg(AUDIT_KEY,db.active.exercises[0].sets[0])');h.run('setDefaultBar(1)');const after=h.read('recordedSetKg(AUDIT_KEY,db.active.exercises[0].sets[0])');
      t.observe('defaultBarKg',{before,after});t.check('10 kg de discos pasan de total 30 a 25 kg',near(before,30)&&near(after,25));
      const c=t.h();c.run("exMeta(AUDIT_KEY).equip='barra';db.gym.bars=[{id:'b20',w:20,on:true,def:true},{id:'b15',w:15,on:true,def:false}];startSession('dia-a');auditDraft(0,'10');setExBarSel(AUDIT_KEY,'b15')");
      t.control('La ruta de cambio de barra del ejercicio preserva 30 kg',near(c.read('recordedSetKg(AUDIT_KEY,db.active.exercises[0].sets[0])'),30));
      const u=t.h();u.run("exMeta(AUDIT_KEY).equip='barra';startSession('dia-a');auditDraft(0,'10')");const ub=u.read('recordedSetKg(AUDIT_KEY,db.active.exercises[0].sets[0])');u.run("setUnit('lb')");const ua=u.read('recordedSetKg(AUDIT_KEY,db.active.exercises[0].sets[0])');
      t.observe('pristineUnitKg',{before:ub,after:ua,delta:ua-ub});t.check('El inventario estándar en lb altera el total del borrador',near(ub,30)&&ua>30.4&&ua<30.42);
      const logged=t.h();logged.run("exMeta(AUDIT_KEY).equip='barra';startSession('dia-a');auditDraft(0,'10')");logged.prepare();logged.run('uiLogSet(0,0)');const lb=logged.read('collectEntries(db.active)[0].sets[0].w');logged.run("setUnit('lb')");
      t.control('Una serie confirmada conserva su total canónico al cambiar unidad',near(lb,logged.read('collectEntries(db.active)[0].sets[0].w')));
    });

  await scenario('F07','Hevy crea días sin plan hasta normalizar de nuevo',[
    ref('index.html','function importHevy('),ref('index.html','function applyHevyImport('),ref('index.html','function nextDay('),ref('index.html','const huerfanas =')],
    'CSV mínimo sintético leído por el parser actual. No valida exportaciones reales ni el aspecto visual de importar.',t=>{
      const h=t.h();h.run('db=normalize({routines:[],history:[],settings:{goal:"hipertrofia"}})');
      h.ctx.auditCSV={text:'title,start_time,end_time,exercise_title,set_type,reps,weight_kg\nTorso sintético,"12 Sep 2026, 18:00","12 Sep 2026, 18:30",Press sintético,normal,10,40\n'};
      h.run('importHevy(auditCSV)');h.completeReads();
      t.control('El parser encontró una sesión',h.read('window.__hevyImport?.news.length')===1);
      h.run('applyHevyImport()');const before=h.read('({history:db.history.length,routines:db.routines.length,split:db.routines[0].split||null,plans:db.splits.length,next:nextDay()})');
      t.observe('beforeReload',before);t.check('Día importado sin split y sin siguiente día navegable',before.history===1&&before.routines===1&&before.split===null&&before.plans===0&&before.next===null);
      h.run('db=load()');t.observe('afterReload',h.read('({split:db.routines[0].split,plans:db.splits.length,next:nextDay()})'));
      t.control('La normalización en load vuelve a hacerlo navegable',h.read('db.splits.length')===1&&h.read('nextDay()')!==null);
    });

  await scenario('F08','Timer de serie mide callbacks y se pierde al cerrar el modal',[
    ref('index.html','function startSetTimer('),ref('index.html','function stopSetTimer('),ref('index.html','function closeModal('),ref('ui.js','function uiWarmupTimedStart(')],
    'Demuestra contabilidad del timer y closeModal. No prueba throttling real, bloqueo de pantalla, Escape, gesto exterior ni foco del navegador.',t=>{
      function timer(h){h.run("setExType(AUDIT_KEY,'tiempo');startSession('dia-a');auditDraft(0,'','20')");h.prepare();h.run('startSetTimer(0,0)');const id=h.read('setTimerInt');h.tick(id,3);return id;}
      const h=t.h(),id=timer(h);const start=h.now();h.tick(id,1,15000);
      const observed=h.read('setTimerState');t.observe('delayedCallback',{wallElapsedSeconds:(h.now()-start)/1000,state:observed});
      t.check('15 s de reloj y un callback descuentan solo 1 s',observed.phase==='run'&&observed.count===19);
      h.run('closeModal()');t.check('Cerrar borra estado y cancela intervalo',h.read('setTimerState')===null&&!h.intervals().includes(id));
      h.run('startSetTimer(0,0)');t.check('Al reabrir reinicia la preparación',h.read('setTimerState.phase')==='prep'&&h.read('setTimerState.count')===3);
      const c=t.h(),cid=timer(c);c.tick(cid,5);c.run('stopSetTimer(true)');
      t.control('Con callbacks puntuales Terminar antes escribe 5 s',c.read('db.active.exercises[0].sets[0].r')==='5');
      t.control('Terminar el timer no confirma automáticamente la serie',c.read('db.active.exercises[0].sets[0].done')!==true);
      const full=t.h(),fid=timer(full);full.tick(fid,20);t.control('20 callbacks completan un objetivo de 20 s',full.read('setTimerState')===null&&full.read('db.active.exercises[0].sets[0].r')==='20');
      const rest=t.h();rest.logged();const deadline=rest.read('restUntil');rest.setTime(deadline+1);rest.run('tickRest()');
      t.control('El descanso sí vence por reloj con una sola actualización',rest.read('restUntil')===null);
    });

  await scenario('F10','Cambiar en la cola cancela descanso; quitar ejercicio lo deja en el siguiente',[
    ref('ui.js','function uiSelectExercise('),ref('ui.js','function uiResetRest('),ref('index.html','function doRemoveSessionEx(')],
    'Navegación de estado mediante handlers reales y uiSession como texto. No mide navegación visual ni historial del navegador.',t=>{
      const h=t.h();h.logged();const before=h.read('restUntil');h.run('uiSessionQueue();uiSelectExercise(0)');
      t.check('Elegir el mismo ejercicio borra el descanso',before>h.now()&&h.read('restUntil')===null&&h.read('db.active.restUntil')===null);
      const c=t.h();c.logged();const cd=c.read('restUntil');c.run('uiSessionQueue();closeModal()');t.control('Cerrar la cola sin seleccionar conserva el descanso',c.read('restUntil')===cd);
      const r=t.h();r.run("db.routines[0].exercises.push({id:'ex-other',key:AUDIT_OTHER,name:'Remo de prueba'});exMeta(AUDIT_OTHER).equip='nada'");r.logged();const rd=r.read('restUntil');r.run('removeSessionEx(0);doRemoveSessionEx(false)');
      const got=r.read('({key:db.active.exercises[sessionOpenIdx()].key,uiRest:db.active.uiRest,rest:restUntil,done:db.active.exercises[0].sets.filter(x=>x.done).length})');t.observe('afterRemove',got);
      t.check('El siguiente ejercicio hereda descanso sin serie confirmada',got.key==='remo de prueba'&&got.rest===rd&&got.uiRest===true&&got.done===0);
      t.control('Quitar solo de la sesión conserva el día del plan',r.read('db.routines[0].exercises.length')===2);
    });

  await scenario('F12','Las etiquetas ocultan el sufijo que distingue máquinas',[
    ref('index.html','function exBaseName('),ref('ui.js','function uiSessionQueue(')],
    'Comprueba el texto generado; no hay colisión de claves ni borrado de ejercicios. No evalúa tamaño o truncado por CSS.',t=>{
      const h=t.h();h.run("db.routines[0].exercises=['Remo (Cable)','Remo (Discos)','Remo (2)'].map((name,i)=>({id:'variant-'+i,name,key:exKey(name)}));startSession('dia-a');uiSessionQueue()");
      const got=h.read('db.active.exercises.map(e=>({key:e.key,storedName:e.name,label:exBaseName(e.name)}))');t.observe('variants',got);
      t.check('Tres variantes terminan etiquetadas Remo',got.length===3&&got.every(e=>e.label==='Remo'));
      t.check('La cola omite los tres sufijos',!h.modal().includes('(Cable)')&&!h.modal().includes('(Discos)')&&!h.modal().includes('(2)'));
      t.control('Claves y nombres completos permanecen distintos',new Set(got.map(e=>e.key)).size===3&&new Set(got.map(e=>e.storedName)).size===3);
      t.control('Nombre sin paréntesis se conserva',h.read("exBaseName('Remo unilateral')")==='Remo unilateral');
    });

  await scenario('F13','Otra máquina se añade a todos los días y no a la sesión abierta',[
    ref('index.html','function promptDuplicateEx('),ref('index.html','function doDuplicateEx('),ref('index.html','function openExerciseByKey(')],
    'Formulario y navegación reales con inputs de memoria; el alcance de la mutación está limitado a la VM.',t=>{
      const h=t.h();h.run("startSession('dia-a');openExFromSession(0,'equipment');promptDuplicateEx(AUDIT_KEY,'Press de prueba')");
      const inp=h.nodes.get('dupname');assert.ok(inp,'Real form must contain dupname');inp.value='Press de prueba (Cable)';h.run('doDuplicateEx({preventDefault(){}})');
      const got=h.read('({routines:db.routines.map(r=>r.exercises.map(e=>e.name)),active:db.active.exercises.map(e=>e.name),view})');t.observe('after',got);
      t.check('La variante se añade a ambos días, incluso al de otro plan',got.routines.every(es=>es.includes('Press de prueba (Cable)')));
      t.check('No se añade a la sesión desde la que se inició',!got.active.includes('Press de prueba (Cable)'));
      t.check('La ficha de destino pierde from=session',got.view.name==='exercise'&&got.view.from!=='session');
      t.control('El original permanece en las dos rutinas y en la sesión',got.routines.every(es=>es.includes('Press de prueba'))&&got.active.includes('Press de prueba'));
      const count=h.read('db.routines[0].exercises.length');h.run("promptDuplicateEx(AUDIT_KEY,'Press de prueba')");h.nodes.get('dupname').value='Press de prueba (Cable)';h.run('doDuplicateEx({preventDefault(){}})');
      t.control('El mismo nombre se rechaza sin otra inserción',h.read('db.routines[0].exercises.length')===count&&h.modal().includes('Ese nombre ya existe'));
    });

  await scenario('F14','Crear Plancha no define el tipo tiempo y pide carga',[
    ref('ui.js','function uiLibraryAdd('),ref('index.html','function exMeta('),ref('index.html','function ensureWarmup(')],
    'La inferencia de tipo es una decisión UX: se reproduce el valor por defecto y el bloqueo de preparación, sin evaluar si todas las planchas deben ser temporizadas.',t=>{
      const h=t.h();h.run("uiLibrary('dia-a');uiLibraryAdd('Plancha');startSession('dia-a')");const xi=h.read('db.active.exercises.findIndex(e=>e.name===\'Plancha\')');
      const got=h.read('({meta:exMeta(exKey("Plancha")),warmup:ensureWarmup('+xi+')})');t.observe('created',got);
      t.check('Se asigna grupo core pero tipo normal y preparación setup',got.meta.type==='normal'&&got.meta.muscle==='core'&&got.warmup.phase==='setup');
      h.run("setExType(exKey('Plancha'),'tiempo')");const w=h.read('ensureWarmup('+xi+')');
      t.control('Elegir Tiempo manualmente permite preparación sin peso',w?.phase!=='setup');
      const c=t.h();c.run("uiLibrary('dia-a');uiLibraryAdd('Pull Up (Assisted)')");
      t.control('La inferencia específica para Assisted sí se ejecuta',c.read("exMeta(exKey('Pull Up (Assisted)')).type")==='asistido');
    });

  await scenario('F18','Rango incoherente y objetivo nuevo dejan reglas/propuesta desalineadas',[
    ref('index.html','function setExRange('),ref('index.html','function effRange('),ref('index.html','function setGoal('),ref('index.html','function refreshActiveSugg(')],
    'Dos subcasos: rango guardado frente a efectivo; propuesta creada por el motor antes/después de setGoal.',t=>{
      const h=t.h();h.run("go({name:'exercise',key:AUDIT_KEY,rid:'dia-a'});setExRange(AUDIT_KEY,'lo','10');setExRange(AUDIT_KEY,'hi','6')");
      const got=h.read('({stored:{lo:exMeta(AUDIT_KEY).lo,hi:exMeta(AUDIT_KEY).hi},effective:effRange(AUDIT_KEY)})');t.observe('range',got);
      t.check('Se guarda 10–6 pero se usa 10–11',got.stored.lo===10&&got.stored.hi===6&&got.effective.lo===10&&got.effective.hi===11);
      h.run("setExRange(AUDIT_KEY,'hi','12')");t.control('Un rango válido permanece 10–12',same(h.read('effRange(AUDIT_KEY)'),{lo:10,hi:12}));
      const g=t.h();g.run("db.history.push(auditHistory('h-a',40,10));startSession('dia-a')");const before=g.read('db.active.exercises[0].sugg');
      g.run("setGoal('fuerza')");const after=g.read('db.active.exercises[0].sugg'),range=g.read('effRange(AUDIT_KEY)');
      t.observe('goalChange',{before,after,range});t.check('La propuesta anterior permanece fuera del rango Fuerza',before!==null&&same(before,after)&&after.reps>range.hi);
      g.run('refreshActiveSugg(AUDIT_KEY)');const refreshed=g.read('db.active.exercises[0].sugg');t.observe('explicitRefresh',refreshed);
      t.control('El motor sí actualiza la propuesta al pedir refresco explícito',refreshed!==null&&!same(after,refreshed));
    });

  await scenario('F20','Editar historial deja récords almacenados obsoletos',[
    ref('index.html','function saveEditedSession('),ref('index.html','function migratePRs(')],
    'Se generan PR mediante migratePRs actual antes de editar. No usa una marca arbitraria inventada como causa.',t=>{
      const h=t.h();h.run("db.history=[auditHistory('prev',40,10,'dia-a',AUDIT_KEY,'2026-09-10T18:00:00Z'),auditHistory('current',100,10)];migratePRs(false)");const prior=h.read('db.history[1].prs');
      t.control('El motor produjo un récord para 100 × 10',Array.isArray(prior)&&prior.length===1&&prior[0].now>100);
      h.run("editSession('current');editVal(0,0,'w','10');saveEditedSession();migratePRs(false)");
      const got=h.read('({sets:db.history[1].entries[0].sets,prs:db.history[1].prs,e1rm:bestE1RM(db.history[1].entries[0].sets)})');t.observe('afterEdit',got);
      t.check('La carga se corrige a 10 y la marca antigua sigue intacta',got.sets[0].w===10&&same(got.prs,prior)&&got.prs[0].now>got.e1rm);
      h.run('for(const x of db.history)delete x.prs;migratePRs(false)');t.control('Recalcular sin el caché elimina ese falso récord',h.read('db.history[1].prs.length')===0);
    });

  await scenario('F21','Una descarga entra en referencias de fuerza y evolución',[
    ref('index.html','function bestMetricBefore('),ref('ui.js','function uiExerciseMetric('),ref('index.html','function bestAssistBefore(')],
    'Descarga sintética deliberadamente superior a la referencia anterior para hacer visible su inclusión. No predice que toda descarga suba las marcas.',t=>{
      const h=t.h();h.run("db.history=[auditHistory('regular',10,10,'dia-a',AUDIT_KEY,'2026-09-10T18:00:00Z'),{...auditHistory('deload',20,10),deload:true}]");
      const got=h.read('({reference:bestMetricBefore(AUDIT_KEY),regular:bestE1RM(db.history[0].entries[0].sets),metric:uiExerciseMetric(AUDIT_KEY)})');t.observe('withDeload',got);
      t.check('Referencia y evolución incluyen la descarga superior',got.reference>got.regular&&got.metric.best>got.regular);
      h.run('db.history.pop()');t.control('Retirar solo la descarga devuelve la referencia regular',near(h.read('bestMetricBefore(AUDIT_KEY)'),got.regular));
      const a=t.h();a.run("exMeta(AUDIT_KEY).type='asistido';db.history=[auditHistory('regular',40,10),{...auditHistory('deload',20,10),deload:true}]");
      t.control('El cálculo de récord asistido sí excluye descargas',near(a.read('bestAssistBefore(AUDIT_KEY)'),40));
    });

  await scenario('F22','Menos asistencia cuenta como regresión en fatiga',[
    ref('index.html','function systemicFatigue(')],
    'Solo la regla del aviso, no un diagnóstico físico. Dos asistidos mejoran con menos ayuda y dos normales permanecen iguales.',t=>{
      const h=t.h();h.run(`db.history=[];for(let i=0;i<4;i++){const k='fatigue-'+i;exMeta(k).type=i<2?'asistido':'normal';db.history.push(auditHistory('old-'+i,40,10,'dia-a',k,'2026-09-10T18:00:00Z'));db.history.push(auditHistory('new-'+i,i<2?30:40,10,'dia-a',k,'2026-09-13T18:00:00Z'));}`);
      const got=h.read('systemicFatigue()');t.observe('alert',got);t.check('La mejora asistida produce aviso 2 de 4 en regresión',got?.regressed===2&&got?.evaluated===4);
      h.run("for(const x of db.history)if(x.id.startsWith('new-'))x.entries[0].sets[0].w=40");t.control('Sin variación no hay aviso',h.read('systemicFatigue()')===null);
      h.run("for(const x of db.history)if(x.id.startsWith('new-'))x.entries[0].sets[0].w=50");t.control('La regla actual tampoco detecta más ayuda como regresión',h.read('systemicFatigue()')===null);
    });

  await scenario('F23','Abrir progreso desde recibo elige el primer día del ejercicio',[
    ref('ui.js','function uiOpenProgress('),ref('index.html','function openExerciseByKey('),ref('ui.js','function uiExerciseMetric(')],
    'La vuelta al recibo sí se conserva; el problema probado es el plan/rango usado dentro de la ficha.',t=>{
      const h=t.h();h.run("exMeta(AUDIT_KEY).type='asistido';db.splits[0].exconf[AUDIT_KEY]={lo:4,hi:6};db.splits[1].exconf[AUDIT_KEY]={lo:8,hi:12};db.history=[auditHistory('receipt-b',20,6,'dia-b')];db.history[0].entries[0].sets.push({w:40,r:10});go({name:'history',progressTab:'diary',historyQuery:'Día B'});uiOpenProgress(AUDIT_KEY,'receipt-b')");
      const got=h.read('({view,range:effRange(AUDIT_KEY),best:uiExerciseMetric(AUDIT_KEY).best})');t.observe('fromReceiptB',got);
      t.check('Recibo de B entra con rid A y mínimo de A',got.view.rid==='dia-a'&&got.range.lo===4&&got.best===20);
      t.control('Se conserva el recibo y la vista de retorno',got.view.receiptId==='receipt-b'&&got.view.historyReturn.historyQuery==='Día B');
      h.run("go({...view,rid:'dia-b'})");t.observe('correctContext',h.read('({range:effRange(AUDIT_KEY),best:uiExerciseMetric(AUDIT_KEY).best})'));
      t.control('Solo corregir el contexto cambia el mínimo válido a 40 kg',h.read('uiExerciseMetric(AUDIT_KEY).best')===40);
    });

  await scenario('F24','Sesión remota bloquea inicio local y reclamar requiere transporte',[
    ref('index.html','function startSession('),ref('sync.js','function syncOfferContinue('),ref('sync.js','async function uiSyncClaim('),ref('sync-engine.js','async claim(device)')],
    'Engine y cifrado actuales, transporte totalmente en memoria. No prueba dos dispositivos reales, latencia ni disponibilidad del servicio.',async t=>{
      const h=t.h();h.run("startSession('dia-a');auditState.remote=HierroSyncCore.project(db,'other-device');db.active=null;syncForeign=HierroSyncCore.clone(auditState.remote.active);restUntil=null;save();startSession('dia-b')");
      t.check('Con sesión ajena no crea una sesión local nueva',h.read('db.active')===null&&h.modal().includes('Ya tienes una sesión abierta'));
      await h.run(`(async()=>{
        auditState.key=await HierroSyncCore.createKey();auditState.keys=await HierroSyncCore.keys(auditState.key);
        auditState.packet=await HierroSyncCore.seal(auditState.remote,auditState.keys);
        auditState.transport=[];auditState.offline=true;auditState.saved=null;
        hierroSync=new HierroSyncEngine.Engine({url:'https://audit.invalid',store:{async get(){return auditState.saved},async set(s){auditState.saved=HierroSyncCore.clone(s)}},
          adapter:{read:syncRead,apply:syncApply,notify(){}},fetch:async(_url,options)=>{
            auditState.transport.push(options.method);
            if(auditState.offline)throw new TypeError('Offline sintético');
            if(options.method==='PUT'){auditState.packet=options.body;auditState.revision++;}
            return {status:200,ok:true,headers:{get:()=>String(auditState.revision)},text:async()=>auditState.packet};
          }});
        auditState.revision=1;hierroSync.keys=auditState.keys;hierroSync.state={key:auditState.key,base:auditState.remote,revision:1,created:true,checkpoints:[]};
        await uiSyncClaim();
      })()`);
      t.observe('offline',{requests:h.read('auditState.transport'),active:h.read('db.active'),errorModal:h.modal().replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()});
      t.check('Reclamar sin transporte no desbloquea y muestra error',h.read('db.active')===null&&h.modal().includes('No se pudo traer la sesión')&&h.modal().includes('Sin conexión'));
      h.run('auditState.offline=false');await h.run('uiSyncClaim()');
      t.control('Mismo Engine con respuesta sintética válida transfiere la sesión',h.read('db.active?.routineId')==='dia-a'&&h.read('syncForeign')===null&&h.read('view.name')==='session');
      t.control('Transferencia usa GET y PUT, sin fetch real',same(h.read('auditState.transport'),['GET','GET','PUT'])&&h.evidence.blockedNetwork===0);
      const c=t.h();c.run("startSession('dia-b')");t.control('Sin sesión remota sí se puede iniciar localmente sin red',c.read('db.active.routineId')==='dia-b');
    });

  await scenario('F28','Aviso local ignora preferencias específicas de descanso e inactividad',[
    ref('index.html','function notify('),ref('index.html','function checkIdleSession('),ref('push-core.js','function schedule('),ref('push.js','function pushActive(')],
    'Notification es un receptor de memoria. Se comprueba decisión de emitir, no entrega del SO; rama fallback con permiso concedido y push no registrado.',t=>{
      const h=t.h();h.logged();h.document.visibilityState='hidden';h.run("db.settings.notify='on';pushPrefs.rest=false;pushPrefs.idle=false;pushRegistered=false");h.setTime(h.read('restUntil')+1);h.run('tickRest()');
      t.check('rest=false no evita el aviso local al vencer',h.evidence.notifications.some(n=>n.tag==='hierro-rest'));
      h.advance(16*60*1000);h.run('checkIdleSession()');t.check('idle=false no evita aviso local tras 15 min',h.evidence.notifications.some(n=>n.tag==='hierro-idle'));t.observe('fallbackNotifications',h.evidence.notifications);
      const n=h.evidence.notifications.length;h.document.visibilityState='visible';h.run("notify('audit-visible','body','audit')");t.control('Visible no emite',h.evidence.notifications.length===n);
      h.document.visibilityState='hidden';h.run("db.settings.notify='off';notify('audit-off','body','audit')");t.control('El interruptor global off sí impide emitir',h.evidence.notifications.length===n);
      h.run("auditState.snapshot={id:'synthetic',lastSetAt:Date.now(),rest:{kind:'rest',at:Date.now()+90000},next:{body:'Sintético'}}");
      t.control('El programador push sí respeta ambas preferencias false',h.read('HierroPushCore.schedule(auditState.snapshot,{rest:false,idle:false},Date.now()).length')===0);
      const jobs=h.read('HierroPushCore.schedule(auditState.snapshot,{rest:true,idle:true},Date.now())');t.observe('pushSchedule',jobs.map(j=>({kind:j.message.kind,secondsFromNow:(j.at-h.now())/1000})));
      t.control('Con preferencias activas programa descanso y recordatorio a 5 min',jobs.length===2&&jobs.some(j=>j.message.kind==='idle'&&j.at-h.now()===300000));
    });

  await scenario('F31','Restaurar respaldo no restaura el reloj de descanso en memoria',[
    ref('index.html','function applyBackup('),ref('sync.js','function syncConfirmRestore('),ref('sync.js','restUntil=db.active?.restUntil||null')],
    'Restauración local y rama vinculada. El checkpoint vinculado usa el Engine actual con almacén en memoria; no se sincroniza con un servidor.',async t=>{
      const h=t.h();h.logged();const backup=h.read('db');const deadline=backup.active.restUntil;
      h.run('db.active=null;restUntil=null;save()');h.importBackup(backup);h.run('window.__confirmFn()');
      const local=h.read('({activeRest:db.active.restUntil,globalRest:restUntil})');t.observe('localRestore',local);
      t.check('Restauración local deja deadline en db y reloj global null',local.activeRest===deadline&&local.globalRest===null);
      h.run('syncApply(HierroSyncCore.project(db,syncDevice))');t.control('syncApply normal sí repone el reloj',h.read('restUntil')===deadline);
      const c=t.h();c.ctx.auditBackup=backup;c.run(`
        hierroSync=new HierroSyncEngine.Engine({url:'',store:{async get(){return null},async set(s){auditState.checkpoint=HierroSyncCore.clone(s)}},adapter:{read:syncRead,apply:syncApply,notify(){}}});
        hierroSync.state={key:'synthetic-linked-marker-not-a-real-key',checkpoints:[]};
      `);
      c.importBackup(backup);c.run('window.__confirmFn()');await c.settle();
      const linked=c.read('({activeRest:db.active?.restUntil,globalRest:restUntil,checkpointCount:auditState.checkpoint?.checkpoints.length})');t.observe('linkedRestore',linked);
      t.check('La rama vinculada también deja el reloj global null',linked.activeRest===deadline&&linked.globalRest===null);
      t.control('Se ejecutó checkpoint real antes de restaurar',linked.checkpointCount===1);
      const old=t.h();old.logged();old.advance(5000);const current=old.read('restUntil');old.ctx.auditBackup=backup;old.run('window.__backup=auditBackup;applyBackup()');
      t.observe('restoreOverRest',old.read('({activeRest:db.active.restUntil,globalRest:restUntil})'));
      t.control('La restauración no toca la variable global ni si ya existía',old.read('restUntil')===current);
    });

  await scenario('NOTAS-GYM','Nota técnica global frente a configuración por gimnasio',[
    ref('index.html','function setExNotes('),ref('index.html','const MACHINE_FIELDS'),ref('index.html','function snapshotActiveGym('),ref('index.html','function applyGymMachines('),ref('sync-core.js','function project(')],
    'Persistencia local sintética, normalización y proyección/merge de sync. Verifica el alcance actual; no presupone que una nota técnica deba ser por gimnasio.',t=>{
      const h=t.h();h.run(`
        db.gyms[0].id='gym-a';db.gyms[0].name='Gym A sintético';db.settings.gymId='gym-a';
        exMeta(AUDIT_KEY).equip='placas';exMeta(AUDIT_KEY).stack={unit:'kg',start:5,step:5};
        db.gyms.push(normGym({id:'gym-b',name:'Gym B sintético',unit:'lb',machines:{[AUDIT_KEY]:{equip:'placas',stack:{unit:'lb',start:10,step:10}}}},'lb'));
        setExNotes(AUDIT_KEY,'Asiento 4 en A');setActiveGym('gym-b');
      `);
      const b=h.read('({note:exMeta(AUDIT_KEY).notes,unit:db.settings.unit,stack:exMeta(AUDIT_KEY).stack})');
      h.run("setExNotes(AUDIT_KEY,'Asiento 7 en B');setActiveGym('gym-a')");const a=h.read('({note:exMeta(AUDIT_KEY).notes,unit:db.settings.unit,stack:exMeta(AUDIT_KEY).stack})');
      t.observe('visitB',b);t.observe('returnA',a);
      t.check('La nota de A aparece en B y editarla en B cambia también A',b.note==='Asiento 4 en A'&&a.note==='Asiento 7 en B');
      t.control('Unidad y torre sí recuperan valores propios de cada gym',a.unit==='kg'&&a.stack.start===5&&a.stack.step===5&&b.unit==='lb'&&b.stack.start===10&&b.stack.step===10);
      h.run('db=load();auditState.project=HierroSyncCore.project(db,syncDevice)');
      const persistence=h.read('({note:db.exmeta[AUDIT_KEY].notes,globalNote:auditState.project.exmeta[AUDIT_KEY].notes,gyms:auditState.project.gyms.map(g=>({id:g.id,unit:g.unit,machine:g.machines[AUDIT_KEY]})),globalEquip:auditState.project.exmeta[AUDIT_KEY].equip||null})');t.observe('persistedAndProjected',persistence);
      t.check('Reload y sync mantienen una nota global y no la incluyen en machines',persistence.note==='Asiento 7 en B'&&persistence.globalNote===persistence.note&&persistence.gyms.every(g=>!Object.hasOwn(g.machine,'notes')));
      h.run(`auditState.base=HierroSyncCore.clone(auditState.project);auditState.local=HierroSyncCore.clone(auditState.base);auditState.remote=HierroSyncCore.clone(auditState.base);
        auditState.local.exmeta[AUDIT_KEY].notes='Edición local A';auditState.remote.exmeta[AUDIT_KEY].notes='Edición remota B';`);
      const conflicts=h.read('HierroSyncCore.merge(auditState.base,auditState.local,auditState.remote).conflicts.map(c=>c.path)');t.observe('concurrentNoteConflicts',conflicts);
      t.check('Editar la misma nota desde dos gimnasios entra en conflicto global',conflicts.some(p=>p.includes('/exmeta/')&&p.endsWith('/notes')));
      h.run(`auditState.local=HierroSyncCore.clone(auditState.base);auditState.remote=HierroSyncCore.clone(auditState.base);
        auditState.local.gyms[0].machines[AUDIT_KEY].stack.step=6;auditState.remote.gyms[1].machines[AUDIT_KEY].stack.step=12;`);
      t.control('Configuraciones distintas por gym se combinan sin conflicto',h.read('HierroSyncCore.merge(auditState.base,auditState.local,auditState.remote).conflicts.length')===0);
    });

  // Cross-cutting controls fail the run if isolation or source integrity breaks.
  const guardA=makeHarness(), guardB=makeHarness();
  guardA.run("setExNotes(AUDIT_KEY,'Only A')");
  const controls=[
    {label:'VMs y almacenamiento aislados',passed:guardB.read('exMeta(AUDIT_KEY).notes')===''},
    {label:'No se exponen require/process ni IndexedDB al código de app',passed:guardA.run("typeof require==='undefined'&&typeof process==='undefined'&&typeof indexedDB==='undefined'")},
    {label:'El stub DOM no inventa campos ausentes',passed:guardA.nodes.get('field-never-rendered')===undefined&&guardA.document.getElementById('field-never-rendered')===null},
    {label:'Sin inicialización de service worker, push o sync',passed:guardA.run("syncReady===false&&pushReady===false&&!('serviceWorker' in navigator)")},
    {label:'Proyección y validación de sync reales aceptan la base sintética',passed:guardA.run('!!HierroSyncCore.validate(HierroSyncCore.project(db,syncDevice))')},
    {label:'Ningún escenario intentó usar fetch/XHR/WebSocket reales',passed:contexts.every(h=>h.evidence.blockedNetwork===0)},
  ];
  // Explicitly probe the network guard only after the preceding zero-call check.
  try{await guardA.run('fetch("https://audit.invalid/guard-control")');}catch{}
  controls.push({label:'La sonda del guard de red se rechaza localmente',passed:guardA.evidence.blockedNetwork===1});
  const afterHashes=Object.fromEntries(FILES.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f)))]));
  controls.push({label:'Los siete archivos de aplicación conservan su SHA-256',passed:same(inputHashes,afterHashes)});
  const counts=Object.fromEntries(['reproduced','not_reproduced','harness_control_failed','harness_error'].map(k=>[k,cases.filter(c=>c.status===k).length]));
  const result={
    schema:'hierro-logic-audit-v1',auditDate:'2026-09-14',generatedAt:new Date().toISOString(),
    applicationVersion:guardA.read('APP_VERSION'),runtime:{node:process.version,platform:process.platform,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},
    root:ROOT,script:{file:path.basename(__filename),sha256:sha(fs.readFileSync(__filename))},
    sourceFiles:FILES.map(file=>({file,sha256:inputHashes[file],sha256After:afterHashes[file],bytes:raw[file].length})),
    scope:{requestedOriginalFindings:requested,executedOriginalFindings:cases.filter(c=>/^F\d+$/.test(c.id)).map(c=>Number(c.id.slice(1))),
      appFilesWritten:0,realDataRead:false,realNetwork:false,browserUsed:false,
      entryPoint:'Scripts clásicos actuales; se omite únicamente la IIFE final init del HTML.',
      stubs:['render general registra llamadas; F03 ejecuta uiHome real','DOM mínimo de campos por id; selectores complejos devuelven vacío y uiSetupModal no aplica decoración/foco','localStorage y FileReader de memoria','Date y scheduler manuales','Notification recolecta intención de aviso','fetch explícito del Engine F24 responde en memoria; el global rechaza toda petición','sin audio, Wake Lock, service worker, IndexedDB ni arranque push'],
      retained:'Se conservan las funciones de negocio, cálculos, importadores, go, apertura/cierre/confirmación de modal, preparación, registro, persistencia, adaptador sync y motor sync actuales.',
      limitations:['No reproduce foco, inert, teclados, gestos, CSS, tamaños, scroll real, retrasos del sistema ni entrega de notificaciones.','El timer demuestra qué ocurre si un callback se retrasa; no demuestra que ese retraso ocurra en un dispositivo concreto.','F03 prueba un respaldo mínimo inválido, no todos los archivos malformados.','F24 y F31 no usan un servicio remoto ni credenciales reales.','No se ejecutan las 37 capturas del usuario. Los hallazgos de navegador se documentan aparte.'],
      statusMeaning:'reproduced = el comportamiento auditado ocurrió y sus controles pasaron; no significa app correcta. harness_error/control_failed = no usar como evidencia del defecto.'},
    controls,summary:{requested:requested.length,executed:cases.length,includesNotesGym:true,caseControls:cases.reduce((n,c)=>n+c.controls.length,0),...counts,globalControlsPassed:controls.every(c=>c.passed)},cases,
  };
  const args=process.argv.slice(2),outIndex=args.indexOf('--out');
  const allowed=args.filter((_,i)=>i!==outIndex&&i!==outIndex+1||outIndex<0);
  assert.ok(allowed.every(a=>a==='--summary'),'Usage: node logic-repro.cjs [--summary] [--out new-name.json]');
  const json=JSON.stringify(result,null,2)+'\n';
  if(outIndex>=0){
    const name=args[outIndex+1];assert.ok(name&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(name),'--out must be a new JSON basename');
    const target=path.resolve(AUDIT_DIR,name);assert.equal(path.dirname(target),AUDIT_DIR);
    fs.writeFileSync(target,json,{flag:'wx'});
  }
  if(args.includes('--summary'))console.log(JSON.stringify({summary:result.summary,controls,cases:cases.map(({id,status,error,checks,controls:cc})=>({id,status,...(error?{error}:{}),failed:[...checks,...cc].filter(x=>!x.passed)}))},null,2));
  else process.stdout.write(json);
  if(!controls.every(c=>c.passed)||cases.some(c=>c.status!=='reproduced'))process.exitCode=1;
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
