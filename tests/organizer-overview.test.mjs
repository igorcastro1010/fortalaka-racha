import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganizerOverview } from '../src/lib/rounds/organizer-overview.ts';

const participant=(id,patch={})=>({id,jogadorId:id,name:id,type:'linha',status:'confirmado',...patch});
const round=(status='aberto',participants=[])=>({roundId:'round',roundName:'Racha',date:'2026-10-22',time:null,address:null,status,participants});
const teams=(status='aberto',items=[],confirmed=false)=>({roundId:'round',status,teams:items,confirmed,version:1,fieldPlayers:[]});
const matches=(roundStatus='aberto',partidas=[],fila=null)=>({roundStatus,partidas,times:[{id:'a',nome:'Time 1'},{id:'b',nome:'Time 2'},{id:'c',nome:'Time 3'}],fila});
const progress=(abertas=false,respondentes=0,total=0)=>({abertas,respondentes,total});
const game=(id,status='finalizada',patch={})=>({id,status,timeAId:'a',timeBId:'b',timeA:'Time 1',timeB:'Time 2',placarA:1,placarB:0,jogadores:[],...patch});
const build=(status,patch={})=>buildOrganizerOverview(round(status,patch.participants??[]),patch.teams??teams(status),patch.matches??matches(status),patch.progress??progress());

test('lista aberta vazia: contadores reais e CTA de lista',()=>{
  const view=build('aberto');assert.equal(view.confirmed,0);assert.equal(view.teamCount,0);assert.equal(view.matchCount,0);
  assert.equal(view.alert,'Nenhum jogador entrou na lista ainda.');assert.equal(view.primary.label,'GERENCIAR LISTA');assert.equal(view.primary.destination,'racha');
  assert.equal(view.listStatus,'ABERTA');assert.equal(view.rachaStatus,'NÃO INICIADO');
});
test('confirmados incluem legado; suplentes, ausentes e removidos não inflam participantes',()=>{
  const view=build('aberto',{participants:[participant('a'),participant('b',{type:'goleiro'}),participant('s',{type:'suplente'}),participant('x',{status:'ausente'}),participant('r',{status:'removido'})]});
  assert.equal(view.confirmed,2);assert.equal(view.substitutes,1);assert.equal(view.absent,1);assert.equal(view.alert,'2 jogadores confirmados.');
});
test('lista fechada e rascunho são diferentes de times confirmados',()=>{
  const empty=build('lista_fechada');assert.equal(empty.listStatus,'FECHADA');assert.equal(empty.teamsStatus,'NÃO SORTEADOS');assert.equal(empty.alert,'Lista fechada. Falta definir os times.');
  const draft=build('lista_fechada',{teams:teams('lista_fechada',[{id:'a'},{id:'b'}])});
  assert.equal(draft.teamCount,2);assert.equal(draft.teamsStatus,'RASCUNHO');assert.match(draft.alert,/rascunho/);assert.equal(draft.primary.label,'REVISAR TIMES');assert.equal(draft.primary.destination,'teams');
  assert.equal(empty.primary.label,'SORTEAR TIMES');
});
test('times confirmados, nenhuma partida: atalho para resultados',()=>{
  const view=build('times_confirmados',{teams:teams('times_confirmados',[{id:'a'},{id:'b'}],true)});
  assert.equal(view.teamsStatus,'CONFIRMADOS');assert.equal(view.rachaStatus,'NÃO INICIADO');assert.equal(view.alert,'Times prontos. Você já pode iniciar o racha.');assert.equal(view.primary.destination,'results');
});
test('partida aberta e fila: mostra somente a partida aberta e times aguardando',()=>{
  const view=build('em_andamento',{matches:matches('em_andamento',[game('done'),game('open','aberta'),game('cancel','cancelada')],{order:['a','b','c'],currentMatchId:'done',version:1})});
  assert.equal(view.currentMatch.id,'open');assert.equal(view.matchCount,3);assert.equal(view.finalized,1);assert.deepEqual(view.waiting,['Time 3']);
  assert.equal(view.rachaStatus,'EM ANDAMENTO');assert.equal(view.alert,'Partida em andamento.');assert.equal(view.primary.label,'GERENCIAR PARTIDAS');
});
test('sem partida aberta não anuncia partida em andamento',()=>{
  const view=build('em_andamento',{matches:matches('em_andamento',[game('done')])});assert.equal(view.currentMatch,null);assert.match(view.alert,/próxima partida/);
});
test('finalizado e avaliações fechadas: navega para o controle existente, sem afirmar abertura inédita',()=>{
  const view=build('finalizado');assert.equal(view.rachaStatus,'FINALIZADO');assert.equal(view.evaluationStatus,'FECHADAS');assert.equal(view.evaluationsCompleted,false);
  assert.equal(view.primary.label,'ABRIR AVALIAÇÕES');assert.equal(view.primary.destination,'evaluate');assert.equal(view.alert,'Racha finalizado. Avaliações fechadas.');
});
test('avaliações abertas: acompanhamento; fechadas após respostas: rodada concluída',()=>{
  const open=build('finalizado',{progress:progress(true,3,10)});assert.equal(open.evaluationStatus,'ABERTAS');assert.equal(open.primary.label,'ACOMPANHAR AVALIAÇÕES');assert.equal(open.alert,'Avaliações em andamento.');
  const closed=build('finalizado',{progress:progress(false,3,10)});assert.equal(closed.evaluationStatus,'ENCERRADAS');assert.equal(closed.evaluationsCompleted,true);assert.equal(closed.alert,'Rodada concluída.');assert.equal(closed.primary.destination,'results');
});
test('dados ausentes nunca viram zeros nem avaliações fechadas inventadas',()=>{
  const view=buildOrganizerOverview(round('finalizado'),null,null,null);assert.equal(view.teamCount,null);assert.equal(view.matchCount,null);assert.equal(view.finalized,null);assert.equal(view.evaluationStatus,null);assert.equal(view.currentMatch,null);assert.deepEqual(view.waiting,[]);assert.equal(view.primary.label,'VER AVALIAÇÕES');
  const closed=buildOrganizerOverview(round('lista_fechada'),null,null,null);assert.equal(closed.alert,'Lista fechada. Consulte os times da rodada.');
});
test('descarta composição de outra rodada ou status e partidas com status divergente',()=>{
  const view=buildOrganizerOverview(round('aberto'),{...teams('aberto',[{id:'old'}]),roundId:'other'},matches('finalizado',[game('old')]),null);
  assert.equal(view.teamCount,null);assert.equal(view.matchCount,null);
});
