// node tests/inscricao-ui.test.mjs <node_modules com esbuild e playwright>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dependencies=createRequire(resolve(process.argv[2],'package.json'));
const {build}=dependencies('esbuild');const {chromium}=dependencies('playwright');
const output=mkdtempSync(join(tmpdir(),'fortalaka-inscricao-'));
const entry=join(output,'entry.tsx'),bundle=join(output,'app.js');
writeFileSync(entry,`
import {useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {OwnRegistration} from ${JSON.stringify(resolve('src/components/rounds/OwnRegistration.tsx'))};
const actor=new URLSearchParams(location.search).get('actor')||'player';
function App(){const [round,setRound]=useState(null);async function refresh(){setRound(await fetch('/state').then(response=>response.json()));}
useEffect(()=>{void refresh();},[]);return round&&<><p role="status" aria-label="Contador">{round.participants.filter(player=>player.status==='confirmado').length} participantes</p><ul>{round.participants.filter(player=>player.status==='confirmado').map(player=><li key={player.id}>{player.name}</li>)}</ul><OwnRegistration round={round} profile={{id:actor,name:actor==='player'?'Jogador teste':'Outro jogador',active:true,role:'jogador',email:null}} onUpdated={refresh}/></>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
await build({entryPoints:[entry],outfile:bundle,bundle:true,platform:'browser',jsx:'automatic',define:{'process.env':'{}'},tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],plugins:[{name:'isolated-client',setup(builder){
  builder.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:'client',namespace:'test'}));
  builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"export function createClient(){return {rpc:(name,args)=>fetch('/registration'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})}).then(response=>response.json())};}"}));
}}]});
const chunks=resolve('.next/static/chunks');const css=readdirSync(chunks).filter(name=>name.endsWith('.css')).map(name=>readFileSync(join(chunks,name),'utf8')).join('\n');
const participants=new Map();let requests=0;
const technical='there is no unique or exclusion constraint matching the ON CONFLICT specification';
const server=createServer(async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/state'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({roundId:'round',status:'aberto',participants:[...participants.values()]}));return;}
  if(url.pathname==='/registration'){
    requests++;const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const {name,args}=JSON.parse(Buffer.concat(chunks).toString());assert.equal(name,'inscricao_rodada');assert.equal(args.p_tipo,'linha');
    await new Promise(done=>setTimeout(done,200));response.setHeader('Content-Type','application/json');
    if(url.searchParams.has('fail')){response.statusCode=400;response.end(JSON.stringify({error:{code:'42P10',message:technical}}));return;}
    const actor=url.searchParams.get('actor')||'player';
    participants.set(actor,{id:actor,jogadorId:actor,name:actor==='player'?'Jogador teste':'Outro jogador',status:args.p_entrar?'confirmado':'removido',type:'linha'});
    response.end(JSON.stringify({error:null}));return;
  }
  response.setHeader('Content-Type',url.pathname==='/app.js'?'text/javascript':url.pathname==='/app.css'?'text/css':'text/html; charset=utf-8');
  response.end(url.pathname==='/app.js'?readFileSync(bundle):url.pathname==='/app.css'?css:'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body style="margin:16px"><div id="root"></div><script src="/app.js"></script></body></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try {
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
  const consoleErrors=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('dialog',dialog=>dialog.accept());const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/?fail=1');await page.getByRole('button',{name:'ENTRAR NA LISTA',exact:true}).click();
  await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('alert').textContent(),'Não foi possível entrar na lista. Tente novamente.');
  assert(!(await page.locator('body').textContent()).includes(technical));assert.equal(participants.size,0);
  assert(consoleErrors.some(message=>message.includes(technical)),'Erro tecnico permanece no console');
  await page.goto(base);await page.getByRole('button',{name:'ENTRAR NA LISTA',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Contador').textContent(),'0 participantes');const before=requests;
  await page.getByRole('button',{name:'ENTRAR NA LISTA',exact:true}).evaluate(button=>{button.click();button.click();});
  const pending=page.getByRole('button',{name:'ENTRANDO...',exact:true});await pending.waitFor();assert(await pending.isDisabled());
  await page.getByRole('button',{name:'SAIR DA LISTA',exact:true}).waitFor();
  assert.equal(requests,before+1);assert.equal(await page.getByLabel('Contador').textContent(),'1 participantes');
  assert.equal(await page.locator('li').allTextContents().then(rows=>rows.join(',')),'Jogador teste');
  assert((await page.locator('body').textContent()).includes('Você entrou na lista ✓'));assert.equal(await page.getByRole('dialog').count(),0);
  await page.reload();await page.getByRole('button',{name:'SAIR DA LISTA',exact:true}).waitFor();assert.equal(participants.size,1);
  await page.getByRole('button',{name:'SAIR DA LISTA',exact:true}).click();await page.getByRole('button',{name:'ENTRAR NA LISTA',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Contador').textContent(),'0 participantes');
  await page.getByRole('button',{name:'ENTRAR NA LISTA',exact:true}).click();await page.getByRole('button',{name:'SAIR DA LISTA',exact:true}).waitFor();assert.equal(participants.size,1);
  await page.goto(base+'/?actor=other');await page.getByRole('button',{name:'ENTRAR NA LISTA',exact:true}).click();await page.getByRole('button',{name:'SAIR DA LISTA',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Contador').textContent(),'2 participantes');
  await page.screenshot({path:join(output,'inscricao.png'),fullPage:true});
  console.log(`PASS UI/repository reais: erro tecnico apenas no console; 0->1; nome; clique duplo; refresh; saida/reentrada; outro jogador. Captura: ${output}`);
} finally {await browser?.close();await new Promise(done=>server.close(done));}
