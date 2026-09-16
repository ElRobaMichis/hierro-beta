#!/usr/bin/env node
/* =====================================================================
   Suite de tests de Hierro — correr con:  node tests/run.js
   Extrae el JS de index.html, simula el entorno del navegador y
   verifica el motor de sugerencias, unidades, edición de historial,
   importación de Hevy y utilidades. Sin dependencias externas.
   NOTA: sin 'use strict' a propósito — el eval() directo en modo sloppy
   filtra las funciones de la app a este scope, que es lo que queremos.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

/* ---------- stubs de navegador ---------- */
global.localStorage = {
  _d: {},
  getItem(k){ return this._d[k] ?? null; },
  setItem(k, v){ this._d[k] = v; },
  removeItem(k){ delete this._d[k]; }
};
const els = {};
global.document = {
  getElementById(id){
    if(!els[id]) els[id] = { innerHTML:'', style:{}, value:'', click(){}, focus(){}, insertAdjacentHTML(){} };
    return els[id];
  },
  addEventListener(){},
  createElement(){ return { click(){}, remove(){} }; },
  body: { appendChild(){} },
  visibilityState: 'hidden'
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { serviceWorker: { ready: Promise.resolve({
    showNotification(t){ shownNotifications.push(t); return Promise.resolve(); }
  }) } }
});
let shownNotifications = [];
global.Notification = class {
  static permission = 'granted';
  constructor(t){ shownNotifications.push('ctor:' + t); }
};
global.Blob = class { constructor(){} };
global.URL = { createObjectURL(){ return 'blob:x'; }, revokeObjectURL(){} };
/* FileReader que lee el "archivo" como contenido directo (string) */
global.FileReader = class {
  readAsText(content){ this.result = content; this.onload(); }
};
global.window = global;

/* ---------- cargar la app ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
code = code
  .replace(/\(function init\(\)\{[\s\S]*?\}\)\(\);/, '')
  .replace(/^\s*'use strict';/, '')
  .replace("let db = load();", 'globalThis.db = load();')
  .replace("let view = { name:'home' };", "globalThis.view = { name:'home' };")
  .replace('let timerInt = null;', 'globalThis.timerInt = null;')
  .replace(/let restUntil = [^\n]+/, 'globalThis.restUntil = null;')
  .replace('let updateReady = false, updateDismissed = false;',
           'globalThis.updateReady = false; globalThis.updateDismissed = false;')
  /* los const del módulo no se filtran del eval: se exponen a propósito */
  + '\nglobalThis.APP_VERSION = APP_VERSION; globalThis.LS_KEY = LS_KEY;';
eval(fs.readFileSync(path.join(__dirname, '..', 'push.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'ui.js'), 'utf8') + '\n' + code);
window.scrollTo = () => {};

/* ---------- mini-framework ---------- */
let pass = 0, fail = 0, section = '';
function suite(name){ section = name; console.log('\n── ' + name + ' ──'); }
function chk(cond, msg){
  if(cond){ pass++; console.log('  OK  ' + msg); }
  else { fail++; console.log('  ❌  ' + msg); }
}
function resetDB(){
  db.routines = []; db.history = []; db.progress = {}; db.exmeta = {}; db.active = null;
  db.settings.goal = 'hipertrofia'; db.settings.unit = 'kg';
  db.settings.fatigueDismissed = null; db.settings.rirDismissed = null;
  dayCounter = 0;
}
let dayCounter = 0;
const S = (w, r, rir) => rir === undefined ? { w, r } : { w, r, rir };
/* Fixture histórica: estos tests de cálculos representan series ya confirmadas.
   Los recorridos de borrador → registrar se prueban aparte sin este helper. */
function confirmFixtureSets(){
  for(const ex of db.active?.exercises||[])for(const st of ex.sets)if(uiValidSet(ex.key,st))st.done=true;
}
function fixtureEntries(){confirmFixtureSets();return collectEntries(db.active);}
/* Existing working-set scenarios begin after the real guided preparation.
   Advance a fake wall clock through its rests; never mark work as confirmed. */
function prepareFixture(xi){
  const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
  try{
    let tries=0;
    while(warmupRequired(xi)){
      if(++tries>12)throw new Error('Warmup fixture failed to advance');
      const w=ensureWarmup(xi);
      if(w.phase==='setup')throw new Error('Warmup fixture needs a target');
      if(w.phase==='set'){
        if(w.plan.steps[w.completed].seconds){uiWarmupTimedStart(xi,w.id,w.completed);clock=w.holdUntil;}
        uiWarmupRecord(xi,w.id,w.completed);
      }else if(w.phase==='rest'){clock=w.restUntil;uiWarmupNext(xi,w.id,w.completed);}
    }
  }finally{Date.now=realNow;}
}
/* sesión reciente (últimos ~4 días) para no activar el ajuste por pausas */
function sess(key, sets, daysAgo){
  const date = daysAgo !== undefined
    ? new Date(Date.now() - daysAgo * 864e5).toISOString()
    : new Date(Date.now() - 4 * 864e5 + (dayCounter++) * 36e5).toISOString();
  const rec = { id: uid(), routineName: 'T', date, duration: 60, entries: [{ key, name: key, sets }] };
  db.history.push(rec);
  db.history.sort((a, b) => a.date < b.date ? -1 : 1);
  updateProgress(key, sets, date);
  return rec;
}

/* =====================================================================
   MOTOR: doble progresión
   ===================================================================== */
suite('Motor — doble progresión');
resetDB();
sess('banca', [S(40,12), S(40,12), S(40,12)]);
let s = computeSuggestion('banca');
chk(s.type === 'up' && s.w === 42.5, 'tope del rango → subir peso (40 → 42,5)');
resetDB();
sess('banca', [S(42.5,9), S(42.5,8), S(42.5,8)]);
s = computeSuggestion('banca');
chk(s.type === 'reps' && s.reps === 10, 'dentro del rango → +1 rep');
resetDB();
sess('banca', [S(40,12), S(40,12)]);            /* base */
sess('banca', [S(42.5,7), S(42.5,6)]);          /* fallo 1 (tras subir) */
s = computeSuggestion('banca');
chk(s.type === 'hold', 'bajo el rango → consolidar');
sess('banca', [S(42.5,7), S(42.5,6)]);          /* fallo 2 */
s = computeSuggestion('banca');
chk(s.type === 'deload' && s.w < 42.5, '2 fallos → deload ~5%');
resetDB();
sess('press', [S(40,12), S(40,12)]);
sess('press', [S(42.5,7), S(42.5,6)]);
chk(Math.abs(db.progress['press'].inc - 0.0175) < 1e-9, 'falla tras subir → incremento adaptativo baja (2,5% → 1,75%)');
resetDB();
const same = [S(30,9), S(30,9)];
sess('curl', same); sess('curl', same); sess('curl', same); sess('curl', same);
s = computeSuggestion('curl');
chk(db.progress['curl'].stall >= 3 && s.sets === 3, 'estancado 3+ sesiones → serie extra');

suite('Motor — tolerancia y consolidación de series');
resetDB();
sess('jalon', [S(40,12), S(40,10), S(40,9), S(40,6)]);
s = computeSuggestion('jalon');
chk(s.type === 'reps', 'con 4+ series la peor no cuenta (12/10/9/[6])');
resetDB();
sess('aperturas', [S(15,12), S(15,10), S(15,6)]);
chk(computeSuggestion('aperturas').type === 'hold', 'con 3 series sigue estricto');
resetDB();
sess('curl polea', [S(10,12), S(10,12), S(10,12), S(10,12), S(10,12), S(10,12)]);
s = computeSuggestion('curl polea');
chk(s.type === 'up' && s.w === 11 && s.sets === 4, '6 series planas al tope → subir peso en 4 series');
resetDB();
sess('remo m', [S(30,10), S(30,10), S(30,9), S(30,10), S(30,10)]);
s = computeSuggestion('remo m');
chk(s.type === 'up' && s.sets === 3 && s.msg.includes('Concentra'), '5 planas en rango → concentrar: más peso, 3 series');
resetDB();
sess('militar', [S(20,12), S(20,10), S(20,8), S(20,7), S(20,6)]);
s = computeSuggestion('militar');
chk(s.type === 'hold' && s.sets === 3, '5 series con derrumbe → mismo peso, 3 series');

suite('Motor — tipos corporal y asistido');
resetDB();
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,12), S(0,12), S(0,12)]);
s = computeSuggestion('dominadas');
chk(s.w === 0 && s.reps === 13, 'corporal al tope → +reps, nunca kg');
resetDB();
exMeta('fondos a').type = 'asistido';
sess('fondos a', [S(25,12), S(25,12), S(25,12)]);
s = computeSuggestion('fondos a');
chk(s.type === 'up' && s.w < 25, 'asistido al tope → MENOS ayuda');
sess('fondos a', [S(22.5,9), S(22.5,8), S(22.5,8)]);
chk(db.progress['fondos a'].fail === 0, 'asistido: bajar ayuda sosteniendo rango = éxito');
resetDB();
exMeta('chin a').type = 'asistido';
sess('chin a', [S(2,12), S(2,12)]);
chk(computeSuggestion('chin a').w === 0, 'ayuda ≤2,5 kg al tope → probar sin asistencia');

suite('Motor — RIR');
resetDB();
sess('inclinado', [S(30,12,4), S(30,12,4), S(30,12,3)]);
s = computeSuggestion('inclinado');
chk(s.type === 'up' && s.w > Math.round(30*1.025*2)/2, 'RIR alto al tope → salto mayor');
resetDB();
sess('martillo', [S(12,9,5), S(12,9,4)]);
s = computeSuggestion('martillo');
chk(s.type === 'up' && s.w > 12, 'RIR 4+ dentro del rango → subir ya');
resetDB();
sess('remo b', [S(50,10), S(50,9)]);
chk(computeSuggestion('remo b').type === 'reps', 'sin RIR funciona igual (opcional)');

suite('Motor — vuelta tras pausa');
resetDB();
sess('banca', [S(60,12), S(60,12)], 10);
chk(computeSuggestion('banca').type === 'up', '10 días → progresión normal');
resetDB();
sess('banca', [S(60,12), S(60,12)], 20);
s = computeSuggestion('banca');
chk(s.type === 'back' && s.w === 55, '20 días → -7,5% (60 → 55)');
resetDB();
sess('banca', [S(60,12), S(60,12), S(60,12)], 40);
s = computeSuggestion('banca');
chk(s.type === 'back' && s.w === 50 && s.sets === 2, '40 días → -15% y una serie menos');
resetDB();
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,12)], 30);
chk(computeSuggestion('dominadas').reps === 10, 'corporal 30 días → menos reps objetivo');
resetDB();
exMeta('fondos a').type = 'asistido';
sess('fondos a', [S(20,12)], 30);
chk(computeSuggestion('fondos a').w > 20, 'asistido 30 días → MÁS ayuda');

suite('Motor — rango y salto personalizados');
resetDB();
Object.assign(exMeta('plancha'), { lo: 15, hi: 25 });
sess('plancha', [S(10,25), S(10,25)]);
s = computeSuggestion('plancha');
chk(s.type === 'up' && s.reps === 15, 'rango custom 15–25 respetado');
Object.assign(exMeta('gemelos'), { lo: 20, hi: 10 });
chk(effRange('gemelos').hi > effRange('gemelos').lo, 'rango inválido (lo>hi) se corrige');
resetDB();
exMeta('mancuernas').step = 2;
sess('mancuernas', [S(16,12), S(16,12)]);
chk(computeSuggestion('mancuernas').w === 18, 'salto custom 2 kg: 16 → 18');

/* =====================================================================
   UNIDADES kg/lb
   ===================================================================== */
suite('Unidades');
resetDB();
db.settings.unit = 'lb';
db.routines.push({ id:'r1', name:'G', exercises:[{ id:'e1', name:'Bench', key:'bench' }] });
startSession('r1');
db.active.exercises[0].sets[0] = { w:'100', r:'12', rir:'' };
let ent = fixtureEntries();
chk(Math.abs(ent[0].sets[0].w - 45.359) < 0.001, '100 lb escritas → 45,359 kg guardados');
chk(fmtW(ent[0].sets[0].w) === '100', 'round-trip exacto: se muestra "100" de vuelta');
confirmFixtureSets();finishSession();
s = computeSuggestion('bench');
chk(fmtW(s.w) === '105' && s.msg.includes('lb'), 'sugerencia limpia en discos lb (100 → 105)');
db.settings.unit = 'kg';
chk(computeSuggestion('bench').msg.includes('kg'), 'mismos datos vistos en kg');
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'10', rir:'' };
setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '44.09', 'cambio a mitad de sesión convierte lo escrito');
setUnit('kg');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 20) < 0.01, 'y de vuelta sin deriva');
db.active = null;
chk(Math.abs(epley(60,10) - 80) < 0.01 && epley(0,15) === 0, 'Epley: 60×10 = 80; corporal = 0');

/* =====================================================================
   EDICIÓN DE SESIONES (agregar/quitar series)
   ===================================================================== */
suite('Editar sesión');
resetDB();
let rec = sess('banca', [S(60,10), S(60,10), S(60,9)]);
editSession(rec.id);
chk(window.__edit.entries[0].sets.length === 3, 'modal abre con las 3 series');
editAddSet(0);
chk(window.__edit.entries[0].sets.length === 4 &&
    window.__edit.entries[0].sets[3].w === '60' && window.__edit.entries[0].sets[3].r === '9',
    'agregar serie: prellenada con la última (60×9)');
saveEditedSession();
chk(db.history.find(h => h.id === rec.id).entries[0].sets.length === 4, 'la serie agregada quedó guardada');
chk(computeSuggestion('banca').sets === 4, 'el coach ahora sugiere 4 series');

editSession(rec.id);
editRemoveSet(0, 3); editRemoveSet(0, 2);
saveEditedSession();
chk(db.history.find(h => h.id === rec.id).entries[0].sets.length === 2, 'quitar series funciona');

resetDB();
rec = sess('sentadilla', [S(300,10), S(100,10)]);   /* 300 = error de dedo */
editSession(rec.id);
editVal(0, 0, 'w', '100');
saveEditedSession();
chk(db.history.find(h => h.id === rec.id).entries[0].sets[0].w === 100, 'corregir un valor (300 → 100)');
chk(computeSuggestion('sentadilla').w <= 105, 'las sugerencias se recalculan con el dato corregido');

/* regresión del bug de lb: guardar SIN tocar no corrompe */
resetDB();
db.settings.unit = 'lb';
rec = sess('squat', [S(42.5,10), S(42.5,9)]);
editSession(rec.id);
saveEditedSession();   /* sin tocar nada */
let w0 = db.history.find(h => h.id === rec.id).entries[0].sets[0].w;
chk(Math.abs(w0 - 42.5) < 0.05, 'lb: guardar sin tocar no re-convierte (queda ' + w0 + ' kg)');
db.settings.unit = 'kg';

/* vaciar un ejercicio lo saca de la sesión; vaciar todo ofrece borrarla */
resetDB();
rec = sess('a', [S(10,10)]);
db.history[0].entries.push({ key:'b', name:'b', sets:[ S(20,8) ] });
editSession(rec.id);
editRemoveSet(0, 0);
saveEditedSession();
chk(db.history[0].entries.length === 1 && db.history[0].entries[0].key === 'b',
    'vaciar un ejercicio lo quita de la sesión');
editSession(rec.id);
editRemoveSet(0, 0);
saveEditedSession();
chk(els['modalhost'].innerHTML.includes('Borrar la sesión'), 'vaciar todo → ofrece borrar la sesión');
window.__confirmFn();
chk(db.history.length === 0, 'confirmar la borra y recalcula');

/* =====================================================================
   IMPORTACIÓN DESDE HEVY
   ===================================================================== */
