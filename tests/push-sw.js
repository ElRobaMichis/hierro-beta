const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const handlers={},sent=[],records=new Map(),scope='https://elrobamichis.github.io/hierro-beta/';let focused=0,opened='';
const windows=[{url:'https://elrobamichis.github.io/hierro/',focus:async()=>{throw Error('wrong app');}},{url:scope,visibilityState:'hidden',focus:async()=>{focused++;},postMessage:m=>sent.push(m)}];
const clients={matchAll:async()=>windows,openWindow:async url=>{opened=url;}};
const context={self:{addEventListener:(name,fn)=>handlers[name]=fn,registration:{scope,showNotification:async(title,options)=>sent.push({title,options})},clients},clients,URL,Response,Request,Date,setTimeout,location:{origin:new URL(scope).origin}};
vm.createContext(context);vm.runInContext(fs.readFileSync('sw.js','utf8'),context);
context.pushStore=async(key,value)=>{if(value===undefined)return records.get(key);records.set(key,value);};
let count=0;const ok=(v,m)=>{assert.ok(v,m);count++;console.log('OK '+m);};
async function push(message){await new Promise((resolve,reject)=>handlers.push({data:{json:()=>message},waitUntil:p=>p.then(resolve,reject)}));}
(async()=>{
 const message={v:1,id:'rest1',kind:'rest',session:'session1',target:'press',title:'Descanso listo',body:'Press · 60 kg. Placa 8.',expires:Date.now()+90000};
 records.set('state',{enabled:true,session:'session1',ids:['rest1']});
 await push(message);ok(sent[0].options.body.includes('Placa 8')&&!sent[0].options.silent,'el worker muestra el montaje aunque no exista una página visible');
 ok(sent[0].options.icon.startsWith(scope),'los iconos apuntan al alcance propio de la beta');
 await push(message);ok(sent.at(-1).options.silent,'un reintento no vuelve a sonar');
 records.set('state',{enabled:true,session:'session2',ids:[]});await push({...message,id:'late'});
 ok(!sent.at(-1).options.body.includes('60 kg')&&sent.at(-1).options.silent,'un aviso en tránsito de otra sesión no recomienda una carga antigua');
 records.set('state',{enabled:false,ids:[]});await push({...message,id:'disabled'});ok(sent.at(-1).options.silent,'desactivar elimina los detalles de avisos que ya iban en tránsito');
 records.clear();await push({...message,id:'rest-no-state'});ok(sent.at(-1).options.body.includes('Placa 8'),'puede mostrar el push al despertar sin estado de la pestaña en memoria');
 const data={session:'session1',target:'press',kind:'rest'};
 await new Promise((resolve,reject)=>handlers.notificationclick({notification:{data,close(){}},waitUntil:p=>p.then(resolve,reject)}));
 ok(focused===1&&sent.at(-1).tipo==='hierro-push-open','tocar el aviso enfoca la beta y envía el contexto de la sesión');
 windows.length=0;
 await new Promise((resolve,reject)=>handlers.notificationclick({notification:{data,close(){}},waitUntil:p=>p.then(resolve,reject)}));
 ok(opened.startsWith('./#aviso='),'si está cerrada abre la app con un fragmento privado');
 console.log(`PRUEBAS SERVICE WORKER PUSH OK (${count})`);
})().catch(e=>{console.error(e);process.exit(1);});
