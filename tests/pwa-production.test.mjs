// Recursos PWA reais no Next de produção, sem login nem acesso ao banco.
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:3021';
const manifestResponse=await fetch(base+'/manifest.webmanifest',{redirect:'manual'});
assert.equal(manifestResponse.status,200);
assert.match(manifestResponse.headers.get('content-type'),/application\/manifest\+json/);
const manifest=await manifestResponse.json();
assert.equal(manifest.name,'Racha Fortalaka');assert.equal(manifest.short_name,'FORTALAKA');
assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){const r=await fetch(base+icon.src,{redirect:'manual'});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);}
for(const path of ['/sw.js','/offline.html','/pwa/offline.js','/pwa/apple-touch-icon.png','/favicon.ico']){
 const r=await fetch(base+path,{redirect:'manual'});assert.equal(r.status,200,path);
 if(path==='/sw.js'){
  assert.match(r.headers.get('content-type'),/javascript/);
  assert.match(r.headers.get('cache-control'),/no-store/);
  assert.equal(r.headers.get('service-worker-allowed'),'/');
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 }
}
const login=await fetch(base+'/login');assert.equal(login.status,200);const html=await login.text();
assert.equal((html.match(/<link[^>]+rel="manifest"/g)||[]).length,1);
assert.equal((html.match(/<meta[^>]+name="viewport"/g)||[]).length,1);
assert.equal((html.match(/<meta[^>]+name="theme-color"/g)||[]).length,1);
assert.match(html,/viewport-fit=cover/);assert.match(html,/apple-touch-icon/);
// Next 16.3 emite o nome padronizado a partir de appleWebApp.capable.
assert.match(html,/<meta name="mobile-web-app-capable" content="yes"/);
assert.match(html,/apple-mobile-web-app-title/);assert.match(html,/apple-mobile-web-app-status-bar-style/);
for(const path of ['/','/comparar','/notificacoes']){
 const r=await fetch(base+path,{redirect:'manual'});assert([307,308].includes(r.status),path);
 assert.equal(new URL(r.headers.get('location'),base).pathname,'/login');
}
console.log('OK: Next real, manifest/assets públicos, headers do SW, metadata única, safe area e redirects de autenticação preservados.');