suite('Importar Hevy');
const CSV_KG = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Bench Press (Barbell)",,"",0,"normal",60,10,,,8
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Bench Press (Barbell)",,"",1,"warmup",20,10,,,
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Pull Up (Assisted)",,"",0,"normal",25,8,,,
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Hanging Leg Raise",,"",0,"normal",,12,,,`;
const CSV_LB = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"
"Upper","5 Jul 2026, 10:00","5 Jul 2026, 11:00","","Bench Press (Barbell)",,"",0,"normal",60,10,,,
"Upper","5 Jul 2026, 10:00","5 Jul 2026, 11:00","","Lat Pulldown (Cable)",,"",0,"normal",80,12,,,`;
resetDB();
importHevy(CSV_KG);
applyHevyImport();
chk(db.history.length === 1 && db.routines.length === 1, 'CSV en kg: 1 sesión, 1 rutina creada');
let e0 = db.history[0].entries.find(e => e.key === 'bench press (barbell)');
chk(e0.sets.length === 1 && e0.sets[0].w === 60 && e0.sets[0].rir === 2, 'warmup omitido; RPE 8 → RIR 2');
chk(exMeta('pull up (assisted)').type === 'asistido', '"(Assisted)" → tipo asistido');
chk(exMeta('hanging leg raise').type === 'corporal', 'sin peso → corporal');
chk(exMeta('hanging leg raise').muscle === 'core', 'grupo muscular adivinado (leg raise → core)');
importHevy(CSV_KG);
chk(els['modalhost'].innerHTML.includes('Nada nuevo'), 're-importar no duplica');

resetDB();
importHevy(CSV_LB);
chk(els['modalhost'].innerHTML.includes('libras'), 'CSV en lb: detecta la unidad y avisa');
applyHevyImport();
e0 = db.history[0].entries.find(e => e.key === 'bench press (barbell)');
chk(Math.abs(e0.sets[0].w - 27.216) < 0.01, '60 lb → 27,2 kg canónicos');

/* auto-reparación de un import viejo sin pesos */
resetDB();
db.history.push({ id:'old', hevyKey:'Upper|5 Jul 2026, 10:00', routineId:null, routineName:'Upper',
  date:new Date(2026,6,5,10,0).toISOString(), duration:3600,
  entries:[{ key:'bench press (barbell)', name:'Bench Press (Barbell)', sets:[S(0,10)] }] });
db.exmeta['bench press (barbell)'] = { type:'corporal', lo:null, hi:null, step:null, notes:'', rest:null, muscle:'pecho' };
importHevy(CSV_LB);
chk(els['modalhost'].innerHTML.includes('reparar'), 'sesión corrupta detectada → ofrece reparar');
applyHevyImport();
e0 = db.history.find(h => h.id === 'old').entries[0];
chk(Math.abs(e0.sets[0].w - 27.216) < 0.01 && db.exmeta['bench press (barbell)'].type === 'normal',
    'reparada: pesos restaurados y tipo corregido');

/* =====================================================================
   UTILIDADES
   ===================================================================== */
suite('Utilidades');
resetDB();
const junk = normalize({ routines:'x', history:null, settings:{ goal:'fuerza' } });
chk(Array.isArray(junk.routines) && junk.settings.rest === 'auto' && junk.settings.unit === 'kg',
    'normalize repara un respaldo roto');
db.settings.goal = 'fuerza';
chk(restSecs() === 180, 'descanso auto fuerza = 3:00');
exMeta('sentadilla').rest = 240;
chk(restSecs('sentadilla') === 240 && restSecs('curl') === 180, 'descanso por ejercicio gana al global');
db.settings.goal = 'hipertrofia';

resetDB();
exMeta('press banca').muscle = 'pecho';
exMeta('sentadilla2').muscle = 'pierna'; Object.assign(exMeta('sentadilla2'), { lo:4, hi:6 });
db.routines.push({ id:'r1', name:'F', exercises:[
  { id:'a', name:'Press banca', key:'press banca' },
  { id:'b', name:'Sentadilla2', key:'sentadilla2' }] });
startSession('r1');
db.active.exercises[0].sets[0].w = '60';
db.active.exercises[1].sets[0].w = '100';
let wp = warmupPlan(0);
chk(wp.rows.length === 2 && wp.rows[0].includes('32,5') && wp.rows[1].includes('47,5 kg × 4'), 'calentamiento hipertrofia: 2 escalones (55%, 80%)');
wp = warmupPlan(1);
chk(wp.rows.length === 3 && wp.rows[2].includes('80'), 'calentamiento fuerza: 3 escalones hasta 80%');
db.active = null;

resetDB();
for(const [i, k] of ['a','b','c','d','e'].entries()){
  sess(k, [S(50,10)], 15);
  sess(k, [S(50, i < 3 ? 7 : 11)], 3);
}
let f = systemicFatigue();
chk(f && f.regressed === 3 && f.evaluated === 5, 'fatiga sistémica: 3/5 en retroceso → alerta');
dismissFatigue();
chk(systemicFatigue() === null, 'descartada 10 días');
resetDB();
sess('a', [S(50,10)], 15); sess('a', [S(50,7)], 3);
sess('b', [S(50,10)], 15); sess('b', [S(50,7)], 3);
chk(systemicFatigue() === null, 'muestra chica (2 ejercicios) no alerta');

resetDB();
db.routines.push({ id:'r1', name:'T', exercises:[{ id:'a', name:'Curl', key:'curl' }] });
sess('curl', [S(20,10)]);          /* e1RM 26,7 */
startSession('r1');
db.active.exercises[0].sets[0] = { w:'22', r:'10', rir:'' };
confirmFixtureSets();finishSession();
chk(els['modalhost'].innerHTML.includes('récord'), 'PR detectado (e1RM 26,7 → 29,3)');

db.settings.notify = 'on';
shownNotifications = [];
startSession('r1');
db.active.start = Date.now() - 16*60*1000;
checkIdleSession();
chk(db.active.idleNotified > 0, 'sesión olvidada 15+ min → recordatorio armado');
db.active = null;

resetDB();
sess('x1', [S(10,10,0), S(10,10,0), S(10,9,0), S(10,9,0)], 2);
sess('x1', [S(10,10,0), S(10,10,0), S(10,9,0), S(10,9,1)], 1);
f = failureHabit();
chk(f && f.failSessions === 2, 'hábito de fallo (RIR 0) en 2 sesiones → aviso');

chk(daysSinceBackup() === null, 'sin respaldo: null');
exportBackup();
chk(daysSinceBackup() === 0, 'exportar registra la fecha');

/* =====================================================================
   LOTE 1: tope de máquina, ejercicios por tiempo, ejercicio en sesión
   ===================================================================== */
suite('Tope de máquina (peso máximo disponible)');
resetDB();
exMeta('crunch maquina').cap = 100;
sess('crunch maquina', [S(95,12), S(95,12), S(95,12)]);
s = computeSuggestion('crunch maquina');
chk(s.type === 'up' && s.w === 97.5, 'bajo el tope: progresión normal (95 → 97,5)');
resetDB();
exMeta('crunch maquina').cap = 101;
sess('crunch maquina', [S(100,12), S(100,12)]);
s = computeSuggestion('crunch maquina');
chk(s.type === 'up' && s.w === 101 && s.msg.includes('tope'), 'salto parcial: clava el último salto en el tope (100 → 101)');
resetDB();
exMeta('press pecho m').cap = 100;
sess('press pecho m', [S(100,12), S(100,12), S(100,12)]);
s = computeSuggestion('press pecho m');
chk(s.type === 'reps' && s.w === 100 && s.reps === 13 && s.msg.includes('Tope'),
    'en el tope + rango lleno → reps abiertas (12 → 13), no kilos imposibles');
sess('press pecho m', [S(100,13,4), S(100,13,4), S(100,13)]);
s = computeSuggestion('press pecho m');
chk(s.w === 100, 'RIR alto en el tope NO dispara subida de peso');
for(let i = 0; i < 4; i++) sess('press pecho m', [S(100,14), S(100,14), S(100,14)]);
s = computeSuggestion('press pecho m');
chk(s.sets === 4, 'estancado en el tope → suma serie (volumen sigue disponible)');

suite('Ejercicios por tiempo');
resetDB();
exMeta('plancha').type = 'tiempo';
chk(effRange('plancha').lo === 20 && effRange('plancha').hi === 45, 'rango por defecto 20–45 s');
sess('plancha', [S(0,45), S(0,45), S(0,45)]);
s = computeSuggestion('plancha');
chk(s.type === 'up' && s.reps === 50 && s.w === 0 && s.msg.includes('s</b>'),
    'tope del rango → +5 s (45 → 50), nunca kg');
resetDB();
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,30), S(0,25)]);
s = computeSuggestion('plancha');
chk(s.type === 'reps' && s.reps === 35, 'dentro del rango → +5 s sobre el mejor (30 → 35)');
resetDB();
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,15), S(0,12)]);
chk(computeSuggestion('plancha').type === 'hold', 'bajo 20 s → consolidar');
resetDB();
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,40)], 20);
s = computeSuggestion('plancha');
chk(s.type === 'back' && s.reps === 35, 'vuelta tras pausa: 40 s → 35 s (redondeado a 5)');
resetDB();
exMeta('farmer').type = 'tiempo';
sess('farmer', [S(20,45), S(20,45)]);
s = computeSuggestion('farmer');
chk(s.w === 20 && s.reps === 50, 'con lastre: mantiene el peso, suma segundos');
exMeta('plancha').type = 'tiempo';
chk(fmtSet('farmer', {w:20, r:45}) === '20+45s' && fmtSet('plancha', {w:0, r:30}) === '30s',
    'formato: "20+45s" con lastre, "30s" sin él');
chk(bestMetricBefore('farmer') === 45, 'récord por tiempo = mejores segundos');
/* cronómetro de serie: abre modal y cancela sin dejar intervalos vivos */
db.routines.push({ id:'rt', name:'Core', exercises:[{ id:'p1', name:'Plancha', key:'plancha' }] });
startSession('rt');
prepareFixture(0);startSetTimer(0, 0);
chk(els['modalhost'].innerHTML.includes('Prepárate'), 'cronómetro: modal con cuenta de preparación');
stopSetTimer(false);
chk(els.modalhost.innerHTML.includes('Cancelar la medición'),'cancelar una medición pide confirmar');window.__confirmFn();
chk(els['modalhost'].innerHTML === ''&&!db.active.setTimer, 'cancelar cierra sin registrar');
db.active = null;
/* guardar con lastre en blanco → 0 */
exMeta('colgado').type = 'tiempo';
db.routines.push({ id:'rc', name:'C2', exercises:[{ id:'c1', name:'Colgado', key:'colgado' }] });
startSession('rc');
db.active.exercises[0].sets[0] = { w:'', r:'40', rir:'' };
chk(fixtureEntries()[0].sets[0].w === 0, 'tiempo: lastre en blanco = 0');
db.active = null;

suite('Agregar ejercicio a media sesión');
resetDB();
sess('press banca', [S(60,10), S(60,10)]);
db.routines.push({ id:'r1', name:'Torso', exercises:[{ id:'a', name:'Remo', key:'remo' }] });
startSession('r1');
window.__keepRoutine = false;
document.getElementById('sessnewex').value = 'press banca';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 2, 'ejercicio agregado a la sesión');
chk(db.active.exercises[1].sugg !== null && db.active.exercises[1].sugg.w > 0,
    'trae la progresión del historial (era de otra rutina)');
chk(db.routines[0].exercises.length === 1, '"solo por hoy": la rutina NO cambia');
document.getElementById('sessnewex').value = 'Press Banca';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 2 && els['modalhost'].innerHTML.includes('Ya está'),
    'duplicado bloqueado (ignora mayúsculas)');
window.__keepRoutine = true;
document.getElementById('sessnewex').value = 'Curl bíceps';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 3, 'segundo ejercicio agregado');
chk(db.routines[0].exercises.length === 2 && db.routines[0].exercises[1].key === 'curl biceps',
    '"guardar en rutina": la rutina crece');
const entries2 = (db.active.exercises[1].sets[0] = { w:'62.5', r:'10', rir:'' }, fixtureEntries());
chk(entries2.length === 1 && entries2[0].key === 'press banca', 'al guardar solo cuentan las series llenadas');
db.active = null;

/* =====================================================================
   LOTE 2: modo descarga, vs última sesión, PR asistidos, auto-copia
   ===================================================================== */
suite('Modo descarga');
resetDB();
sess('banca', [S(60,12), S(60,12), S(60,12), S(60,12)]);
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,10), S(0,10)]);
exMeta('fondos a').type = 'asistido';
sess('fondos a', [S(20,10), S(20,10)]);
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,40), S(0,40)]);
db.routines.push({ id:'r1', name:'Full', exercises:[
  { id:'a', name:'Banca', key:'banca' }, { id:'b', name:'Dominadas', key:'dominadas' },
  { id:'c', name:'Fondos a', key:'fondos a' }, { id:'d', name:'Plancha', key:'plancha' }] });
const incBefore = prog('banca').inc, failBefore = prog('banca').fail;
startSession('r1', true);
chk(db.active.deload === true, 'sesión marcada como descarga');
let dl = db.active.exercises[0].sugg;
chk(dl.msg.includes('Descarga') && dl.w < 62.5 && dl.sets === 2, 'normal: ~-10% de carga y mitad de series (4 → 2)');
chk(db.active.exercises[1].sugg.reps === 8, 'corporal: ~70% del objetivo del coach (11 → 8)');
chk(db.active.exercises[2].sugg.w > 20, 'asistido: MÁS ayuda en descarga');
chk(db.active.exercises[3].sugg.reps % 5 === 0 && db.active.exercises[3].sugg.reps < 45, 'tiempo: segundos reducidos y redondeados a 5');
db.active.exercises[0].sets[0] = { w:'55', r:'8', rir:'' };
db.active.exercises[0].sets[1] = { w:'55', r:'8', rir:'' };
confirmFixtureSets();finishSession();
chk(els['modalhost'].innerHTML.includes('Descarga guardada'), 'modal propio de descarga');
chk(db.history[db.history.length-1].deload === true, 'guardada con marca de descarga');
chk(prog('banca').inc === incBefore && prog('banca').fail === failBefore, 'NO toca el estado adaptativo');
s = computeSuggestion('banca');
chk(s.w === 62.5, 'la siguiente sugerencia retoma desde la sesión NORMAL (60 → 62,5), no desde la descarga');
chk(systemicFatigue() === null, 'la descarga no dispara la alarma de fatiga');
chk(!els['modalhost'].innerHTML.includes('Nuevo récord') && !els['modalhost'].innerHTML.includes('🏆'),
    'una descarga nunca compite por récords');

suite('vs última sesión (en vivo)');
resetDB();
sess('banca', [S(60,10), S(60,10)]);        /* volumen previo: 1200 */
db.routines.push({ id:'r1', name:'T', exercises:[{ id:'a', name:'Banca', key:'banca' }] });
startSession('r1');
chk(vsLastInfo(0) === null, 'sin series llenadas aún → sin chip');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
confirmFixtureSets();let vi = vsLastInfo(0);
chk(vi && vi.pct === 50 && !vi.beat, 'una serie de dos: 50 % del volumen previo');
db.active.exercises[0].sets[1] = { w:'62.5', r:'10', rir:'' };
confirmFixtureSets();vi = vsLastInfo(0);
chk(vi && vi.beat && vi.pct > 100, 'al superar el total anterior lo celebra');
db.active = null;
/* corporal compara reps, y asistido no muestra chip */
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,10), S(0,10)]);
db.routines.push({ id:'r2', name:'C', exercises:[{ id:'x', name:'Dominadas', key:'dominadas' }] });
startSession('r2');
db.active.exercises[0].sets[0] = { w:'', r:'21', rir:'' };
confirmFixtureSets();vi = vsLastInfo(0);
chk(vi && vi.beat, 'corporal: 21 reps superan las 20 previas');
db.active = null;
exMeta('jalon a').type = 'asistido';
sess('jalon a', [S(30,10)]);
db.routines.push({ id:'r3', name:'A', exercises:[{ id:'y', name:'Jalon a', key:'jalon a' }] });
startSession('r3');
db.active.exercises[0].sets[0] = { w:'25', r:'10', rir:'' };
chk(vsLastInfo(0) === null, 'asistido: sin chip (menos ayuda ≠ menos volumen)');
db.active = null;

suite('PR de asistidos');
resetDB();
exMeta('pull up a').type = 'asistido';
sess('pull up a', [S(25,10), S(25,9)]);
db.routines.push({ id:'r1', name:'T', exercises:[{ id:'a', name:'Pull up a', key:'pull up a' }] });
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'9', rir:'' };
confirmFixtureSets();finishSession();
chk(els['modalhost'].innerHTML.includes('récord') && els['modalhost'].innerHTML.includes('20'),
    'menos ayuda sosteniendo el rango = récord (25 → 20)');
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'4', rir:'' };   /* bajo el piso del rango */
confirmFixtureSets();finishSession();
chk(!els['modalhost'].innerHTML.includes('récord'), 'menos ayuda SIN llegar al rango no cuenta');
startSession('r1');
db.active.exercises[0].sets[0] = { w:'0', r:'8', rir:'' };
confirmFixtureSets();finishSession();
chk(els['modalhost'].innerHTML.includes('sin asistencia'), 'llegar a 0 kg de ayuda se celebra especial');
db.active = null;

/* =====================================================================
   EQUIPO DEL GIMNASIO Y CALCULADORA DE CARGA
   ===================================================================== */
suite('Equipo — detección por el nombre');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
chk(guessEquip('Squat (Barbell)') === 'barra', 'inglés de Hevy: "(Barbell)" → barra');
chk(guessEquip('Peso muerto rumano con barra') === 'barra', 'español: "con barra" → barra');
chk(guessEquip('Incline Bench Press (Dumbbell)') === 'mancuerna', '"(Dumbbell)" → mancuerna');
chk(guessEquip('Curl con mancuernas') === 'mancuerna', '"con mancuernas" → mancuerna');
chk(guessEquip('Leg Curl (Machine)') === 'placas', '"(Machine)" → torre de placas');
chk(guessEquip('Jalón en polea alta') === 'placas', '"polea" → torre de placas');
chk(guessEquip('Prensa de pierna') === 'discos', '"prensa" → discos que pones tú');
chk(guessEquip('Hack Squat') === 'discos', '"hack" → discos que pones tú');
chk(guessEquip('Smith Machine Squat') === 'barra', 'la multipower se carga con discos: barra gana a máquina');
chk(guessEquip('Sentadilla búlgara') === null, 'sin implemento en el nombre → sin equipo');

suite('Equipo — cargar la barra');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('squat').equip = 'barra';
let l = barLoad('squat', 72.5);
chk(l.bar.kg === 20 && l.total === 72.5 && l.exact, 'barra olímpica: 72,5 se arma exacto');
chk(Math.abs(l.perSide - 26.25) < 1e-9, '26,25 kg por lado');
chk(l.plates.length === 2 && l.plates.includes(25) && l.plates.includes(1.25),
    'elige la combinación con menos discos (25+1,25, no 20+5+1,25)');
l = barLoad('squat', 20);
chk(l.total === 20 && !l.plates.length, 'solo la barra cuando el peso es el de la barra');

/* un solo par de 25 → no puede poner dos por lado */
db.gym.plates = db.gym.plates.filter(p => p.kg === 25 || p.kg === 20);
db.gym.plates.find(p => p.kg === 25).pairs = 1;
db.gym.plates.find(p => p.kg === 20).pairs = 1;
invalidatePlates();
l = barLoad('squat', 110);   /* pediría 45 por lado = 25+20 */
chk(l.total === 110 && l.plates.length === 2, 'con un par de cada uno: 25+20 por lado');
l = barLoad('squat', 120);   /* haría falta 25+25 y solo hay un par */
chk(l.total === 110, 'no propone dos discos de 25 por lado si solo tienes un par');

resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('squat').equip = 'barra';
db.gym.plates = db.gym.plates.filter(p => p.kg !== 1.25);
invalidatePlates();
chk(plateMinStep(2) === 5, 'sin discos de 1,25 el salto mínimo pasa a 5 kg');
l = barLoad('squat', 72.5);
chk(l.total === 75 && !l.exact, 'lo que no se puede armar sube al más cercano (72,5 → 75)');

suite('Equipo — el coach solo propone pesos que existen');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.gym.plates = db.gym.plates.filter(p => [20,15,10,5].includes(p.kg));
invalidatePlates();
exMeta('sentadilla').equip = 'barra';
sess('sentadilla', [S(60,12), S(60,12), S(60,12)]);
s = computeSuggestion('sentadilla');
chk(effStep('sentadilla', 60) === 10, 'sin discos chicos, el salto automático es el par menor (10 kg)');
chk(s.w === 70, 'el salto respeta lo que se puede armar: 60 → 70');

resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.gym.plates = db.gym.plates.filter(p => [20,15,10,5,2.5].includes(p.kg));
invalidatePlates();
Object.assign(exMeta('sentadilla'), { equip:'barra', step:2.5 });
sess('sentadilla', [S(60,12), S(60,12), S(60,12)]);
s = computeSuggestion('sentadilla');
chk(s.wanted === 62.5 && s.w === 65, 'el salto pedía 62,5 (no armable) → 65');
chk(s.msg.includes('65') && !s.msg.includes('62,5'), 'el mensaje muestra el peso corregido');
chk(s.why.includes('Con tus discos'), 'y explica por qué cambió');

resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('polea').equip = 'placas';
sess('polea', [S(31,12), S(31,12)]);
s = computeSuggestion('polea');
chk(s.wanted === undefined, 'torre sin configurar: no se toca el peso');

suite('Equipo — mancuernas y barras alternativas');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
chk(nearestDumbbell(19) === 19, 'con la serie completa, 19 existe');
db.gym.dumbbells = db.gym.dumbbells.filter(d => d.kg !== 19);
chk(nearestDumbbell(19) === 20, 'sin el par de 19, lo más cercano por arriba es 20');

suite('Mancuernas — lo que anotas es el total de las dos');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();

let pl;
/* el caso del standing calf raise: 12 kg = dos mancuernas de 6 */
exMeta('calf raise').equip = 'mancuerna';
Object.assign(exMeta('calf raise'), { lo:15, hi:20 });
sess('calf raise', [S(12,20), S(12,20)]);
s = computeSuggestion('calf raise');
chk(s.w === 14, 'de 12 kg (dos de 6) el siguiente escalón es 14 (dos de 7), no 13');
chk(effStep('calf raise', 12) === 2, 'el salto es el hueco del rack × 2 manos');
pl = loadPlan('calf raise', 14);
chk(pl.dumbbell === 7 && pl.points === 2, 'y son dos mancuernas de 7');

/* el caso del incline bench: 20 kg = dos de 10, no dos de 20 */
exMeta('incline db').equip = 'mancuerna';
pl = loadPlan('incline db', 20);
chk(pl.total === 20 && pl.dumbbell === 10, '20 kg anotados = 2 × 10, no 2 × 20');
chk(pl.exact, 'y sale exacto porque el par de 10 existe');

/* totales imposibles se redondean al par que sí existe */
pl = loadPlan('incline db', 13);
chk(pl.total === 14 || pl.total === 12, '13 kg no se puede con dos mancuernas iguales: cae en 12 o 14');
chk(pl.total % 2 === 0, 'los totales con dos manos siempre son pares');

/* a una sola mano el total es la mancuerna */
exMeta('remo una mano').equip = 'mancuerna';
exMeta('remo una mano').points = 1;
pl = loadPlan('remo una mano', 22);
chk(pl.points === 1 && pl.total === 22 && pl.dumbbell === 22, 'a una mano, el total es esa mancuerna');
chk(effStep('remo una mano', 22) === 1, 'y el salto es el hueco del rack, sin multiplicar');

/* sin el par de 7, el coach no lo propone */
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.gym.dumbbells = db.gym.dumbbells.filter(d => d.kg !== 7);
exMeta('calf raise').equip = 'mancuerna';
Object.assign(exMeta('calf raise'), { lo:15, hi:20 });
sess('calf raise', [S(12,20), S(12,20)]);
s = computeSuggestion('calf raise');
chk(s.w === 16, 'sin el par de 7 salta al de 8: 12 → 16');
chk(s.why.includes('mancuernas'), 'y explica que fue por el rack');


resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('curl z').equip = 'barra';
exMeta('curl z').bar = 'ez';
chk(barFor('curl z').kg === 7, 'la barra fijada en el ejercicio gana a la predeterminada');
exMeta('curl z').bar = null;
chk(barFor('curl z').kg === 20, 'sin fijar, se usa la predeterminada');
db.gym.bars.forEach(b => { b.on = false; });
chk(barLoad('curl z', 60) === null, 'sin barras marcadas no se calcula nada (y no revienta)');

suite('Equipo — puntos de carga');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('prensa').equip = 'discos';
exMeta('prensa').points = 4;
chk(plateMinStep(4) === 5, 'con 4 pitones el salto mínimo es 5 kg (un 1,25 en cada uno)');
chk(plateMinStep(2) === 2.5, 'con 2 lados, 2,5 kg');
chk(plateMinStep(1) === 1.25, 'con 1 pitón, un disco suelto: 1,25 kg');
chk(maxPerPoint(2, 4) === 1, 'dos pares (4 discos) solo dan uno por pitón entre cuatro');
chk(maxPerPoint(2, 1) === 4, 'y los cuatro discos caben en un solo pitón');

pl = loadPlan('prensa', 145);
chk(pl.points === 4 && pl.total === 145, 'prensa de 4 pitones: 145 kg exactos');
chk(Math.abs(pl.perPointKg - 36.25) < 1e-9, '36,25 kg en cada pitón');
chk(pl.perPoint.length === 3, 'y son tres discos por pitón (25 + 10 + 1,25)');

exMeta('hipthrust').equip = 'discos';
exMeta('hipthrust').points = 1;
pl = loadPlan('hipthrust', 46.25);
chk(pl.points === 1 && pl.total === 46.25, 'un solo pitón: todo el peso va ahí');
chk(pl.perPoint.reduce((a,b) => a+b, 0) === 46.25, 'los discos suman el total, no la mitad');

exMeta('hipthrust').base = 15;   /* el aparato pesa 15 kg */
pl = loadPlan('hipthrust', 45);
chk(pl.base === 15 && pl.total === 45 && pl.perPointKg === 30, 'el peso del aparato se descuenta de los discos');

suite('Equipo — torres de placas');
const KGxLB = 0.45359237;
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('remo cable').equip = 'placas';
chk(loadPlan('remo cable', 50) === null, 'sin configurar la torre no se calcula nada');
chk(exUnit('remo cable') === 'kg', 'y la unidad sigue siendo la de la app');

Object.assign(exMeta('remo cable').stack, { unit:'lb', step:5, start:10 });
chk(exUnit('remo cable') === 'lb', 'la torre en libras manda sobre la unidad global');
chk(stackPreview('remo cable', 4).join(',') === '10,15,20,25', 'la vista previa sale de 5 en 5 desde 10');
let sn = stackSnap('remo cable', 27.2155);   /* 60 lb */
chk(sn.value === 60 && sn.index === 11, '60 lb es la placa 11');
chk(Math.abs(sn.kg - 27.2155) < 0.001, 'y por dentro se guardan sus kilos exactos');
sn = stackSnap('remo cable', 26);            /* 57,3 lb: entre 55 y 60 */
chk(sn.value === 55, 'un peso intermedio cae en la placa más cercana');
chk(Math.abs(effStep('remo cable', 30) - 5*KGxLB) < 1e-6, 'el salto del coach es el de la torre, en kg');

/* la misma máquina pero en kilos */
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('pulldown').equip = 'placas';
Object.assign(exMeta('pulldown').stack, { unit:'kg', step:5, start:5 });
chk(exUnit('pulldown') === 'kg', 'una torre en kilos se queda en kilos');
chk(stackSnap('pulldown', 47).value === 45, '47 kg cae en la placa de 45');
chk(effStep('pulldown', 40) === 5, 'y el salto del coach es 5 kg');

suite('Equipo — el coach en máquinas de placas');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('remo cable').equip = 'placas';
Object.assign(exMeta('remo cable').stack, { unit:'lb', step:5, start:10 });
const lb55 = Math.round(55 * KGxLB * 1000) / 1000;
sess('remo cable', [S(lb55,12), S(lb55,12), S(lb55,12)]);
s = computeSuggestion('remo cable');
chk(Math.abs(s.w - 60*KGxLB) < 0.001, 'de 55 lb el coach salta a 60 lb, no a un peso imposible');
chk(s.msg.includes('60'), 'y lo dice en libras, como la máquina');
chk(fmtSet('remo cable', { w:lb55, r:12 }) === '55×12', 'el historial de ese ejercicio también va en libras');

suite('Equipo — duplicar para otra máquina');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
Object.assign(exMeta('hip thrust'), { equip:'placas', muscle:'gluteos', lo:8, hi:12 });
db.routines.push({ id:'r1', name:'G', exercises:[{ id:'a', name:'Hip Thrust', key:'hip thrust' }] });
document.getElementById('dupname').value = 'Hip Thrust (Discos)';
window.__dupFrom = 'hip thrust';
window.__dupView = {name:'exercise',key:'hip thrust',rid:'r1'};
doDuplicateEx({ preventDefault(){} });
chk(!!db.exmeta['hip thrust (discos)'], 'se crea el ejercicio nuevo');
chk(exMeta('hip thrust (discos)').muscle === 'gluteos' && exMeta('hip thrust (discos)').lo === 8,
    'hereda grupo muscular y rango de reps');
chk(exMeta('hip thrust (discos)').equip === null, 'pero no el equipo: es otra máquina');
chk(db.routines[0].exercises.length === 2, 'y queda junto al original en la rutina');

suite('Navegación — volver donde te quedaste');
resetDB();
db.routines.push({ id:'r1', name:'T', exercises:[] });
db.routines.push({ id:'r2', name:'P', exercises:[] });
const saltos = [];
window.scrollTo = (x, y) => { saltos.push(y); window.scrollY = y; };
window.scrollY = 0;
go({ name:'home' });
window.scrollY = 640;                       /* bajas hasta el sexto ejercicio */
go({ name:'routine', id:'r1' });
chk(saltos[saltos.length-1] === 0, 'una pantalla nueva empieza arriba');
window.scrollY = 300;
go({ name:'exercise', key:'x', exname:'X', rid:'r1' });
chk(saltos[saltos.length-1] === 0, 'la ficha del ejercicio también');
go({ name:'routine', id:'r1' });
chk(saltos[saltos.length-1] === 300, 'al volver, la rutina retoma donde ibas');
go({ name:'home' });
chk(saltos[saltos.length-1] === 640, 'y el inicio recuerda la suya');
go({ name:'routine', id:'r2' });
chk(saltos[saltos.length-1] === 0, 'cada rutina lleva su propia memoria');
window.scrollTo = () => {};

suite('Mancuernas — el aviso');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('press db').equip = 'mancuerna';
chk(weightColLabel('press db', 'normal') === 'kg total', 'la columna del peso avisa: «kg total»');
exMeta('press db').points = 1;
chk(weightColLabel('press db', 'normal') === 'kg', 'a una mano no hace falta: es una sola');
exMeta('press db').points = 2;
exMeta('barra').equip = 'barra';
chk(weightColLabel('barra', 'normal') === 'kg discos', 'en barra la columna avisa: solo los discos');
chk(weightColLabel('press db', 'tiempo') === 'lastre', 'los ejercicios por tiempo siguen pidiendo lastre');

chk(dbNoticeHTML('press db').includes('total de las dos'), 'la primera vez sale el aviso completo');
chk(dbNoticeHTML('barra').includes('solo los discos'), 'y en barra sale el suyo: la barra se suma sola');
dismissDbNotice();
chk(dbNoticeHTML('press db') === '', 'una vez lo descartas, no vuelve');

suite('Splits — migración y rotación');
/* las rutinas viejas, sin split, se agrupan solas al cargar */
db = normalize({ routines:[
  { id:'a', name:'Torso', exercises:[] },
  { id:'b', name:'Pierna', exercises:[] },
  { id:'c', name:'Full Body', exercises:[] } ], history:[] });
chk(db.splits.length === 1 && db.splits[0].active, 'se crea un split y queda en curso');
chk(db.splits[0].name === 'Torso / Pierna / Full Body', 'toma el nombre de tus rutinas');
chk(db.routines.every(r => r.split === db.splits[0].id), 'y todas quedan dentro');

/* la rotación: el siguiente al último entrenado, dando la vuelta */
chk(nextDay().routine.name === 'Torso', 'sin historial, toca el primer día');
db.history.push({ id:'h1', routineId:'b', routineName:'Pierna',
  date:new Date(Date.now() - 2*864e5).toISOString(), duration:60, entries:[] });
let n = nextDay();
chk(n.routine.name === 'Full Body' && n.idx === 2, 'tras Pierna toca Full Body');
chk(n.last.name === 'Pierna' && n.total === 3, 'y dice qué hiciste antes');
db.history.push({ id:'h2', routineId:'c', routineName:'Full Body',
  date:new Date(Date.now() - 864e5).toISOString(), duration:60, entries:[] });
chk(nextDay().routine.name === 'Torso', 'al llegar al final, la rotación da la vuelta');
chk(daysAgoText(new Date(Date.now() - 864e5).toISOString()) === 'ayer', 'el texto del último día');

/* saltarse un día no rompe nada: cuenta desde el último entrenado */
db.history.push({ id:'h3', routineId:'a', routineName:'Torso', date:new Date().toISOString(), duration:60, entries:[] });
chk(nextDay().routine.name === 'Pierna', 'se cuenta desde lo que entrenaste, no del calendario');

suite('Splits — guardar, retomar y mover días');
const spA = db.splits[0].id;
document.getElementById('newsplit').value = 'PPL';
createSplit({ preventDefault(){} });
chk(db.splits.length === 2, 'se crea el split nuevo');
chk(activeSplit().name === 'PPL', 'y queda en curso');
chk(db.splits.find(x => x.id === spA).active === false, 'el anterior pasa a guardados sin perder nada');
chk(splitRoutines(spA).length === 3, 'sus días siguen ahí');
chk(nextDay() === null, 'un split sin días todavía no propone nada');

/* crear un día lo mete en el split en curso */
document.getElementById('newroutine').value = 'Push';
createRoutine({ preventDefault(){} });
chk(splitRoutines(activeSplit().id).length === 1, 'el día nuevo entra en el split en curso');
chk(nextDay().routine.name === 'Push', 'y pasa a ser el que toca');

/* mover un día de un split a otro */
const push = db.routines.find(r => r.name === 'Push');
const torso = db.routines.find(r => r.name === 'Torso');
window.__moveTo = activeSplit().id; window.__moveCopy = false;
doMoveRoutine(torso.id);
chk(torso.split === activeSplit().id, 'mover cambia el día de split');
chk(splitRoutines(spA).length === 2, 'y desaparece del anterior');

/* copiar lo deja en los dos */
window.__moveTo = spA; window.__moveCopy = true;
doMoveRoutine(push.id);
chk(splitRoutines(spA).length === 3, 'copiar añade una copia al destino');
chk(push.split === activeSplit().id, 'y el original se queda donde estaba');

/* retomar el guardado */
activateSplit(spA);
chk(activeSplit().id === spA, 'ponerlo en curso lo devuelve al inicio');
chk(db.splits.filter(x => x.active).length === 1, 'solo uno puede estar en curso');

/* reordenar los días */
const orden = () => splitRoutines(activeSplit().id).map(r => r.name).join(',');
const antes = orden();
moveRoutine(splitRoutines(activeSplit().id)[1].id, -1);
chk(orden() !== antes, 'los días se pueden reordenar');
chk(splitRoutines(activeSplit().id).length === 3, 'sin perder ninguno');

/* borrar un split se lleva sus días pero no el historial */
const nSes = db.history.length;
const otro = db.splits.find(x => !x.active).id;
window.__confirmFn = null;
deleteSplit(otro);
window.__confirmFn();
chk(!db.splits.some(x => x.id === otro), 'el split desaparece');
chk(db.routines.every(r => r.split !== otro), 'y sus días también');
chk(db.history.length === nSes, 'pero el historial queda intacto');

suite('Splits — cada día con lo suyo');
/* dos días con el mismo nombre en splits distintos no se roban sesiones */
resetDB();
db.splits = [{ id:'s1', name:'A', active:true, created:new Date().toISOString() },
             { id:'s2', name:'B', active:false, created:new Date().toISOString() }];
db.routines = [{ id:'ra', name:'Push', split:'s1', exercises:[] },
               { id:'rb', name:'Push', split:'s2', exercises:[] }];
db.history = [{ id:'hx', routineId:'ra', routineName:'Push', date:new Date().toISOString(), duration:60, entries:[] }];
chk(splitSessions('s1').length === 1, 'la sesión cuenta en el split del día que la generó');
chk(splitSessions('s2').length === 0, 'y no en el que solo comparte el nombre');
/* historial sin routineId (importado) sí cae por nombre */
db.history.push({ id:'hy', routineId:null, routineName:'Push', date:new Date().toISOString(), duration:60, entries:[] });
chk(splitSessions('s1').length === 2, 'el historial importado se atribuye por nombre');

suite('Torre de placas — el dibujo no miente');
resetDB();
exMeta('cable').equip = 'placas';
Object.assign(exMeta('cable').stack, { unit:'lb', step:5, start:2.5 });
chk(stackPreview('cable', 4).join(',') === '2.5,7.5,12.5,17.5', 'torre que empieza en 2,5 y sube de 5 en 5');
chk(stackSnap('cable', 17.5 * 0.45359237).index === 4, '17,5 lb es la placa 4');

/* el dibujo tiene que caber entero: si se recorta, el pin parece estar
   en otra placa — que es el fallo que se arregló */
function cabe(sel, total, h){
  const svg = stackSVG(sel, total, { h });
  const ys = [...svg.matchAll(/y="(-?[\d.]+)"[^>]*height="([\d.]+)"/g)];
  return ys.every(m => +m[1] >= -0.5 && +m[1] + +m[2] <= h + 0.5);
}
chk(cabe(4, 12, 104), 'cabe en el alto del calentamiento');
chk(cabe(4, 12, 140), 'cabe en el alto de la sesión');
chk(cabe(11, 15, 190), 'cabe en el alto del detalle');
chk(cabe(20, 24, 96), 'y aguanta torres largas en poco espacio');
chk(cabe(1, 12, 104), 'también con el pin en la primera placa');

/* el pin se dibuja dentro de la placa que toca */
function pinEnPlaca(sel, total, h){
  const svg = stackSVG(sel, total, { h });
  const rects = [...svg.matchAll(/<rect data-plate="\d+" x="[\d.]+" y="([\d.]+)" width="\d+" height="([\d.]+)"/g)]
    .map(m => [+m[1], +m[1] + +m[2]]);
  const cy = +/circle data-pin="true" cx="\d+" cy="([\d.]+)"/.exec(svg)[1];
  const i = rects.findIndex(([a, b]) => cy >= a && cy <= b);
  return i + 1;
}
chk(pinEnPlaca(4, 12, 104) === 4, 'el pin cae en la placa 4, no en otra');
chk(pinEnPlaca(1, 12, 104) === 1, 'y en la 1 cuando toca la primera');
chk(pinEnPlaca(12, 12, 104) === 12, 'y en la última cuando toca el final');
chk(cabe(50, 50, 106) && pinEnPlaca(50, 50, 106) === 50, 'torre de 50 placas: pin final visible dentro del alto de calentamiento');
chk(cabe(13, 50, 190) && pinEnPlaca(13, 50, 190) === 13, 'el indicador de placa 13 sigue en su posición real en una torre larga');

suite('Configurar sin parar la sesión');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.routines.push({ id:'r1', name:'Pierna', split:db.splits[0] && db.splits[0].id,
  exercises:[{ id:'a', name:'Leg Press', key:'leg press' }] });
sess('leg press', [S(100,12), S(100,12)]);
startSession('r1');
const sug0 = db.active.exercises[0].sugg.w;
chk(sug0 === 102.5, 'al empezar, sin configurar, sugiere el salto genérico');

/* se abre la ficha desde la sesión y se vuelve a ella */
openExFromSession(0);
chk(view.name === 'exercise' && view.from === 'session', 'la ficha se abre desde la sesión y recuerda el origen');
chk(view.key === 'leg press', 'y es la del ejercicio abierto');

/* configurarlo a media sesión recalcula la sugerencia de hoy */
setExEquip('leg press', 'discos');
setExPoints('leg press', 4);
chk(effPoints('leg press') === 4, 'queda como prensa de 4 pitones');
chk(db.active.exercises[0].sugg.w === 105, 'y la sugerencia de la sesión se recalcula al vuelo (102,5 → 105)');
chk(loadPlan('leg press', db.active.exercises[0].sugg.w).points === 4, 'la carga ya se reparte entre los 4');

/* una torre en libras convierte lo ya escrito */
resetDB();
db.routines.push({ id:'r2', name:'Torso', split:db.splits[0] && db.splits[0].id,
  exercises:[{ id:'b', name:'Cable Row', key:'cable row' }] });
startSession('r2');
db.active.exercises[0].sets[0].w = '20';          /* escrito en kg */
setExEquip('cable row', 'placas');
setExStack('cable row', 'unit', 'lb');
chk(exUnit('cable row') === 'lb', 'el ejercicio pasa a libras');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 44.09) < 0.1,
    'y los 20 kg ya escritos se convierten a 44,09 lb: siguen siendo el mismo peso');
setExStack('cable row', 'unit', 'kg');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 20) < 0.01, 'y de vuelta a 20 kg');
db.active = null;

suite('Actualizaciones — que se note, pero sin estorbar');
resetDB();
const toast = () => document.getElementById('toasthost').innerHTML;
updateReady = false; updateDismissed = false;
showUpdateToast();
chk(toast() === '', 'sin versión nueva no aparece nada');

updateReady = true;
showUpdateToast();
chk(toast().includes('Versión nueva lista'), 'cuando la hay, sale el aviso abajo');
chk(toast().includes('no se tocan'), 'y tranquiliza sobre los datos');
chk(toast().includes('Actualizar') && toast().includes('Ahora no'), 'con las dos salidas');

/* lo importante: durante una sesión no interrumpe */
db.routines.push({ id:'r1', name:'P', split:(db.splits[0]||{}).id, exercises:[{ id:'a', name:'Sq', key:'sq' }] });
startSession('r1');
showUpdateToast();
chk(toast() === '', 'con una sesión en curso se calla: ahí estorba');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
confirmFixtureSets();finishSession();
chk(toast().includes('Versión nueva lista'), 'y aparece en cuanto terminas la sesión');

dismissUpdate();
chk(toast() === '', '«Ahora no» lo quita');
chk(/^\d+\.\d+\.\d+$/.test(APP_VERSION), 'la versión sigue el formato MAYOR.MENOR.PARCHE');
chk(viewSettings().includes(APP_VERSION), 'y ajustes la enseña en el pie');
/* olvidar subir una de las dos es el fallo fácil: la caché quedaría vieja */
const swSrc = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
chk(new RegExp("const CACHE = 'hierro-" + APP_VERSION.replace(/\./g, '\\.') + "'").test(swSrc),
    'y el service worker usa esa misma versión para su caché');
updateReady = false; updateDismissed = false; showUpdateToast();

suite('Una sesión interrumpida no se pierde');
resetDB();
db.routines.push({ id:'r1', name:'Pierna', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Squat', key:'squat' }] });
startSession('r1');
db.active.start = Date.now() - 34*60*1000;      /* lleva 34 minutos */
setVal(0, 0, 'w', '60'); setVal(0, 0, 'r', '10'); setVal(0, 0, 'rir', '2');
prepareFixture(0);toggleSetDone(0, 0);
addSet(0);
setVal(0, 1, 'w', '60'); setVal(0, 1, 'r', '9');

/* «se cierra la app o entra una actualización»: se relee lo guardado,
   igual que hace la app al arrancar */
const enDisco = localStorage.getItem(LS_KEY);
db = normalize(JSON.parse(enDisco));
chk(!!db.active, 'al volver a abrir, la sesión sigue en curso');
chk(db.active.routineName === 'Pierna', 'con su rutina');
chk(db.active.exercises[0].sets.length === 2, 'y las series que llevaba');
chk(db.active.exercises[0].sets[0].w === '60' && db.active.exercises[0].sets[0].r === '10',
    'lo escrito, intacto');
chk(db.active.exercises[0].sets[0].done === true, 'incluida la serie que ya había cerrado');
chk(db.active.exercises[0].sets[1].r === '9', 'y la que estaba a medio anotar');
chk(Math.round((Date.now() - db.active.start)/60000) === 34,
    'el cronómetro sigue contando desde que empezó, no desde cero');

/* y se termina y se guarda como si nada hubiera pasado */
confirmFixtureSets();finishSession();
chk(db.history.length === 1, 'la sesión se guarda en el historial');
chk(db.history[0].entries[0].sets.length === 2, 'con sus dos series');
chk(db.active === null, 'y deja de estar en curso');

/* =====================================================================
   GIMNASIOS: plantillas de equipo por establecimiento
   ===================================================================== */
suite('Gimnasios — migración desde 1.0');
db = normalize({ routines:[], history:[], settings:{ unit:'lb' },
  gym:{ plates:[{ kg:10, pairs:2, on:true }] },
  exmeta:{ 'remo cable': { type:'normal', lo:null, hi:null, step:null, notes:'', rest:null,
    muscle:null, equip:'placas', bar:null, points:null, base:null,
    stack:{ unit:'lb', step:5, start:10 } } } });
chk(db.gyms.length === 1 && db.gyms[0].name === 'Mi gimnasio', 'el equipo de 1.0 pasa a ser el primer gimnasio');
chk(db.gym.plates.length === 1 && db.gym.plates[0].kg === 10 && db.gym.bars.length > 0,
    'db.gym sigue funcionando: apunta al gimnasio activo');
chk(exUnit('remo cable') === 'lb', 'las máquinas ya configuradas no se tocan');
chk(db.gym.unit === 'lb', 'y el gimnasio recuerda la unidad del usuario');
chk(JSON.parse(JSON.stringify(db)).gym === undefined, 'el respaldo no duplica: el equipo vive en db.gyms');

suite('Gimnasios — la configuración viaja con cada gimnasio');
resetDB();
db.gyms = [normGym({ name:'Forum Buenavista', unit:'kg' }, 'kg')];
db.settings.gymId = db.gyms[0].id;
invalidatePlates();
/* el caso real: lateral raise en polea, con la torre en libras */
exMeta('lateral raise polea').equip = 'placas';
Object.assign(exMeta('lateral raise polea').stack, { unit:'lb', step:5, start:5 });
chk(exUnit('lateral raise polea') === 'lb', 'en Forum la máquina va en libras');
const gymA = db.settings.gymId;

/* el gimnasio de la pareja: copia de Forum, y ahí la torre va en kilos */
window.__gymBase = 'copy';
document.getElementById('newgymname').value = 'Gym de mi pareja';
createGym({ preventDefault(){} });
chk(db.gyms.length === 2 && db.gym.name === 'Gym de mi pareja', 'crear un gimnasio te cambia ahí');
const gymB = db.settings.gymId;
chk(exUnit('lateral raise polea') === 'lb', 'la copia arranca igual que el original');
Object.assign(exMeta('lateral raise polea').stack, { unit:'kg', step:5, start:5 });
chk(exUnit('lateral raise polea') === 'kg', 'y se ajusta a la máquina de ese gimnasio');

setActiveGym(gymA);
chk(exUnit('lateral raise polea') === 'lb', 'volver a Forum devuelve las libras — sin reconfigurar nada');
setActiveGym(gymB);
chk(exUnit('lateral raise polea') === 'kg', 'y el otro sigue en kilos');

/* el inventario también es de cada gimnasio */
setActiveGym(gymA);
db.gym.plates = db.gym.plates.filter(p => Math.abs(p.kg - 1.25) > 1e-9); invalidatePlates();
chk(plateMinStep(2) === 5, 'en Forum ya no hay discos de 1,25: salto mínimo 5');
setActiveGym(gymB);
chk(db.gym.plates.some(p => Math.abs(p.kg - 1.25) < 1e-9), 'pero en el otro gimnasio siguen estando');
chk(plateMinStep(2) === 2.5, 'y su salto mínimo no se contagia');

/* cada gimnasio recuerda su unidad de vista */
setUnit('lb');
setActiveGym(gymA);
chk(db.settings.unit === 'kg', 'Forum se ve en kilos');
setActiveGym(gymB);
chk(db.settings.unit === 'lb', 'y el de la pareja en libras: cada uno con la suya');
setUnit('kg');

suite('Gimnasios — cambiar a media sesión');
db.routines.push({ id:'rg', name:'Hombro', split:(db.splits[0]||{}).id,
  exercises:[{ id:'x', name:'Lateral Raise Polea', key:'lateral raise polea' }] });
startSession('rg');
db.active.exercises[0].sets[0].w = '20';          /* escrito con la torre en kg */
setActiveGym(gymA);
chk(exUnit('lateral raise polea') === 'lb', 'en Forum el ejercicio pasa a libras');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 44.09) < 0.1,
    'los 20 kg ya escritos se convierten a 44,09 lb: el mismo peso');
setActiveGym(gymB);
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 20) < 0.01, 'y de vuelta sin deriva');
db.active = null;

suite('Gimnasios — desde cero y perfiles compartibles');
window.__gymBase = 'kg';
document.getElementById('newgymname').value = 'Gym vacío';
createGym({ preventDefault(){} });
chk(db.gym.name === 'Gym vacío' && stackConf('lateral raise polea') === null,
    'desde cero: la torre queda sin configurar');
chk(exMeta('lateral raise polea').equip === 'placas', 'pero el implemento se adivina del nombre («polea»)');

/* compartir el gimnasio de la pareja: el perfil lleva equipo y máquinas */
const prof = gymProfile(gymB);
chk(prof.kind === 'gimnasio' && prof.gym.name === 'Gym de mi pareja', 'el perfil es un .json del gimnasio');
chk(prof.gym.machines['lateral raise polea'].stack.unit === 'kg', 'con la config de sus máquinas');
chk(prof.gym.id === undefined, 'y sin id: al importarlo se genera otro');

/* la pareja lo importa en su app */
const nAntes = db.gyms.length;
window.__gymImport = JSON.parse(JSON.stringify(prof));
applyGymImport();
chk(db.gyms.length === nAntes + 1 && db.gym.name === 'Gym de mi pareja', 'importarlo lo agrega y te cambia ahí');
chk(exUnit('lateral raise polea') === 'kg', 'con las máquinas ya configuradas');

/* el restaurador de respaldos también reconoce un perfil de gimnasio */
importBackup(JSON.stringify(prof));
chk(els['modalhost'].innerHTML.includes('Agregar el gimnasio'), 'importarlo por «Restaurar respaldo» redirige bien');
closeModal();

/* administrar: renombrar y eliminar */
document.getElementById('gymrename').value = 'Smart Fit Coapa';
renameGym({ preventDefault(){} }, db.settings.gymId);
chk(db.gym.name === 'Smart Fit Coapa', 'renombrar el gimnasio');
askDeleteGym(db.settings.gymId);
chk(els['modalhost'].innerHTML.includes('actual'), 'el gimnasio activo no se elimina: pide cambiarte antes');
closeModal();
const otroId = db.gyms.find(g => g.id !== db.settings.gymId).id;
window.__confirmFn = null;
askDeleteGym(otroId);
window.__confirmFn();
chk(!db.gyms.some(g => g.id === otroId), 'uno guardado sí se elimina');
chk(db.gyms.length >= 1 && db.gyms.some(g => g.id === db.settings.gymId), 'y siempre queda un gimnasio activo');

/* =====================================================================
   ACTUALIZAR EN SEGUNDO PLANO: el aviso llega en el gimnasio
   ===================================================================== */
suite('Actualizar en segundo plano — la red lenta ya no lo impide');
/* con la red del gym, el documento se sirve de la copia local pero la
   descarga sigue por detrás; estas piezas tienen que existir en pareja */
chk(swSrc.includes('e.waitUntil(red)'), 'el SW no abandona la descarga cuando gana la copia local');
chk(/servidoDeCopia/.test(swSrc) && swSrc.includes('avisarDocumentoFresco'),
    'y solo avisa cuando el fresco llegó tarde (si llegó a tiempo, ya lo estás viendo)');
chk(/documento-fresco/.test(swSrc) && /documento-fresco/.test(html),
    'el mensaje del SW y el que escucha la app son el mismo');
chk(html.includes("addEventListener('online'"), 'la app también busca versión al recuperar la conexión');
chk(!swSrc.includes('redConPrisa'), 'la carrera vieja (que tiraba la descarga) ya no existe');

/* =====================================================================
   ARREGLOS DE SESIÓN EN CURSO: quitar ejercicios y el default al agregar
   ===================================================================== */
suite('Quitar un ejercicio de la sesión en curso');
resetDB();
db.routines.push({ id:'r1', name:'Torso', split:(db.splits[0]||{}).id, exercises:[
  { id:'a', name:'Banca', key:'banca' }, { id:'b', name:'Remo', key:'remo' }] });
startSession('r1');
/* el que se agregó por error, guardado también en la rutina */
window.__keepRoutine = true;
document.getElementById('sessnewex').value = 'Curl raro';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 3 && db.routines[0].exercises.length === 3,
    'el error de la pareja: agregado a la sesión Y a la rutina');
removeSessionEx(2);
chk(els['modalhost'].innerHTML.includes('también de la rutina'),
    'como también vive en la rutina, pregunta qué hacer');
doRemoveSessionEx(true);
chk(db.active.exercises.length === 2, 'se quita de la sesión');
chk(db.routines[0].exercises.length === 2 && !db.routines[0].exercises.some(e => e.key === 'curl raro'),
    'y también de la rutina: el error queda deshecho');
/* quitar solo de hoy: la rutina no se toca */
db.active.open = 1;
removeSessionEx(0);
chk(els['modalhost'].innerHTML.includes('Quitar solo de la sesión'), 'ofrece quitarlo solo por hoy');
doRemoveSessionEx(false);
chk(db.active.exercises.length === 1 && db.active.exercises[0].key === 'remo',
    'desaparece de la sesión de hoy');
chk(db.routines[0].exercises.length === 2, 'pero la rutina queda como estaba');
chk(db.active.open === 0, 'y el ejercicio que estaba abierto sigue siendo el mismo');
/* uno que no está en la rutina: sin preguntas de rutina */
window.__keepRoutine = false;
document.getElementById('sessnewex').value = 'Face pull';
sessionAddExercise({ preventDefault(){} });
removeSessionEx(1);
chk(!els['modalhost'].innerHTML.includes('también de la rutina'),
    'si no vive en la rutina, no pregunta por ella');
doRemoveSessionEx(false);
chk(db.active.exercises.length === 1, 'y se quita sin más');
db.active = null;

suite('Agregar a media sesión — dos botones, la rutina por defecto');
resetDB();
db.routines.push({ id:'r1', name:'Pull', split:(db.splits[0]||{}).id, exercises:[] });
startSession('r1');
promptAddExercise();
chk(window.__keepRoutine === true, 'el default es guardar en la rutina, no «solo por hoy»');
chk(els['modalhost'].innerHTML.includes('Agregar a la rutina') &&
    els['modalhost'].innerHTML.includes('Solo por hoy'),
    'dos botones explícitos en lugar del switch');
chk(!els['modalhost'].innerHTML.includes('keepRoutineBtn'), 'el switch confuso ya no existe');
chk(els['modalhost'].innerHTML.includes('Pull'), 'el texto dice a qué rutina se guarda');
document.getElementById('sessnewex').value = 'Press militar';
sessionAddExercise({ preventDefault(){} });
chk(db.routines[0].exercises.length === 1 && db.routines[0].exercises[0].key === 'press militar',
    'con el default, el ejercicio queda guardado en la rutina');
db.active = null;

suite('El botón del gimnasio siempre a la vista en la sesión');
/* el caso real: 90 minutos adentro de un gimnasio nuevo, con UN solo
   gimnasio configurado — el botón para crear el segundo tiene que estar
   ahí mismo, en la cabecera de la sesión */
resetDB();
db.gyms = [normGym({ name:'Mi gimnasio', unit:'kg' }, 'kg')];
db.settings.gymId = db.gyms[0].id;
invalidatePlates();
db.routines.push({ id:'r1', name:'T', split:(db.splits[0]||{}).id, exercises:[] });
startSession('r1');
chk(uiSession().includes('Mi gimnasio'), 'con un solo gimnasio el botón sale igual, con su nombre');
chk(uiSession().includes('gymPickerModal'), 'la sesión permite abrir el selector de gimnasio');
db.active = null;

/* =====================================================================
   UNIDADES SIN DERIVA: kg → lb → kg tiene que volver exacto
   ===================================================================== */
suite('Unidades — ida y vuelta sin deriva (lo que reportó la pareja)');
resetDB();
db.gyms = [normGym({ name:'Mi gimnasio', unit:'lb' }, 'lb')];
db.settings.gymId = db.gyms[0].id;
invalidatePlates();
db.settings.unit = 'lb';
db.routines.push({ id:'r1', name:'T', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Curl', key:'curl' }] });
startSession('r1');
setVal(0, 0, 'w', '10'); setVal(0, 0, 'r', '10');
setUnit('kg');
chk(db.active.exercises[0].sets[0].w === '4.54', '10 lb escritas se ven como 4,54 kg');
setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '10', 'y de vuelta son 10 lb exactas (antes quedaban 10,01)');
setUnit('kg'); setUnit('lb'); setUnit('kg'); setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '10', 'ni con varias vueltas seguidas se degrada');
/* re-escribir el peso actualiza el canónico */
setVal(0, 0, 'w', '12');
setUnit('kg');
chk(db.active.exercises[0].sets[0].w === '5.44', 'un valor re-escrito parte de cero: 12 lb → 5,44 kg');
setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '12', 'y también regresa exacto');
/* guardar viendo la otra unidad ya no contamina el historial */
setUnit('kg');
confirmFixtureSets();finishSession();
setUnit('lb');
chk(fmtW(db.history[db.history.length-1].entries[0].sets[0].w) === '12',
    'guardado viendo kg, el historial en lb dice 12 — no 12,01');

/* torre de placas: el mismo arreglo al alternar la unidad de la máquina */
startSession('r1');
setVal(0, 0, 'w', '10');
exMeta('curl').equip = 'placas';
setExStack('curl', 'unit', 'kg');
chk(db.active.exercises[0].sets[0].w === '4.54', 'la torre pasa a kg y lo escrito se convierte');
setExStack('curl', 'unit', 'lb');
chk(db.active.exercises[0].sets[0].w === '10', 'torre de vuelta a lb: exacto, sin 10,01');
db.active = null;
exMeta('curl').equip = null;
exMeta('curl').stack = { unit:null, step:null, start:null };

suite('Unidades — el inventario no se corrompe: solo cambia el lente');
setUnit('kg');
db.gym.plates = [10, 20, 2.5, 5].map(kg => ({ kg, pairs:2, on:true }));
invalidatePlates();
setUnit('lb'); setUnit('kg');
chk(db.gym.plates.map(p => p.kg).join(',') === '10,20,2.5,5',
    'alternar unidades jamás reescribe los discos guardados');
/* los decimales que vio la pareja: inventario SEMBRADO en libras, visto en kilos */
db.gym.plates = defaultGym('lb').plates;
invalidatePlates();
chk(fmtW(db.gym.plates[0].kg) === '20,41',
    'un juego sembrado en lb se ve con decimales en kg (un disco de 45 lb SON 20,41 kg): no es corrupción');
/* y su remedio: restaurar el juego estándar en la unidad actual */
window.__confirmFn = null;
askResetGymKind('plates');
window.__confirmFn();
chk(db.gym.plates.map(p => p.kg).join(',') === '25,20,15,10,5,2.5,1.25',
    'restaurar deja el juego estándar limpio en kg');
askResetGymKind('bars');
window.__confirmFn();
chk(db.gym.bars.find(b => b.def).kg === 20, 'las barras también se restauran (olímpica de 20 kg)');

suite('Unidades — el juego estándar intacto sigue a la unidad, solo');
resetDB();
db.gyms = [normGym({ name:'G', unit:'kg' }, 'kg')];
db.settings.gymId = db.gyms[0].id;
db.settings.unit = 'kg'; db.gym.unit = 'kg';
db.gym.plates = defaultGym('kg').plates;
db.gym.bars = defaultGym('kg').bars;
db.gym.dumbbells = defaultGym('kg').dumbbells;
invalidatePlates();
setUnit('lb');
chk(fmtW(db.gym.plates[0].kg) === '45', 'sin tocar nada, en lb aparecen los discos estándar de lb (45…), no 55,12');
chk(fmtW(db.gym.dumbbells[0].kg) === '5', 'y las mancuernas de 5 en 5 lb');
setUnit('kg');
chk(db.gym.plates.map(p => p.kg).join(',') === '25,20,15,10,5,2.5,1.25', 'de regreso, el juego de kg limpio');
setUnit('lb'); setUnit('kg'); setUnit('lb'); setUnit('kg');
chk(db.gym.plates[0].kg === 25, 'infinitas vueltas: siempre limpio, sin botones');
/* un inventario EDITADO no se reemplaza: esos discos existen de verdad */
db.gym.plates.find(p => Math.abs(p.kg - 1.25) < 1e-9).on = false;
setUnit('lb');
chk(Math.abs(db.gym.plates[0].kg - 25) < 1e-9 && fmtW(db.gym.plates[0].kg) === '55,12',
    'editado (destildaste el de 1,25): se conserva y en lb se ve su peso real, 55,12');
setUnit('kg');
chk(db.gym.plates.find(p => Math.abs(p.kg - 1.25) < 1e-9).on === false,
    'y tu edición sigue ahí al volver a kg');

suite('Renombrar splits y días');
resetDB();
db.splits = [{ id:'s1', name:'PPL', active:true, created:new Date().toISOString() }];
db.routines.push({ id:'ra', name:'Armas/Delts', split:'s1', exercises:[] });
db.history.push({ id:'h1', routineId:'ra', routineName:'Armas/Delts',
  date:new Date().toISOString(), duration:60, entries:[] });
/* el caso real: el typo «Armas/Delts» */
startSession('ra');
document.getElementById('routinename').value = 'Arms/Delts';
renameRoutine({ preventDefault(){} }, 'ra');
chk(db.routines[0].name === 'Arms/Delts', 'el día se renombra: adiós «Armas»');
chk(db.active.routineName === 'Arms/Delts', 'la sesión en curso adopta el nombre nuevo');
chk(splitSessions('s1').length === 1, 'el historial no se desengancha: las sesiones van por id, no por nombre');
db.active = null;
/* el split también */
document.getElementById('splitname').value = 'Arnold Split';
renameSplit({ preventDefault(){} }, 's1');
chk(db.splits[0].name === 'Arnold Split', 'el split se renombra');
/* y los botones están donde se esperan, con el lápiz (no el icono de copiar) */
const lapiz = 'M4 20l1-4L16 5l3 3L8 19l-4 1z';
view = { name:'routine', id:'ra' };
chk(routineHeadHTML().includes('promptRenameRoutine') && routineHeadHTML().includes(lapiz),
    'la cabecera del día tiene su botón de renombrar con lápiz');
view = { name:'split', id:'s1' };
const cabSplit = splitHeadHTML();
chk(cabSplit.includes('promptRenameSplit') && cabSplit.includes(lapiz),
    'el del split ya no se disfraza de icono de duplicar');
view = { name:'home' };

/* =====================================================================
   CONFIG POR SPLIT: el mismo ejercicio, reglas distintas por plan
   ===================================================================== */
suite('Config por split — rango, series y descanso propios');
resetDB();
db.splits = [
  { id:'sh', name:'Hipertrofia', active:true,  created:new Date().toISOString(), exconf:{} },
  { id:'sf', name:'Fuerza',      active:false, created:new Date().toISOString(), exconf:{} }];
db.routines = [
  { id:'rh', name:'Torso H', split:'sh', exercises:[{ id:'a', name:'Banca', key:'banca' }] },
  { id:'rf', name:'Torso F', split:'sf', exercises:[{ id:'b', name:'Banca', key:'banca' }] }];
/* en el split de fuerza: 4–6 reps, 2 series y 4:00 de descanso */
db.splits[1].exconf['banca'] = { lo:4, hi:6, sets:2, rest:240 };
sess('banca', [S(60,6), S(60,6), S(60,6)]);   /* historial COMPARTIDO: 60×6 */

view = { name:'routine', id:'rh' };
chk(effRange('banca').lo === 8 && effRange('banca').hi === 12, 'en hipertrofia rige lo general (8–12)');
let sg = computeSuggestion('banca');
chk(sg.type === 'hold' && sg.sets === 3, 'con 6 reps ahí toca consolidar, en sus 3 series');
chk(restSecs('banca') === 90, 'y descansar 1:30 (el general de hipertrofia)');

view = { name:'routine', id:'rf' };
chk(effRange('banca').lo === 4 && effRange('banca').hi === 6, 'en fuerza rigen SUS 4–6');
sg = computeSuggestion('banca');
chk(sg.type === 'up', 'las MISMAS 6 reps ahí son tope del rango → subir peso');
chk(sg.sets === 2, 'en las 2 series fijadas de ese split');
chk(restSecs('banca') === 240, 'con su descanso de 4:00');
chk(exMeta('banca').lo == null && exMeta('banca').hi == null,
    'todo sin tocar la config general del ejercicio');

suite('Config por split — la sesión manda sobre el split en curso');
startSession('rf');                /* sesión del split de fuerza… */
activateSplit('sh');               /* …y a media sesión pones en curso el otro */
chk(effRange('banca').hi === 6, 'la sesión sigue rigiéndose por SU split (fuerza), no por el activo');
db.active.exercises[0].sets[0] = { w:'62.5', r:'6', rir:'' };
confirmFixtureSets();finishSession();
chk(prog('banca').fail === 0,
    'al guardar, 6 reps se juzgan con el rango de fuerza (éxito) — no con el 8–12 del split activo');
view = { name:'home' };
chk(effRange('banca').hi === 12, 'sin sesión, vuelve a mandar el split en curso');

suite('Config por split — sobrevive, viaja y muere con su split');
chk(db.splits.find(x => x.id === 'sf').exconf['banca'].lo === 4,
    'cambiar de split en curso no toca la config: vive en su split');
/* copiar un día a otro split lleva su config, sin pisar la del destino */
db.splits.push({ id:'s2', name:'Nuevo', active:false, created:new Date().toISOString(), exconf:{} });
window.__moveTo = 's2'; window.__moveCopy = true;
doMoveRoutine('rf');
chk(db.splits.find(x => x.id === 's2').exconf['banca'].hi === 6,
    'copiar el día lleva la config de sus ejercicios al split destino');
/* borrar el split se lleva su config; lo general queda intacto */
window.__confirmFn = null;
deleteSplit('sf');
window.__confirmFn();
view = { name:'home' };
chk(!db.splits.some(x => x.id === 'sf'), 'el split de fuerza se borra');
chk(effRange('banca').hi === 12 && exMeta('banca').lo == null,
    'banca vuelve a lo general, que nunca se tocó');

/* los inputs de la ficha escriben en el split del contexto */
view = { name:'exercise', key:'banca', exname:'Banca', rid:'rh' };
chk(viewExercise().includes('Objetivos') && !viewExercise().includes('Rango mínimo'),
    'la ficha separa objetivos del resto de la información');
view.exTab='targets'; view.targetScope='plan';
chk(uiTargets('banca').includes('Solo este plan'), 'Objetivos permite seleccionar reglas del plan');
setSplitConf('banca', 'sets', '2');
view = { name:'exercise', key:'banca', exname:'Banca', rid:'rh' };   /* ficha reabierta, sin tocar el botón */
chk(uiTargets('banca').includes('Solo este plan'), 'las reglas del plan siguen accesibles al reabrir');
setSplitConf('banca', 'sets', '2');
chk(db.splits.find(x => x.id === 'sh').exconf['banca'].sets === 2, 'escribe en el split de la rutina de origen');
setSplitConf('banca', 'sets', '');
chk(!db.splits.find(x => x.id === 'sh').exconf['banca'], 'en blanco, la config vacía se limpia sola');
view = { name:'home' };

/* series fijadas: el coach no suma la serie extra por estancamiento */
resetDB();
db.splits = [{ id:'s1', name:'A', active:true, created:new Date().toISOString(),
  exconf:{ curl: { sets:2 } } }];
const planas = [S(30,9), S(30,9)];
sess('curl', planas); sess('curl', planas); sess('curl', planas); sess('curl', planas);
sg = computeSuggestion('curl');
chk(db.progress['curl'].stall >= 3 && sg.sets === 2,
    'estancado 3+ sesiones, pero las 2 series fijadas se respetan: sin serie extra');

suite('Almacenamiento — tamaño real y cuota');
/* la cuota típica de localStorage es ~5 MB por sitio; medir lo que ocupa todo */
const kb = JSON.stringify(db).length / 1024;
chk(kb < 5000, `los datos actuales ocupan ${Math.round(kb)} KB: sobra sitio (cuota ~5 MB)`);
chk(uiData().includes(' KB'), 'la categoría Datos muestra cuánto ocupan tus datos');
/* si el navegador rechazara la escritura, la app no revienta y avisa UNA vez */
const setItemReal = localStorage.setItem;
localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
window.__quotaWarned = false;
let exploto = false;
try{ save(); }catch(e){ exploto = true; }
chk(!exploto, 'save() sobrevive a un QuotaExceededError sin reventar');
chk(window.__saveError?.includes('descarga una copia'),'el fallo conserva una advertencia persistente y una salida de respaldo');
els['modalhost'].innerHTML = '';
save();
chk(els['modalhost'].innerHTML === '' && !!window.__saveError,
    'escribir no abre diálogos repetidos y conserva el estado pendiente');
localStorage.setItem = setItemReal;
save();

/* =====================================================================
   CADA SPLIT PROGRESA POR SU HILO (historial compartido)
   ===================================================================== */
suite('El coach ancla en la última sesión DEL split en contexto');
resetDB();
db.splits = [
  { id:'sA', name:'A', active:true,  created:new Date().toISOString(), exconf:{} },
  { id:'sB', name:'B', active:false, created:new Date().toISOString(), exconf:{ calf: { lo:6, hi:8, sets:1 } } }];
db.routines = [
  { id:'rA', name:'Pierna A', split:'sA', exercises:[{ id:'a', name:'Calf', key:'calf' }] },
  { id:'rB', name:'Pierna B', split:'sB', exercises:[{ id:'b', name:'Calf', key:'calf' }] }];
Object.assign(exMeta('calf'), { lo:15, hi:20, step:2 });
/* historia: 16×15×2 en A (hace 4 días) y luego 18×6 en B (hace 2) */
db.history.push({ id:'h1', routineId:'rA', routineName:'Pierna A',
  date:new Date(Date.now() - 4*864e5).toISOString(), duration:60,
  entries:[{ key:'calf', name:'Calf', sets:[S(16,15), S(16,15)] }] });
db.history.push({ id:'h2', routineId:'rB', routineName:'Pierna B',
  date:new Date(Date.now() - 2*864e5).toISOString(), duration:60,
  entries:[{ key:'calf', name:'Calf', sets:[S(18,6)] }] });
view = { name:'routine', id:'rA' };
let sgg = computeSuggestion('calf');
chk(sgg.w === 16 && sgg.sets === 2 && sgg.type === 'reps',
    'en A ancla en SU 16×15: mismo 16 kg y 2 series — ya no «consolida 18»');
view = { name:'routine', id:'rB' };
sgg = computeSuggestion('calf');
chk(sgg.w === 18 && sgg.sets === 1, 'y B sigue su propio hilo desde el 18×6');

suite('Un mes en el otro split — sin castigo por pausa ni saltos de peso');
/* A quedó hace 30 días; B se siguió entrenando (hace 2, ya en 30 kg) */
db.history[0].date = new Date(Date.now() - 30*864e5).toISOString();
db.history[1].entries[0].sets = [S(30,8)];
view = { name:'routine', id:'rA' };
sgg = computeSuggestion('calf');
chk(sgg.type !== 'back', 'volver a A tras un mes NO descuenta por pausa: el movimiento siguió vivo en B');
chk(sgg.w === 16, 'y retoma el hilo de A donde quedó (16 kg) — nunca salta a los 30 de B');
view = { name:'routine', id:'rB' };
chk(computeSuggestion('calf').w > 30 || computeSuggestion('calf').reps > 0, 'B sigue progresando desde sus 30');
/* abandonado en TODOS los splits, la pausa sí aplica */
db.history[1].date = new Date(Date.now() - 30*864e5 + 36e5).toISOString();
view = { name:'routine', id:'rA' };
chk(computeSuggestion('calf').type === 'back', 'un mes sin hacerlo en NINGÚN split → sí es vuelta tras pausa');

suite('Hilos por split — bordes');
/* primera vez en un split nuevo: usa el historial global, no arranca de cero */
db.splits.push({ id:'sC', name:'C', active:false, created:new Date().toISOString(), exconf:{} });
db.routines.push({ id:'rC', name:'Pierna C', split:'sC', exercises:[{ id:'c', name:'Calf', key:'calf' }] });
view = { name:'routine', id:'rC' };
let le = lastEntry('calf');
chk(le !== null && le.entry.sets[0].w === 30, 'un split que nunca lo vio cae al hilo global (la sesión más reciente)');
/* borrar la rutina de B: sus sesiones quedan sin split y solo alimentan el global */
db.routines = db.routines.filter(r => r.id !== 'rB');
view = { name:'routine', id:'rA' };
chk(computeSuggestion('calf') !== null && lastEntry('calf').entry.sets[0].w === 16,
    'borrada la rutina de B, el hilo de A sigue intacto y nada revienta');
/* historial importado (sin routineId) se atribuye por nombre de rutina */
db.history.push({ id:'h3', routineId:null, routineName:'Pierna A',
  date:new Date().toISOString(), duration:60,
  entries:[{ key:'calf', name:'Calf', sets:[S(17,15)] }] });
chk(lastEntry('calf').entry.sets[0].w === 17, 'una sesión importada cuenta en el hilo del día con su nombre');
view = { name:'home' };

/* =====================================================================
   COMPARTIR SPLITS COMPLETOS
   ===================================================================== */
suite('Compartir splits — exportar el plan entero');
resetDB();
db.splits = [{ id:'s1', name:'PPL de regalo', active:true, created:new Date().toISOString(),
  exconf:{ 'lateral raise': { lo:12, hi:20, sets:4 } } }];
db.routines = [
  { id:'r1', name:'Push', split:'s1', exercises:[
    { id:'a', name:'Bench Press (Barbell)', key:'bench press (barbell)' },
    { id:'b', name:'Lateral Raise', key:'lateral raise' }] },
  { id:'r2', name:'Pull', split:'s1', exercises:[{ id:'c', name:'Row', key:'row' }] }];
Object.assign(exMeta('lateral raise'), { muscle:'hombros', equip:'placas' });
Object.assign(exMeta('lateral raise').stack, { unit:'lb', step:5, start:5 });
exMeta('bench press (barbell)').equip = 'barra';
const sprof = splitProfile('s1');
chk(sprof.kind === 'split' && sprof.split.days.length === 2, 'el perfil lleva el split con sus 2 días en orden');
chk(sprof.split.days[0].exercises.length === 2 && sprof.split.days[1].exercises[0].name === 'Row',
    'con los ejercicios de cada día');
chk(sprof.split.exmeta['lateral raise'].stack.unit === 'lb' &&
    sprof.split.exmeta['bench press (barbell)'].equip === 'barra',
    'y la configuración completa de cada ejercicio (equipo, torre…)');
chk(sprof.split.exconf['lateral raise'].sets === 4, 'incluida la config por split (series, rango)');

suite('Compartir splits — la pareja lo importa');
resetDB();
db.splits = [{ id:'viejo', name:'Su split', active:true, created:new Date().toISOString(), exconf:{} }];
exMeta('bench press (barbell)').equip = 'mancuerna';   /* SU config previa: no debe pisarse */
window.__splitImport = JSON.parse(JSON.stringify(sprof));
applySplitImport();
const traido = db.splits.find(x => x.name === 'PPL de regalo');
chk(!!traido && traido.active, 'el split llega y queda en curso');
chk(db.splits.find(x => x.id === 'viejo').active === false, 'el suyo pasa a guardados, no se borra');
chk(splitRoutines(traido.id).length === 2 && splitRoutines(traido.id)[0].exercises.length === 2,
    'días y ejercicios completos');
chk(traido.exconf['lateral raise'].sets === 4, 'la config por split viaja con él');
chk(exMeta('lateral raise').equip === 'placas' && exMeta('lateral raise').stack.unit === 'lb',
    'los ejercicios nuevos llegan configurados (la polea en lb, lista)');
chk(exMeta('bench press (barbell)').equip === 'mancuerna',
    'pero en los que ella ya tenía, SU configuración manda');
chk(nextDay().routine.name === 'Push', 'y el coach ya sabe que hoy toca Push');
/* el restaurador de respaldos también lo reconoce */
importBackup(JSON.stringify(sprof));
chk(els['modalhost'].innerHTML.includes('Agregar el split'), 'importarlo por «Restaurar respaldo» redirige bien');
closeModal();
/* un archivo roto no revienta nada */
importSplitFile('{"kind":"split"}');
chk(els['modalhost'].innerHTML.includes('no válido'), 'un .json incompleto avisa en vez de romper');
closeModal();
importSplitFile('esto no es json');
chk(els['modalhost'].innerHTML.includes('no válido'), 'y uno corrupto también');
closeModal();
/* la lista de splits ofrece importar */
view = { name:'splits' };
chk(viewSplits().includes('importSplitFile') && splitHeadHTML() === '', 'la pantalla de splits tiene el botón de importar');
view = { name:'split', id:traido.id };
chk(splitHeadHTML().includes('exportSplit'), 'y la ficha del split, el de compartir');
view = { name:'home' };

/* =====================================================================
   AL FALLO A PROPÓSITO: el aviso de RIR 0 respeta el programa
   ===================================================================== */
suite('Al fallo a propósito — por split, no global');
resetDB();
db.splits = [
  { id:'mm', name:'Min-Max', active:true,  created:new Date().toISOString(), exconf:{}, failOk:true },
  { id:'nm', name:'Normal',  active:false, created:new Date().toISOString(), exconf:{} }];
db.routines = [
  { id:'rm', name:'Upper MM', split:'mm', exercises:[{ id:'e1', name:'Press', key:'press' }] },
  { id:'rn', name:'Upper N',  split:'nm', exercises:[{ id:'e2', name:'Press', key:'press' }] }];
const rir0 = [S(50,8,0), S(50,8,0), S(50,7,0), S(50,6,0)];
/* tres sesiones al fallo, todas del split marcado */
for(let i = 0; i < 3; i++) db.history.push({ id:'f'+i, routineId:'rm', routineName:'Upper MM',
  date:new Date(Date.now() - (5-i)*864e5).toISOString(), duration:60,
  entries:[{ key:'press', name:'Press', sets:rir0 }] });
chk(failureHabit() === null, 'RIR 0 sistemático en el split marcado NO dispara el regaño: es el programa');
/* el mismo hábito en un split normal sigue protegido */
for(let i = 0; i < 2; i++) db.history.push({ id:'n'+i, routineId:'rn', routineName:'Upper N',
  date:new Date(Date.now() - (2-i)*864e5).toISOString(), duration:60,
  entries:[{ key:'press', name:'Press', sets:rir0 }] });
chk(failureHabit() !== null, 'en un split normal el aviso sigue vivo: la protección no se pierde');

/* la nota al terminar la sesión también respeta la marca */
startSession('rm');
for(let i = 0; i < 4; i++){
  if(!db.active.exercises[0].sets[i]) addSet(0);
  setVal(0, i, 'w', '50'); setVal(0, i, 'r', '8'); setVal(0, i, 'rir', '0');
}
confirmFixtureSets();finishSession();
chk(!els['modalhost'].innerHTML.includes('llegaste al fallo'),
    'al guardar una sesión Min-Max, sin sermón por el RIR 0');
closeModal();
startSession('rn');
for(let i = 0; i < 4; i++){
  if(!db.active.exercises[0].sets[i]) addSet(0);
  setVal(0, i, 'w', '50'); setVal(0, i, 'r', '8'); setVal(0, i, 'rir', '0');
}
confirmFixtureSets();finishSession();
chk(els['modalhost'].innerHTML.includes('llegaste al fallo'),
    'la misma sesión en el split normal sí recibe la nota educativa');
closeModal();

/* la marca viaja en el perfil compartible */
const pfMM = splitProfile('mm');
chk(pfMM.split.failOk === true, 'el .json del split lleva la marca de fallo a propósito');
db.splits = [{ id:'v', name:'Suyo', active:true, created:new Date().toISOString(), exconf:{} }];
db.routines = []; db.history = [];
window.__splitImport = JSON.parse(JSON.stringify(pfMM));
applySplitImport();
chk(db.splits.find(x => x.name === 'Min-Max').failOk === true, 'y al importarlo se conserva');
/* el toggle en la ficha del split */
view = { name:'split', id: db.splits.find(x => x.name === 'Min-Max').id };
uiPlanRules(view.id);
chk(els['modalhost'].innerHTML.includes('uiTogglePlanFailure') && els['modalhost'].innerHTML.includes('Fallo a propósito'), 'las reglas del plan conservan el toggle');
closeModal();
view = { name:'home' };

/* =====================================================================
   AJUSTE FINO DE LA TORRE: discos añadidos, palanca o pin giratorio
   ===================================================================== */
suite('Torres con ajuste fino — placa N + extra, no «placa 27»');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
/* el jalón al pecho real: 10 en 10 lb desde 10, con dos discos de 5,5 al lado */
exMeta('jalon pecho').equip = 'placas';
Object.assign(exMeta('jalon pecho').stack, { unit:'lb', step:10, start:10, extra:5.5, extraMax:11 });
let snp = stackSnap('jalon pecho', 25.5 * KGxLB);
chk(snp.index === 2 && snp.extra === 5.5 && snp.value === 25.5,
    '25,5 lb = placa 2 (20) + un disco de 5,5 — no una placa inventada');
snp = stackSnap('jalon pecho', 31 * KGxLB);
chk(snp.index === 2 && snp.extra === 11 && snp.value === 31,
    '31 lb = placa 2 + los dos discos (11): el extra puede pasar del salto de la torre');
snp = stackSnap('jalon pecho', 30 * KGxLB);
chk(snp.index === 3 && snp.extra === 0, '30 lb exactas siguen siendo la placa 3 sin extra');
chk(Math.abs(effStep('jalon pecho', 20) - 5.5*KGxLB) < 1e-6,
    'el salto del coach pasa a ser el fino (5,5 lb), no el de la torre (10)');
chk(stackExtraLabel(stackSnap('jalon pecho', 25.5*KGxLB)) === ' + 5,5', 'la etiqueta dice «+ 5,5»');

/* El extra puede cruzarse con la placa anterior: importa la combinación real,
   no sumar siempre un disco de 5,5 al peso previo. */
sess('jalon pecho', [S(Math.round(20*KGxLB*1000)/1000, 12), S(Math.round(20*KGxLB*1000)/1000, 12)]);
s = computeSuggestion('jalon pecho');
chk(Math.abs(s.w - 21*KGxLB) < 0.001 && stackSnap('jalon pecho',s.w).index===1 && stackSnap('jalon pecho',s.w).extra===11,
    'de 20 lb puede subir a 21: placa 1 de 10 + dos discos de 5,5');

/* el pin giratorio: torre de 15 en 15, el pin suma 0, 5 o 10 */
exMeta('prensa sentada').equip = 'placas';
Object.assign(exMeta('prensa sentada').stack, { unit:'kg', step:15, start:15, extra:5, extraMax:10 });
snp = stackSnap('prensa sentada', 35);
chk(snp.index === 2 && snp.extra === 5 && snp.value === 35, '35 kg = placa 2 (30) + pin en 5');
snp = stackSnap('prensa sentada', 40);
chk(snp.index === 2 && snp.extra === 10 && snp.value === 40, '40 kg = placa 2 + pin en 10');
chk(effStep('prensa sentada', 30) === 5, 'y el salto del coach es el del pin (5)');

/* sin «hasta», el máximo es un solo escalón del fino */
exMeta('polea lateral').equip = 'placas';
Object.assign(exMeta('polea lateral').stack, { unit:'kg', step:5, start:5, extra:2.5 });
snp = stackSnap('polea lateral', 12.5);
chk(snp.index === 2 && snp.extra === 2.5, 'palanca de 2,5: placa 2 + 2,5');
chk(stackSnap('polea lateral', 10).extra === 0, 'y los pesos de placa exacta no usan la palanca');

/* sin ajuste fino, todo sigue exactamente igual que antes */
exMeta('remo torre').equip = 'placas';
Object.assign(exMeta('remo torre').stack, { unit:'kg', step:5, start:5 });
snp = stackSnap('remo torre', 27);
chk(snp.index === 5 && snp.value === 25 && snp.extra === 0 && stackExtraLabel(snp) === '',
    'una torre normal ni se entera del cambio');

/* el ajuste fino viaja: foto del gimnasio y perfil de split */
chk(machineSnapshot(exMeta('jalon pecho')).stack.extra === 5.5,
    'la foto por gimnasio guarda el ajuste fino');
db.splits = [{ id:'sf1', name:'S', active:true, created:new Date().toISOString(), exconf:{} }];
db.routines = [{ id:'rf1', name:'D', split:'sf1', exercises:[{ id:'x', name:'Jalon Pecho', key:'jalon pecho' }] }];
const pfx = splitProfile('sf1');
chk(pfx.split.exmeta['jalon pecho'].stack.extra === 5.5, 'y el perfil de split también lo lleva');

/* =====================================================================
   LAS SERIES FIJADAS TAMBIÉN VALEN SIN HISTORIAL (el bug de la pareja)
   ===================================================================== */
suite('Series fijadas — la sesión abre con las filas correctas');
resetDB();
db.splits = [{ id:'sx', name:'Importado', active:true, created:new Date().toISOString(),
  exconf:{ 'back squat': { lo:4, hi:7, sets:3 }, 'hip thrust': { sets:4 } } }];
db.routines = [{ id:'rx', name:'Lower', split:'sx', exercises:[
  { id:'a', name:'Back Squat', key:'back squat' },
  { id:'b', name:'Hip Thrust', key:'hip thrust' },
  { id:'c', name:'Crunch', key:'crunch' }] }];
/* el escenario exacto: split recién importado, CERO historial */
startSession('rx');
chk(db.active.exercises[0].sets.length === 3, 'ejercicio nuevo con 3 series fijadas → 3 filas, no 1');
chk(db.active.exercises[1].sets.length === 4, 'y el de 4 series abre con sus 4 filas');
chk(db.active.exercises[2].sets.length === 1, 'sin series fijadas ni historial, sí queda 1 (como antes)');

/* agregar a media sesión un ejercicio nuevo con series fijadas */
db.splits[0].exconf['face pull'] = { sets:2 };
window.__keepRoutine = false;
document.getElementById('sessnewex').value = 'Face Pull';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises[3].sets.length === 2, 'agregado a media sesión también respeta sus 2 series');

/* cambiar las series con la sesión en curso ajusta las filas */
view = { name:'exercise', key:'back squat', exname:'Back Squat', rid:'rx' };
setSplitConf('back squat', 'sets', '2');
chk(db.active.exercises[0].sets.length === 2, 'bajar de 3 a 2 quita la fila vacía sobrante');
setSplitConf('back squat', 'sets', '4');
chk(db.active.exercises[0].sets.length === 4, 'y subir a 4 agrega filas vacías al vuelo');
/* pero lo ya anotado jamás se borra */
db.active.exercises[0].sets[3] = { w:'60', r:'5', rir:'' };
db.active.exercises[0].sets[2] = { w:'60', r:'5', rir:'' };
setSplitConf('back squat', 'sets', '2');
chk(db.active.exercises[0].sets.length === 4, 'bajar a 2 con series anotadas en la 3 y 4 NO las borra');
db.active = null;

/* con historial de 3 series y fijadas 2, la sesión abre con 2 */
db.history.push({ id:'hh', routineId:'rx', routineName:'Lower', date:new Date().toISOString(), duration:60,
  entries:[{ key:'crunch', name:'Crunch', sets:[S(0,12), S(0,12), S(0,12)] }] });
exMeta('crunch').type = 'corporal';
db.splits[0].exconf['crunch'] = { sets:2 };
view = { name:'home' };
startSession('rx');
chk(db.active.exercises[2].sets.length === 2, 'historial de 3 series + fijadas 2 → la sesión abre con 2');
db.active = null;

/* =====================================================================
   APPLE SALUD VÍA ATAJOS
   ===================================================================== */
suite('Apple Salud — el botón, el atajo y su URL');
resetDB();
chk(db.settings.health === 'off', 'apagado por defecto: nadie ve botones que no pidió');
chk(healthShortcutURL(62) === 'shortcuts://run-shortcut?name=Hierro&input=text&text=62',
    'la URL invoca el atajo «Hierro» con los minutos como entrada');
chk(healthBtnHTML(3720) === '', 'con la función apagada, el resumen no enseña el botón');
db.settings.health = 'on';
chk(healthBtnHTML(3720).includes('62 min') && healthBtnHTML(3720).includes('logToHealth(62)'),
    'encendida: botón con los minutos reales de la sesión (62)');
chk(healthBtnHTML(20).includes('logToHealth(1)'), 'una sesión cortísima redondea a mínimo 1 min');
/* el resumen de sesión lo incluye */
db.routines.push({ id:'r1', name:'T', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Curl', key:'curl' }] });
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'10', rir:'' };
confirmFixtureSets();finishSession();
chk(els['modalhost'].innerHTML.includes('Guardar en Apple Salud'), 'el resumen al terminar trae el botón');
closeModal();
/* y la descarga también (una descarga sigue siendo entrenamiento) */
startSession('r1', true);
db.active.exercises[0].sets[0] = { w:'18', r:'8', rir:'' };
confirmFixtureSets();finishSession();
chk(els['modalhost'].innerHTML.includes('Guardar en Apple Salud'), 'el resumen de descarga también');
closeModal();
/* ajustes: toggle + guía */
view = { name:'settings' };
chk(uiPreferences().includes('toggleHealth') && uiPreferences().includes('healthInfo()'),
    'ajustes tiene el toggle y la guía del atajo');
db.settings.health = 'off';
chk(!uiPreferences().includes('healthInfo()'), 'apagado, la guía se esconde');
/* la guía describe los Atajos reales de iOS 26: Sustraer + Fecha/Duración */
healthInfo();
const guia = els['modalhost'].innerHTML;
chk(guia.includes('Sustraer') && guia.includes('Duración') && guia.includes('Fecha ajustada'),
    'la guía usa los nombres reales de iOS 26 (Sustraer, Fecha, Duración)');
chk(guia.includes('Recibir') && guia.includes('Texto'),
    'y avisa de marcar Texto en el bloque «Recibir» para que entre el dato');
chk(guia.includes('0 km') && guia.includes('NO las dejes en blanco'),
    'y exige Calorías/Distancia con valor: en blanco la acción falla (verificado en iPhone real)');
closeModal();
view = { name:'home' };

/* =====================================================================
   CIERRE DE SESIÓN: el titular y su recibo
   ===================================================================== */
suite('Cierre — el titular siempre tiene noticia que dar');
resetDB();
db.settings.health = 'off';
db.routines.push({ id:'rf', name:'Torso', split:(db.splits[0]||{}).id, exercises:[
  { id:'a', name:'Curl', key:'curl' }, { id:'b', name:'Press', key:'press' }] });
/* dos récords el mismo día: gana el titular la mejora MAYOR, no la primera */
sess('curl',  [S(20,10)]);          /* e1RM 26,7 */
sess('press', [S(50,10)]);          /* e1RM 66,7 */
startSession('rf');
db.active.exercises[0].sets[0] = { w:'21', r:'10', rir:'' };   /* +5 %  */
db.active.exercises[1].sets[0] = { w:'60', r:'10', rir:'' };   /* +20 % */
confirmFixtureSets();finishSession();
let fin = els['modalhost'].innerHTML;
chk(fin.includes('Nuevo récord · Press'), 'el titular es el récord con mayor mejora (Press, +20 %)');
chk(fin.includes('También hoy') && fin.includes('Curl'), 'el otro récord baja a «También hoy»');
chk(fin.includes('1RM estimado') && fin.includes('sobre tu marca'), 'la cifra viene explicada');
chk(fin.includes('<svg') && fin.includes('polyline'), 'y con su curva de progresión');
chk(fin.includes('El detalle') && fin.includes('Total movido'), 'debajo, el recibo con su total');
chk(fin.includes('fin-mark'), 'los ejercicios con récord van marcados en el recibo');
chk(fin.includes('Ver historial') && fin.includes('Listo'), 'las salidas siguen a mano');
closeModal();

suite('Cierre — sin récord manda el peso movido');
resetDB();
db.settings.health = 'off';
db.routines.push({ id:'rv', name:'Pierna', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Sentadilla', key:'sentadilla' }] });
startSession('rv');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
addSet(0);
db.active.exercises[0].sets[1] = { w:'60', r:'10', rir:'' };
confirmFixtureSets();finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes('Peso movido') && fin.includes(fmtInt(1200)), '1 200 kg movidos como titular');
chk(!fin.includes('récord'), 'y ni se menciona la palabra récord: hoy no tocaba');
chk(fin.includes('Tu primera vez de este día'), 'sin sesión previa, lo dice en vez de comparar');
closeModal();
/* la segunda vez ya hay contra qué medirse: mismo peso, una serie más
   (subir el peso sería récord y el titular pasaría a ser ese) */
startSession('rv');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
addSet(0); db.active.exercises[0].sets[1] = { w:'60', r:'10', rir:'' };
addSet(0); db.active.exercises[0].sets[2] = { w:'60', r:'10', rir:'' };
/* Esta comparación representa tres series previstas y realizadas. */
db.active.exercises[0].sets=db.active.exercises[0].sets.filter(st=>st.w!==''&&st.r!=='');
confirmFixtureSets();finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes(fmtInt(600) + ' kg más') && fin.includes('anterior'),
    'compara contra tu Pierna anterior (1 200 → 1 800 kg)');
chk(!fin.includes('récord'), 'más volumen sin más peso no es récord, y no se inventa uno');
closeModal();

suite('Cierre — casos que no son kilos');
chk(entryVolume('sentadilla', [S(60,10)]) === 600, 'volumen = peso × reps');
exMeta('dominadas').type = 'corporal';
exMeta('fondos a').type = 'asistido';
exMeta('plancha').type = 'tiempo';
chk(entryVolume('fondos a', [S(25,10)]) === 0, 'en asistidos los kg son ayuda: no cuentan como volumen');
chk(entryVolume('plancha', [S(0,45)]) === 0, 'y en los de tiempo las «reps» son segundos');
/* una sesión solo de peso corporal tiene titular igual: reps */
resetDB();
db.settings.health = 'off';
exMeta('dominadas').type = 'corporal';
db.routines.push({ id:'rc', name:'Core', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Dominadas', key:'dominadas' }] });
startSession('rc');
db.active.exercises[0].sets[0] = { w:'', r:'12', rir:'' };
confirmFixtureSets();finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes('12') && fin.includes('reps') && fin.includes('Total de reps'),
    'sin peso que sumar, el titular y el total van en reps');
closeModal();

suite('Cierre — descarga y Apple Salud');
resetDB();
db.routines.push({ id:'rd', name:'Full', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Banca', key:'banca' }] });
sess('banca', [S(60,12), S(60,12)]);
db.settings.health = 'on';
startSession('rd', true);
db.active.exercises[0].sets[0] = { w:'55', r:'8', rir:'' };
confirmFixtureSets();finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes('Descarga guardada') && !fin.includes('Nuevo récord'), 'la descarga tiene su propio encabezado');
chk(!fin.includes('polyline'), 'y sin curva: bajar el peso a propósito no es una caída que enseñar');
chk(fmtDurShort(3140) === '52 min' && fmtDurShort(3852) === '1 h 4 min', 'el pie no dice «52 min 0 s»');
chk(fin.includes('Guardar en Apple Salud') && fin.includes('btn health'),
    'el botón de Salud sale en ámbar, ya no camuflado');
closeModal();
db.settings.health = 'off';

suite('Cierre — la curva');
chk(sparkSVG([1], '#D7A44B') === '', 'con un solo punto no se dibuja nada');
chk(sparkSVG([1,2,3], '#D7A44B').includes('circle'), 'con dos o más, línea y punto final marcado');
chk(fmtInt(8528) === '8 528' && fmtInt(950) === '950', 'los miles se separan con espacio fino');

/* =====================================================================
   HISTORIAL: el panel arriba, el diario abajo
   ===================================================================== */
suite('Historial — récords guardados con la sesión');
resetDB();
db.routines.push({ id:'rh', name:'Torso', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Banca', key:'banca' }] });
sess('banca', [S(60,10)]);
startSession('rh');
db.active.exercises[0].sets[0] = { w:'65', r:'10', rir:'' };
confirmFixtureSets();finishSession(); closeModal();
let ult = db.history[db.history.length-1];
chk(Array.isArray(ult.prs) && ult.prs.length === 1 && ult.prs[0].key === 'banca',
    'la sesión guarda SUS récords: el historial ya no tiene que recalcularlos');
chk(ult.prs[0].now > ult.prs[0].prev, 'con la marca nueva y la anterior');
/* el historial viejo se repara solo, en una pasada */
db.history.forEach(h => { delete h.prs; });
migratePRs();
chk(db.history.every(h => Array.isArray(h.prs)), 'migratePRs deja todas las sesiones con su lista');
chk(db.history[db.history.length-1].prs.length === 1, 'y reconstruye el récord que hubo');
chk(db.history[0].prs.length === 0, 'la primera vez de un ejercicio no es récord: no hay contra qué');

suite('Historial — el panel');
resetDB();
db.routines.push({ id:'rp', name:'Pierna', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Sentadilla', key:'sentadilla' }] });
for(let i = 6; i >= 0; i--) sess('sentadilla', [S(60+i, 10), S(60+i, 10)], i*7 + 2);
view = { name:'history' };
let pan = histPanelHTML();
chk(pan.includes('Peso movido') && pan.includes('semana en curso'), 'el titular es la semana en curso');
chk(pan.includes('hp-bars') && (pan.match(/<span class="(now)?"/g)||[]).length >= 8,
    'con las últimas 9 semanas en barras');
chk(pan.includes('class="now"'), 'y la semana en curso va punteada: aún no termina');
chk(pan.includes('Tu fuerza') && pan.includes('sentadilla') && pan.includes('polyline'),
    'debajo, tus levantamientos con su curva de 1RM');
chk(pan.includes('openExerciseByKey'), 'y cada uno lleva a su ficha');
/* semanas y volúmenes */
const wv = weeklyVolumes(9);
chk(wv.length === 9 && wv[8].current === true, 'weeklyVolumes: 8 cerradas + la que corre');
chk(weekStart('2026-08-26T12:00:00Z').getDay() === 1, 'la semana empieza en lunes');
chk(weekLabel(weekStart(new Date())) === 'Esta semana', 'la semana actual se llama por su nombre');

suite('Historial — el diario');
const dia = histDiaryHTML();
chk(dia.includes('hd-wk') && dia.includes('sesi'), 'las sesiones van agrupadas por semana con su resumen');
chk(nSesiones(1) === '1 sesión' && nSesiones(3) === '3 sesiones', 'y el singular lleva su acento');
chk(dia.includes('hd-row') && dia.includes('class="d"'), 'cada sesión es una fila con su día del mes');
chk(dia.includes('fin-row') && dia.includes('fin-sets'), 'y al abrirla, el mismo recibo del cierre');
chk(dia.includes('Editar sesión') && dia.includes('class="dz"'),
    'editar es botón y borrar es enlace: no compiten');
/* regresión: la clase «pr» global (el 1RM de la ficha) es display:flex y
   partía el <details> en dos columnas — el detalle salía al lado, no debajo */
resetDB();
db.history.push({ id:'hx', routineId:'rz', routineName:'T', date:new Date().toISOString(),
  duration:3600, entries:[{ key:'banca', name:'Banca', sets:[S(60,10)] }],
  prs:[{ key:'banca', name:'Banca', now:80, prev:75, unit:'kg', assist:false }] });
const fila = histRowHTML(db.history[0]);
chk(fila.includes('class="hd is-pr"') && !fila.includes('class="hd pr"'),
    'la sesión con récord NO usa la clase global «pr»: el detalle va debajo, no al lado');
chk(receiptHTML(db.history[0].entries, new Set(['banca'])).includes('fin-row is-pr'),
    'y el recibo tampoco');
/* saber si está abierta o cerrada, y dónde acaba cada una */
chk(fila.includes('hd-cv'), 'cada fila lleva su galón: se ve si está plegada o abierta');
const hoja = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
chk(hoja.includes('details.hd[open]{') && hoja.includes('border-radius:14px'),
    'abierta se vuelve tarjeta con borde: con tres abiertas no se mezclan');
chk(hoja.includes('details.hd[open] .hd-cv{transform:rotate(90deg)'), 'y el galón gira al abrir');
chk(hoja.includes('prefers-reduced-motion') , 'con su respeto al movimiento reducido');
/* las semanas se nombran por distancia, con sus fechas debajo */
const hace3 = weekStart(new Date(Date.now() - 21*864e5));
chk(weekLabel(hace3) === 'Hace 3 semanas', 'una semana vieja dice a cuánto está');
chk(weekLabel(weekStart(new Date(Date.now() - 7*864e5))) === 'Semana pasada', 'y la anterior, por su nombre');
chk(/\d/.test(weekRange(hace3)) && weekRange(hace3).includes('–'), 'debajo van las fechas exactas');
/* las series se agrupan por peso */
chk(setsLine('sentadilla', [S(60,10), S(60,10), S(60,9)]) === '60 × 10 · 10 · 9',
    '«60 × 10 · 10 · 9» en vez de repetir el peso tres veces');
chk(setsLine('sentadilla', [S(60,10), S(50,12)]).includes('60 × 10') &&
    setsLine('sentadilla', [S(60,10), S(50,12)]).includes('50 × 12'),
    'si el peso cambia, se abre otro grupo');
chk(setsLine('sentadilla', [S(60,10,2), S(60,9,1)]).includes('RIR 2·1'), 'el RIR se anota si lo registraste');
exMeta('domin').type = 'corporal';
chk(setsLine('domin', [S(0,12), S(0,11)]) === '12 · 11 reps', 'en peso corporal manda la rep, no el cero');

suite('Historial — no se dibuja lo que no cabe');
resetDB();
db.routines.push({ id:'rq', name:'T', split:(db.splits[0]||{}).id, exercises:[] });
for(let i = 0; i < 45; i++) sess('press', [S(50,10)], 60 - i);
view = { name:'history' };
chk((histDiaryHTML().match(/details class="hd/g)||[]).length === 40,
    'de entrada se pintan 40 sesiones, no 400');
chk(histDiaryHTML().includes('Ver 5 sesiones más'), 'y un botón para traer las que faltan');
moreHistory();
chk((histDiaryHTML().match(/details class="hd/g)||[]).length === 45, 'que las trae');
view = { name:'home' };

suite('Máquinas de discos con peso propio — anotas solo los discos');
resetDB();
exMeta('remomaq').equip = 'discos';
exMeta('remomaq').points = 2;
exMeta('remomaq').base = 11.3;
chk(discosOffset('remomaq') === 11.3, 'el peso del aparato anotado se vuelve el offset');
chk(Math.abs(typedToKg('remomaq', 30) - 41.3) < 1e-9, 'teclear 30 son 41,3 kg reales (30 + 11,3 del carro)');
chk(Math.abs(kgToTyped('remomaq', 41.3) - 30) < 1e-9, 'y 41,3 reales se enseñan como 30 al teclear');
chk(kgToTyped('remomaq', 5) === 0, 'un histórico menor que el aparato no produce discos negativos');
/* sin base anotada, nada cambia */
exMeta('jalonx').equip = 'discos';
chk(discosOffset('jalonx') === 0 && typedToKg('jalonx', 30) === 30,
    'sin peso de aparato anotado, lo tecleado sigue siendo el total');
/* en asistidos el número es AYUDA, no carga: el offset no aplica */
exMeta('fondasist').equip = 'discos'; exMeta('fondasist').base = 20; exMeta('fondasist').type = 'asistido';
chk(discosOffset('fondasist') === 0, 'en asistidos no se suma nada: ahí se anota la ayuda');

/* al guardar la sesión, el historial recibe el peso real */
db.active = { routineId:'', routineName:'X', start: Date.now(), exercises:[
  { key:'remomaq', name:'Remo en máquina', sugg:null, sets:[{ w:'30', r:'10', rir:'2' }] }
]};
let entD = fixtureEntries();
chk(Math.abs(entD[0].sets[0].w - 41.3) < 1e-9, 'la serie tecleada como 30 se guarda como 41,3');
db.active.exercises[0].sets = [{ w:'0', r:'10', rir:'' }];
entD = fixtureEntries();
chk(Math.abs(entD[0].sets[0].w - 11.3) < 1e-9, 'teclear 0 guarda el aparato vacío (11,3)');
/* y si hubo conversión de unidad, el offset se suma sobre el canónico */
db.active.exercises[0].sets = [{ w:'22.05', wkg: 10, r:'8', rir:'' }];
entD = fixtureEntries();
chk(Math.abs(entD[0].sets[0].w - 21.3) < 1e-9, 'con kg canónicos (conversión de unidad) el offset se suma igual');

/* el chip de volumen compara peras con peras */
sess('remomaq', [S(41.3, 10)], 7);
db.active.exercises[0].sets = [{ w:'30', r:'10', rir:'' }];
confirmFixtureSets();const viD = vsLastInfo(0);
chk(viD && viD.pct === 100, 'volumen vs última sesión: 30 tecleado hoy = 41,3 guardado ayer (100 %)');

/* el caso reportado: base 11,3, cargó 15 por lado, tecleó 30 */
db.gym.plates = [
  { kg:20, pairs:2, on:true }, { kg:10, pairs:2, on:true },
  { kg:5, pairs:2, on:true }, { kg:2.5, pairs:2, on:true }
];
invalidatePlates();
const twD = targetWeight(db.active.exercises[0]);
chk(Math.abs(twD - 41.3) < 1e-9, 'el objetivo de carga parte del peso real');
const lpD = loadPlan('remomaq', twD);
chk(lpD && Math.abs(lpD.perPointKg - 15) < 1e-9 && lpD.exact,
    'y la calculadora dice 15 por lado EXACTOS — ya no «10 por lado ≈ 31,3»');
const stripD = loadStripHTML(0);
chk(stripD.includes('Anotas (solo discos)') && stripD.includes('>30 kg<'),
    'la tira de carga enseña también lo que se anota: 30');

/* la sugerencia del coach se guarda real pero se teclea sin la base */
db.active.exercises[0].sugg = { w:41.3, reps:8, sets:3, type:'up', msg:'', why:'' };
const rowD = setRowHTML(0, 0, { w:'', r:'', rir:'' }, db.active.exercises[0].sugg, 'normal');
chk(rowD.includes('placeholder="30"'), 'el placeholder de la serie sugiere 30, listo para teclear');
chk(weightColLabel('remomaq', 'normal') === 'kg discos', 'la columna avisa: ahí van solo los discos');

/* el aviso de una sola vez */
const noticeD = dbNoticeHTML('remomaq');
chk(noticeD.includes('Anota solo los discos') && noticeD.includes('11,3'),
    'la primera vez sale el aviso con el peso del aparato');
db.settings.discosNoticeSeen = new Date().toISOString();
chk(dbNoticeHTML('remomaq') === '', 'y una vez entendido, no vuelve');
delete db.settings.discosNoticeSeen;

/* el calentamiento también parte del peso real */
const wpD = warmupPlan(0);
chk(wpD && Math.abs(wpD.W - 41.3) < 1e-9, 'la escalera de calentamiento se calcula sobre 41,3, no sobre 30');

suite('Barra — mismo trato: anotas solo los discos');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.gym.bars = [{ id:'ol', name:'Olímpica', kg:20, on:true, def:true }];
db.gym.plates = [
  { kg:20, pairs:2, on:true }, { kg:10, pairs:2, on:true },
  { kg:5, pairs:2, on:true }, { kg:2.5, pairs:2, on:true }
];
invalidatePlates();
exMeta('press banca').equip = 'barra';
chk(discosOffset('press banca') === 20, 'la barra del ejercicio se vuelve el offset');
chk(typedToKg('press banca', 5) === 25, 'teclear 5 son 25 reales (2,5 por lado + la barra)');
chk(kgToTyped('press banca', 25) === 5, 'y 25 reales se enseñan como 5 al teclear');

/* el caso reportado: tecleó 0 (barra sola) y luego 5 (2,5 por lado) */
db.active = { routineId:'', routineName:'X', start: Date.now(), exercises:[
  { key:'press banca', name:'Press banca', sugg:null, sets:[{ w:'0', r:'10', rir:'' }] }
]};
let entB = fixtureEntries();
chk(entB[0].sets[0].w === 20, 'teclear 0 guarda la barra sola: 20');
chk(targetWeight(db.active.exercises[0]) === 20, 'y la calculadora entiende «barra vacía»');
db.active.exercises[0].sets = [{ w:'5', r:'10', rir:'' }];
entB = fixtureEntries();
chk(entB[0].sets[0].w === 25, 'teclear 5 guarda 25 reales');
const lpB = loadPlan('press banca', targetWeight(db.active.exercises[0]));
chk(lpB && Math.abs(lpB.perPointKg - 2.5) < 1e-9 && lpB.exact,
    'y manda 2,5 por lado EXACTOS — ya no «la barra sola es lo más cercano a 5»');
const stripB = loadStripHTML(0);
chk(stripB.includes('Anotas (solo discos)') && stripB.includes('>5 kg<'),
    'la tira de carga también enseña lo que se anota: 5');

/* la sugerencia real se teclea sin la barra */
db.active.exercises[0].sugg = { w:25, reps:8, sets:3, type:'up', msg:'', why:'' };
chk(setRowHTML(0, 0, { w:'', r:'', rir:'' }, db.active.exercises[0].sugg, 'normal').includes('placeholder="5"'),
    'el placeholder sugiere 5, listo para teclear');

/* sin barra disponible no hay offset: lo tecleado vuelve a ser el total */
db.gym.bars = [];
chk(discosOffset('press banca') === 0 && typedToKg('press banca', 25) === 25,
    'sin barra en el inventario, nada cambia');
db.gym.bars = [{ id:'ol', name:'Olímpica', kg:20, on:true, def:true }];
db.active = null;

/* en libras, el puente respeta la unidad activa */
db.settings.unit = 'lb';
exMeta('pressLb').equip = 'discos';
exMeta('pressLb').base = toKg(10);   /* el aparato pesa 10 lb */
chk(Math.abs(fromKgEx('pressLb', kgToTyped('pressLb', typedToKg('pressLb', 30))) - 30) < 0.01,
    'teclear 30 lb y volver da 30 lb, sin arrastre');
chk(fmtWEx('pressLb', typedToKg('pressLb', 30)) === '40', '30 lb en discos + 10 lb de aparato = 40 lb reales');
db.settings.unit = 'kg';
db.active = null;

/* ---------- rediseño: regresiones funcionales ---------- */
suite('Rediseño — series completas y valores explícitos');
resetDB();
db.gym = defaultGym('kg');
exMeta('press ux').equip = 'barra';
chk(!uiValidSet('press ux', {w:'',r:'12'}), 'reps sin peso no son una serie completa');
chk(uiValidSet('press ux', {w:'0',r:'12'}), 'cero discos con barra sí es una serie válida');
chk(!uiValidSet('press ux', {w:'20',r:'2.5'}), 'las repeticiones fraccionarias se rechazan');
chk(!uiValidSet('press ux', {w:'Infinity',r:'12'}), 'se rechazan cargas no finitas');
exMeta('plancha ux').type='tiempo';
chk(uiValidSet('plancha ux', {w:'',r:'30'}), 'un ejercicio por tiempo puede omitir lastre');
db.active={id:'ux',routineId:'ux-r',routineName:'UX',start:Date.now(),exercises:[{key:'press ux',name:'Press UX',sugg:{w:60,reps:8,sets:3,type:'up',msg:'',why:''},sets:[{w:'',r:'12',rir:'2'},{w:'',r:'',rir:''}]}]};
chk(!exDone(db.active.exercises[0]), 'no se da por hecho un ejercicio con peso pendiente');
toggleSetDone(0,0);
chk(!db.active.exercises[0].sets[0].done, 'confirmar no acepta la serie incompleta');
chk(collectEntries(db.active).length===0, 'al terminar no se guardan series incompletas');
uiUseSuggestion(0);
chk(db.active.exercises[0].sets[0].w==='40', 'aplicar la propuesta descuenta los 20 kg de barra');
chk(db.active.exercises[0].sets[0].r==='8' && db.active.exercises[0].sets[0].rir==='2', 'aplicar propuesta sustituye reps y conserva el RIR escrito');
chk(!db.active.exercises[0].sets[0].done, 'aplicar sugerencia no finge haber completado la serie');
prepareFixture(0);toggleSetDone(0,0);
db.active.exercises[0].sets[1]={w:'50',r:'10',rir:''};
chk(targetWeight(db.active.exercises[0])===70, 'la calculadora sigue la serie actual, no la primera');
toggleSetDone(0,1);
chk(db.active.open===0, 'al completar, el ejercicio permanece visible para revisar el logro');
const activeId=db.active.id;
db.routines.push({id:'other',name:'Otro día',exercises:[{id:'e',key:'x',name:'X'}]});
startSession('other');
chk(db.active.id===activeId, 'iniciar otra rutina no sobreescribe la sesión en curso');
db.active.uiRest=true;
chk(uiSession().includes('+30 segundos') && !uiSession().includes('Distrito'), 'la fase de descanso permite añadir tiempo sin datos de ejemplo');
delete db.active.uiRest;
clearInterval(timerInt);timerInt=null;

suite('Rediseño — descanso persistente');
db.settings.rest='auto';db.settings.goal='hipertrofia';
exMeta('press ux').rest=240;
startRestAuto('press ux');
chk(db.active.restDuration===240 && db.active.restUntil>Date.now()+239000, 'se conserva la duración propia del ejercicio');
const restoredRest=JSON.parse(localStorage.getItem(LS_KEY)).active;
chk(restoredRest.restUntil===db.active.restUntil, 'el final del descanso se guarda junto a las series');
uiAddRest();
chk(db.active.restUntil>=restoredRest.restUntil+29990, '+30 segundos se añade al descanso que quedaba');
toggleRest();
chk(!db.active.restUntil, 'saltar el descanso también limpia el estado guardado');
db.active=null;restUntil=null;

suite('Rediseño — atlas sin doble conteo ni falsa precisión');
resetDB();
const atlasNow=Date.now();
exMeta('sentadilla ux').muscle='pierna';exMeta('extension ux').muscle='cuadriceps';exMeta('sin grupo ux').muscle=null;
db.history=[{id:'ux-map',date:new Date(atlasNow-864e5).toISOString(),entries:[
 {key:'sentadilla ux',name:'Sentadilla',sets:[S(40,10),S(40,10)]},
 {key:'extension ux',name:'Extensión',sets:[S(20,10),S(20,10),S(20,10)]},
 {key:'sin grupo ux',name:'Sin grupo',sets:[S(10,10)]}
]}];
const atlas=uiMuscleStats(atlasNow);
chk(atlas.total===6 && atlas.untagged===1 && atlas.counts.pierna===2 && atlas.counts.cuadriceps===3, 'series generales, específicas y sin grupo se cuentan una sola vez');
chk(uiAtlas(true).includes('Pierna: 5 series') && uiAtlas(false).includes('Pierna: 2 series'), 'inicio agrupa la pierna; el detalle la desglosa sin duplicarla');
chk(uiAtlas(false).includes('Cuádriceps: 3 series') && uiAtlas(false).includes('1 series sin grupo'), 'el detalle muestra cifras y declara las series sin asignar');
chk(uiMuscleColor(0,10)==='var(--muscle-zero)', 'sin registro se conserva el tono neutro del contorno');
db.history.push({id:'future',date:new Date(atlasNow+864e5).toISOString(),entries:[{key:'extension ux',name:'Futuro',sets:[S(20,10)]}]});
chk(uiMuscleStats(atlasNow).total===6, 'el atlas no cuenta sesiones fechadas en el futuro');
chk(guessMuscle('Leg extension')==='cuadriceps' && guessMuscle('Peso muerto rumano')==='isquios' && guessMuscle('Calf raise')==='pantorrillas', 'los ejercicios nuevos reconocen las categorías específicas');
chk(exMeta('sentadilla ux').muscle==='pierna', 'la categoría antigua no se migra inventando detalle');
chk(uiAtlas(false).includes('Vista frontal') && uiAtlas(false).includes('Vista posterior'), 'ambas vistas tienen alternativa de texto');

suite('Rediseño — navegación, seguridad de texto y recursos offline');
chk(uiAction('uiMuscleDetail', "curl d'\"<x>").includes('&lt;') && uiAction('uiMuscleDetail', "curl d'\"<x>").includes('&#39;'), 'los argumentos nuevos se escapan como JavaScript y como HTML');
const uiSource=fs.readFileSync(path.join(__dirname,'..','ui.js'),'utf8');
const cssSource=fs.readFileSync(path.join(__dirname,'..','ui.css'),'utf8');
const swSource=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
chk(!html.includes('user-scalable=no'), 'el zoom está permitido');
chk(!html.includes('href="https://fonts.googleapis.com'), 'la tipografía ya no requiere fuentes de red');
chk(swSource.includes("'./ui.css'")&&swSource.includes("'./ui.js'"), 'la PWA precarga los recursos del rediseño');
chk(cssSource.includes('prefers-reduced-motion'), 'las animaciones respetan movimiento reducido');
chk(uiSource.includes('uiSetupModal')&&uiSource.includes("e.key==='Escape'")&&uiSource.includes('el.inert=open'), 'los diálogos contienen el foco y admiten Escape');
clearInterval(timerInt);timerInt=null;
resetDB();

suite('Rediseño — métricas de asistencia y de tiempo');
resetDB();
exMeta('dominadas asistidas ux').type='asistido';
exMeta('dominadas asistidas ux').equip='placas';
db.history=[{id:'assist1',date:new Date(Date.now()-864e5).toISOString(),entries:[{key:'dominadas asistidas ux',name:'Dominadas asistidas',sets:[S(25,10)]}]},
 {id:'assist2',date:new Date().toISOString(),entries:[{key:'dominadas asistidas ux',name:'Dominadas asistidas',sets:[S(0,10)]}]}];
view={name:'exercise',key:'dominadas asistidas ux',exname:'Dominadas asistidas'};
const assistScreen=viewExercise();
chk(assistScreen.includes('Tu menor asistencia') && !assistScreen.includes('1RM estimado'), 'los asistidos muestran ayuda real, no un 1RM de la asistencia');
chk(window.__chartPts.some(p=>p.v===0), 'la gráfica conserva el logro de llegar a cero ayuda');
exMeta('plancha ux').type='tiempo';
const timeRec={id:'timed-ux',routineName:'Core',date:new Date().toISOString(),duration:120,entries:[{key:'plancha ux',name:'Plancha',sets:[S(0,30),S(0,45)]}]};
const timeFinish=finishScreenHTML(timeRec,[],'');
chk(uiSessionMeasure(timeRec.entries).value===75 && uiSessionMeasure(timeRec.entries).unit==='s', 'una sesión solo por tiempo suma segundos');
chk(timeFinish.includes('Tiempo registrado')&&timeFinish.includes('Total de segundos')&&!timeFinish.includes('Total de reps'), 'el cierre por tiempo no celebra cero repeticiones');
db.history=[{id:'only-history',date:new Date().toISOString(),entries:[{key:'historico ux',name:'Ejercicio histórico',sets:[S(20,10)]}]}];
view={name:'history'};openExerciseByKey('historico ux');
chk(view.name==='exercise'&&view.exname==='Ejercicio histórico', 'un ejercicio retirado del plan sigue abriéndose desde el historial');
chk(exerciseHeadHTML().includes('Progreso'), 'la ficha abierta desde progreso vuelve a progreso');
view={name:'home'};resetDB();


suite('Experiencia nueva — navegación y tareas separadas');
resetDB();db.gym=defaultGym('kg');db.settings.rest='auto';view={name:'home'};
renderTabs();
chk((els.tabs.innerHTML.match(/<button/g)||[]).length===3 && els.tabs.innerHTML.includes('Entrenar') && els.tabs.innerHTML.includes('Evolución') && els.tabs.innerHTML.includes('Tú'), 'hay tres destinos globales');
db.splits=[{id:'newsp',name:'Plan UX',active:true,exconf:{}}];
db.routines=[{id:'newr',name:'Día UX',split:'newsp',exercises:[{id:'newex',name:'Press UX',key:'press ux'}]}];
exMeta('press ux').equip='barra';
view={name:'routine',id:'newr'};
chk(!viewRoutine().includes('removeExercise'), 'la preparación no mezcla controles para quitar ejercicios');
view.sort=true;
chk(viewRoutine().includes('removeExercise')&&viewRoutine().includes('uiLibrary'), 'Ordenar y quitar permite gestionar la misma lista del día');
view={name:'exercise',key:'press ux',exname:'Press UX',rid:'newr',exTab:'equipment'};
chk(viewExercise().includes('Equipo') && !viewExercise().includes('Rango mínimo'), 'Equipo no muestra reglas de progresión');
view.exTab='targets';
chk(viewExercise().includes('Rango mínimo')&&!viewExercise().includes('Primera placa'), 'Objetivos no muestra el formulario de la torre');
view={name:'settings'};
chk(viewSettings().includes('Datos y respaldos')&&!viewSettings().includes('backupfile'), 'Tú es un índice, el formulario de datos vive en su categoría');
view={name:'gym',kind:'dumbbells'};
chk(viewGym().includes('n-rack')&&viewGym().includes('aria-pressed'), 'el rack es una cuadrícula de disponibilidad accesible');
view={name:'routine',id:'newr'};startSession('newr');
db.active.exercises[0].sets=[{w:'',r:'',rir:''},{w:'',r:'',rir:''}];
setVal(0,0,'w','40');setVal(0,0,'r','10');
chk(restUntil===null,'escribir peso y reps no inicia el descanso');
prepareFixture(0);uiLogSet(0,0);
chk(db.active.exercises[0].sets[0].done&&db.active.uiRest&&restUntil>Date.now(), 'confirmar guarda la serie y abre el descanso');
chk(uiSession().includes('n-rest-phase')&&!uiSession().includes('id="n-weight"'), 'el descanso sustituye el formulario de la serie');
uiContinue();
const focused=uiSession();
chk(focused.includes('Serie 2 de 2')&&(focused.match(/id="n-weight"/g)||[]).length===1,'se presenta una sola serie pendiente');
chk(focused.includes('62')===false&&focused.includes('60 kg total'), 'las series anteriores muestran la carga física total');
clearInterval(timerInt);timerInt=null;

suite('Cambios de gimnasio — preservar la carga física');
const beforeGym=db.settings.gymId,barred=db.active.exercises[0].sets[0];
const firstGym=db.gym;
const lightGym=Object.assign(defaultGym('kg'),{id:'light-gym',name:'Barras ligeras',unit:'kg',machines:{'press ux':{equip:'barra',bar:'lightbar'}}});
lightGym.bars=[{id:'lightbar',name:'Barra 10 kg',kg:10,on:true,def:true}];
db.gyms.push(lightGym);
setActiveGym('light-gym');
chk(barred.w==='50'&&barred.totalKg===60,'al cambiar de barra de 20 a 10 se recalculan discos, conservando 60 kg');
chk(fixtureEntries()[0].sets[0].w===60,'el historial guardará 60 kg, no 50');
setActiveGym(beforeGym);
chk(barred.w==='40'&&fixtureEntries()[0].sets[0].w===60,'volver al gimnasio original no acumula cambios de carga');
setVal(0,0,'w','45');
chk(barred.totalKg===undefined&&fixtureEntries()[0].sets[0].w===65,'reescribir el peso establece una carga nueva');
exMeta('press ux').bar=null;
withExChange('press ux',()=>{exMeta('press ux').equip='discos';exMeta('press ux').base=15;});
chk(fixtureEntries()[0].sets[0].w===65&&barred.w==='50','cambiar el peso base desde la ficha también preserva la carga total');
uiContinue();clearInterval(timerInt);timerInt=null;db.active=null;restUntil=null;

suite('Interfaz — nombres con comillas y validación sin perder borradores');
const quotedKey=exKey('Press d\'Ángelo "Cable" \\ A');
exMeta(quotedKey).equip='placas';view={name:'exercise',key:quotedKey,exname:quotedKey,exTab:'equipment'};
const quotedMarkup=uiExercise();
const decodeAttr=t=>t.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
let validHandlers=true;
for(const match of quotedMarkup.matchAll(/on(?:click|input|change)="([^"]*)"/g))try{new Function(decodeAttr(match[1]));}catch{validHandlers=false;}
chk(validHandlers,'los handlers de Equipo aceptan nombres con comillas y barras');
const rawKey=decodeAttr(uiInlineKey(quotedKey));
chk(new Function("return '"+rawKey+"'")()===quotedKey,'la clave conserva exactamente su nombre al pasar por HTML y JavaScript');
window.__edit={id:'draft',routineName:'Draft',date:new Date().toISOString(),entries:[{key:quotedKey,name:'Press',sets:[{w:'20',r:'2.5',rir:''}]}]};
uiEditHistory();uiSaveHistory();
chk(window.__edit.entries[0].sets[0].r==='2.5'&&els['n-history-error'].textContent.includes('siguen aquí'),'un error al editar conserva los cambios y explica la corrección');
closeModal();window.__edit=null;view={name:'home'};resetDB();


suite('3.0.1 — propuesta, confirmación y descanso son acciones distintas');
resetDB();db.settings.rest='auto';db.settings.unit='kg';db.gym=defaultGym('kg');
db.splits=[{id:'fix-sp',name:'Plan de revisión',active:true,exconf:{}}];
db.routines=[{id:'fix-day',name:'Torso A',split:'fix-sp',exercises:['Press X','Press de banca','Press lleno'].map((name,i)=>({id:'fix-'+i,name,key:exKey(name)}))}];
view={name:'routine',id:'fix-day'};startSession('fix-day');
for(const ex of db.active.exercises){ex.sugg={w:40,reps:8,sets:1,type:'hold',msg:'Propuesta de prueba'};ex.sets=[{w:'',r:'',rir:''}];}
const historyBeforeProposal=db.history.length;
uiUseSuggestion(0);
chk(sessionOpenIdx()===0&&!exDone(db.active.exercises[0]),'rellenar una propuesta no termina ni cambia el ejercicio');
chk(db.active.exercises[0].sets[0].w==='40'&&db.active.exercises[0].sets[0].r==='8'&&!db.active.exercises[0].sets[0].done,'la propuesta prepara campos, sin confirmar');
chk(collectEntries(db.active).length===0&&restUntil===null,'un borrador preparado no genera historial ni descanso');
chk(vsLastInfo(0)===null,'no se celebra volumen de una propuesta sin registrar');
uiEditSet(0,0);document.getElementById('n-edit-w').value='40';document.getElementById('n-edit-r').value='8';document.getElementById('n-edit-rir').value='';uiSaveSet({preventDefault(){}},0,0);
chk(collectEntries(db.active).length===0&&!exDone(db.active.exercises[0]),'editar un borrador no lo confirma ni evita el registro');
uiUseSuggestion(0);
chk(sessionOpenIdx()===0&&collectEntries(db.active).length===0,'pulsar otra vez tampoco avanza ni confirma');
askFinish();
chk(els.modalhost.innerHTML.includes('No hay series confirmadas')&&db.active!==null,'terminar explica que no se han confirmado series');
closeModal();finishSession();
chk(db.history.length===historyBeforeProposal&&db.active!==null,'ni siquiera el cierre directo crea una sesión con propuestas sin confirmar');
closeModal();prepareFixture(0);uiLogSet(0,0);
const firstRest=restUntil;
chk(exDone(db.active.exercises[0])&&collectEntries(db.active).length===1,'registrar sí confirma el ejercicio de una serie');
chk(sessionOpenIdx()===0&&db.active.uiRest&&uiSession().includes('Ejercicio completo'),'el descanso de la última serie permanece en el ejercicio correcto');
prepareFixture(0);uiLogSet(0,0);
chk(restUntil===firstRest,'una confirmación repetida no reinicia el descanso');
db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));
chk(db.active.uiRest&&db.active.restUntil===firstRest&&sessionOpenIdx()===0,'la recarga conserva confirmación, ejercicio y descanso');
uiContinue();
chk(sessionOpenIdx()===1&&!db.active.uiRest,'continuar tras el último descanso lleva al siguiente ejercicio sin otro paso');
uiSelectExercise(1);uiUseSuggestion(1);prepareFixture(1);uiLogSet(1,0);uiContinue();uiSelectExercise(2);uiUseSuggestion(2);
chk(collectEntries(db.active).length===2,'el cierre incluye solo las dos series confirmadas, no la tercera propuesta');
askFinish();
chk(els.modalhost.innerHTML.includes('sin confirmar'),'el cierre advierte de campos rellenados pendientes de confirmar');closeModal();
finishSession();
chk(db.history.at(-1).entries.length===2&&!db.history.at(-1).entries.some(e=>e.key==='press lleno'),'el historial no incluye el ejercicio que solo tenía una propuesta');
closeModal();clearInterval(timerInt);timerInt=null;restUntil=null;

suite('3.0.1 — acceso a todos los ejercicios y regreso al diario');
const onlyTime='dead hang',onlyAssist='dominada asistida';
Object.assign(exMeta(onlyTime),{type:'tiempo',equip:'nada'});Object.assign(exMeta(onlyAssist),{type:'asistido',equip:'placas'});
sess(onlyTime,[S(0,30)]);sess(onlyAssist,[S(0,10)]);
const directory=uiExerciseDirectoryRows('');
chk(directory.includes('press lleno')||directory.includes('Press lleno'),'también aparecen los ejercicios todavía sin historial');
chk(directory.includes(onlyTime)&&directory.includes(onlyAssist),'la lista incluye tiempo y asistencia, aunque no estén en un plan');
chk(uiExerciseDirectoryRows('DEAD').includes(onlyTime)&&!uiExerciseDirectoryRows('DEAD').includes('Press X'),'la búsqueda encuentra por nombre y filtra el resto');
chk(uiExerciseMetric(onlyAssist).pts[0].v===0,'cero ayuda sigue siendo un registro visible de progreso');
view={name:'history',progressTab:'diary',historyFilter:'fix-day'};
const receiptId=db.history.find(h=>h.routineId==='fix-day').id;uiReceipt(receiptId);
chk(els.modalhost.innerHTML.includes('Ver progreso de Press X')&&els.modalhost.innerHTML.includes('uiOpenProgress'),'los ejercicios del recibo abren su propia evolución');
uiOpenProgress('press x',receiptId);
chk(view.name==='exercise'&&view.exTab==='progress'&&view.from==='history','desde el diario se abre directamente Evolución, sin pasar por Equipo');
uiBackToProgress();
chk(view.progressTab==='diary'&&view.historyFilter==='fix-day'&&els.modalhost.innerHTML.includes('Ver progreso de Press X'),'volver recupera el recibo y el filtro del diario');closeModal();
view={name:'history',progressTab:'exercises'};uiOpenProgress(onlyTime);
chk(view.name==='exercise'&&view.exTab==='progress'&&uiExerciseProgress(onlyTime).includes('Tu primera referencia ya está aquí'),'un solo registro por tiempo ya tiene un punto de referencia visible');

suite('3.0.1 — ejercicios por tiempo sin equivalencias ficticias de RIR');
db.active=null;db.routines=[{id:'time-day',name:'Tiempo',split:'fix-sp',exercises:[{id:'hang',name:'Dead hang',key:onlyTime}]}];
view={name:'routine',id:'time-day'};startSession('time-day');
const timeBefore=JSON.stringify(computeSuggestion(onlyTime));
for(const h of db.history)for(const e of h.entries)if(e.key===onlyTime)for(const st of e.sets)st.rir=0;
chk(JSON.stringify(computeSuggestion(onlyTime))===timeBefore,'un RIR antiguo en un ejercicio por tiempo no altera la propuesta');
prepareFixture(0);const timeUI=uiSession();
chk(timeUI.includes('no se usa RIR')&&!timeUI.includes('onclick="uiRIR('),'la sesión por tiempo explica la unidad y no muestra selector de RIR');
setVal(0,0,'r','35');setVal(0,0,'rir','1');
chk(db.active.exercises[0].sets[0].rir==='','no se acepta 1 RIR como si significara segundos');
prepareFixture(0);uiLogSet(0,0);
chk(collectEntries(db.active)[0].sets[0].r===35&&collectEntries(db.active)[0].sets[0].rir===undefined,'se guarda la duración sin RIR, con lastre vacío permitido');
uiEditSet(0,0);chk(!els.modalhost.innerHTML.includes('id="n-edit-rir"'),'el editor de una serie por tiempo tampoco pide RIR');closeModal();
db.history=[];sess(onlyTime,[S(0,30,0),S(0,30,0),S(0,30,0)]);sess(onlyTime,[S(0,35,0),S(0,35,0),S(0,35,0)]);
chk(failureHabit()===null,'los RIR antiguos por tiempo no disparan avisos de fallo por repeticiones');
uiContinue();db.active=null;clearInterval(timerInt);timerInt=null;restUntil=null;

suite('3.0.1 — un único espacio para el día y salidas no redundantes');
view={name:'routine',id:'time-day'};
const oneDay=uiRoutine();
chk(!oneDay.includes('Ver preparación')&&!oneDay.includes('Editar día')&&(oneDay.match(/Añadir ejercicios/g)||[]).length===1,'hay una sola página del día y un único acceso a añadir ejercicios');
chk(uiIsDismissAction('closeModal();')&&!uiIsDismissAction('stopSetTimer(false)')&&!uiIsDismissAction('closeModal();deleteRoutine("x")'),'se distingue cerrar de una acción que descarta una medición o cambia datos');
view={name:'home'};resetDB();


suite('3.0.1 — acciones conectadas en vistas y diálogos');
resetDB();db.settings.rest='auto';db.splits=[{id:'audit-sp',name:'Plan auditoría',active:true,exconf:{}}];
db.routines=[{id:'audit-day',name:'Día auditoría',split:'audit-sp',exercises:[{id:'audit-ex',name:'Press auditoría',key:'press audit'}]}];
Object.assign(exMeta('press audit'),{equip:'placas',muscle:'pecho',stack:{unit:'kg',start:5,step:5},notes:'Asiento en 4'});
sess('press audit',[S(30,10)]);
db.active={id:'audit-active',routineId:'audit-day',routineName:'Día auditoría',start:Date.now(),open:0,exercises:[{key:'press audit',name:'Press auditoría',sets:[{w:'',r:'',rir:''}],sugg:computeSuggestion('press audit')}]};
let auditedHandlers=0;const brokenHandlers=[],auditMarkup=[];
function auditActions(label,markup){
 if(!label.includes('/cabecera'))auditMarkup.push({label,markup,view:{...view}});
 for(const match of markup.matchAll(/on(?:click|input|change|submit)="([^"]*)"/g)){
  const code=decodeAttr(match[1]);auditedHandlers++;
  try{new Function('event',code);}catch(e){brokenHandlers.push(label+': sintaxis '+e.message);continue;}
  for(const call of code.matchAll(/(?<![.\w])\b([A-Za-z_$][\w$]*)\s*\(/g)){
   const name=call[1];if(['if','for','while','switch','function','catch'].includes(name))continue;
   try{if(eval('typeof '+name)!=='function')brokenHandlers.push(label+': '+name+' no está conectado');}catch(e){brokenHandlers.push(label+': '+name);}
  }
 }
}
const screens=[['home',uiHome],['splits',uiPlans],['split',uiPlan],['routine',uiRoutine],['session',uiSession],['exercise',uiExercise],['history',uiProgress],['settings',uiSettings],['gym',uiGym]];
for(const [name,make] of screens){
 const variants=name==='exercise'?['progress','equipment','targets']:name==='history'?['summary','exercises','body','diary']:name==='settings'?['','session','appearance','data','help','gyms','sync','notifications']:name==='gym'?['plates','bars','dumbbells','machines']:[''];
 for(const variant of variants){view={name,id:name==='split'?'audit-sp':'audit-day',rid:'audit-day',key:'press audit',exname:'Press auditoría',exTab:variant,progressTab:variant,section:variant,kind:variant||'plates'};auditActions(name+'/'+variant,make());uiTop();auditActions(name+'/cabecera',els.topbar.innerHTML);}
}
view={name:'routine',id:'audit-day',sort:true};auditActions('Ordenar y quitar',uiRoutine());
view={name:'session'};
const sheets=[()=>promptNewSplit(),()=>uiPlanOptions('audit-sp'),()=>uiPlanRules('audit-sp'),()=>uiDayOptions('audit-day'),()=>uiLibrary('audit-day'),()=>uiSessionQueue(),()=>uiSessionOptions(0),()=>uiEditSet(0,0),()=>uiRIR(0,0),()=>uiGymPicker(),()=>uiInventoryOptions('plates'),()=>uiDumbbellRange(),()=>uiReceipt(db.history[0].id),()=>showLoad(0),()=>showWarmup(0)];
 sheets.push(()=>uiChooseDay(),()=>uiNewDay('audit-sp'),()=>editExNotes(0),()=>promptRenameSplit('audit-sp'),()=>promptRenameRoutine('audit-day'),()=>promptDuplicateEx('press audit','Press auditoría'),()=>uiDeload('audit-day'),()=>uiEditSets(0),()=>uiSuggestionInfo(0),()=>uiWelcome(),()=>confirmModal('Eliminar ejemplo','Se conserva el historial.','Eliminar',()=>{}),()=>infoModal('Información','Detalle de prueba'));
for(const [i,show] of sheets.entries()){show();auditActions('Diálogo '+i,els.modalhost.innerHTML);closeModal();}
db.active=null;view={name:'home'};auditActions('home/sin sesión',uiHome());
chk(auditedHandlers>200&&brokenHandlers.length===0,`${auditedHandlers} acciones de vistas y diálogos tienen sintaxis válida y funciones existentes`);
if(brokenHandlers.length)console.log(brokenHandlers);
uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;view={name:'home'};resetDB();

/* Optional browser fixtures use exactly the markup above and production CSS/helpers.
   They contain no storage, training engine or actionable data. */
if(process.argv.includes('--ui-audit')){
 const legacyStyle=html.match(/<style>([\s\S]*?)<\/style>/)[1];
 const escapeHTML=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 const frames=auditMarkup.map(({label,markup,view:v})=>{
  const sheet=markup.includes('class="overlay'),src=`<!doctype html><html lang="es" data-theme="light" data-motion="off"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${legacyStyle}</style><link rel="stylesheet" href="../ui.css?v=${APP_VERSION}"><script src="../ui.js?v=${APP_VERSION}"></script></head><body data-view="${v.name}"><div id="app"><main id="main">${sheet?'':markup}</main></div><nav id="tabs"></nav><div id="modalhost">${sheet?markup:''}</div><script>const view={name:'home'};uiArrangeActions(document.getElementById('main'));uiSetupModal();document.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();},true);document.addEventListener('submit',e=>e.preventDefault(),true);</script></body></html>`;
  return `<section><h2>${escapeHTML(label)}</h2><iframe title="${escapeHTML(label)}" srcdoc="${escapeHTML(src)}"></iframe></section>`;
 }).join('');
 const gallery=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Auditoría visual de componentes</title><style>body{font:14px system-ui;margin:20px;background:#eceee8;color:#20372f}header{position:sticky;top:0;background:#eceee8;padding:15px;z-index:9}button{font:inherit;padding:12px;margin-right:12px}iframe{width:390px;height:850px;border:1px solid #89937f;background:white}#cases{display:flex;flex-wrap:wrap;gap:30px}h2{font-size:16px}</style></head><body><header><h1>Componentes reales · ${auditMarkup.length} casos</h1><p>Solo geometría y presentación. Sin datos guardados ni acciones.</p><button onclick="size(320)">320 px</button><button onclick="size(1280)">1280 px</button><button onclick="theme('light')">Tema claro</button><button onclick="theme('dark')">Tema oscuro</button></header><div id="cases">${frames}</div><script>function size(w){document.querySelectorAll('iframe').forEach(f=>f.style.width=w+'px')}function theme(t){document.querySelectorAll('iframe').forEach(f=>f.contentDocument.documentElement.dataset.theme=t)}</script></body></html>`;
 fs.writeFileSync(path.join(__dirname,'../mockups/ui-audit.html'),gallery);
 console.log('Auditoría visual generada: mockups/ui-audit.html');
}

