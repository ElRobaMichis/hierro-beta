/* Build the independently installable Pages beta from the tested app source. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
const assets=['index.html','ui.js','ui.css','sync-core.js','sync-engine.js','sync.js','qr.js','sw.js','manifest.webmanifest','icon.svg','icon-180.png','icon-192.png','icon-512.png','.nojekyll'];
fs.mkdirSync(out,{recursive:true});
for(const file of assets)fs.copyFileSync(path.join(root,file),path.join(out,file));
function transform(file,fn){const target=path.join(out,file);fs.writeFileSync(target,fn(fs.readFileSync(target,'utf8')));}
function replaceOnce(text,from,to){assert.equal(text.split(from).length,2,`Expected exactly one: ${from}`);return text.replace(from,()=>to);}
transform('index.html',text=>{
 text=replaceOnce(text,"const LS_KEY = 'hierro.v1';","const LS_KEY = 'hierro.beta.v1';");
 text=replaceOnce(text,'<title>Hierro — tu registro de gimnasio</title>','<title>Hierro Beta — tu registro de gimnasio</title>');
 text=replaceOnce(text,'name="apple-mobile-web-app-title" content="Hierro"','name="apple-mobile-web-app-title" content="Hierro Beta"');
 text=text.replaceAll("'hierro-idle'","'hierroBeta-idle'").replaceAll("'hierro-rest'","'hierroBeta-rest'");
 return text.replaceAll('`hierro-respaldo-','`hierro-beta-respaldo-');
});
// The stable worker deletes caches starting with "hierro-". This prefix must
// stay outside that namespace, in both the name and all cleanup/version checks.
transform('sw.js',text=>text.replaceAll('hierro-','hierroBeta-'));
transform('ui.js',text=>replaceOnce(text,'Hierro ${APP_VERSION}','Hierro Beta ${APP_VERSION}'));
// Deliver the interface and engine atomically. A first visit, slow connection
// or old worker must not pair the document with missing/stale CSS or JS.
// Keep the separate assets available for workers installed by older releases.
transform('index.html',text=>{
 const version=text.match(/const APP_VERSION = '([^']+)'/)[1];
 const css=fs.readFileSync(path.join(out,'ui.css'),'utf8');
 const ui=fs.readFileSync(path.join(out,'ui.js'),'utf8');
 assert(!/<\/style/i.test(css)&&!/<\/script/i.test(ui),'Inline assets must not close their HTML element');
 text=replaceOnce(text,`<link rel="stylesheet" href="ui.css?v=${version}">`,`<style id="hierro-ui-styles">\n${css}\n</style>`);
 text=replaceOnce(text,`<script src="ui.js?v=${version}"></script>`,`<script id="hierro-ui">\n${ui}\n</script>`);
 for(const name of ['sync-core','sync-engine','qr','sync']){
  const js=fs.readFileSync(path.join(out,name+'.js'),'utf8');
  assert(!/<\/script/i.test(js),'Inline scripts must not close their HTML element');
  text=replaceOnce(text,`<script src="${name}.js?v=${version}"></script>`,`<script id="hierro-${name}">\n${js}\n</script>`);
 }
 return text;
});
transform('manifest.webmanifest',text=>{
 const m=JSON.parse(text);
 Object.assign(m,{id:'./',name:'Hierro Beta — registro de gimnasio',short_name:'Hierro Beta',description:'Versión beta de Hierro. Datos independientes de la app principal; funciona sin conexión.'});
 return JSON.stringify(m,null,2)+'\n';
});
assert.deepEqual(fs.readdirSync(out).sort(),assets.sort(),'Only application assets belong in the public site');
console.log('Hierro Beta preparada en dist/ · datos hierro.beta.v1 · caché hierroBeta-*');
