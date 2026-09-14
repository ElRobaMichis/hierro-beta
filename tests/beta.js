const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'../dist'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),sw=read('sw.js'),ui=read('ui.js'),manifest=JSON.parse(read('manifest.webmanifest'));
let checks=0;const ok=(v,message)=>{assert.ok(v,message);checks++;console.log('OK '+message);};
ok(html.includes("const LS_KEY = 'hierro.beta.v1';")&&!html.includes("const LS_KEY = 'hierro.v1';"),'el almacenamiento de la beta es independiente');
ok(/const CACHE = 'hierroBeta-/.test(sw)&&!sw.includes("startsWith('hierro-')"),'la beta no elimina las cachés de la app principal');
ok(!'hierroBeta-3.2.2'.startsWith('hierro-'),'la limpieza de la app principal no elimina la caché beta');
ok(manifest.short_name==='Hierro Beta'&&manifest.id==='./'&&manifest.scope==='./'&&manifest.start_url==='./','identidad instalable y alcance propios del proyecto');
ok(html.includes('<title>Hierro Beta')&&ui.includes('Hierro Beta ${APP_VERSION}'),'navegador y ajustes identifican la beta');
const url=new URL('https://elrobamichis.github.io/hierro-beta/');
const links=[...html.matchAll(/(?:src|href)="([^"<>]+)"/g)].map(m=>m[1]).filter(v=>!/[{}$]/.test(v)&&!v.startsWith('#')&&!/^(?:https?:|blob:|data:)/.test(v));
for(const link of links){const asset=new URL(link,url);ok(asset.pathname.startsWith('/hierro-beta/')&&fs.existsSync(path.join(root,decodeURIComponent(asset.pathname.slice('/hierro-beta/'.length)))),'recurso relativo disponible: '+link);}
ok(fs.readdirSync(root).length===10&&!fs.existsSync(path.join(root,'tests'))&&!fs.existsSync(path.join(root,'mockups')),'la web publica solo los diez recursos de la app');
console.log(`\nTODOS LOS TESTS BETA OK (${checks})`);
