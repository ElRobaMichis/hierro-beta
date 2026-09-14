/* Service-worker integration tests with real Response objects and an in-memory
   Cache API. Exercises install, offline navigation, updates and failed networks. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const beta=process.argv.includes('--beta');
const root=path.join(__dirname,'..',beta?'dist':'.'),base='https://example.test/'+(beta?'hierro-beta/':'hierro/');
const workerSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const declaredCache=workerSource.match(/const CACHE = '([^']+)'/)[1],cachePrefix=declaredCache.replace(/\d+\.\d+\.\d+$/,'');
const listeners={},buckets=new Map(),messages=[];let checks=0;
const absolute=req=>new URL(typeof req==='string'?req:req.url,base).href;
let network=async req=>{
 const name=new URL(absolute(req)).pathname.slice(new URL(base).pathname.length)||'index.html';
 return new Response(fs.readFileSync(path.join(root,name)),{status:200});
};
function bucket(name){
 if(!buckets.has(name))buckets.set(name,new Map());
 const map=buckets.get(name);
 return {
  async addAll(urls){const responses=await Promise.all(urls.map(u=>network(u)));responses.forEach(r=>assert(r.ok));for(let i=0;i<urls.length;i++)await this.put(urls[i],responses[i]);},
  async put(req,res){map.set(absolute(req),res.clone());},
  async match(req,opts){
   const target=new URL(absolute(req));if(opts?.ignoreSearch)target.search='';
   for(const [key,res]of map){const u=new URL(key);if(opts?.ignoreSearch)u.search='';if(u.href===target.href)return res.clone();}
  }
 };
}
const caches={
 async open(name){return bucket(name);},
 async keys(){return [...buckets.keys()];},
 async delete(name){return buckets.delete(name);},
 async match(req,opts){for(const name of buckets.keys()){const hit=await bucket(name).match(req,opts);if(hit)return hit;}}
};
const clients={async claim(){},async matchAll(){return [{postMessage:m=>messages.push(m),focus(){}}];},async openWindow(){}};
const context={self:{addEventListener:(k,fn)=>listeners[k]=fn,skipWaiting:async()=>{},clients},clients,caches,location:{origin:new URL(base).origin},URL,Response,Request:class extends Request{constructor(url,options){super(absolute(url),options);}},fetch:req=>network(req),setTimeout:(fn,ms)=>setTimeout(fn,ms===3000?2:ms)};
vm.runInNewContext(workerSource,context);
const ok=(value,msg)=>{assert.ok(value,msg);checks++;console.log('OK '+msg);};
async function lifecycle(type){const work=[];listeners[type]({waitUntil:p=>work.push(p)});await Promise.all(work);}
function request(file,navigate=false){
 let response;const work=[];
 listeners.fetch({request:{method:'GET',url:absolute(file),mode:navigate?'navigate':'same-origin'},respondWith:p=>response=p,waitUntil:p=>work.push(p)});
 return {response:Promise.resolve(response),work};
}
(async()=>{
 await lifecycle('install');
 const app=fs.readFileSync(path.join(root,'index.html'),'utf8');
 let workerReply;
 listeners.message({data:{tipo:'consultar-version'},source:{postMessage:m=>workerReply=m}});
 ok(workerReply?.tipo==='version-disponible'&&workerReply.version===app.match(/const APP_VERSION = '([^']+)'/)[1],'el worker comunica la versión instalada, sin pedir una actualización repetida');
 for(const asset of ['./','index.html','ui.css','ui.js','icon.svg','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'])ok(await caches.match(asset),'precargado '+asset);
 buckets.set(cachePrefix+'previous',new Map());buckets.set('otra-app',new Map());
 if(beta)buckets.set('hierro-2.0.0',new Map());
 await lifecycle('activate');
 ok(!buckets.has(cachePrefix+'previous')&&buckets.has('otra-app'),'la actualización limpia solo sus cachés anteriores');
 if(beta)ok(buckets.has('hierro-2.0.0'),'actualizar la beta conserva la caché de la app principal');
 network=async()=>{throw new TypeError('Offline');};
 let nav=request('./?offline=1',true);
 ok((await (await nav.response).text())===app,'navegación sin red recupera la app completa');await Promise.all(nav.work);
 for(const name of ['ui.js','ui.css']){
  const req=request(name);ok((await (await req.response).text())===fs.readFileSync(path.join(root,name),'utf8'),'sin conexión conserva '+name);
 }
 const versioned=beta?[...workerSource.matchAll(/'\.\/(ui\.(?:css|js)\?v=[^']+)'/g)].map(m=>m[1]):[...app.matchAll(/(?:href|src)="(ui\.(?:css|js)\?v=[^"]+)"/g)].map(m=>m[1]);
 ok(versioned.length===2&&versioned.every(p=>p.endsWith('?v='+app.match(/const APP_VERSION = '([^']+)'/)[1])),'el documento identifica la misma versión de CSS, JS y motor');
 for(const asset of versioned){const req=request(asset);ok((await(await req.response).text())===fs.readFileSync(path.join(root,asset.split('?')[0]),'utf8'),'sin conexión conserva '+asset);}
 const currentCache=await caches.open(declaredCache);
 for(const asset of versioned){
  const name=asset.split('?')[0];await currentCache.put(name,new Response('recurso antiguo sin versión'));
  const req=request(asset);ok((await(await req.response).text())===fs.readFileSync(path.join(root,name),'utf8'),'la versión exacta prevalece sobre una copia antigua de '+name);await Promise.all(req.work);
 }
 const foreign=await caches.open(cachePrefix+'ajena');await foreign.put('ui.js?v=desconocida',new Response('copia de otro caché'));
 let absent=request('ui.js?v=desconocida');ok((await absent.response).type==='error','sin red no sustituye una versión desconocida por archivos de otro caché');await Promise.all(absent.work);
 network=async()=>new Response(app.replace(/const APP_VERSION = '[^']+'/,"const APP_VERSION = '99.0.0'"));
 nav=request('./',true);ok((await(await nav.response).text()).includes("APP_VERSION = '99.0.0'"),'una versión futura se puede recibir desde la red');await Promise.all(nav.work);
 network=async()=>{throw new TypeError('Offline');};nav=request('./',true);
 ok((await(await nav.response).text())===app,'hasta instalar la actualización completa se conserva un documento offline compatible');await Promise.all(nav.work);
 network=async()=>new Response('error del servidor',{status:503});nav=request('./',true);
 ok((await (await nav.response).text())===app,'un 503 usa la copia local');await Promise.all(nav.work);
 let finishNetwork;network=()=>new Promise(resolve=>finishNetwork=resolve);
 nav=request('./',true);
 ok((await (await nav.response).text())===app,'red lenta abre la copia sin esperar la descarga');
 finishNetwork(new Response('documento actualizado',{status:200}));await Promise.all(nav.work);
 ok((await (await caches.match('./')).text())==='documento actualizado','la descarga tardía queda guardada');
 await Promise.resolve();
 ok(messages.some(m=>m.tipo==='documento-fresco'),'el documento nuevo avisa cuando la red se recupera');
 console.log(`\nTODOS LOS TESTS OFFLINE OK (${checks})`);
})().catch(e=>{console.error(e);process.exitCode=1;});
