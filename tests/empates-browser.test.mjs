import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {readFileSync,readdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
const deps=createRequire(resolve(process.argv[2],'package.json'));
const {build}=deps('esbuild'),{chromium}=deps('playwright');
const out=mkdtempSync(join(tmpdir(),'fortalaka-empates-'));
const bundle=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import {MatchesPanel} from './src/components/rounds/MatchesPanel';import {EvaluationAdminPanel} from './src/components/ratings/EvaluationAdminPanel';const q=new URLSearchParams(location.search);createRoot(document.getElementById('root')).render(q.has('ratings')?<EvaluationAdminPanel roundId="r" organizer={!q.has('player')} roundStatus="finalizado" onOpenEvaluate={()=>{}} personalState={null}/>:<MatchesPanel roundId="r" organizer={true} roundStatus={q.has('closed')?'finalizado':'em_andamento'} showRoundHistory={false}/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,jsx:'automatic',tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:'client',namespace:'fixture'}));
 b.onResolve({filter:/\/PostRoundSummary$/},()=>({path:'summary',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='client'?'export const createClient=()=>({rpc:window.rpc});':'export const PostRoundSummary=()=>null;',loader:'js'}));
}}]});
const css=readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>readFileSync(join('.next/static/chunks',n),'utf8')).join('\n');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text);}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main class="mx-auto max-w-[640px] p-4"><div id="root"></div></main><script src="/app.js"></script></body></html>`);}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser,diagnosticPage;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext();
 await context.addInitScript(()=>{
  window.process={env:{NODE_ENV:'production'}};
  const q=new URLSearchParams(location.search),count=Number(q.get('waiting')??1),closed=q.has('closed');
  window.calls=[];
  const match={id:'m',versao:0,timeAId:'a',timeBId:'b',timeA:'Time Vermelho',timeB:'Time Branco',placarA:1,placarB:1,status:closed?'finalizada':'aberta',createdAt:null,finalizadaAt:null,jogadores:[{jogador_id:'p',nome:'Jogador com nome comprido da rodada',avatar_url:null,time_id:'a',participou:true,gols:0,assistencias:0}]};
  const state={roundStatus:closed?'finalizado':'em_andamento',times:[{id:'a',nome:'Time Vermelho'},{id:'b',nome:'Time Branco'},{id:'c',nome:'Time Preto'},{id:'d',nome:'Time Azul'}],partidas:[match],fila:{order:['a','b',...['c','d'].slice(0,count)],version:0,currentMatchId:closed?null:'m'}};
  window.peerEdit=()=>{match.versao++;};
  window.rpc=async(name,args)=>{window.calls.push({name,args});
   if(name==='ler_partidas_rodada'){if(window.failRead){window.failRead=false;return {error:{message:'technical read failure'}};}return {data:structuredClone(state)};}
   if(name==='salvar_partida_com_desempate'){
    await new Promise(done=>setTimeout(done,80));
    if(window.failWrite)return {error:{message:'technical SQL error'}};
    if(args.p_versao!==match.versao)return {error:{message:'stale version'}};
    Object.assign(match,{status:args.p_status,placarA:args.p_placar_a,placarB:args.p_placar_b,versao:match.versao+1,jogadores:match.jogadores.map(p=>({...p,...args.p_jogadores.find(j=>j.jogador_id===p.jogador_id)}))});state.fila.currentMatchId=match.status==='aberta'?'m':null;return {data:{aviso:null}};
   }
   if(name==='ler_progresso_avaliacoes')return {data:{total:3,respondentes:1,abertas:true}};
   if(name==='ler_pendencias_avaliacoes')return {data:[{id:'p',nome:'Jogador com nome comprido da rodada',avatar_url:null,respondidas:0,total:3},{id:'q',nome:'Parcial',avatar_url:null,respondidas:1,total:3}]};
   return {data:null};
  };
 });
 const page=await context.newPage(),errors=[];diagnosticPage=page;page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.setDefaultTimeout(10000);
 const cdp=await context.newCDPSession(page);await cdp.send('Runtime.enable');cdp.on('Runtime.consoleAPICalled',e=>{if(e.type==='error')errors.push(JSON.stringify(e.args));});
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const width of [360,375,390,430]){
  await page.setViewportSize({width,height:844});
  await page.goto(`${base}/?waiting=0`);await page.getByRole('button',{name:'LANÇAR PLACAR E EVENTOS'}).click();
  await page.getByRole('button',{name:'Adicionar gols de Jogador com nome comprido da rodada',exact:true}).click();
  await page.getByText('Gol de Jogador com nome comprido da rodada registrado.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='salvar_partida_com_desempate').at(-1).args.p_placar_a),1);
  await page.screenshot({path:join(out,`sumula-${width}.png`)});
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();await page.getByText('Último lançamento desfeito.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='salvar_partida_com_desempate').at(-1).args.p_jogadores[0].gols),0);
  await page.getByRole('button',{name:'Adicionar assistencias de Jogador com nome comprido da rodada',exact:true}).click();await page.getByText('Assistência de Jogador com nome comprido da rodada registrada.',{exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'Corrigir lançamentos'}).check();await page.getByRole('button',{name:'Diminuir assistencias de Jogador com nome comprido da rodada'}).click();await page.getByText('Assistência de Jogador com nome comprido da rodada corrigida.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Voltar às partidas'}).click();await page.getByRole('button',{name:'LANÇAR PLACAR E EVENTOS'}).click();
  assert.equal(await page.getByRole('button',{name:'Desfazer',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const waiting of [0,1,2]){
   await page.goto(`${base}/?waiting=${waiting}`);await page.getByRole('button',{name:'LANÇAR PLACAR E EVENTOS'}).click();
   if(waiting===1){await page.getByRole('button',{name:'Finalizar partida',exact:true}).click();await page.getByText('Disputem os pênaltis alternados', {exact:false}).first().waitFor();assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='salvar_partida_com_desempate').length),0);await page.getByRole('radio',{name:'Time Branco',exact:true}).check();}
   await page.getByRole('button',{name:'Finalizar partida',exact:true}).click();await page.getByRole('dialog').waitFor();
   assert.match(await page.getByRole('dialog').innerText(),waiting===2?/saem os dois/:waiting===1?/vencedor dos pênaltis/:/dois permanecem/);
   await page.screenshot({path:join(out,`empate-${waiting}-${width}.png`)});
   await page.getByRole('button',{name:'Confirmar',exact:true}).click();await page.getByText('Partida finalizada.',{exact:false}).waitFor();
   const call=await page.evaluate(()=>calls.find(c=>c.name==='salvar_partida_com_desempate'));assert.equal(call.args.p_vencedor_penaltis,waiting===1?'b':null);assert.equal(call.args.p_placar_a,1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.goto(`${base}/?closed`);await page.getByRole('button',{name:'Editar resultados da rodada'}).click();await page.getByRole('button',{name:'Editar resultado',exact:true}).click();await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Cancelar partida',exact:true}).count(),0);
  await page.getByText('Participação ·',{exact:false}).click();assert.equal(await page.getByRole('checkbox').isDisabled(),true);
  await page.getByRole('button',{name:'Aumentar placar de Time Vermelho'}).click();await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByText('Partida finalizada.',{exact:false}).waitFor();
  await page.goto(`${base}/?ratings`);await page.getByText('Avaliações pendentes · 2').click();await page.getByText('Não iniciou',{exact:true}).waitFor();await page.getByText('1/3 concluídas',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(out,`pendencias-${width}.png`)});
 }
 await page.goto(`${base}/?waiting=0`);await page.getByRole('button',{name:'LANÇAR PLACAR E EVENTOS'}).click();
 const add=page.getByRole('button',{name:'Adicionar gols de Jogador com nome comprido da rodada',exact:true});
 await add.evaluate(button=>{button.click();button.click();});await page.getByText('Gol de Jogador com nome comprido da rodada registrado.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='salvar_partida_com_desempate').length),1);
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>{window.failRead=true;});await add.click();await page.getByRole('button',{name:'Atualizar partida',exact:true}).waitFor();
 assert.equal(await add.isDisabled(),true);assert.equal(await page.getByText('technical read failure',{exact:false}).count(),0);
 const writes=await page.evaluate(()=>calls.filter(c=>c.name==='salvar_partida_com_desempate').length);
 await page.getByRole('button',{name:'Atualizar partida',exact:true}).click();await page.getByText('Partida atualizada.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>calls.filter(c=>c.name==='salvar_partida_com_desempate').length),writes);
 assert.equal(await page.getByRole('button',{name:'Desfazer',exact:true}).count(),0);
 await page.evaluate(()=>window.peerEdit());await add.click();await page.getByRole('button',{name:'Atualizar partida',exact:true}).waitFor();assert.equal(await add.isDisabled(),true);
 assert.equal(errors.length,2);errors.length=0;
 await page.goto(`${base}/?ratings&player`);await page.waitForTimeout(200);assert.equal(await page.getByText('Avaliações pendentes',{exact:false}).count(),0);assert.equal(await page.evaluate(()=>calls.some(c=>c.name==='ler_pendencias_avaliacoes')),false);
 assert.deepEqual(errors,[]);console.log('PASS: empates, correcoes, pendencias privadas, 360/375/390/430px e console CDP. '+out);
}catch(e){console.error(await diagnosticPage?.locator('body').innerText());throw e;}finally{await browser?.close();server.close();}