suite('3.1.0 — eliminación de planes y estado vacío persistente');
resetDB();view={name:'home'};db.splits=[{id:'delete-a',name:'Plan A',active:true,exconf:{}},{id:'delete-b',name:'Plan B',active:false,exconf:{}}];
db.routines=[{id:'delete-day',name:'Torso',split:'delete-a',exercises:[{id:'delete-ex',name:'Press',key:'delete press'}]}];
sess('delete press',[S(40,10)]);const retainedHistory=JSON.stringify(db.history),retainedProgress=JSON.stringify(db.progress);
deleteSplit('delete-a');
chk(els.modalhost.innerHTML.includes('Plan B')&&db.splits.length===2,'el diálogo explica el reemplazo, sin borrar antes de confirmar');
closeModal();chk(db.splits.length===2,'cancelar conserva el plan y sus días');
deleteSplit('delete-a');window.__confirmFn();
chk(db.splits.length===1&&activeSplit().id==='delete-b'&&!db.routines.length,'borrar el activo elimina sus días y activa el otro plan');
chk(view.name==='splits'&&uiPlans().includes('Plan A” se eliminó'),'se informa de la eliminación sin mostrar la ficha obsoleta');
deleteSplit('delete-b');chk(els.modalhost.innerHTML.includes('sin planes'),'se puede confirmar la eliminación del último plan');window.__confirmFn();
db=load();
chk(db.splits.length===0&&db.routines.length===0&&activeSplit()===null,'recargar no recrea el último plan eliminado');
chk(JSON.stringify(db.history.map(({splitId,...h})=>h))===retainedHistory&&JSON.stringify(db.progress)===retainedProgress,'todos los registros y marcas sobreviven a borrar todos los planes');
chk(uiPlans().includes('Crear primer día')&&uiHome().includes('Crear mi primer día'),'el estado vacío permite comenzar otra vez');
db.splits=[{id:'busy-plan',name:'En uso',active:true,exconf:{}}];db.routines=[{id:'busy-day',name:'Torso',split:'busy-plan',exercises:[]}];
db.active={routineId:'busy-day',exercises:[],start:Date.now()};deleteSplit('busy-plan');
chk(db.splits.length===1&&els.modalhost.innerHTML.includes('Continuar sesión'),'un plan en uso mantiene su configuración y permite volver a la sesión');
closeModal();db.active=null;clearInterval(timerInt);timerInt=null;

