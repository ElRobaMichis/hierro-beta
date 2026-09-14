const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'../dist'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),sw=read('sw.js'),ui=read('ui.js'),manifest=JSON.parse(read('manifest.webmanifest'));
let checks=0;const ok=(v,message)=>{assert.ok(v,message);checks++;console.log('OK '+message);};
ok(html.includes("const LS_KEY = 'hierro.beta.v1';")&&!html.includes("const LS_KEY = 'hierro.v1';"),'el almacenamiento de la beta es independiente');
ok(/const CACHE = 'hierroBeta-/.test(sw)&&!sw.includes("startsWith('hierro-')"),'la beta no elimina las cachés de la app principal');
ok(!sw.match(/const CACHE = '([^']+)'/)[1].startsWith('hierro-'),'la limpieza de la app principal no elimina la caché beta');
ok(manifest.short_name==='Hierro Beta'&&manifest.id==='./'&&manifest.scope==='./'&&manifest.start_url==='./','identidad instalable y alcance propios del proyecto');
ok(html.includes('<title>Hierro Beta')&&ui.includes('Hierro Beta ${APP_VERSION}'),'navegador y ajustes identifican la beta');
ok(html.match(/<script id="hierro-ui">\n([\s\S]*?)\n<\/script>/)?.[1]===ui,'el documento incluye la interfaz exacta de la beta');
ok(html.match(/<style id="hierro-ui-styles">\n([\s\S]*?)\n<\/style>/)?.[1]===read('ui.css'),'el documento incluye todos los estilos compatibles');
ok(!/<script[^>]+src=|<link[^>]+rel="stylesheet"/i.test(html),'el arranque no depende de descargar JS o CSS por separado');
ok(html.indexOf('<script id="hierro-ui">')<html.indexOf('<script>'),'la interfaz se declara antes de arrancar el motor');
const url=new URL('https://elrobamichis.github.io/hierro-beta/');
const links=[...html.matchAll(/(?:src|href)="([^"<>]+)"/g)].map(m=>m[1]).filter(v=>!/[{}$]/.test(v)&&!v.startsWith('#')&&!/^(?:https?:|blob:|data:)/.test(v));
for(const link of links){const asset=new URL(link,url);ok(asset.pathname.startsWith('/hierro-beta/')&&fs.existsSync(path.join(root,decodeURIComponent(asset.pathname.slice('/hierro-beta/'.length)))),'recurso relativo disponible: '+link);}
ok(fs.readdirSync(root).length===14&&!fs.existsSync(path.join(root,'tests'))&&!fs.existsSync(path.join(root,'sync-worker'))&&!fs.existsSync(path.join(root,'mockups')),'la web publica solo los recursos de la app, sin backend ni credenciales');
for(const name of ['sync-core','sync-engine','qr','sync'])ok(html.match(new RegExp('<script id="hierro-'+name+'">\\n([\\s\\S]*?)\\n</script>'))?.[1]===read(name+'.js'),'incluye de forma atómica '+name);
console.log(`\nTODOS LOS TESTS BETA OK (${checks})`);
