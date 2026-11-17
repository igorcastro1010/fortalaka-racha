import { readBuiltCss } from './built-css.mjs';
// Browser isolado: componentes e repository reais, sem acesso a dados remotos.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import { mkdtempSync } from 'node:fs';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
const deps=createRequire(resolve(process.argv[2],'package.json'));
const {build}=deps('esbuild'),{chromium}=deps('playwright');
const out=mkdtempSync(join(tmpdir(),'fortalaka-notifications-'));
const bundle=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {NotificationCenter} from './src/components/notifications/NotificationCenter';createRoot(document.getElementById('root')).render(<NotificationCenter/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,jsx:'automatic',tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:'client',namespace:'fixture'}));
 b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 b.onResolve({filter:/^\.\/PushSettings$/},()=>({path:'push',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='client'?'export const createClient=()=>window.client;':path==='link'?"export default 'a';":'export const PushSettings=()=>null;',loader:'tsx'}));
}}]});
const css = readBuiltCss();
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':'text/html; charset=utf-8');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="mx-auto max-w-[640px] p-4"><div id="root"></div></main><script src="/app.js"></script></body></html>`);});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try {
 browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const initial=Array.from({length:27},(_,i)=>({id:String(i),title:`Aviso ${i}`,body:'Informações da rodada',destination:'racha',round_id:null,created_at:'2026-11-12T20:00:00Z',read_at:i<25?'2026-11-12T21:00:00Z':null}));
  let rows=JSON.parse(sessionStorage.getItem('notices')||'null')||initial;
  window.writes=0;
  window.client={from(){let read=false;return {select(){return this;},is(){read=false;return this;},not(){read=true;return this;},order(){return this;},async range(start,end){return {data:rows.filter(r=>Boolean(r.read_at)===read).slice(start,end+1)};}};},async rpc(name,args){window.writes++;if(window.failWrite)return {error:{message:'SQL internal'}};if(name==='limpar_notificacoes_lidas')rows=rows.filter(r=>!r.read_at);else rows=rows.map(r=>!args.p_ids||args.p_ids.includes(r.id)?{...r,read_at:'2026-11-12T21:00:00Z'}:r);sessionStorage.setItem('notices',JSON.stringify(rows));return {error:null};}};
 });
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [360,375,390,430]){
  await page.setViewportSize({width,height:844});await page.goto(base);await page.evaluate(()=>sessionStorage.clear());await page.reload();
  await page.getByRole('heading',{name:'Aviso 25',exact:true}).waitFor();assert.equal(await page.locator('li').count(),2);
  await page.getByRole('button',{name:'Marcar como lida',exact:true}).first().click();await page.getByText('Notificação lida.',{exact:true}).waitFor();assert.equal(await page.locator('li').count(),1);
  await page.getByRole('button',{name:'Marcar todas como lidas',exact:true}).click();await page.getByRole('heading',{name:'Tudo em dia'}).waitFor();
  await page.getByRole('tab',{name:'Lidas',exact:true}).click();await page.getByRole('heading',{name:'Aviso 0',exact:true}).waitFor();assert.equal(await page.locator('li').count(),20);
  await page.getByRole('button',{name:'Carregar mais avisos'}).click();await page.getByRole('heading',{name:'Aviso 26',exact:true}).waitFor();assert.equal(await page.locator('li').count(),27);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(out,`lidas-${width}.png`)});
  const writes=await page.evaluate(()=>window.writes);
  await page.getByRole('button',{name:'Limpar lidas',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await page.evaluate(()=>window.writes),writes);
  await page.evaluate(()=>window.failWrite=true);await page.getByRole('button',{name:'Limpar lidas',exact:true}).click();await page.getByRole('button',{name:'Confirmar',exact:true}).click();await page.getByText('Não foi possível limpar as notificações. Tente novamente.',{exact:true}).waitFor();assert.equal(await page.locator('li').count(),27);
  await page.evaluate(()=>window.failWrite=false);await page.getByRole('button',{name:'Limpar lidas',exact:true}).click();await page.getByRole('button',{name:'Confirmar',exact:true}).click();await page.getByRole('heading',{name:'Nenhuma notificação lida'}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Tudo em dia'}).waitFor();await page.getByRole('tab',{name:'Lidas',exact:true}).click();await page.getByRole('heading',{name:'Nenhuma notificação lida'}).waitFor();
 }
 assert.deepEqual(errors,[]);console.log('PASS: filtros antes da paginação, individual/todas, limpeza/cancelamento/erro, refresh e 360/375/390/430px. '+out);
}finally{await browser?.close();await new Promise(done=>server.close(done));}