suite('3.1.0 — cinco minutos y reglas por contexto');
view={name:'home'};db.settings.rest='300';
chk(restSecs()===300&&uiPreferences().includes('value="300" selected>5:00'),'cinco minutos está disponible en preferencias y se calcula como 300 segundos');
const restKey='rest review';view={name:'exercise',key:restKey,rid:'busy-day',targetScope:'general'};
setExRest(restKey,'300');chk(restSecs(restKey)===300&&uiTargets(restKey).includes('value="300" selected>5:00'),'el descanso propio del ejercicio admite cinco minutos');
db.splits[0].exconf[restKey]={rest:180};chk(restSecs(restKey)===180,'la regla del plan conserva prioridad sobre los cinco minutos generales');
db.splits[0].exconf[restKey].rest=300;view.targetScope='plan';
chk(uiTargets(restKey).includes('value="300" selected>5:00'),'también se pueden elegir cinco minutos solo para ese plan');
db.settings.rest='off';chk(restSecs(restKey)===null,'Sin temporizador sigue desactivando el descanso');

suite('3.1.0 — preferencias, cierres y switch sin rehacer el diálogo');
db=normalize(db);uiSetPreference('theme','dark');uiSetPreference('sound','off');uiSetPreference('motion','off');db=load();
chk(db.settings.theme==='dark'&&db.settings.sound==='off'&&db.settings.motion==='off','apariencia, sonido y movimiento se conservan al recargar');
uiSetPreference('theme','invalid');chk(db.settings.theme==='dark','una preferencia inválida no reemplaza el tema');
chk(uiResolvedTheme('system',true)==='dark'&&uiResolvedTheme('system',false)==='light'&&uiResolvedTheme('light',true)==='light','Sistema sigue el dispositivo; una elección explícita prevalece');
chk(uiDismissLabel('Volver','closeModal()')==='Cerrar'&&uiDismissLabel('Listo','closeModal()')==='Cerrar','información y selectores comparten Cerrar');
chk(uiDismissLabel('Cancelar','closeModal()')==='Cancelar'&&uiDismissLabel('Volver','closeModal()',true)==='Cancelar','formularios y confirmaciones comparten Cancelar');
chk(uiDismissLabel('Volver','uiReturnToFinish("x")')==='Volver al resumen','una navegación real conserva el destino de regreso');
view={name:'split',id:'busy-plan'};uiPlanRules('busy-plan');const rulesBefore=els.modalhost.innerHTML;
uiTogglePlanFailure('busy-plan');chk(db.splits[0].failOk&&els.modalhost.innerHTML===rulesBefore,'el switch guarda su estado sin destruir el diálogo ni su foco');
uiTogglePlanFailure('busy-plan');chk(!db.splits[0].failOk,'el mismo switch puede desactivarse');closeModal();

