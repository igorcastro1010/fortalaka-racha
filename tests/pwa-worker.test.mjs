import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import assert from 'node:assert/strict';
const source=readFileSync('public/sw.js','utf8');
const handlers={},stores=new Map();let calls=[],offline=false,skips=0,claims=0;
const caches={async keys(){return [...stores.keys()]},async delete(k){return stores.delete(k)},async open(k){if(!stores.has(k))stores.set(k,new Map());const data=stores.get(k);return {async match(r){return data.get(typeof r==='string'?r:r.url)?.clone()},async put(r,res){data.set(typeof r==='string'?r:r.url,res.clone())}}}};
async function fetch(request,options){calls.push({request,options});if(offline)throw Error('network offline');const path=new URL(typeof request==='string'?request:request.url,'https://fortalaka.test').pathname;const type=path.endsWith('.png')?'image/png':path.endsWith('.jpeg')?'image/jpeg':path.endsWith('.js')?'application/javascript':'text/html';const response=new Response(path==='/offline.html'?'OFFLINE PUBLICO':path,{headers:{'Content-Type':type}});Object.defineProperty(response,'type',{value:'basic'});return response;}
runInNewContext(source,{self:{location:{origin:'https://fortalaka.test'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>{skips++},clients:{claim:async()=>{claims++}}},caches,fetch,URL,Request,Response});
async function lifecycle(name){let p;handlers[name]({waitUntil:v=>p=v});await p;}
await lifecycle('install');assert.equal(skips,0,'Atualização não pode ativar sozinha');assert(calls.every(c=>c.options.credentials==='omit'));
const current=[...stores.keys()][0];assert(stores.get(current).has('/offline.html'));
stores.set('fortalaka-pwa-antigo',new Map());stores.set('outro-app',new Map());await lifecycle('activate');assert(!stores.has('fortalaka-pwa-antigo'));assert(stores.has('outro-app'));assert.equal(claims,1);
async function request(path,patch={}){let p;handlers.fetch({request:{url:new URL(path,'https://fortalaka.test').href,method:'GET',mode:'cors',headers:new Headers(),...patch},respondWith:v=>p=v,waitUntil() {}});return p?await p:null;}
for(const path of ['/api/private','/?_rsc=1','/notificacoes','/login','/comparar','https://project.supabase.co/rest/v1/profiles'])assert.equal(await request(path),null,'Sem interceptação de dados '+path);
assert.equal(await request('/pwa/icon-192.png',{headers:new Headers({Authorization:'Bearer teste'})}),null);
assert.equal(await request('/pwa/icon-192.png?v=private'),null);
assert.equal(await request('/pwa/icon-192.png',{method:'POST'}),null);
calls=[];await request('/notificacoes',{mode:'navigate'});assert.equal(calls[0].options.cache,'no-store');assert(!stores.get(current).has('/notificacoes'));
offline=true;assert.equal(await (await request('/notificacoes',{mode:'navigate'})).text(),'OFFLINE PUBLICO');assert.equal((await request('/pwa/icon-192.png')).status,200);
handlers.message({data:{type:'QUALQUER'}});assert.equal(skips,0);handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(skips,1);
assert([...stores.get(current).keys()].every(p=>p==='/offline.html'||p==='/fortalaka-escudo.jpeg'||p.startsWith('/pwa/')));
console.log('OK: cache público enumerado, sem credenciais, sem HTML privado/API/RSC/Supabase, fallback offline e atualização explícita.');
