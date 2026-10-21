import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoundShareText, getRoundShareSummary, getWhatsAppShareUrl } from '../src/lib/results/round-share.ts';
import { copyRoundShareText, shareRoundText } from '../src/lib/results/share-actions.ts';

const player = (id, team, goals=0, assists=0, participou=true) => ({jogador_id:id,nome:id,avatar_url:null,time_id:team,participou,gols:goals,assistencias:assists});
const match = (id, patch={}) => ({id,versao:1,timeAId:'a',timeBId:'b',timeA:'Time 1',timeB:'Time 2',placarA:2,placarB:0,status:'finalizada',createdAt:'2026-10-22T20:00:00Z',finalizadaAt:'2026-10-22T20:07:00Z',jogadores:[],...patch});
const source = (partidas, patch={}) => ({roundId:'rodada-1',date:'2026-10-22',partidas,...patch});
const text = partidas => buildRoundShareText('rodada-1',source(partidas));
const summary = partidas => getRoundShareSummary('rodada-1',source(partidas));

test('mensagem traz marca, data em pt-BR e partidas em ordem cronológica sem mutar entrada',()=>{
  const later=match('late',{timeA:'Time 3',createdAt:'2026-10-22T21:00:00Z'});
  const earlier=match('early'); const input=[later,earlier]; const result=text(input);
  assert.equal(typeof result,'string'); assert(result.startsWith('⚽❤️ *RACHA FORTALAKA*'));
  assert(result.includes('📅 22/10/2026')); assert(result.endsWith('❤️⚽ FORTALAKA'));
  assert(result.indexOf('Time 1 2 x 0 Time 2')<result.indexOf('Time 3 2 x 0 Time 2'));
  assert.equal(input[0],later);
});
test('artilharia soma eventos registrados, e não o placar',()=>{
  const games=[match('1',{jogadores:[player('Igão','a',1),player('Lobo','b',2)]}),match('2',{jogadores:[player('Igão','a',3)]})];
  assert.deepEqual(summary(games).goals.map(p=>[p.name,p.value]),[['Igão',4],['Lobo',2]]);
  assert(text(games).includes('🥇 Igão — 4 gols'));
});
test('assistências usam os eventos da rodada',()=>{
  const games=[match('1',{jogadores:[player('PH','a',0,2),player('Jack','a',0,1)]}),match('2',{jogadores:[player('PH','a',0,1)]})];
  assert(text(games).includes('🎯 *ASSISTÊNCIAS*\n🥇 PH — 3 assistências\n🥈 Jack — 1 assistência'));
});
test('vitórias contam participação por partida; empate não dá vitória',()=>{
  const games=[match('1',{jogadores:[player('Igão','a',3,4),player('PH','b',1,2),player('Ausente','a',0,0,false)]}),match('2',{placarA:1,placarB:1,jogadores:[player('Igão','a')]}),match('3',{placarA:0,placarB:2,jogadores:[player('Igão','a'),player('PH','b')]})];
  assert.deepEqual(summary(games).wins.map(p=>[p.name,p.value,p.place]),[['Igão',1,1],['PH',1,1]]);
  assert.equal(summary(games).participantCount,2);
});
test('TOP 3 inclui empates, preserva ordem estável e não inventa desempate',()=>{
  const games=[match('1',{jogadores:[player('Zeca','a',4),player('Ana','a',4),player('Jack','b',2),player('PH','b',2),player('Outro','a',1)]})];
  assert.deepEqual(summary(games).goals.map(p=>[p.name,p.place]),[['Zeca',1],['Ana',1],['Jack',3],['PH',3]]);
  assert(text(games).includes('🥇 Ana — 4 gols')); assert(text(games).includes('🥉 PH — 2 gols'));
  assert(!text(games).includes('Outro — 1 gol'));
});
test('sem gols não há artilharia, mesmo com gols no placar',()=>{
  assert(!text([match('1',{jogadores:[player('PH','a')]})]).includes('*ARTILHEIROS*'));
});
test('sem assistências não gera seção vazia',()=>{
  assert(!text([match('1',{jogadores:[player('PH','a',1)]})]).includes('*ASSISTÊNCIAS*'));
});
test('nenhuma partida gera resumo mínimo sem rankings vazios',()=>{
  const result=text([]); assert(result.includes('Racha finalizado.'));
  for(const section of ['*RESULTADOS*','*ARTILHEIROS*','*ASSISTÊNCIAS*','*MAIS VITÓRIAS*'])assert(!result.includes(section));
  assert.equal(summary([]).participantCount,0);
});
test('exclui partidas abertas e canceladas de resultados e estatísticas',()=>{
  const result=text([match('open',{status:'aberta',timeA:'Time aberto',jogadores:[player('Aberto','a',9)]}),match('cancel',{status:'cancelada',timeA:'Time cancelado',jogadores:[player('Cancelado','a',9)]}),match('ok',{jogadores:[player('Real','a',1)]})]);
  assert(!result.includes('Time aberto'));assert(!result.includes('Time cancelado'));
  assert(!result.includes('Aberto'));assert(!result.includes('Cancelado'));assert(result.includes('Real — 1 gol'));
});
test('snapshot de outra rodada é rejeitado, sem consultar histórico global',()=>{
  const foreign=source([match('foreign',{timeA:'OUTRA RODADA',jogadores:[player('Externo','a',99)]})],{roundId:'rodada-2'});
  assert.throws(()=>buildRoundShareText('rodada-1',foreign),/não pertencem/);
  assert(!text([match('current')]).includes('Externo'));
});
test('nomes especiais são preservados; quebras de linha não criam seções falsas',()=>{
  const result=text([match('1',{timeA:'Time João & PH',jogadores:[{...player('id','a',1),nome:'Igão & “Lobo” / PH 🏃\nJunior'}]})]);
  assert(result.includes('Time João & PH 2 x 0 Time 2'));assert(result.includes('Igão & “Lobo” / PH 🏃 Junior — 1 gol'));
});
test('WhatsApp usa encodeURIComponent e recupera exatamente texto, emojis e quebras',()=>{
  const result=text([match('1',{jogadores:[player('Igão & PH #10?','a',1)]})]);
  const url=getWhatsAppShareUrl(result);assert.equal(url,'https://wa.me/?text='+encodeURIComponent(result));
  assert.equal(new URL(url).searchParams.get('text'),result);assert(!url.includes('\n'));
});
test('não duplica partida/jogador e ignora não participantes ou time estranho',()=>{
  const game=match('1',{jogadores:[player('Real','a',1),player('Real','a',1),player('Ausente','a',99,99,false),player('Estranho','c',99,99)]});
  assert.equal(summary([game,game]).matches.length,1);assert.equal(summary([game,game]).participantCount,1);
  assert.equal(summary([game,game]).goals[0].value,1);assert.equal(summary([game,game]).wins[0].value,1);
});
test('não inventa data quando ausente ou inválida',()=>{
  for(const date of [null,'inválida','2026-02-30'])assert(!buildRoundShareText('rodada-1',source([],{date})).includes('📅'));
});
test('Web Share recebe a mesma mensagem e cancelamento é silencioso',async()=>{
  let sent; const value=text([match('1')]);
  assert.equal(await shareRoundText(value,async data=>{sent=data;}),'shared');assert.deepEqual(sent,{text:value});
  assert.equal(await shareRoundText(value,async()=>{throw {name:'AbortError'};}),'cancelled');
});
test('sem Web Share ou com falha retorna fallback sem envio automático',async()=>{
  assert.equal(await shareRoundText('resultado',null),'fallback');
  assert.equal(await shareRoundText('resultado',async()=>{throw new Error('bloqueado');}),'fallback');
});
test('copiar usa exatamente o texto; clipboard ausente ou negado tem erro amigável',async()=>{
  let copied; const value=text([match('1')]);
  await copyRoundShareText(value,{writeText:async text=>{copied=text;}});assert.equal(copied,value);
  await assert.rejects(copyRoundShareText(value,null),/Abra VER RESUMO/);
  await assert.rejects(copyRoundShareText(value,{writeText:async()=>{throw new Error('negado');}}),/Não foi possível copiar/);
});