suite('3.1.0 — avisos de cuenta atrás sin duplicados');
const audioOriginal=window.AudioContext,vibrateOriginal=navigator.vibrate,dateNowOriginal=Date.now;
const tones=[],vibrations=[];
window.AudioContext=class{constructor(){this.state='running';this.currentTime=0;this.destination={};}createOscillator(){const o={frequency:{value:0},connect(){},start(t){tones.push({frequency:o.frequency.value,at:t});},stop(){},disconnect(){}};return o;}createGain(){return{connect(){},disconnect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}};}};
navigator.vibrate=pattern=>{vibrations.push(pattern);return true;};
db.settings.sound='on';db.settings.vibration='off';unlockAudio();beep('countdown');
chk(tones.length===1&&vibrations.length===0,'el pitido funciona sin obligar a activar la vibración');
db.settings.sound='off';db.settings.vibration='on';beep('countdown');
chk(tones.length===1&&vibrations.length===1,'la vibración funciona con el sonido apagado');
db.settings.vibration='off';beep();chk(tones.length===1&&vibrations.length===1,'ambos apagados dejan el temporizador silencioso');
db.settings.sound='on';db.settings.notify='off';db.settings.rest='5';view={name:'home'};let cueNow=1900000000000;Date.now=()=>cueNow;
db.active={start:cueNow,routineId:'cue-day',exercises:[],uiRest:true};tones.length=0;restUntil=null;
startRestAuto();chk(tones.length===0,'el descanso empieza sin adelantar los pitidos');
cueNow+=2000;tickRest();tickRest();
chk(tones.length===1&&tones[0].frequency===660,'el segundo 3 emite un único pitido aunque se actualice dos veces');
db=load();tickRest();chk(tones.length===1,'recargar dentro del mismo segundo no repite su aviso');
cueNow+=1000;tickRest();cueNow+=1000;tickRest();cueNow+=1000;tickRest();tickRest();
chk(tones.map(t=>t.frequency).join(',')==='660,660,660,880,1175','se emiten 3, 2, 1 y una sola señal final diferenciada');
chk(restUntil===null&&db.active.uiRest,'terminar el reloj no registra ni cambia de ejercicio');
tones.length=0;startRestAuto();cueNow+=8000;tickRest();
chk(tones.map(t=>t.frequency).join(',')==='880,1175','al regresar tarde no se reproducen los segundos perdidos');
tones.length=0;startRestAuto();cueNow+=2000;tickRest();uiAddRest();const countBeforeNewDeadline=tones.length;tickRest();
chk(tones.length===countBeforeNewDeadline&&restUntil>cueNow+29000,'añadir treinta segundos interrumpe la cuenta atrás sin duplicarla');
uiResetRest();cueNow+=31000;tickRest();chk(tones.length===countBeforeNewDeadline,'saltar un descanso cancela sus futuros avisos');
window.AudioContext=audioOriginal;navigator.vibrate=vibrateOriginal;Date.now=dateNowOriginal;db.active=null;clearInterval(timerInt);timerInt=null;

