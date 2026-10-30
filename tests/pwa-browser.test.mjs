// PWA real em Chromium, com sessão fictícia isolada. Nunca acessa Supabase.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import manifest from '../src/app/manifest.ts';
const deps=createRequire(resolve(process.argv[2],'package.json'));
const {build}=deps('esbuild');const {chromium}=deps('playwright');
const dir=mkdtempSync(join(tmpdir(),'fortalaka-pwa-'));
await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {PwaExperience} from './src/components/pwa/PwaExperience';createRoot(document.getElementById('pwa')).render(<PwaExperience/>);`,resolveDir:process.cwd(),loader:'tsx'},outfile:join(dir,'client.js'),bundle:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')]});
const css=readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>readFileSync(join('.next/static/chunks',n),'utf8')).join('\n');
let version=1,authenticated=true;const assetCredentials=[];
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/test/update'&&req.method==='POST'){version++;res.end('ok');return;}
 if(path==='/test/logout'&&req.method==='POST'){authenticated=false;res.end('ok');return;}
 if(path==='/sw.js'){res.setHeader('Content-Type','application/javascript');res.setHeader('Cache-Control','no-store');res.end(readFileSync('public/sw.js','utf8').replace(/fortalaka-pwa-v\d+/,'fortalaka-pwa-test-'+version));return;}
 if(path==='/manifest.webmanifest'){res.setHeader('Content-Type','application/manifest+json');res.end(JSON.stringify(manifest()));return;}
 const assets=['/offline.html','/fortalaka-escudo.jpeg',...readdirSync('public/pwa').map(n=>'/pwa/'+n)];
 if(assets.includes(path)){assetCredentials.push(req.headers.cookie||'');res.setHeader('Content-Type',path.endsWith('.png')?'image/png':path.endsWith('.jpeg')?'image/jpeg':path.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');res.end(readFileSync('public'+path));return;}
 if(path==='/client.js'){res.setHeader('Content-Type','application/javascript');res.end(readFileSync(join(dir,'client.js')));return;}
 if(path==='/client.css'){res.setHeader('Content-Type','text/css');res.end(css);return;}
 if(path==='/favicon.ico'){res.setHeader('Content-Type','image/x-icon');res.end(readFileSync('src/app/favicon.ico'));return;}
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/client.css"><title>PWA local fictícia</title></head><body><div id="pwa"></div><main style="padding:24px"><h1>${path==='/private'&&authenticated?'DADO PRIVADO FICTÍCIO':'Login fictício'}</h1><a href="/private">Home fictícia</a></main><script defer src="/client.js"></script></body></html>`);
});
await new Promise(done=>server.listen(process.argv.includes('--serve')?3022:0,'127.0.0.1',done));
const url=`http://127.0.0.1:${server.address().port}`;
if(process.argv.includes('--serve'))console.log('PWA isolada: '+url);
else {
 let browser;
 try {
  browser=await chromium.launch({headless:true,channel:'chrome'});const context=await browser.newContext();
  const page=await context.newPage();async function waitBrowser(predicate){for(let n=0;n<150;n++){if(await page.evaluate(predicate)===true)return;await new Promise(done=>setTimeout(done,100));}throw new Error('Estado assíncrono do navegador não alcançado');}const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/private');await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');
  const appManifest=await cdp.send('Page.getAppManifest');assert.equal(appManifest.errors.length,0);assert.equal(JSON.parse(appManifest.data).display,'standalone');
  assert.equal(await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.scope}),url+'/');
  assert.equal(await page.getByRole('button',{name:'Atualizar e recarregar'}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Instalar Fortalaka'}).count(),0);
  await page.evaluate(()=>{
    const event=new Event('beforeinstallprompt',{cancelable:true});
    event.prompt=async()=>{window.promptCalls=(window.promptCalls||0)+1};
    event.userChoice=Promise.resolve({outcome:'dismissed'});
    window.dispatchEvent(event);
  });
  await page.getByRole('button',{name:'Instalar Fortalaka',exact:true}).click();
  await page.getByRole('button',{name:'Instalar Fortalaka',exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.promptCalls),1);
  await page.reload();assert.equal(await page.getByRole('button',{name:'Instalar Fortalaka',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('fortalaka:pwa:install-dismissed:v1')),'1');
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
  await page.getByText('Algumas informações podem estar indisponíveis ou desatualizadas.').waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.getByText('Conexão restaurada.',{exact:true}).waitFor();
  const other=await context.newPage();await other.goto(url+'/private');
  await other.evaluate(()=>{const input=document.createElement('input');input.setAttribute('aria-label','Rascunho local');input.value='alterações ainda não salvas';document.body.append(input);});
  await page.evaluate(()=>document.cookie='fixture=test; path=/');
  await page.request.post(url+'/test/update');await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update()});
  await page.getByRole('button',{name:'Atualizar e recarregar'}).waitFor();assert(await page.getByText('DADO PRIVADO FICTÍCIO',{exact:true}).isVisible());
  await page.evaluate(()=>{window.originalGetRegistration=navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker);navigator.serviceWorker.getRegistration=async()=>{throw new Error('Falha local de atualização')};});
  await page.getByRole('button',{name:'Atualizar e recarregar'}).click();
  await page.getByText('Não foi possível atualizar agora. Tente novamente.').waitFor();
  assert.equal(await page.getByRole('button',{name:'Atualizar e recarregar'}).isEnabled(),true);
  await page.evaluate(()=>{navigator.serviceWorker.getRegistration=window.originalGetRegistration;});
  await waitBrowser(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.waiting?.state==='installed';});
  await page.evaluate(async()=>{window.previousWaiting=(await navigator.serviceWorker.getRegistration()).waiting;});
  await page.request.post(url+'/test/update');
  await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
  await waitBrowser(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.waiting!==window.previousWaiting&&r.waiting?.state==='installed';});
  await waitBrowser(async()=> (await caches.keys()).includes('fortalaka-pwa-test-3'));const changed=page.waitForEvent('load');await page.getByRole('button',{name:'Atualizar e recarregar'}).click();await changed;
  await waitBrowser(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.active?.state==='activated'&&!r.waiting});
  const cached=await page.evaluate(async()=>{const keys=await caches.keys();return Promise.all(keys.map(async key=>({key,urls:(await (await caches.open(key)).keys()).map(r=>new URL(r.url).pathname)})))});
  assert.equal(cached.length,1);assert(cached[0].key.endsWith('3'));assert(!cached[0].urls.includes('/private'));assert(!cached[0].urls.includes('/login'));
  assert.equal(await other.getByRole('textbox',{name:'Rascunho local'}).inputValue(),'alterações ainda não salvas');
  await other.getByRole('button',{name:'Atualizar e recarregar'}).waitFor();
  const otherReload=other.waitForEvent('load');await other.getByRole('button',{name:'Atualizar e recarregar'}).click();await otherReload;
  assert.equal(await other.getByRole('textbox',{name:'Rascunho local'}).count(),0);await other.close();
  await context.setOffline(true);await page.goto(url+'/private');await page.getByRole('heading',{name:'Você está sem conexão.'}).waitFor();assert.equal(await page.getByText('DADO PRIVADO FICTÍCIO',{exact:true}).count(),0);
  for(const [width,height] of [[360,800],[375,812],[390,844],[430,932],[1280,900]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await context.setOffline(false);await page.getByText(/Conexão restaurada/).waitFor();await page.getByRole('button',{name:'TENTAR NOVAMENTE'}).click();await page.getByText('DADO PRIVADO FICTÍCIO',{exact:true}).waitFor();
  await page.request.post(url+'/test/logout');await page.reload();await page.getByText('Login fictício',{exact:true}).waitFor();
  await context.setOffline(true);await page.goto(url+'/private');assert.equal(await page.getByText('DADO PRIVADO FICTÍCIO',{exact:true}).count(),0);await page.getByRole('heading',{name:'Você está sem conexão.'}).waitFor();
  await context.setOffline(false);
  const ios=await browser.newContext({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
  const iphone=await ios.newPage();await iphone.goto(url);
  await iphone.getByRole('button',{name:'Instalar Fortalaka',exact:true}).click();
  await iphone.getByText('No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.').waitFor();
  await iphone.getByRole('button',{name:'Agora não'}).click();await iphone.reload();
  assert.equal(await iphone.getByRole('button',{name:'Instalar Fortalaka',exact:true}).count(),0);
  await ios.close();
  const standalone=await browser.newContext();
  await standalone.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
  const app=await standalone.newPage();await app.goto(url);
  await app.evaluate(()=>window.dispatchEvent(new Event('beforeinstallprompt',{cancelable:true})));
  assert.equal(await app.getByRole('button',{name:'Instalar Fortalaka',exact:true}).count(),0);await standalone.close();
  assert.deepEqual(errors,[]);console.log('OK: manifest CDP, SW/scope, instalação/recusa, orientação iOS, standalone, atualização explícita, limpeza de cache, offline/restauração, logout sem HTML privado, cinco viewports.');
 }finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
}
