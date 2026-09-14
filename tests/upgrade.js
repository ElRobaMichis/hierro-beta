/* Startup compatibility: run the real engine/init with an old or missing UI. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..',process.argv.includes('--beta')?'dist':'.'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const engine=html.match(/<script>([\s\S]*)<\/script>/)[1];
const version=html.match(/const APP_VERSION = '([^']+)'/)[1];
const ui=html.match(/<script id="hierro-ui">\n([\s\S]*?)\n<\/script>/)?.[1]||fs.readFileSync(path.join(root,'ui.js'),'utf8');
const css=html.match(/<style id="hierro-ui-styles">\n([\s\S]*?)\n<\/style>/)?.[1]||fs.readFileSync(path.join(root,'ui.css'),'utf8');
const cssVersion=css.match(/--ui-version:([^;]+);/)[1];
let count=0;const ok=(value,message)=>{assert.ok(value,message);count++;console.log('OK '+message);};
async function startup(prefix,cssVersion){
 const fields={},events={},trace=[],timeouts=[];
 const stored=JSON.stringify({settings:{goal:'hipertrofia'},history:[],routines:[{id:'keep-day',name:'Mi día',exercises:[{id:'keep-press',name:'Press',key:'press'}]}],active:null});
 let reloads=0;
 const location={href:'https://example.test/hierro-beta/?existing=1',protocol:'https:',hostname:'example.test',reload(){reloads++;},replace(url){trace.push(url);}};
 const document={body:{style:{},dataset:{}},querySelector(){return null;},getElementById(id){return fields[id]||=( {innerHTML:'',style:{}} );},addEventListener(){}};
 const registration={addEventListener(){},update(){trace.push('update');return Promise.resolve();}};
 const navigator={serviceWorker:{addEventListener(name,fn){events[name]=fn;},register(url,options){trace.push('register');assert.equal(options.updateViaCache,'none');return Promise.resolve(registration);}}};
 const context={document,navigator,location,URL,localStorage:{getItem(){return stored;},setItem(){trace.push('WRITE');}},console,setTimeout(fn,ms){timeouts.push({fn,ms});},setInterval(){},clearInterval(){},addEventListener(){},isSecureContext:true};
 if(cssVersion!==undefined){document.documentElement={dataset:{}};context.getComputedStyle=()=>({getPropertyValue(){return cssVersion;}});}
 context.window=context;vm.createContext(context);
 vm.runInContext(prefix+'\n'+engine,context);await Promise.resolve();
 return {fields,events,trace,timeouts,retry:()=>vm.runInContext('retryStartup()',context),get reloads(){return reloads;}};
}
(async()=>{
 ok(fs.readFileSync(path.join(root,'ui.js'),'utf8').includes(`const UI_VERSION = '${version}'`),'motor e interfaz declaran la misma versión');
 ok(cssVersion===JSON.stringify(version),'la versión CSS es texto, sin tokens numéricos que WebKit pueda reinterpretar');
 for(const [label,prefix]of [['ausente',''],['anterior',"const UI_VERSION='3.0.1';"]]){
  const run=await startup(prefix);
  ok(run.trace.includes('register')&&run.trace.includes('update'),`con interfaz ${label} se registra y busca el worker nuevo`);
  ok(run.fields.main.innerHTML.includes('Preparando la actualización')&&run.fields.main.innerHTML.includes('Volver a intentar'),`con interfaz ${label} aparece una recuperación visible, sin pantalla en blanco`);
  ok(!run.trace.includes('WRITE'),`la recuperación con interfaz ${label} no modifica los datos`);
  run.timeouts.find(t=>t.ms===8000).fn();
  ok(run.fields.main.innerHTML.includes('No pudimos cargar la interfaz.')&&!run.fields.main.innerHTML.includes('Preparando la actualización'),`la interfaz ${label} no deja una espera indefinida`);
  run.retry();
  const retryURL=new URL(run.trace.at(-1));
  ok(retryURL.origin==='https://example.test'&&retryURL.pathname==='/hierro-beta/'&&retryURL.searchParams.has('recargar')&&retryURL.searchParams.get('existing')==='1',`el reintento ${label} pide una página nueva dentro de la misma app`);
  ok(!run.trace.includes('WRITE'),`el reintento ${label} conserva los datos`);
  run.events.controllerchange();ok(run.reloads===1,`al activarse el worker compatible se reintenta el arranque ${label}`);
 }
 const cssMismatch=await startup(`const UI_VERSION='${version}';`,'3.0.1');
 ok(cssMismatch.fields.main.innerHTML.includes('Preparando la actualización'),'una hoja de estilos antigua también activa la recuperación');
 const current=await startup(ui,cssVersion);
 ok(current.fields.main.innerHTML.includes('Mi día')&&!current.fields.main.innerHTML.includes('Preparando la actualización'),'la versión compatible inicia la aplicación y conserva el día existente');
 ok(!current.events.controllerchange,'una aplicación funcionando no se recarga por una actualización del worker');
 for(const value of [version,` '${version}' `]){
  const alternate=await startup(ui,value);
  ok(alternate.fields.main.innerHTML.includes('Mi día'),'arranca con la representación compatible '+JSON.stringify(value));
 }
 console.log(`\nTODOS LOS TESTS DE ACTUALIZACIÓN OK (${count})`);
})().catch(e=>{console.error(e);process.exitCode=1;});