suite('3.2.0 — mirar cualquier día y anticipar la progresión');
resetDB();view={name:'home'};db.settings.rest='auto';
db.splits=[{id:'future-a',name:'Mi plan',active:true,exconf:{}},{id:'future-b',name:'Fuerza',active:false,exconf:{}}];
db.routines=[{id:'future-full',name:'Full body',split:'future-a',exercises:[]},{id:'future-arms',name:'Arms & delts',split:'future-a',exercises:[]},{id:'future-force',name:'Fuerza',split:'future-b',exercises:[]}];
function futureExercise(key,sets,meta={},day=0){
 const ex={id:'future-'+key,name:key,key};db.routines[day].exercises.push(ex);Object.assign(exMeta(key),{type:'normal',equip:'nada',lo:8,hi:12,step:2.5,...meta});
 if(sets){const h=sess(key,sets,1);h.routineId=db.routines[day].id;h.routineName=db.routines[day].name;}
 return ex;
}
futureExercise('subir',[S(40,12,2),S(40,12,2),S(40,12,2)]);
futureExercise('casi',[S(30,12,2),S(30,12,2),S(30,11,2)]);
futureExercise('consolidar',[S(25,8,2),S(25,7,2),S(25,7,2)]);
futureExercise('ajustar',[S(50,6,2),S(50,6,2),S(50,6,2)]);prog('ajustar').fail=2;
futureExercise('reserva',[S(20,9,4),S(20,9,4),S(20,9,4)]);
futureExercise('tolerancia',[S(40,12),S(40,12),S(40,12),S(40,10)]);
futureExercise('tiempo',[S(0,30),S(0,30)],{type:'tiempo',lo:20,hi:30},1);
futureExercise('ayuda',[S(15,12),S(15,12)],{type:'asistido',step:5},1);
futureExercise('sin ayuda',[S(5,12),S(5,12)],{type:'asistido',step:5},1);
futureExercise('corporal',[S(0,12),S(0,12)],{type:'corporal'},1);
futureExercise('nuevo',null,{},1);
futureExercise('cap',[S(40,12),S(40,12)],{cap:40},1);
futureExercise('mixtas',[S(20,12),S(40,12),S(40,11)],{},1);
futureExercise('pausa',[S(20,12),S(20,12)],{},1);db.history.find(h=>h.entries[0].key==='pausa').date=new Date(Date.now()-21*864e5).toISOString();
futureExercise('subir',[S(60,6),S(60,6)],{},2);db.splits[1].exconf.subir={lo:4,hi:6,sets:2};
const fullForecast=uiDayForecast(db.routines[0]),armsForecast=uiDayForecast(db.routines[1]);
const forecastFor=k=>[...fullForecast.items,...armsForecast.items].find(x=>x.key===k);
chk(forecastFor('subir').atTop&&forecastFor('subir').ready&&forecastFor('subir').suggestion.w===42.5,'rango completo muestra el salto real de 40 a 42,5 kg');
chk(forecastFor('subir').series.every(st=>st.r===12)&&forecastFor('subir').suggestion.reps===8,'el rango logrado no se vacía cuando la próxima carga reinicia las reps');
chk(forecastFor('casi').remaining===1&&!forecastFor('casi').ready&&forecastFor('casi').series[2].r===11,'una rep pendiente se identifica en la serie exacta, sin inventar subida');
chk(forecastFor('consolidar').state==='hold'&&forecastFor('consolidar').suggestion.w===25,'consolidar conserva la carga que pide el motor');
chk(forecastFor('ajustar').state==='ease'&&forecastFor('ajustar').suggestion.w<50,'la reducción aparece como ajuste, no como subida');
chk(forecastFor('reserva').ready&&!forecastFor('reserva').atTop&&forecastFor('reserva').complete===0,'la subida por reserva no dibuja un rango completo ficticio');
chk(forecastFor('tolerancia').tolerated&&!forecastFor('tolerancia').atTop&&forecastFor('tolerancia').ready,'la excepción de cuatro series conserva visible la serie incompleta');
chk(forecastFor('tiempo').state==='time'&&forecastFor('tiempo').load.value==='35'&&forecastFor('tiempo').load.unit==='s','el objetivo de tiempo se representa en segundos');
chk(forecastFor('ayuda').state==='assist'&&forecastFor('ayuda').suggestion.w===10,'progresar en asistidos significa reducir la ayuda');
chk(forecastFor('sin ayuda').load.caption==='sin asistencia'&&forecastFor('sin ayuda').load.unit==='reps','llegar a cero ayuda muestra reps sin asistencia');
chk(forecastFor('corporal').state==='body'&&forecastFor('corporal').load.value==='13','el ejercicio corporal avanza por reps');
chk(forecastFor('nuevo').suggestion===null&&forecastFor('nuevo').series.length===0&&!forecastFor('nuevo').ready,'sin registro no se inventan carga ni porcentaje de progreso');
chk(forecastFor('cap').state==='reps'&&forecastFor('cap').suggestion.w===40&&forecastFor('cap').suggestion.reps===13,'el tope de equipo conserva la carga y propone reps');
chk(forecastFor('mixtas').series.length===2&&forecastFor('mixtas').series[0].index===2,'las series a otras cargas no se mezclan ni renumeran como peso de trabajo');
chk(forecastFor('pausa').state==='back'&&!forecastFor('pausa').ready,'retomar después de una pausa no se anuncia como una subida');
const frozenFuture=JSON.stringify({history:db.history,routines:db.routines,splits:db.splits,active:db.active}),futureNext=nextDay().routine.id;
uiOpenDay('future-arms','home');
chk(view.id==='future-arms'&&view.dayFrom==='home'&&db.active===null&&nextDay().routine.id===futureNext,'abrir otro día no inicia sesión ni cambia la secuencia');
chk(JSON.stringify({history:db.history,routines:db.routines,splits:db.splits,active:db.active})===frozenFuture,'explorar conserva historial, días, planes y sesión');
const forecastMarkup=uiRoutine();
chk(forecastMarkup.includes('Día de este plan')&&forecastMarkup.includes('Último registro')&&forecastMarkup.includes('Por qué esta propuesta'),'el día conecta navegación, prueba del progreso y motivos desplegables');
chk(!/NaN|undefined/.test(forecastMarkup),'la vista de estados mixtos no expone valores ausentes');
openExercise('future-arms','future-tiempo');uiTop();
chk(view.dayFrom==='home'&&els.topbar.innerHTML.includes('dayFrom'),'entrar en un ejercicio conserva el regreso al día y a la portada');
view={name:'home'};const startForecast=uiDayForecast(db.routines[2]);startSession('future-force');
chk(db.active.exercises[0].sugg.w===startForecast.items[0].suggestion.w&&db.active.exercises[0].sugg.reps===4&&db.active.exercises[0].sets.length===2,'iniciar otro plan desde cualquier vista usa la misma propuesta que su vista previa');
const frozenSession=JSON.stringify(db.active),duringSession=uiDayForecast(db.routines[0]);
chk(duringSession.items[0].range.hi===12&&duringSession.items[0].suggestion.w===42.5,'consultar hipertrofia durante una sesión de fuerza mantiene sus propias reglas');
chk(JSON.stringify(db.active)===frozenSession&&ctxSplitId()==='future-b','la consulta restaura el contexto y no modifica la sesión en curso');
uiOpenDay('future-full','home');openExercise('future-full','future-subir');
chk(effRange('subir').hi===12,'la ficha abierta desde el día consultado usa también ese plan');
refreshActiveSugg('subir');
chk(db.active.exercises[0].sugg.reps===4&&db.active.exercises[0].sugg.sets===2,'actualizar la sesión desde otra ficha conserva las reglas de la sesión');
view={name:'session'};chk(effRange('subir').hi===6,'volver a la sesión recupera sus rangos');
db.active=null;clearInterval(timerInt);timerInt=null;view={name:'home'};
const singleRack=db.gym.dumbbells;db.gym.dumbbells=[{kg:20,on:true}];
Object.assign(exMeta('subir'),{equip:'mancuerna',points:2});
const noJump=uiDayForecast(db.routines[0]).items[0];
chk(noJump.state==='equipment'&&!noJump.ready,'un salto redondeado al mismo peso no se cuenta como subida disponible');
db.gym.dumbbells=singleRack;Object.assign(exMeta('subir'),{equip:'nada'});
const boundPreview=uiDayForecast(db.routines[0]).items[0];
const card=uiForecastCard(boundPreview,db.routines[0],0);
chk((card.match(/role="meter"/g)||[]).length===3&&card.includes('aria-valuenow="12"'),'cada serie conserva su valor accesible y su límite');
auditActions('Próxima sesión',card);chk(brokenHandlers.length===0,'los accesos nuevos a ejercicios están conectados');
const completedRange=sess('casi',[S(30,12,2),S(30,12,2),S(30,12,2)],0);completedRange.routineId='future-full';completedRange.routineName='Full body';
const afterNewRecord=uiDayForecast(db.routines[0]).items.find(x=>x.key==='casi');
chk(afterNewRecord.atTop&&afterNewRecord.ready&&afterNewRecord.remaining===0,'al completar la rep pendiente, la próxima consulta muestra rango lleno y una subida');
Object.assign(exMeta('subir'),{equip:'barra'});db.gym.bars=[{id:'future-bar',name:'Olímpica',kg:20,on:true,def:true}];db.gym.plates=defaultGym('kg').plates;invalidatePlates();
const barPreview=uiDayForecast(db.routines[0]).items[0];
chk(barPreview.load.caption==='total, incluida la barra'&&!barPreview.load.setup.includes('kg kg'),'la carga total se distingue de los discos y no duplica unidades');

suite('3.2.2 — propuesta completa, deshacer y calentamiento');
resetDB();restUntil=null;db.settings.rest='auto';db.settings.unit='kg';db.gym=defaultGym('kg');
db.splits=[{id:'mobile-plan',name:'Plan móvil',active:true,exconf:{}}];
db.routines=[{id:'mobile-day',name:'Full body',split:'mobile-plan',exercises:[{id:'mobile-row',name:'Remo en torre',key:'mobile-row'},{id:'mobile-row-2',name:'Remo 2',key:'mobile-row-2'}]}];
for(const k of ['mobile-row','mobile-row-2'])Object.assign(exMeta(k),{equip:'placas',muscle:'espalda',stack:{unit:'lb',start:5,step:5}});
view={name:'routine',id:'mobile-day'};startSession('mobile-day');
const mobileEx=db.active.exercises[0];mobileEx.sugg={w:toKgEx(mobileEx.key,65),reps:6,sets:2,type:'up',msg:'Subir',why:'Prueba'};mobileEx.sets=[{w:'20',r:'2',rir:'1',wkg:123,totalKg:456},{w:'',r:'',rir:''}];
db.active.exercises[1].sets[0].w='65';
const mobileDraft=JSON.stringify(mobileEx.sets[0]);
uiUseSuggestion(0);
chk(mobileEx.sets[0].w==='65'&&mobileEx.sets[0].r==='6'&&mobileEx.sets[0].rir==='1','aplicar cambia 20 lb × 2 a 65 lb × 6, conservando RIR');
chk(mobileEx.sets[0].wkg===undefined&&mobileEx.sets[0].totalKg===undefined,'no conserva conversiones anteriores de otra carga');
chk(!mobileEx.sets[0].done&&sessionOpenIdx()===0&&restUntil===null&&collectEntries(db.active).length===0,'aplicar no confirma, avanza ni inicia descanso');
chk(uiCanUndoProposal(mobileEx)&&uiProposalMatches(mobileEx,mobileEx.sets[0]),'la propuesta coincide con los campos y se puede deshacer');
exMeta(mobileEx.key).stack.unit='kg';chk(!uiCanUndoProposal(mobileEx),'deshacer no restaura números de otra unidad o configuración');exMeta(mobileEx.key).stack.unit='lb';
uiUndoProposal(0);chk(JSON.stringify(mobileEx.sets[0])===mobileDraft,'deshacer recupera exactamente la carga y reps anteriores');
uiUseSuggestion(0);setVal(0,0,'w','60');uiUndoProposal(0);
chk(mobileEx.sets[0].w==='60'&&!uiProposalMatches(mobileEx,mobileEx.sets[0]),'una edición posterior no se pisa con un deshacer atrasado y permite aplicar de nuevo');
uiUseSuggestion(0);chk(mobileEx.sets[0].w==='65','aplicar de nuevo sustituye la carga manual completa');
showWarmup(0);chk(!mobileEx.warmupDone,'ver el calentamiento no afirma que ya lo hiciste');closeModal();
chk(warmupPlan(1).first,'un ejercicio anterior sin series registradas no se considera calentamiento hecho');
prepareFixture(0);
chk(mobileEx.warmupDone&&!mobileEx.sets[0].done&&restUntil===null&&collectEntries(db.active).length===0,'completar el recorrido guarda solo preparación, sin añadir trabajo ni su descanso');
chk(!warmupPlan(1).first,'el calentamiento confirmado del mismo músculo también cuenta como preparación previa');
mobileEx.warmupDone=false;db.active.exercises[1].warmupDone=true;
chk(!warmupPlan(0).first,'la preparación respeta ejercicios realizados fuera del orden del plan');
mobileEx.warmupDone=true;db.active.exercises[1].warmupDone=false;
const restoredWarmup=normalize(JSON.parse(localStorage.getItem(LS_KEY)));
chk(restoredWarmup.active.exercises[0].warmupDone,'la preparación persiste al recargar');
openExFromSession(0,'equipment');
chk(view.exTab==='equipment'&&view.from==='session'&&view.rid==='mobile-day'&&uiExercise().includes('Primera placa'),'ajustar la torre abre Equipo en el contexto de la sesión');
chk(db.active.exercises[0]===mobileEx&&!mobileEx.sets[0].done,'abrir Equipo mantiene el borrador de la sesión');
view={name:'session'};showLoad(0);chk(els.modalhost.innerHTML.includes("openExFromSession(0,'equipment')"),'el botón de la torre enlaza al ajuste directo');closeModal();
prepareFixture(0);uiLogSet(0,0);const afterProposalRest=restUntil;
chk(mobileEx.sets[0].done&&afterProposalRest>Date.now()&&db.active.uiRest,'solo Registrar confirma e inicia el descanso');
uiUndoProposal(0);chk(mobileEx.sets[0].done&&restUntil===afterProposalRest,'deshacer no modifica una serie ya registrada ni su descanso');
chk(!warmupPlan(1).first,'una serie confirmada del mismo músculo sí cuenta como trabajo previo');
uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;

