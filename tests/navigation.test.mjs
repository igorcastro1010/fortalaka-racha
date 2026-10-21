// Fluxo completo da navegação com componentes reais e PostgreSQL local.
// node tests/navigation.test.mjs <diretório com node_modules de esbuild, jsdom e PGlite>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const dependencies = createRequire(resolve(process.argv[2], 'package.json'));
const { build } = dependencies('esbuild');
const { JSDOM } = dependencies('jsdom');
const fixture = spawn(process.execPath, ['tests/preview-sorteio.mjs', process.argv[2], process.argv[2], '--app'], { stdio: ['ignore', 'pipe', 'inherit'] });
const originalFetch = globalThis.fetch;
let root;
let window;
let testAct;
let playerId;

try {
  await new Promise((done, fail) => {
    fixture.stdout.on('data', chunk => { if (chunk.toString().includes('Validação isolada:')) done(); });
    fixture.once('exit', code => fail(new Error(`Preview encerrou: ${code}`)));
    fixture.once('error', fail);
  });
  const output = mkdtempSync(join(tmpdir(), 'fortalaka-navigation-'));
  const client = join(output, 'client.ts');
  writeFileSync(client, `
    async function request(body){const r=await fetch('http://127.0.0.1:3011/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,role:new URLSearchParams(location.search).get('role')||'organizador'})});return r.json();}
    export function createClient(){return {rpc:(name,args)=>request({kind:'rpc',name,args}),
      from(table){const body={kind:'table',table,op:'select',filters:[],single:false};const q={select(){return q},eq(k,v){body.filters.push([k,v]);return q},order(k,o){body.orders??=[];body.orders.push([k,o]);return q},limit(n){body.limit=n;return q},returns(){return q},maybeSingle(){body.single=true;return q},single(){body.single=true;return q},insert(value){body.op="insert";body.value=value;return q},update(value){body.op="update";body.value=value;return q},then(a,b){return request(body).then(a,b)}};return q},
      auth:{getUser:async()=>({data:{user:(await request({kind:'user'})).data}})}
    };}
  `);
  const router = join(output, 'router.ts');
  writeFileSync(router, 'export function useRouter(){return {replace(){},refresh(){}};}');
  const entry = join(output, 'entry.ts');
  writeFileSync(entry, `export {act,createElement} from 'react';export {createRoot} from 'react-dom/client';export {FortalakaApp} from ${JSON.stringify(resolve('src/components/app/FortalakaApp.tsx'))};`);
  const bundle = join(output, 'app.cjs');
  await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', jsx: 'automatic', tsconfig: resolve('tsconfig.json'), nodePaths: [resolve('node_modules')], plugins: [{name:'local-only',setup(b){b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:client}));b.onResolve({filter:/^next\/navigation$/},()=>({path:router}));}}] });
  window = new JSDOM('<div></div>',{url:'http://127.0.0.1:3011/'}).window;
  globalThis.window=window;globalThis.document=window.document;
  const { act, createElement, createRoot, FortalakaApp } = createRequire(import.meta.url)(bundle);
  testAct=act;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  async function flush() {
    await act(async () => { await new Promise(done => setTimeout(done, 20)); });
  }
  async function waitFor(check) {
    for (let i=0;i<100;i++) { await flush(); if(check()) return; }
    assert.fail(`Estado esperado não apareceu: ${document.body.textContent}`);
  }
  function button(name) {
    return [...document.querySelectorAll('button')].find(e => e.getAttribute('aria-label') === name || e.textContent.trim() === name);
  }
  async function click(name) {
    await waitFor(()=>button(name) && !button(name).disabled);
    await act(async()=>button(name).click());
  }
  async function mount(role) {
    if(root) await act(async()=>root.unmount());
    window?.close();
    window = new JSDOM('<div id="root"></div>', {url:`http://127.0.0.1:3011/?role=${role}`}).window;
    for(const key of ['window','document','location','HTMLElement','HTMLDialogElement'])globalThis[key]=key==='window'?window:window[key];
    window.confirm=()=>true;
    window.scrollTo=()=>{};
    window.matchMedia=()=>({matches:true});
    window.HTMLElement.prototype.scrollIntoView=()=>{};
    window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    window.HTMLDialogElement.prototype.close=function(){this.open=false;};
    const data=await originalFetch('http://127.0.0.1:3011/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'user',role})}).then(r=>r.json());
    playerId=data.data.id;
    root=createRoot(document.getElementById('root'));
    await act(async()=>root.render(createElement(FortalakaApp,{profile:{id:data.data.id,name:'Conta teste',email:null,role,active:true}})));
    await waitFor(()=>document.body.textContent.includes('Rodada isolada'));
    assert.deepEqual([...document.querySelectorAll('nav[aria-label="Navegação principal"] button')].map(e=>e.textContent),['Início','Racha','Times','Avaliação','Resultados']);
  }
  await mount('jogador');
  window.confirm=()=>false;
  await click('SAIR DA LISTA');
  assert(button('SAIR DA LISTA'),'Cancelar a saída deve manter a inscrição');
  assert(!button('ENTRAR NA LISTA'));
  window.confirm=()=>true;
  await click('SAIR DA LISTA');
  await waitFor(()=>button('ENTRAR NA LISTA'));
  await click('ENTRAR NA LISTA');
  await waitFor(()=>button('SAIR DA LISTA'));
  await click('SAIR DA LISTA');await waitFor(()=>button('ENTRAR NA LISTA'));
  await click('ENTRAR NA LISTA');
  await waitFor(()=>button('SAIR DA LISTA'));
  await mount('organizador');
  await click('Racha');
  await waitFor(()=>button('Fechar lista'));
  assert(![...document.querySelectorAll('h3')].some(e=>['Partidas','Avaliações'].includes(e.textContent)));
  assert.equal(button('FINALIZAR RACHA').disabled,true);
  assert(!document.body.textContent.includes('ABRIR AVALIAÇÕES'));
  await click('Fechar lista');
  await waitFor(()=>button('Reabrir lista'));
  await click('Reabrir lista');await waitFor(()=>button('Fechar lista'));
  await click('Fechar lista');await waitFor(()=>button('Reabrir lista'));
  await click('Times');
  assert(!document.body.textContent.toLowerCase().includes('goleiro'));
  await click('Sortear times');
  await waitFor(()=>button('Confirmar times') && !button('Confirmar times').disabled);
  assert(!document.body.textContent.toLowerCase().includes('goleiro'));
  await click('Confirmar times');
  await waitFor(()=>document.body.textContent.includes('Times confirmados'));
  await click('Racha');await click('Reabrir lista');
  await waitFor(()=>button('Fechar lista'));
  await click('Resultados');
  await waitFor(()=>document.body.textContent.includes('Nenhuma partida ainda'));
  assert(!button('INICIAR PRIMEIRA PARTIDA'),'Fila antiga não habilita início com lista reaberta');
  assert(!button('Criar partida'));
  await click('Racha');await click('Fechar lista');
  await waitFor(()=>button('Reabrir lista'));
  await click('Times');await click('Confirmar times');
  await waitFor(()=>document.body.textContent.includes('Times confirmados'));
  await click('Racha');
  await click('IR PARA RESULTADOS');
  await click('INICIAR PRIMEIRA PARTIDA');
  await click('Aumentar placar de Time 1');
  await waitFor(()=>button('Adicionar gols de Conta teste'));
  await click('Adicionar gols de Conta teste');
  await click('Aumentar placar de Time 1');
  await waitFor(()=>document.querySelector('dialog')?.open);
  assert(document.body.textContent.includes('Time 1 atingiu 2 gols.'));
  await click('CONTINUAR');
  assert.equal(document.querySelectorAll('article').length,1);
  await click('Diminuir placar de Time 1');
  await click('Aumentar placar de Time 1');
  await waitFor(()=>document.querySelector('dialog')?.open);
  await click('FINALIZAR');
  await waitFor(()=>document.body.textContent.includes('Vencedor: Time 1'));
  assert.equal(document.querySelectorAll('article').length,1);
  await click('Ranking');
  await waitFor(()=>document.body.textContent.includes('Classificação por overall'));
  await click('Racha');
  await click('FINALIZAR RACHA');
  await waitFor(()=>document.querySelector('dialog')?.open);
  await click('FINALIZAR');
  await waitFor(()=>document.body.textContent.includes('RODADA FINALIZADA'));
  await click('Avaliação');
  await click('ABRIR AVALIAÇÕES');
  await waitFor(()=>document.body.textContent.includes('ABERTA'));
  await mount('jogador');
  await click('Racha');
  await waitFor(()=>document.body.textContent.includes('RODADA FINALIZADA'));
  assert(!button('FINALIZAR RACHA'));
  await click('Resultados');
  await waitFor(()=>document.querySelectorAll('article').length===1);
  assert(!button('Editar resultado'));
  assert(!document.body.textContent.includes('NOVA PARTIDA'));
  await click('Avaliação');
  await click('AVALIAR MEU TIME');
  await waitFor(()=>document.body.textContent.includes('0 de 4 companheiros avaliados'));
  assert(!button('ABRIR AVALIAÇÕES'));
  const rpc=async(name,args)=>originalFetch('http://127.0.0.1:3011/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'rpc',role:'jogador',name,args})}).then(r=>r.json()).then(r=>r.data);
  const evaluation=await rpc('ler_avaliacoes_atual',{p_racha:null});
  const matches=await rpc('ler_partidas_rodada',{p_racha:evaluation.roundId});
  const players=matches.partidas[0].jogadores;
  const ownTeam=players.find(p=>p.jogador_id===playerId).time_id;
  const expected=players.filter(p=>p.time_id===ownTeam && p.jogador_id!==playerId).map(p=>`Avaliar ${p.nome}`).sort();
  const shown=[...document.querySelectorAll('button')].filter(e=>e.textContent==='AVALIAR').map(e=>e.getAttribute('aria-label')).sort();
  assert.deepEqual(shown,expected,'A lista deve excluir o próprio usuário e adversários');
  const evaluate=[...document.querySelectorAll('button')].find(e=>e.textContent==='AVALIAR');
  assert(evaluate);
  await act(async()=>evaluate.click());
  for(const label of ['Passe','Chute','Velocidade','Defesa','Físico'])assert(button(`${label}: 5 de 5`));
  await click('ENVIAR AVALIAÇÃO');
  await waitFor(()=>document.body.textContent.includes('1 de 4 companheiros avaliados'));
  assert(button('EDITAR'));
  await click('EDITAR');
  await click('Passe: 5 de 5');
  await click('ENVIAR AVALIAÇÃO');
  await waitFor(()=>document.body.textContent.includes('1 de 4 companheiros avaliados') && !button('ENVIAR AVALIAÇÃO'));
  const raters=players.filter(p=>p.time_id===ownTeam && p.jogador_id!==playerId).slice(0,2);
  async function receiveRating(actorId,scores){
    const result=await originalFetch('http://127.0.0.1:3011/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'rpc',role:'jogador',actorId,name:'salvar_avaliacao',args:{p_racha:evaluation.roundId,p_avaliado:playerId,p_passe:scores[0],p_chute:scores[1],p_velocidade:scores[2],p_defesa:scores[3],p_fisico:scores[4]}})}).then(r=>r.json());
    assert.equal(result.error,null);
  }
  await receiveRating(raters[0].jogador_id,[4,5,3,4,5]);
  await click('Abrir meu perfil');
  await waitFor(()=>document.body.textContent.includes('A nota aparece com 2 respostas.'));
  assert(!document.querySelector('svg polygon[stroke="#f87171"]'),'Uma resposta ainda não desenha radar');
  await receiveRating(raters[1].jogador_id,[5,5,4,4,5]);
  await act(async()=>window.dispatchEvent(new window.Event('focus')));
  await waitFor(()=>document.querySelector('[aria-label="Nota geral: 88"]'));
  assert(document.querySelector('svg polygon[stroke="#f87171"]'),'Duas respostas desenham radar');
  assert(document.querySelector('svg[aria-label*="Passe: 9 de 10"]'));
  await click('Resultados');await click('Ranking');
  await waitFor(()=>document.querySelector('article [aria-label="Nota media 88"]'));
  assert(document.querySelector('article').querySelector('[aria-label="Nota media 88"]'),'Maior overall aparece primeiro');
  await click('Abrir meu perfil');
  await waitFor(()=>button('Sair da conta'));
  await mount('jogador');await click('Avaliação');await click('AVALIAR MEU TIME');
  await waitFor(()=>document.body.textContent.includes('1 de 4 companheiros avaliados'));
  await mount('organizador');await click('Avaliação');await click('FECHAR AVALIAÇÕES');
  await waitFor(()=>document.body.textContent.includes('FECHADA'));
  await mount('jogador');await click('Avaliação');
  await waitFor(()=>document.body.textContent.includes('Avaliações fechadas'));
  assert(!button('AVALIAR MEU TIME'));
  await click('VER MINHAS AVALIAÇÕES');
  await waitFor(()=>document.body.textContent.includes('1 de 4 companheiros avaliados'));
  const viewOwn=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')?.startsWith('Ver avaliação de '));
  assert(viewOwn,'Avaliações enviadas continuam acessíveis após fechar');
  await act(async()=>viewOwn.click());
  assert(button('ENVIAR AVALIAÇÃO').disabled,'Consulta fechada não permite enviar');
  assert(button('Passe: 5 de 5').disabled);
  assert.equal(button('Passe: 5 de 5').getAttribute('aria-pressed'),'true','Consulta carrega a nota enviada');
  assert(![...document.querySelectorAll('button')].some(e=>e.textContent==='EDITAR'));
  await mount('organizador');await click('Racha');
  await waitFor(()=>document.querySelector('summary') && document.body.textContent.includes('CRIAR PRÓXIMA RODADA'));
  assert(!button('FINALIZAR RACHA'));
  await act(async()=>document.querySelector('summary').click());
  for(const [type,value] of [['date','2026-10-15'],['time','20:30'],['text','Quadra teste']])await act(async()=>{
    const input=document.querySelector(`input[type="${type}"]`);
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
    input.dispatchEvent(new window.Event('input',{bubbles:true}));
    input.dispatchEvent(new window.Event('change',{bubbles:true}));
  });
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  await waitFor(()=>document.body.textContent.includes('Racha Fortalaka') && button('Fechar lista'));
  assert(document.body.textContent.includes('Quadra teste'));
  console.log('OK: cinco abas; processos separados; partida → rodada → avaliações; roles; envio/edição sem duplicata; Ranking e Perfil acessíveis.');
} finally {
  if(root)await testAct(async()=>root.unmount());
  window?.close();
  fixture.kill();
}
// React/Next podem manter MessageChannels abertos no ambiente DOM isolado.
process.exit(0);
