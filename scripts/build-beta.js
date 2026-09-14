/* Build the independently installable Pages beta from the tested app source. */
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
const assets=['index.html','ui.js','ui.css','sw.js','manifest.webmanifest','icon.svg','icon-180.png','icon-192.png','icon-512.png','.nojekyll'];
fs.mkdirSync(out,{recursive:true});
for(const file of assets)fs.copyFileSync(path.join(root,file),path.join(out,file));
function transform(file,fn){const target=path.join(out,file);fs.writeFileSync(target,fn(fs.readFileSync(target,'utf8')));}
function replaceOnce(text,from,to){assert.equal(text.split(from).length,2,`Expected exactly one: ${from}`);return text.replace(from,to);}
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
transform('manifest.webmanifest',text=>{
 const m=JSON.parse(text);
 Object.assign(m,{id:'./',name:'Hierro Beta — registro de gimnasio',short_name:'Hierro Beta',description:'Versión beta de Hierro. Datos independientes de la app principal; funciona sin conexión.'});
 return JSON.stringify(m,null,2)+'\n';
});
assert.deepEqual(fs.readdirSync(out).sort(),assets.sort(),'Only application assets belong in the public site');
console.log('Hierro Beta preparada en dist/ · datos hierro.beta.v1 · caché hierroBeta-*');