suite('3.2.2 — nombres de barras, orden y eliminación de días');
view={name:'gym',kind:'bars'};
const renameBar=db.gym.bars[0],barId=renameBar.id;
const unchangedBar=JSON.stringify({...renameBar,name:''}),otherBarNames=db.gym.bars.slice(1).map(b=>b.name).join('|');
uiRenameBar(barId);auditActions('Renombrar barra',els.modalhost.innerHTML);
document.getElementById('n-bar-name').value='Barra de prueba "A" <trap>';
uiSaveBarName({preventDefault(){}},barId);
chk(renameBar.name==='Barra de prueba "A" <trap>'&&JSON.stringify({...renameBar,name:''})===unchangedBar,'renombrar conserva ID, peso, disponibilidad y barra predeterminada');
chk(db.gym.bars.slice(1).map(b=>b.name).join('|')===otherBarNames&&uiGym().includes('&lt;trap&gt;'),'se conserva el resto del equipo y se escapa el nombre');
uiRenameBar(barId);document.getElementById('n-bar-name').value='   ';uiSaveBarName({preventDefault(){}},barId);
chk(renameBar.name==='Barra de prueba "A" <trap>','un nombre vacío no borra el anterior');closeModal();
const resetBefore=JSON.stringify(db.gym.bars);askResetGymKind('bars');closeModal();
chk(JSON.stringify(db.gym.bars)===resetBefore,'abrir y cancelar Restaurar conserva el inventario');
db.routines.push({id:'mobile-other',name:'Upper',split:'mobile-plan',exercises:[]});
view={name:'split',id:'mobile-plan',sort:true};
const originalOrder=db.routines.map(r=>r.id).join(',');moveRoutine('mobile-day',1);moveRoutine('mobile-day',-1);
chk(db.routines.map(r=>r.id).join(',')===originalOrder,'subir y bajar conserva la identidad y contenido de los días');
auditActions('Ordenar días móvil',uiPlan());
db.history=[{id:'mobile-history',routineId:'mobile-other',routineName:'Upper',date:new Date().toISOString(),entries:[{name:'Remo',key:'mobile-row',sets:[S(20,8)]}]}];
const retainedDayHistory=JSON.stringify(db.history),retainedDayProgress=JSON.stringify(db.progress);
deleteRoutine('mobile-other');closeModal();chk(db.routines.length===2,'cancelar Quitar conserva el día');
deleteRoutine('mobile-other');window.__confirmFn();
chk(db.routines.length===1&&view.name==='split'&&view.id==='mobile-plan'&&view.sort,'quitar vuelve al mismo plan y mantiene el modo de orden');
chk(JSON.stringify(db.history.map(({splitId,...h})=>h))===retainedDayHistory&&db.history[0].splitId==='mobile-plan'&&JSON.stringify(db.progress)===retainedDayProgress,'quitar un día conserva sesiones, su plan de origen y progresión');
db.active={routineId:'mobile-day',exercises:[],start:Date.now()};deleteRoutine('mobile-day');
chk(db.routines.length===1&&els.modalhost.innerHTML.includes('Continuar sesión'),'no se quita el día de una sesión en curso');closeModal();db.active=null;
deleteRoutine('missing-day');chk(db.routines.length===1,'un identificador retirado no provoca una excepción');
deleteRoutine('mobile-day');window.__confirmFn();
chk(!db.routines.length&&db.splits.length===1&&uiPlan().includes('Añade el primer día'),'se puede quitar el último día y continuar editando el plan');
chk(brokenHandlers.length===0,'las nuevas acciones de orden y nombres están conectadas');

suite('3.2.2 — volver de una tarjeta al detalle del diario');
view={name:'history',progressTab:'diary'};
uiReturnToReceipt('mobile-history');
chk(view.name==='history'&&els.modalhost.innerHTML.includes('Editar sesión')&&!els.modalhost.innerHTML.includes('class="modal full"'),'volver de la tarjeta recupera el detalle del diario');
chk(uiIsDismissAction('uiReturnToReceipt("mobile-history")')&&uiDismissLabel('Volver','uiReturnToReceipt("mobile-history")')==='Volver al detalle','el retorno a la sesión guardada es la única salida de la tarjeta');
closeModal();

suite('3.2.2 — el bloqueo de fondo depende del diálogo visible');
const originalQuery=document.querySelector,originalBodyStyle=document.body.style;
let visibleTestModal=true;document.querySelector=()=>visibleTestModal?{}:null;document.body.style={overflow:'auto'};delete window.__modalOverflow;
uiSyncModalState();
chk(els.app.inert&&els.tabs.inert&&document.body.style.overflow==='hidden','un diálogo visible bloquea fondo y navegación de forma conjunta');
uiSyncModalState();visibleTestModal=false;uiSyncModalState();
chk(!els.app.inert&&!els.tabs.inert&&document.body.style.overflow==='auto','cerrar o retirar el diálogo restaura clics y desplazamiento');
els.app.inert=true;els.tabs.inert=false;uiAfterRender();
chk(!els.app.inert&&!els.tabs.inert,'renderizar repara un fondo inerte sin diálogo, incluso si la barra seguía activa');
document.querySelector=originalQuery;document.body.style=originalBodyStyle;delete window.__modalOverflow;
uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;

suite('3.2.2 — avisar solo de una versión realmente posterior');
db.active=null;updateDismissed=false;
receiveWorkerVersion('99.0.0');chk(updateReady&&els.toasthost.innerHTML.includes('Actualizar'),'una versión posterior ofrece actualizar');
receiveWorkerVersion(APP_VERSION);chk(!updateReady&&!els.toasthost.innerHTML,'la versión ya abierta elimina el aviso redundante');
receiveWorkerVersion('0.0.0');chk(!updateReady,'una respuesta de un worker anterior no se ofrece como nueva');
receiveWorkerVersion('sin-versión');chk(!updateReady,'una respuesta inválida no muestra un aviso');
updateDismissed=true;receiveWorkerVersion('99.0.0');chk(!els.toasthost.innerHTML,'se respeta Ahora no durante la visita');updateReady=false;updateDismissed=false;

suite('3.2.5 — torre principal y ajuste fino con límites independientes');
resetDB();view={name:'home'};
const cappedTowerKey='polea limite beta';
exMeta(cappedTowerKey).equip='placas';
Object.assign(exMeta(cappedTowerKey).stack,{unit:'lb',start:2.5,step:5,extra:1.5,extraMax:3});
setExCap(cappedTowerKey,'250');
chk(stackConf(cappedTowerKey).max===250&&stackConf(cappedTowerKey).extraMax===3,'250 lb de torre y 3 lb de extras se guardan como límites distintos');
setExCap(cappedTowerKey,'200');
chk(stackCapValue(cappedTowerKey)===200&&stackHintHTML(cappedTowerKey).includes('203 lb'),'editar a 200 lb no introduce decimales de la conversión a kg');
exMeta(cappedTowerKey).cap=Math.round(200*KGxLB*1000)/1000;
chk(stackCapValue(cappedTowerKey)===200,'un máximo de 200 lb de un respaldo anterior tampoco se convierte en 199,999');
setExCap(cappedTowerKey,'200.625');
chk(stackCapValue(cappedTowerKey)===200.625,'un límite nuevo conserva tres decimales de la unidad de la máquina');
setExCap(cappedTowerKey,'250');
let boundedStack=stackSnap(cappedTowerKey,5.5*KGxLB);
chk(boundedStack.index===1&&boundedStack.plateValue===2.5&&boundedStack.extra===3,'dos extras de 1,5 lb mantienen el pin en la primera placa');
boundedStack=stackSnap(cappedTowerKey,999*KGxLB);
chk(boundedStack.value===253&&boundedStack.plateValue===250&&boundedStack.extra===3&&boundedStack.index===boundedStack.plates,'una carga fuera de rango usa la última placa y solo los dos extras existentes');
const boundedPreview=stackPreview(cappedTowerKey,100);
chk(boundedPreview.at(-1)===250&&boundedPreview.at(-2)===247.5&&boundedPreview.length===51,'el máximo indicado cierra la torre aunque el último salto sea menor');
chk(stackHintHTML(cappedTowerKey).includes('253 lb')&&stackHintHTML(cappedTowerKey).includes('2 pasos de 1,5 lb'),'la explicación distingue placa máxima, pasos finos y total');
let towerBoundsHold=true;
for(let target=0;target<=400;target+=1.125){
 const x=stackSnap(cappedTowerKey,target*KGxLB);
 if(x.plateValue>250||x.extra>3||x.value>253||x.index>x.plates||!Number.isInteger(x.extra/1.5))towerBoundsHold=false;
}
chk(towerBoundsHold,'ninguna carga de la barrida inventa placas ni un tercer extra');
const kgAtTower=(lb)=>Math.round(lb*KGxLB*1000)/1000;
sess(cappedTowerKey,[S(kgAtTower(250),12),S(kgAtTower(250),12)]);
let cappedSuggestion=computeSuggestion(cappedTowerKey);
chk(cappedSuggestion.type==='up'&&cappedSuggestion.w===kgAtTower(253),'al completar las reps en 250 lb todavía se pueden aprovechar los extras hasta 253 lb');
sess(cappedTowerKey,[S(kgAtTower(253),12,4),S(kgAtTower(253),12,4)]);
cappedSuggestion=computeSuggestion(cappedTowerKey);
chk(cappedSuggestion.type==='reps'&&cappedSuggestion.reps===13&&cappedSuggestion.w===kgAtTower(253),'con torre y extras agotados se proponen reps, incluso con RIR alto');
sess(cappedTowerKey,Array.from({length:5},()=>S(kgAtTower(253),12)));
cappedSuggestion=computeSuggestion(cappedTowerKey);
chk(cappedSuggestion.w===kgAtTower(253)&&cappedSuggestion.type!=='up','concentrar cinco series también respeta el máximo total');
setExStack(cappedTowerKey,'extraMax','2');
chk(stackSnap(cappedTowerKey,999).value===251.5,'un máximo fino de 2 lb permite un extra de 1,5, sin inventar fracciones');
setExStack(cappedTowerKey,'extraMax','0');
chk(stackSnap(cappedTowerKey,999).value===250&&Math.abs(effStep(cappedTowerKey,100)-5*KGxLB)<1e-9,'un máximo fino cero desactiva los extras y recupera el salto entre placas');
setExStack(cappedTowerKey,'extraMax','3');
const machineLimitsSnapshot=machineSnapshot(exMeta(cappedTowerKey));
chk(machineLimitsSnapshot.cap===exMeta(cappedTowerKey).cap&&machineLimitsSnapshot.stack.extraMax===3,'la configuración por gimnasio conserva ambos máximos');
const limitsGymA=db.gym.id;
snapshotActiveGym();
window.__gymBase='kg';els.newgymname.value='Otra torre beta';createGym({preventDefault(){}});
const limitsGymB=db.gym.id;
exMeta(cappedTowerKey).equip='placas';
Object.assign(exMeta(cappedTowerKey).stack,{unit:'kg',start:5,step:5,extra:0.625,extraMax:1.25});
setExCap(cappedTowerKey,'100');
chk(stackSnap(cappedTowerKey,100.625).value===100.625&&stackSnap(cappedTowerKey,999).value===101.25,'los dos extras de 0,625 kg se calculan sin redondearlos a otro incremento');
setActiveGym(limitsGymA);
chk(stackSnap(cappedTowerKey,999).value===253&&stackConf(cappedTowerKey).unit==='lb','volver al primer gimnasio recupera su torre de 250 lb y sus extras');
setActiveGym(limitsGymB);
chk(stackSnap(cappedTowerKey,999).value===101.25&&stackConf(cappedTowerKey).unit==='kg','el otro gimnasio conserva de forma independiente sus 100 kg y dos extras');
const savedLimits=JSON.parse(JSON.stringify(db));
db=normalize(savedLimits);
chk(stackSnap(cappedTowerKey,999).value===101.25,'restaurar los datos conserva ambos límites y los decimales finos');
setExCap(cappedTowerKey,'');
chk(stackConf(cappedTowerKey).max===null&&stackSnap(cappedTowerKey,999).value>101.25,'dejar el máximo vacío conserva el comportamiento sin un límite conocido');
setExCap(cappedTowerKey,'100');
db.splits=[{id:'limits-plan',name:'Plan con torre',active:true,exconf:{}}];
db.routines=[{id:'limits-day',name:'Día de polea',split:'limits-plan',exercises:[{id:'limits-ex',key:cappedTowerKey,name:'Polea limite beta'}]}];
window.__splitImport=JSON.parse(JSON.stringify(splitProfile('limits-plan')));
db.exmeta={};applySplitImport();
chk(stackSnap(cappedTowerKey,999).value===101.25,'exportar e importar un plan lleva la torre y los extras completos');
sess(cappedTowerKey,[S(10,12),S(10,12)]);
const fineDay=db.routines.find(r=>r.exercises.some(e=>e.key===cappedTowerKey));
view={name:'home'};startSession(fineDay.id);
chk(db.active.exercises[0].sugg.w===10.625,'una progresión de 0,625 kg propone exactamente 10,625 kg');
uiUseSuggestion(0);
chk(db.active.exercises[0].sets[0].w==='10.625'&&fmtWEx(cappedTowerKey,10.625)==='10,625','la propuesta y su campo conservan el ajuste fino, sin convertirlo en 10,63');
confirmFixtureSets();
chk(fixtureEntries()[0].sets[0].w===10.625,'la serie confirmada conserva la carga exacta del ajuste fino');
db.active=null;uiResetRest();clearInterval(timerInt);timerInt=null;


suite('3.3.0 — calentamiento primero, persistente y separado del trabajo');
resetDB();uiResetRest();db.gym=defaultGym('kg');db.settings.rest='off';db.settings.sound='off';db.settings.vibration='off';
db.splits=[{id:'warm-sp',name:'Preparación',active:true,exconf:{}}];
db.routines=[{id:'warm-day',name:'Torso',split:'warm-sp',exercises:[{id:'wa',key:'warm-a',name:'Press principal'},{id:'wb',key:'warm-b',name:'Press secundario'},{id:'wc',key:'warm-c',name:'Remo'}]}];
for(const [key,muscle] of [['warm-a','pecho'],['warm-b','pecho'],['warm-c','espalda']])Object.assign(exMeta(key),{equip:'placas',muscle,stack:{unit:'kg',start:5,step:5},lo:8,hi:12});
view={name:'home'};startSession('warm-day');
chk(uiSession().includes('warmup-target')&&!uiSession().includes('id="n-weight"'),'sin historial se prepara una carga, sin mostrar el registro de trabajo');
const warmRealNow=Date.now;let warmClock=warmRealNow();Date.now=()=>warmClock;
const warmFormEvent={preventDefault(){}};
document.getElementById('warmup-target').value='60';uiWarmupSetTarget(warmFormEvent,0);
let warmEx=db.active.exercises[0],warmState=ensureWarmup(0);
chk(warmState.phase==='set'&&warmState.plan.W===60&&warmState.plan.steps.length===2,'elegir 60 kg crea dos aproximaciones');
chk(warmState.plan.steps[0].w===35&&warmState.plan.steps[1].w===50,'la escalera usa placas existentes: 35 y 50 kg');
chk(uiSession().includes('Pin en la placa')&&uiSession().includes('Calentamiento 1 de 2')&&!uiSession().includes('Registrar serie'),'la preparación sustituye toda la interfaz de registro');
warmEx.sets[0].r='8';uiLogSet(0,0);toggleSetDone(0,0);
chk(!warmEx.sets[0].done&&collectEntries(db.active).length===0,'los dos caminos para registrar bloquean trabajo antes de preparar');
uiContinue();chk(warmupRequired(0),'Continuar el descanso normal tampoco salta la preparación');
const warmStepToken=warmState.id;uiWarmupRecord(0,warmStepToken,0);
chk(warmState.phase==='rest'&&warmState.completed===1&&warmState.restUntil===warmClock+30000,'confirmar un calentamiento inicia exactamente 30 s incluso con descanso de trabajo desactivado');
chk(restUntil===null&&!db.active.uiRest&&!warmEx.sets[0].done,'el descanso de calentamiento no usa ni confirma el de trabajo');
const warmDeadline=warmState.restUntil;
uiWarmupRecord(0,warmStepToken,0);uiWarmupNext(0,warmStepToken,1);
chk(warmState.completed===1&&warmState.restUntil===warmDeadline&&warmState.phase==='rest','doble toque y continuar antes de tiempo no avanzan ni reinician el descanso');
warmClock+=10000;uiWarmupExtend(0,warmStepToken);
chk(warmState.restDuration===60&&warmState.restUntil===warmDeadline+30000,'añadir 30 s mantiene un máximo total de un minuto');
uiWarmupExtend(0,warmStepToken);chk(warmState.restUntil===warmDeadline+30000,'una segunda ampliación no supera el minuto');
warmEx.sets[0].r='';save();db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));warmEx=db.active.exercises[0];warmState=ensureWarmup(0);
chk(warmState.completed===1&&warmState.phase==='rest'&&warmState.restUntil===warmDeadline+30000,'restaurar conserva la serie y el plazo absoluto del descanso');
const warmMotionKey=uiMotionKey();warmClock+=1000;tickRest();
chk(uiMotionKey()===warmMotionKey&&els['warmup-next'].disabled,'el reloj actualiza controles sin reconstruir ni animar la pantalla');
uiSelectExercise(1);chk(uiSession().includes('warmup-target'),'visitar otro ejercicio sin terminar preparación no lo da por caliente');
uiSelectExercise(0);chk(ensureWarmup(0).id===warmStepToken&&ensureWarmup(0).restUntil===warmDeadline+30000,'volver recupera exactamente el calentamiento y su descanso');
warmClock=warmState.restUntil-1;uiWarmupNext(0,warmStepToken,1);chk(warmState.phase==='rest','el último milisegundo de descanso también se respeta');
warmClock++;tickRest();chk(!els['warmup-next'].disabled&&warmState.phase==='rest','al acabar el reloj habilita continuar, sin avanzar solo');
uiWarmupNext(0,warmStepToken,1);chk(warmState.phase==='set'&&warmState.completed===1,'continuar presenta el segundo calentamiento');
uiWarmupRecord(0,warmStepToken,0);chk(warmState.phase==='set','un evento atrasado de la primera serie no confirma la segunda');
uiWarmupRecord(0,warmStepToken,1);warmClock=warmState.restUntil;tickRest();
chk(warmupRequired(0)&&uiSession().includes('Empezar series de trabajo'),'también hay descanso después del último calentamiento, con salida explícita');
uiWarmupNext(0,warmStepToken,2);
chk(warmEx.warmupDone&&!warmupRequired(0)&&uiSession().includes('Registrar serie'),'solo el recorrido terminado desbloquea las series normales');
chk(collectEntries(db.active).length===0&&db.history.length===0,'los calentamientos no generan volumen, historial ni récords');
chk(warmEx.sets[0].w==='60'&&warmEx.sets[0].r==='','la carga de trabajo permanece, sin inventar repeticiones realizadas');
const completedWarmToken=warmState.id;
setVal(0,0,'w','70');chk(warmupRequired(0)&&ensureWarmup(0).id!==completedWarmToken,'subir la carga antes de empezar trabajo recalcula la preparación');
setVal(0,0,'w','60');prepareFixture(0);warmState=ensureWarmup(0);setVal(0,0,'w','55');
chk(!warmupRequired(0)&&ensureWarmup(0).id===warmState.id,'bajar la carga ya preparada no obliga a repetir el recorrido');
setVal(0,0,'r','8');db.settings.rest='auto';uiLogSet(0,0);
chk(warmEx.sets[0].done&&db.active.uiRest&&restUntil>warmClock,'registrar trabajo mantiene su descanso habitual');
chk(collectEntries(db.active)[0].loadContext===warmupLoadContext(warmEx.key),'el historial confirmado conserva el contexto para comparar cargas equivalentes');
uiSelectExercise(1);db.active.exercises[1].sets[0].w='40';
chk(restUntil>warmClock,'consultar otro ejercicio conserva el descanso');uiContinue();
chk(warmupPlan(1).reason==='prepared'&&!warmupRequired(1)&&uiSession().includes('Registrar serie'),'trabajo confirmado del mismo músculo permite el acceso directo en rango moderado');
uiSelectExercise(2);db.active.exercises[2].sets[0].w='40';
chk(warmupRequired(2)&&warmupPlan(2).first,'un grupo diferente prepara desde su primer escalón');
Object.assign(exMeta('warm-b'),{lo:4,hi:6});chk(warmupPlan(1).steps.length===2,'otro ejercicio de fuerza conserva dos aproximaciones aunque su músculo tenga trabajo');
Object.assign(exMeta('warm-b'),{lo:8,hi:12});warmClock+=31*60*1000;
chk(warmupPlan(1).first&&warmupRequired(1),'tras una pausa larga no se mantiene la omisión por trabajo antiguo');
Date.now=warmRealNow;uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;

suite('3.3.0 — cargas, equipo real y criterios de preparación');
resetDB();db.gym=defaultGym('kg');db.settings.rest='auto';
function warmFixture(key,meta,w,sugg){
  Object.assign(exMeta(key),meta);
  db.active={id:'wf',routineName:'Prueba',start:Date.now(),open:0,exercises:[{key,name:key,sugg,sets:[{w:w??'',r:'',rir:''}]}]};
  view={name:'session'};uiResetRest();return db.active.exercises[0];
}
let we=warmFixture('warm-canonical',{equip:'barra',muscle:'pecho',lo:8,hi:12},'40');we.sets[0].totalKg=60;
chk(warmupPlan(0).W===60&&Array.isArray(warmupPlan(0).steps),'el peso canónico devuelve un plan completo, nunca un número aislado');
chk(warmupPlan(0).steps.every(st=>st.w<60&&loadPlan(we.key,st.w).exact),'la barra y los discos están incluidos en cada carga realizable');
we=warmFixture('warm-small',{equip:'nada',muscle:'hombros',lo:8,hi:12},'8');
chk(warmupPlan(0).steps.length>0,'8 kg no se considera automáticamente ligero para una persona sin historial');
sess('warm-small',[S(20,10)],2);
chk(warmupPlan(0).steps.length>0,'un historial sin contexto de equipo no demuestra que la carga actual sea ligera');
db.history.at(-1).entries[0].loadContext=warmupLoadContext('warm-small');chk(warmupPlan(0).reason==='light'&&!warmupRequired(0),'una reducción grande respecto al trabajo reciente comparable puede ir directo');
exMeta('warm-small').points=1;chk(warmupPlan(0).steps.length>0,'cambiar de dos manos a una impide comparar cargas no equivalentes');exMeta('warm-small').points=2;
uiWarmupRestart(0);chk(warmupRequired(0),'se puede solicitar preparación guiada incluso cuando se ofrece acceso directo');
we=warmFixture('warm-old',{equip:'nada',lo:8,hi:12},'8');sess(we.key,[S(20,10)],40);
chk(warmupPlan(0).steps.length>0,'una referencia antigua no elimina el calentamiento');
we=warmFixture('warm-machine',{equip:'placas',lo:8,hi:12,stack:{unit:'lb',start:2.5,step:5,extra:1.5,extraMax:3},cap:250*.45359237},'65');sess(we.key,[S(100,10)],2);
chk(warmupPlan(0).reason==='specific','no se comparan cargas históricas de torres cuya relación de poleas puede cambiar');
chk(warmupPlan(0).steps.every(st=>Math.abs(stackSnap(we.key,st.w).kg-st.w)<.001),'las cargas de calentamiento respetan placas, libras y extras disponibles');
let wg=ensureWarmup(0);uiWarmupRecord(0,wg.id,0);const oldWarmContext=wg.id;
withExChange(we.key,()=>{exMeta(we.key).stack={unit:'kg',start:2,step:2};});
chk(ensureWarmup(0).id!==oldWarmContext&&ensureWarmup(0).phase==='set','cambiar la máquina rehace la preparación con su equipo actual');
uiWarmupRecord(0,oldWarmContext,0);chk(ensureWarmup(0).completed===0,'un botón de la configuración anterior no confirma una carga nueva');
we=warmFixture('warm-min',{equip:'barra',muscle:'pecho',lo:4,hi:6},'0');
chk(warmupPlan(0).steps[0].easy&&warmupPlan(0).steps[0].w===0,'si no hay equipo más ligero propone práctica sin carga, sin inventar discos negativos');
we=warmFixture('warm-assist',{type:'asistido',equip:'placas',lo:8,hi:12,stack:{unit:'kg',start:5,step:5},cap:50},'20');
chk(warmupPlan(0).steps[0].w>20&&warmupPlan(0).steps[0].assisted,'el calentamiento asistido aumenta la ayuda, no la dificultad');
we.sets[0].w='50';chk(warmupPlan(0).steps[0].w<=50&&warmupPlan(0).note.includes('apoyo'),'al máximo de ayuda respeta el tope y ofrece apoyo adicional');
we=warmFixture('warm-body',{type:'corporal',muscle:'pecho',lo:3,hi:6},'10');
chk(warmupPlan(0).steps[0].w===0&&warmupPlan(0).steps[0].reps===1,'peso corporal prepara sin lastre y con menos reps que el objetivo');
we=warmFixture('warm-unknown',{equip:'nada',muscle:null,lo:8,hi:12},'40');
db.active.exercises.unshift({key:'unknown-before',name:'Sin grupo',warmupDone:true,sets:[{w:'20',r:'8',done:true}]});
chk(warmupPlan(1).first,'un grupo sin asignar nunca se trata como calentamiento de todo el cuerpo');
we=warmFixture('warm-forced-new',{equip:'nada',muscle:'pecho',lo:8,hi:12},'');
db.active.exercises.push({key:'warm-previous',name:'Anterior',lastWorkAt:Date.now(),sets:[{w:'40',r:'10',done:true}]});exMeta('warm-previous').muscle='pecho';
chk(!warmupRequired(0),'otro ejercicio del grupo puede empezar sin calentamiento aunque no tenga carga propuesta');
uiWarmupRestart(0);chk(ensureWarmup(0).phase==='setup','pedir calentamiento explícito sin historial abre la elección de carga');
document.getElementById('warmup-target').value='20';uiWarmupSetTarget(warmFormEvent,0);
chk(warmupRequired(0)&&ensureWarmup(0).forced,'elegir carga conserva la preparación solicitada aunque el grupo ya tenga trabajo');
we=warmFixture('warm-damaged',{equip:'nada',muscle:'pecho',lo:8,hi:12},'40');wg=ensureWarmup(0);wg.completed=999;
chk(ensureWarmup(0).completed===0,'un progreso dañado en un respaldo se recalcula sin desbloquear trabajo');
wg=ensureWarmup(0);uiWarmupRecord(0,wg.id,0);wg.restUntil=Infinity;
chk(ensureWarmup(0).phase==='set','un descanso corrupto no bloquea la app para siempre');
wg=ensureWarmup(0);wg.plan.steps[0].reps='<img src=x onerror=alert(1)>';
chk(!uiSession().includes('<img src=x'),'los pasos restaurados se validan antes de generar la interfaz');
we=warmFixture('warm-legacy',{equip:'nada',lo:8,hi:12},'40');we.warmupDone=true;
chk(!warmupRequired(0),'una sesión anterior con calentamiento confirmado sigue abierta para trabajar');
delete we.warmupDone;we.sets[0].r='8';we.sets[0].done=true;
chk(!warmupRequired(0),'una sesión que ya tenía trabajo confirmado no vuelve a empezar desde calentamiento');
uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;

suite('3.3.0 — calentamiento por tiempo y avisos sin duplicados');
we=warmFixture('warm-hang',{type:'tiempo',equip:'nada',muscle:'espalda',lo:20,hi:40},'',{w:0,reps:30,sets:1,type:'hold'});
warmClock=Date.now();Date.now=()=>warmClock;wg=ensureWarmup(0);
chk(wg.plan.steps[0].seconds===10&&uiSession().includes('Iniciar 10 segundos'),'el isométrico empieza por una duración corta con temporizador propio');
uiWarmupRecord(0,wg.id,0);chk(wg.completed===0,'el calentamiento por tiempo no se confirma antes de medirlo');
uiWarmupTimedStart(0,wg.id,0);const holdDeadline=wg.holdUntil;
uiWarmupTimedStart(0,wg.id,0);chk(wg.holdUntil===holdDeadline,'un doble toque no reinicia el temporizador de preparación');
chk(holdDeadline===warmClock+13000,'hay tres segundos para colocarse antes de los diez de trabajo suave');
warmClock+=3000;tickRest();chk(els['warmup-hold-time'].textContent===10&&els['warmup-record'].disabled,'el tiempo para colocarse no descuenta segundos del isométrico');
save();db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));wg=ensureWarmup(0);
warmClock=holdDeadline-1;uiWarmupRecord(0,wg.id,0);chk(wg.phase==='set','recargar tampoco permite confirmar antes de terminar la duración');
warmClock=holdDeadline;tickRest();uiWarmupRecord(0,wg.id,0);
chk(wg.phase==='rest'&&wg.restDuration===30&&collectEntries(db.active).length===0,'el isométrico medido abre su descanso sin convertirse en registro');
const originalWarmBeep=beep,warmCues=[];beep=(kind='finish')=>{warmCues.push(kind);return {};};
warmClock=wg.restUntil-3000;tickRest();tickRest();warmClock+=1000;tickRest();warmClock+=1000;tickRest();warmClock+=1000;tickRest();tickRest();
chk(warmCues.join(',')==='countdown,countdown,countdown,finish','los últimos tres segundos y el final avisan una sola vez cada uno');
const warmExpiry=wg.restUntil;uiWarmupExtend(0,wg.id);chk(wg.restUntil===warmExpiry,'un descanso ya acabado no se reactiva al pulsar un botón antiguo');
save();db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));tickRest();chk(warmCues.length===4,'recargar después del descanso no repite el sonido final');
beep=originalWarmBeep;wg=ensureWarmup(0);uiWarmupNext(0,wg.id,wg.completed);
chk(uiSession().includes('Medir esta serie')&&!uiSession().includes('Iniciar 10 segundos'),'al completar la preparación aparece el temporizador normal del ejercicio');
Date.now=warmRealNow;uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;

