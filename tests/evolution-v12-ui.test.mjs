import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync,readFileSync,writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { readBuiltCss } from './built-css.mjs';
const deps=createRequire(resolve(process.argv[2],'package.json'));
const {build}=deps('esbuild'),{chromium}=deps('playwright');
const output=mkdtempSync(join(tmpdir(),'fortalaka-v12-'));
const summary={stats:{jogos:15,gols:10,assistencias:2,vitorias:9,empates:3,derrotas:3,rodadas:5,sequencia:3,artilharias:1,destaques:1,garcons:0},overall:{media:80,melhor:90,ultimas:[{racha_id:'r2',data:'2026-01-08',overall:90},{racha_id:'r1',data:'2026-01-01',overall:70}],rodadas:2},marcos:{'gols-1':{earned:true,data:'2026-01-01'},'gols-10':{earned:true,data:'2026-01-08'},'presencas-5':{earned:true,data:null},'sequencia-3':{earned:true,data:'2026-01-08'}}};
for(const id of ['vitoria-1','artilheiro','destaque','jogos-10','assistencias-1']) summary.marcos[id]={earned:true,data:'2026-01-08'};
const match={id:'m1',racha_id:'r1',nome:'Rodada do Fortalaka',data:'2026-01-01',time_a:'TimeAlfaNomeMuitoLongoSemEspacos',time_b:'Time Beta',placar_a:2,placar_b:1,resultado:'V',gols:1,assistencias:0};
writeFileSync(join(output,'client.ts'),`
window.calls=[];window.summary=${JSON.stringify(summary)};
export function createClient(){return {rpc:async(name,args)=>{window.calls.push(args);await new Promise(r=>setTimeout(r,40));
 if(location.pathname==='/error')return {error:{message:'private sql error'}};
 const empty=location.pathname==='/empty';
 const section=args.p_secao,page=args.p_pagina;
 if(section==='resumo')return {data:empty?{stats:Object.fromEntries(Object.keys(window.summary.stats).map(k=>[k,0])),overall:{media:null,melhor:null,ultimas:[],rodadas:0},marcos:{}}:window.summary};
 if(section==='notas')return {data:{items:empty?[]:window.summary.overall.ultimas.map(p=>({...p,nome:'Rodada do Fortalaka'})),hasMore:false}};
 if(section==='partidas')return {data:{items:empty?[]:Array.from({length:page===0?12:3},(_,i)=>({...${JSON.stringify(match)},id:'m'+(page*12+i)})),hasMore:!empty&&page===0}};
 return {data:{items:empty?[]:[{racha_id:'r1',nome:'Rodada do Fortalaka',data:'2026-01-01',jogos:3,gols:2,vitorias:1,empates:1,derrotas:1}],hasMore:false}};
 }}};
`);
writeFileSync(join(output,'refresh.ts'),`export function subscribeLiveRefresh(read){window.addEventListener('fixture-refresh',read);return ()=>window.removeEventListener('fixture-refresh',read)}export function invalidateLive(){}`);
writeFileSync(join(output,'entry.tsx'),`
import {createRoot} from 'react-dom/client';
import {PlayerJourney} from ${JSON.stringify(resolve('src/components/players/PlayerJourney.tsx'))};
import {setMemorySession,invalidateMemory} from ${JSON.stringify(resolve('src/lib/live/cache.ts'))};
setMemorySession('fixture');
window.correct=()=>{window.summary={...window.summary,stats:{...window.summary.stats,gols:0},marcos:{}};invalidateMemory(['matches']);window.dispatchEvent(new Event('fixture-refresh'))};
createRoot(document.getElementById('root')).render(<><h1>Ficha do atleta</h1><PlayerJourney playerId="fixture"/></>);
`);
await build({entryPoints:[join(output,'entry.tsx')],outfile:join(output,'app.js'),bundle:true,jsx:'automatic',define:{'process.env':'{}'},tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:join(output,'client.ts')}));
 b.onResolve({filter:/^@\/lib\/live\/refresh$/},()=>({path:join(output,'refresh.ts')}));
}}]});
const css=readBuiltCss();
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;res.setHeader('Content-Type',path==='/app.js'?'text/javascript':path==='/app.css'?'text/css':'text/html; charset=utf-8');res.end(path==='/app.js'?readFileSync(join(output,'app.js')):path==='/app.css'?css:'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><main id="root" style="max-width:640px;margin:auto;padding:20px"></main><script src="/app.js"></script></html>')});
const serve=process.argv.includes('--serve');
await new Promise(r=>server.listen(serve?3037:0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
if(serve) console.log(`Preview V1.2: ${url} (dados ficticios, sem Supabase remoto)`);
else {
let browser;
try {
 browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);assert.equal(await page.evaluate(()=>window.calls?.length ?? 0),0,'Nenhuma leitura antes de abrir');
 const open=()=>page.getByRole('button',{name:'Evolução, histórico e conquistas'}).click();
 await open();await page.getByText('+20 pontos na última rodada').waitFor();await page.getByRole('img',{name:/Evolução do overall/}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>c.p_secao).sort()),['notas','resumo']);
 await open();await open();await page.getByText('+20 pontos na última rodada').waitFor();assert.equal(await page.evaluate(()=>window.calls.length),2,'Cache ao reabrir');
 await page.getByRole('tab',{name:'Histórico',exact:true}).click();await page.getByRole('article').first().waitFor();assert.equal(await page.getByRole('article').count(),12);
 await page.getByRole('button',{name:'Próxima página'}).click();await page.waitForFunction(()=>document.querySelectorAll('article').length===3);
 await page.getByRole('tab',{name:'Rodadas',exact:true}).click();await page.getByText('Vitórias: 1 · Empates: 1 · Derrotas: 1').waitFor();
 for(const width of [360,375,390,430,1280]) {
  await page.setViewportSize({width,height:900});
  for(const tab of ['Evolução','Histórico','Conquistas']) {
   await page.getByRole('tab',{name:tab,exact:true}).click();await page.waitForTimeout(100);
   const overflow=await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).position!=='absolute'&&e.getBoundingClientRect().right>innerWidth+1).map(e=>e.tagName));
   assert.deepEqual(overflow,[],`${tab} ${width}px`);
   await page.screenshot({path:join(output,`${tab}-${width}.png`),fullPage:true});
  }
 }
 assert.equal(await page.getByRole('listitem').count(),21);
 await page.evaluate(()=>window.correct());await page.waitForFunction(()=>document.querySelector('progress').value===0);
 assert.equal(await page.getByText(/Desbloqueada/).count(),0,'Correcao invalida conquistas');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('tab',{name:'Evolução',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Histórico',exact:true}).getAttribute('aria-selected'),'true');
 await page.goto(url+'/empty');await open();await page.getByText('Evolução ainda indisponível').waitFor();assert.equal(await page.getByRole('img').count(),0);
 await page.getByRole('tab',{name:'Histórico',exact:true}).click();await page.getByText('Sem partidas registradas').waitFor();
 await page.goto(url+'/error');await open();await page.getByRole('alert').waitFor();assert.ok(!(await page.locator('body').innerText()).includes('private sql'));
 assert.deepEqual(errors,[]);console.log('PASS V1.2 UI: lazy/cache, correcao, paginacao, vazio/erro, teclado, 360/375/390/430/1280px. Screenshots: '+output);
} finally {await browser?.close();await new Promise(r=>server.close(r));}
}