suite('3.3.1 — avisos de carga según la precisión real del equipo');
resetDB();db.gym=defaultGym('kg');
const visualTower='visual-tower';
Object.assign(exMeta(visualTower),{equip:'placas',stack:{unit:'lb',start:2.5,step:5,extra:1.5,extraMax:3},cap:250*.45359237});
let visualPlan=loadPlan(visualTower,toKgEx(visualTower,65.5));
chk(!uiLoadDiffers(visualTower,visualPlan),'65,5 lb disponibles no disparan un aviso por su conversión a kg');
chk(!uiLoadDiffers(visualTower,loadPlan(visualTower,visualPlan.total)),'el peso canónico guardado tampoco genera una diferencia ficticia');
chk(uiLoadDiffers(visualTower,loadPlan(visualTower,toKgEx(visualTower,65))),'65 lb frente a 65,5 lb disponibles sí se explica como carga cercana');
exMeta(visualTower).stack={unit:'lb',start:.625,step:5,extra:.625,extraMax:1.25};
visualPlan=loadPlan(visualTower,toKgEx(visualTower,65.625));
chk(!uiLoadDiffers(visualTower,visualPlan)&&!uiLoadDiffers(visualTower,loadPlan(visualTower,visualPlan.total)),'los ajustes finos de tres decimales conservan su valor de etiqueta');
chk(uiProposalValue({key:visualTower,sugg:{w:toKgEx(visualTower,65.625),reps:6}}).includes('65,625 lb'),'la propuesta visible respeta los tres decimales del ajuste fino');
exMeta('visual-bar').equip='barra';
chk(uiLoadDiffers('visual-bar',loadPlan('visual-bar',142)),'una diferencia física en los discos sigue siendo visible');
chk(!uiLoadDiffers('visual-bar',loadPlan('visual-bar',140)),'una barra que se puede montar exactamente no muestra aviso');

suite('Volumen semanal — una referencia sin semanas futuras ni porcentajes engañosos');
resetDB();
function volumeWeekFixture(ago,volume){
  const start=weekStart(new Date());start.setDate(start.getDate()-ago*7);start.setHours(12);
  db.history.push({id:'vol-'+ago,date:start.toISOString(),entries:[{key:'banca',name:'Banca',sets:volume?[S(volume/10,10)]:[]}]});
}
volumeWeekFixture(5,16000);volumeWeekFixture(3,6000);volumeWeekFixture(2,6000);volumeWeekFixture(1,12000);volumeWeekFixture(0,2000);
let volumeRef=weeklyVolumeReference(weeklyVolumes(8));
chk(volumeRef.count===4 && volumeRef.mean===6000,'media de cuatro semanas completas: incluye la semana sin sesiones, excluye la actual y la quinta');
chk(uiWeekComparison(weeklyVolumes(8).at(-1),volumeRef).includes('33%'),'2000 de 6000 es el 33% del promedio semanal');
chk(uiWeekComparison({vol:7200,current:true},volumeRef).includes('20%'),'7200 supera el promedio de 6000 en un 20%');
chk(uiWeekComparison({vol:6000,current:true},volumeRef).includes('alcanzaste'),'alcanzar exactamente el promedio tiene su propio estado');
chk(uiWeekComparison({vol:5999,current:true},volumeRef).includes('casi el 100%'),'el redondeo no anuncia que se alcanzó un promedio pendiente');
chk(uiWeekComparison({vol:10,current:true},volumeRef).includes('menos del 1%'),'un volumen positivo pequeño no se presenta como cero');
db.settings.unit='lb';
chk(weeklyVolumeReference(weeklyVolumes(8)).mean===6000 && uiWeekComparison({vol:2000,current:true},volumeRef).includes('33%'),'cambiar a libras no altera la media almacenada ni la proporción');
resetDB();volumeWeekFixture(1,6000);volumeWeekFixture(0,2000);
volumeRef=weeklyVolumeReference(weeklyVolumes(8));
chk(volumeRef.count===1 && volumeRef.mean===6000,'un historial corto no se rellena con ceros anteriores a su primer registro');
resetDB();volumeWeekFixture(0,2000);
volumeRef=weeklyVolumeReference(weeklyVolumes(8));
chk(volumeRef.count===0 && volumeRef.mean===null,'la primera semana en curso todavía no tiene referencia');
chk(uiWeekComparison({vol:2000,current:true},volumeRef).includes('primera semana'),'sin referencia explica cuándo aparecerá, sin inventar un porcentaje');
resetDB();volumeWeekFixture(20,6000);
volumeRef=weeklyVolumeReference(weeklyVolumes(8));
chk(volumeRef.count===4 && volumeRef.mean===0,'una pausa larga conserva las semanas recientes sin actividad');
chk(!/NaN|Infinity|%/.test(uiWeekComparison({vol:2000,current:true},volumeRef)),'un promedio cero nunca divide entre cero ni anuncia porcentajes infinitos');
resetDB();
volumeRef=weeklyVolumeReference(weeklyVolumes(8));
chk(volumeRef.count===0 && volumeRef.mean===null,'sin historial no hay media numérica');


suite('Refinamiento UX — guardado, contexto y recuperación');
{
function refineDB(){
 db=normalize({settings:{goal:'hipertrofia'},history:[],routines:[{id:'ra',name:'A',split:'sa',exercises:[{id:'ea',key:'ref-press',name:'Press'}]},{id:'rb',name:'B',split:'sb',exercises:[{id:'eb',key:'ref-press',name:'Press'}]}],splits:[{id:'sa',name:'Plan A',active:true,exconf:{'ref-press':{sets:3,rest:60}}},{id:'sb',name:'Plan B',active:false,exconf:{'ref-press':{sets:2,rest:180}}}],exmeta:{}});
 view={name:'home'};restUntil=null;window.__saveError=null;window.__loadError=null;window.__removedSet=null;
 Object.assign(exMeta('ref-press'),{equip:'nada',lo:6,hi:10});save();
}
refineDB();startSession('ra');
view={name:'exercise',rid:'rb',key:'ref-press'};setSplitConf('ref-press','sets','5');
chk(db.active.exercises[0].sets.length===3&&db.splits[1].exconf['ref-press'].sets===5,'editar series de B conserva la sesión de A');
db.history.push({id:'ref-history',routineId:'ra',routineName:'A',date:new Date().toISOString(),entries:[{key:'ref-press',name:'Press',sets:[S(20,8)]}]});
window.__moveTo='sb';window.__moveCopy=false;doMoveRoutine('ra');
view={name:'session'};
chk(historySplitId(db.history[0])==='sa'&&db.active.splitId==='sa'&&restSecs('ref-press')===60,'mover un día conserva atribución y descanso de la sesión');

refineDB();startSession('ra');db.active.exercises[0].sets[0]={w:'20',r:'8',rir:''};prepareFixture(0);save();
const beforeRejected=localStorage.getItem(LS_KEY),writer=localStorage.setItem;
localStorage.setItem=()=>{throw new Error('quota');};uiLogSet(0,0);
chk(!db.active.exercises[0].sets[0].done&&!restUntil,'un registro rechazado sigue editable y no inicia descanso');
chk(localStorage.getItem(LS_KEY)===beforeRejected,'un registro rechazado conserva la copia anterior');
localStorage.setItem=writer;db.active.exercises[0].sets[0].done=true;save();const beforeFinishReject=localStorage.getItem(LS_KEY);
localStorage.setItem=()=>{throw new Error('quota');};finishSession();
chk(!!db.active&&db.history.length===0&&localStorage.getItem(LS_KEY)===beforeFinishReject,'un cierre rechazado conserva la sesión y no anuncia éxito');
localStorage.setItem=writer;save();finishSession();
chk(!db.active&&db.history.length===1&&els.modalhost.innerHTML.includes('sesión parcial')&&!els.modalhost.innerHTML.includes('fin-spark'),'reintentar guarda una sola sesión parcial sin compararla con sesiones completas');closeModal();

refineDB();const original=localStorage.getItem(LS_KEY);
localStorage.setItem(LS_KEY,'{invalid');const corrupted=load();
chk(!!window.__loadError&&localStorage.getItem(LS_KEY)==='{invalid','una lectura dañada conserva el original y activa recuperación');
chk(save()===false&&localStorage.getItem(LS_KEY)==='{invalid','la recuperación bloquea escribir una base vacía sobre datos dañados');
localStorage.setItem(LS_KEY,original);db=load();
chk(!window.__loadError&&db.routines.length===2,'al recuperar la lectura reaparecen los datos anteriores');
chk(!validBackup({routines:[],history:[null]})&&!validBackup({routines:[null],history:[]}), 'un respaldo inválido se rechaza antes de restaurar');
startSession('ra');db.active.restUntil=Date.now()+60000;save();const restored=JSON.parse(JSON.stringify(db));restUntil=null;
chk(restoreBackupData(restored)&&restUntil===restored.active.restUntil,'restaurar una sesión recupera el descanso en memoria');
chk(!!localStorage.getItem(LS_KEY+'.recovery'),'restaurar conserva una copia local del estado previo');

refineDB();const gymA=db.gym.id,gymB=normGym({id:'ref-gym-b',name:'Otro gimnasio'},'kg');db.gyms.push(gymB);
setExNotes('ref-press','Baja con control');setGymNotes('ref-press','Asiento 4');setActiveGym(gymB.id);
chk(!exMeta('ref-press').gymNotes&&exMeta('ref-press').notes==='Baja con control','el segundo gimnasio recibe la técnica general y su propio ajuste');
setGymNotes('ref-press','Asiento 7');setActiveGym(gymA);
chk(exMeta('ref-press').gymNotes==='Asiento 4'&&exerciseNotes('ref-press').includes('Baja con control'),'volver al gimnasio recupera su asiento sin perder técnica');
setExRange('ref-press','hi','4');chk(exMeta('ref-press').hi===10,'un rango invertido no se guarda');

refineDB();startSession('ra');db.active.exercises[0].sets[0]={w:'20',r:'8',done:true,totalKg:20};save();uiRemoveSet(0,0);uiUndoRemovedSet();
chk(db.active.exercises[0].sets[0].done&&db.active.exercises[0].sets[0].totalKg===20,'deshacer restaura la serie confirmada y su carga canónica');
view={name:'history',progressTab:'exercises',exerciseQuery:'Press'};go({name:'home'});uiTab('history');
chk(view.progressTab==='exercises'&&view.exerciseQuery==='Press','volver a Evolución conserva pestaña y búsqueda');
chk(viewKey({name:'settings',section:'data'})!==viewKey({name:'settings',section:'sync'}),'cada ajuste conserva una posición independiente');

refineDB();Object.assign(exMeta('ref-press'),{type:'tiempo',equip:'nada',lo:10,hi:30});startSession('ra');db.active.exercises[0].sets[0].r='20';prepareFixture(0);
const timerNow=Date.now;let timerClock=timerNow();Date.now=()=>timerClock;
startSetTimer(0,0);closeModal();
chk(!!db.active.setTimer,'minimizar conserva una medición en la sesión');
timerClock+=15000;startSetTimer(0,0);
chk(db.active.setTimer.count===8&&db.active.setTimer.phase==='run','el cronómetro usa tiempo real: 3 s de preparación y 12 s transcurridos');
closeModal();timerClock+=10000;startSetTimer(0,0);
chk(!db.active.setTimer&&db.active.exercises[0].sets[0].r==='20'&&!db.active.exercises[0].sets[0].done,'retomar una medición vencida rellena segundos sin confirmar la serie');
Date.now=timerNow;closeModal();

refineDB();exMeta('ref-press').lo=6;exMeta('ref-press').hi=10;
db.history=[{id:'normal',routineName:'A',date:new Date(Date.now()-86400000).toISOString(),entries:[{key:'ref-press',name:'Press',sets:[S(20,8)]}]},{id:'deload',routineName:'A',date:new Date().toISOString(),deload:true,entries:[{key:'ref-press',name:'Press',sets:[S(40,8)]}]}];
chk(bestMetricBefore('ref-press')===epley(20,8)&&uiExerciseMetric('ref-press').best===20,'descargas no elevan récords ni la gráfica de progreso normal');
window.__edit={id:'normal',entries:[{key:'ref-press',name:'Press',sets:[{w:'10',r:'8',rir:''}]}]};db.history[0].prs=[{key:'ref-press',now:100,prev:10}];saveEditedSession();
chk(!db.history[0].prs.some(p=>p.now===100),'corregir historial recalcula los récords almacenados');

refineDB();startSession('ra');view={name:'exercise',rid:'ra',key:'ref-press',from:'session'};
promptDuplicateEx('ref-press','Press');document.getElementById('dupname').value='Press cable';doDuplicateEx({preventDefault(){}});
chk(db.routines[0].exercises.length===2&&db.routines[1].exercises.length===1&&db.active.exercises.length===2,'crear una variante afecta solo al día consultado y su sesión');
chk(db.active.exercises[1].sets.length===3&&view.rid==='ra'&&view.exTab==='equipment','la variante conserva sus series y abre su equipo en el mismo contexto');closeModal();
refineDB();startSession('ra');db.active.exercises[0].sets=[{w:'20',r:'8',done:true},{w:'',r:'',rir:''}];
uiRemoveSet(0,0);uiUndoRemovedSet();chk(db.active.exercises[0].sets.length===2&&!db.active.exercises[0].sets[1].done,'deshacer conserva también una serie vacía que ya existía');
refineDB();const priorImport=localStorage.getItem(LS_KEY);
window.__hevyImport={news:[{hevyKey:'ux-import',title:'Día importado',date:new Date().toISOString(),duration:600,ex:new Map([['Remo',[S(20,8)]]])}],repairs:[]};
localStorage.setItem=()=>{throw new Error('quota');};applyHevyImport();
chk(localStorage.getItem(LS_KEY)===priorImport&&db.history.length===0&&!!window.__hevyImport,'una importación rechazada conserva el estado anterior y puede reintentarse');
localStorage.setItem=writer;applyHevyImport();
chk(db.history.length===1&&db.routines.find(r=>r.name==='Día importado')?.split&&window.__hevyImport===null,'reintentar la importación agrega una sola copia y un día asociado a un plan');closeModal();
}

suite('Regresión — torre 10/15, ajuste 0/5/10 y preparación conservada');
{
 const key='tower-regression',F=.45359237,kg=lb=>Math.round(lb*F*1000)/1000;
 function towerFixture(fine=true){
  const machine=(step,max,extra,extraMax)=>({equip:'placas',cap:kg(max),stack:{unit:'lb',start:10,step,extra,extraMax}});
  db=normalize({settings:{goal:'ambas',unit:'lb',gymId:'tower-b',sound:'off',vibration:'off'},
   gyms:[{id:'tower-a',name:'Habitual',unit:'lb',machines:{[key]:machine(10,200,2.5,5)}},
         {id:'tower-b',name:'Segunda torre',unit:'lb',machines:{[key]:machine(15,160,fine?5:null,fine?10:null)}}],
   splits:[{id:'tower-plan',name:'Plan',active:true,exconf:{[key]:{lo:6,hi:8,sets:2}}}],
   routines:[{id:'tower-day',name:'Torso',split:'tower-plan',exercises:[{id:'tower-ex',key,name:'Jalón en torre'}]}],
   exmeta:{[key]:{type:'normal',muscle:'espalda',lo:6,hi:8}},history:[]});
  applyGymMachines(db.gym);invalidatePlates();view={name:'home'};uiResetRest();
  window.__saveError=null;window.__loadError=null;delete window.__proposalUndo;
  const previous=sess(key,[S(kg(62.5),13,0),S(kg(62.5),10,0)],2);
  previous.routineId='tower-day';previous.splitId='tower-plan';
  save();return computeSuggestion(key);
 }
 function beginTower(fine=false){towerFixture(fine);startSession('tower-day');return db.active.exercises[0];}
 let sg=towerFixture();
 chk(sg.type==='up'&&sg.w===kg(65)&&sg.reps===6&&sg.sets===2,
     '62,5 lb × 13/10, RIR 0 y rango 6–8 → 65 lb × 6 en dos series');
 let mount=loadPlan(key,sg.w).stack;
 chk(mount.index===4&&mount.plateValue===55&&mount.extra===10&&mount.value===65,
     '65 lb son placa 4 (55) + ajuste 10; la placa conserva su valor base');
 db.history[0].entries[0].sets.forEach(st=>st.w=62.5*F);
 chk(computeSuggestion(key).w===kg(65),'el mismo historial sin redondear también propone 65 lb');
 sg=towerFixture(false);
 chk(sg.w===kg(70)&&loadPlan(key,sg.w).stack.index===5,
     'sin ajuste fino el siguiente peso disponible es 70 lb, placa 5; no salta a 85');
 setExStack(key,'extra','5');setExStack(key,'extraMax','10');
 chk(computeSuggestion(key).w===kg(65),'habilitar el pin giratorio vuelve a calcular 65 lb desde el historial');
 let allPhysical=true;
 for(let i=0;i<=10;i++)for(const extra of [0,5,10]){
  const base=10+15*i,total=base+extra,sn=stackSnap(key,kg(total));
  allPhysical&&=sn.index===i+1&&sn.plateValue===base&&sn.extra===extra&&sn.value===total;
 }
 chk(allPhysical,'las 33 combinaciones mantienen índice, placa base, ajuste y total coherentes');
 chk(stackSnap(key,kg(70)).index===5&&stackSnap(key,kg(85)).index===6,
     '70 lb siguen siendo placa 5 y 85 lb siguen siendo placa 6');
 chk(progressionWeight(key,kg(65),.025)===kg(70)&&progressionWeight(key,kg(65),.05,-1)===kg(60),
     'subir y bajar eligen combinaciones en la dirección correcta');
 chk(stackSnap(key,kg(170),{min:kg(170)+.001})===null&&progressionWeight(key,kg(170),.025)===kg(170),
     'al agotar torre y ajuste no se inventa una placa adicional');
 chk(stackSnap(key,kg(10),{max:kg(10)-.001})===null&&progressionWeight(key,kg(10),.05,-1)===kg(10),
     'tampoco se inventan pesos por debajo de la primera placa');
 exMeta(key).step=kg(10);
 chk(progressionWeight(key,kg(62.5),.025)===kg(75),'un aumento mínimo explícito de 10 lb sí se respeta');
 chk(progressionWeight(key,kg(165),.025)===kg(170),'si el mínimo supera la última placa alcanza el tope disponible de 170 lb');
 exMeta(key).step=null;
 const history=JSON.stringify(db.history);setActiveGym('tower-a');
 chk(computeSuggestion(key).w===kg(65)&&stackConf(key).step===10&&stackConf(key).extra===2.5,
     'la torre habitual con dos ajustes de 2,5 permite 65 lb y conserva sus saltos de 10');
 setActiveGym('tower-b');
 chk(computeSuggestion(key).w===kg(65)&&stackConf(key).step===15&&stackConf(key).extraMax===10&&JSON.stringify(db.history)===history,
     'volver a la segunda torre recupera su equipo sin modificar el historial');

 let ex=beginTower();prepareFixture(0);
 let warm=ensureWarmup(0),warmId=warm.id,performed=JSON.stringify(warm.plan.steps);
 chk(ex.sets[0].w==='70'&&ex.sets[0].autoWeightKg===kg(70)&&ex.warmupDone,
     'al completar la preparación se identifica la carga rellenada automáticamente');
 setExStack(key,'extra','5');setExStack(key,'extraMax','10');
 chk(ex.sugg.w===kg(65)&&ex.sets[0].w==='65'&&recordedSetKg(key,ex.sets[0])===kg(65),
     'editar el ajuste actualiza propuesta, borrador automático y carga canónica a 65 lb');
 chk(!warmupRequired(0)&&ensureWarmup(0).id===warmId&&JSON.stringify(ex.warmup.plan.steps)===performed,
     'el calentamiento completado mantiene su identidad y las aproximaciones realizadas');
 chk(collectEntries(db.active).length===0&&ex.sets.every(st=>!st.done)&&ex.sets[0].r==='',
     'corregir equipo no registra series ni rellena repeticiones realizadas');
 const card=uiLoadStrip(0);
 chk(card.includes('Placa 4')&&card.includes('55 lb de torre')&&card.includes('10 lb de ajuste fino')&&card.includes('Total: 65 lb'),
     'el montaje muestra placa 4, base 55, ajuste 10 y total 65 juntos');
 save();db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));ex=db.active.exercises[0];
 chk(!warmupRequired(0)&&ex.sets[0].autoWeightKg===kg(65),'recargar conserva la preparación y el origen automático del borrador');
 setGymNotes(key,'Asiento 4');
 chk(!warmupRequired(0)&&ensureWarmup(0).id===warmId,'editar una nota de montaje tampoco repite la preparación');
 setExStack(key,'extraMax','0');
 chk(ex.sets[0].w==='70'&&!warmupRequired(0),'quitar el ajuste recupera 70 lb sin repetir el calentamiento ya hecho para 70');

 ex=beginTower();prepareFixture(0);setVal(0,0,'w','85');prepareFixture(0);warmId=ensureWarmup(0).id;
 setExStack(key,'extra','5');setExStack(key,'extraMax','10');
 chk(ex.sugg.w===kg(65)&&ex.sets[0].w==='85'&&!Number.isFinite(ex.sets[0].autoWeightKg),
     'un peso escrito por la persona se conserva aunque la propuesta cambie a 65');
 chk(!warmupRequired(0)&&ensureWarmup(0).id===warmId&&uiLoadStrip(0).includes('Montaje para tu carga escrita')&&uiLoadStrip(0).includes('Placa 6')&&uiLoadStrip(0).includes('Total: 85 lb'),
     'la carga manual de 85 se identifica y su pin 6 no se confunde con la propuesta de 65');
 uiUseSuggestion(0);
 chk(ex.sets[0].w==='65'&&ex.sets[0].r==='6'&&ex.sets[0].autoWeightKg===kg(65),'aplicar la propuesta sustituye explícitamente el borrador manual');
 uiUndoProposal(0);
 chk(ex.sets[0].w==='85'&&ex.sets[0].r===''&&ex.sets[0].autoWeightKg===undefined,'deshacer recupera tanto el peso manual como su origen');

 ex=beginTower();prepareFixture(0);uiUseSuggestion(0);uiLogSet(0,0);
 const confirmed=JSON.stringify(collectEntries(db.active));setExStack(key,'extra','5');setExStack(key,'extraMax','10');
 chk(JSON.stringify(collectEntries(db.active))===confirmed&&ex.sets[0].w==='70'&&ex.sets[0].done&&ex.sets[0].autoWeightKg===undefined&&collectEntries(db.active)[0].sets[0].w===kg(70),
     'una serie confirmada de 70 lb permanece intacta al corregir el ajuste');

 ex=beginTower();warm=ensureWarmup(0);uiWarmupRecord(0,warm.id,0);
 const firstStep=JSON.stringify(warm.plan.steps[0]),deadline=warm.restUntil,oldToken=warm.id;
 setExStack(key,'extra','5');setExStack(key,'extraMax','10');warm=ensureWarmup(0);
 chk(warm.completed===1&&warm.phase==='rest'&&warm.restUntil===deadline&&JSON.stringify(warm.plan.steps[0])===firstStep,
     'editar durante un descanso conserva la aproximación realizada y el plazo original');
 chk(warm.id!==oldToken&&warm.plan.W===kg(65),'solo se recalculan las aproximaciones pendientes para la nueva carga');
 uiWarmupRecord(0,oldToken,1);
 chk(warm.completed===1&&warm.restUntil===deadline,'un botón atrasado no puede registrar una aproximación recalculada');
 prepareFixture(0);
 chk(ex.warmupDone&&ex.sets[0].w==='65'&&!warmupRequired(0),'continuar las aproximaciones pendientes termina con 65 lb sin empezar de cero');

 ex=beginTower();prepareFixture(0);delete ex.sets[0].autoWeightKg;save();
 db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));ex=db.active.exercises[0];
 setExStack(key,'extra','5');setExStack(key,'extraMax','10');
 chk(!warmupRequired(0)&&ex.sets[0].w==='70'&&ex.sugg.w===kg(65),
     'una sesión antigua sin origen del peso conserva su borrador y su calentamiento');
 ex.sugg={...ex.sugg,w:kg(85)};delete db.active.suggestionVersion;save();
 db=normalize(JSON.parse(localStorage.getItem(LS_KEY)));ex=db.active.exercises[0];warmId=ensureWarmup(0).id;
 const priorSessionHistory=JSON.stringify(db.history);
 chk(refreshSessionSuggestions()&&ex.sugg.w===kg(65)&&db.active.suggestionVersion===APP_VERSION,
     'actualizar la app corrige también una propuesta antigua de 85 lb guardada en la sesión');
 chk(ex.sets[0].w==='70'&&!warmupRequired(0)&&ensureWarmup(0).id===warmId&&JSON.stringify(db.history)===priorSessionHistory,
     'la actualización mantiene el borrador antiguo, el calentamiento y el historial');
 chk(!refreshSessionSuggestions(),'la misma versión no vuelve a recalcular una sesión ya actualizada');
 delete db.active.suggestionVersion;ex.sugg.w=kg(85);save();const oldWriter=localStorage.setItem;
 localStorage.setItem=()=>{throw new Error('quota');};
 chk(!refreshSessionSuggestions()&&db.active.exercises[0].sugg.w===kg(85)&&db.active.suggestionVersion===undefined,
     'si falla el guardado de la actualización se conserva la sesión anterior para reintentar');
 localStorage.setItem=oldWriter;refreshSessionSuggestions();

 ex=beginTower();prepareFixture(0);warmId=ensureWarmup(0).id;setActiveGym('tower-a');
 chk(ex.sets[0].w==='65'&&warmupRequired(0)&&ensureWarmup(0).id!==warmId,
     'cambiar realmente de gimnasio recalcula el borrador y prepara la otra máquina');
 prepareFixture(0);warmId=ensureWarmup(0).id;setExStack(key,'step','15');
 chk(warmupRequired(0)&&ensureWarmup(0).id!==warmId,'cambiar el salto principal de placas sí invalida una preparación distinta');
 prepareFixture(0);warmId=ensureWarmup(0).id;ensureWarmup(0,true);
 chk(warmupRequired(0)&&ensureWarmup(0).id!==warmId,'pedir explícitamente otro calentamiento sigue reiniciándolo');
 uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;
}

/* =====================================================================
   3.7.0 — escalera por intensidad y descanso tras el escalón pesado
   ===================================================================== */
suite('3.7.0 — escalera por intensidad y descanso tras el escalón pesado');
resetDB();uiResetRest();db.gym=defaultGym('kg');db.settings.rest='off';db.settings.sound='off';db.settings.vibration='off';db.settings.unit='kg';
db.routines=[{id:'lad-day',name:'Pierna',exercises:[{id:'l1',key:'hack',name:'Hack squat'},{id:'l2',key:'curl fem',name:'Curl femoral'},{id:'l3',key:'ext',name:'Extensión'},{id:'l4',key:'prensa',name:'Prensa'}]}];
Object.assign(exMeta('hack'),{equip:'discos',base:47.6,muscle:'cuadriceps',lo:6,hi:8});
Object.assign(exMeta('curl fem'),{equip:'placas',muscle:'isquios',lo:6,hi:8,stack:{unit:'lb',start:10,step:10,extra:2.5,extraMax:7.5}});
Object.assign(exMeta('ext'),{equip:'placas',muscle:'cuadriceps',lo:8,hi:12,stack:{unit:'kg',start:5,step:5}});
Object.assign(exMeta('prensa'),{equip:'discos',base:30,muscle:'gluteos',lo:12,hi:15});
view={name:'home'};startSession('lad-day');
db.active.exercises[0].sets[0].w='10';   /* 5 kg por lado + carro de 47,6 = 57,6 */
let lad=warmupPlan(0);
chk(lad.heavy&&Math.abs(lad.W-57.6)<1e-9,'un rango de 6 a 8 cuenta como pesado (≈80 % 1RM)');
chk(lad.steps.length===1&&Math.abs(lad.steps[0].w-47.6)<1e-9&&lad.steps[0].reps===3,'hack squat: el carro vacío (83 %) es el único escalón y toma las reps del escalón pesado (3), no del ligero');
const ladNow=Date.now;let ladClock=ladNow();Date.now=()=>ladClock;
let ladState=ensureWarmup(0);
uiWarmupRecord(0,ladState.id,0);
chk(ladState.phase==='rest'&&ladState.restDuration===60&&ladState.restUntil===ladClock+60000&&validWarmupState(ladState),'tras el escalón pesado final el descanso base es de 1 minuto');
uiWarmupExtend(0,ladState.id);
chk(ladState.restDuration===90&&ladState.restUntil===ladClock+90000&&validWarmupState(ladState),'ampliar suma 30 s hasta 1:30');
uiWarmupExtend(0,ladState.id);chk(ladState.restUntil===ladClock+90000,'una segunda ampliación no supera 1:30');
ladClock=ladState.restUntil;uiWarmupNext(0,ladState.id,1);
chk(db.active.exercises[0].warmupDone&&!warmupRequired(0),'el recorrido termina tras el único escalón');
db.settings.unit='lb';db.active.exercises[1].sets[0].w='70';
lad=warmupPlan(1);
const ladLb=lad.steps.map(st=>Math.round(st.w/0.45359237*100)/100);
chk(lad.first&&ladLb.length===2&&ladLb[0]===35&&ladLb[1]===55&&lad.steps[0].reps===5&&lad.steps[1].reps===3,'curl femoral en torre de lb con manija: 35 × 5 y 55 × 3 (50 % y 80 % de 70)');
ladState=ensureWarmup(1);uiWarmupRecord(1,ladState.id,0);
chk(ladState.restDuration===30&&ladState.restUntil===ladClock+30000,'el escalón ligero mantiene 30 s');
ladClock=ladState.restUntil;uiWarmupNext(1,ladState.id,1);uiWarmupRecord(1,ladState.id,1);
chk(ladState.restDuration===60,'el segundo escalón, al 80 %, descansa 1 minuto antes del trabajo');
db.settings.unit='kg';db.active.exercises[2].sets[0].w='40';
lad=warmupPlan(2);
chk(!lad.first&&lad.reason==='prepared'&&lad.steps.length===0&&!warmupRequired(2),'rango de 8 a 12 con el grupo ya preparado: sin escalones, acceso directo');
db.active.exercises[3].sets[0].w='20';   /* 10 por lado + carro de 30 = 50 */
lad=warmupPlan(3);
chk(lad.first&&lad.steps.length===1&&lad.steps[0].w===35&&lad.steps[0].reps===6,'rango de 12 a 15 como primer trabajo del grupo: un escalón al 70 % × 6');
Date.now=ladNow;uiResetRest();db.active=null;clearInterval(timerInt);timerInt=null;

/* ---------- resultado ---------- */
console.log('\n' + '='.repeat(50));
console.log(fail === 0 ? `TODOS LOS TESTS OK (${pass})` : `${fail} FALLOS de ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
