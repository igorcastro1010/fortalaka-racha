import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankingMetric, sortRanking } from '../src/lib/players/ranking.ts';

const player = (id, nome, nota, gols, assistencias, vitorias, jogos) => ({ jogador_id: id, nome, avatar_url: null, nota_geral_100: nota, quantidade_avaliacoes: nota == null ? 0 : 2, gols, assistencias, vitorias, jogos });
const players = [player('a','Zeca',80,2,1,4,5), player('b','Ana',90,1,4,1,8), player('c','Bruno',90,6,0,3,2), player('d','Diego',null,0,2,0,0), player('e','Eva',70,6,2,5,4), player('f','Fabio',null,0,0,0,1)];
const expected = { geral: 'bcaedf', nota: 'bcaedf', gols: 'ceabdf', assistencias: 'bedacf', vitorias: 'eacbdf', jogos: 'baecfd' };
for (const [sort, order] of Object.entries(expected)) test(`filtro ${sort}: decrescente, com empate estável e zeros preservados`, () => {
  const original = structuredClone(players);
  const result = sortRanking(players, sort);
  assert.equal(result.map(row => row.jogador_id).join(''), order);
  assert.equal(result.length, players.length);
  assert.deepEqual(players, original);
  if (sort !== 'geral' && sort !== 'nota') assert(result.every((row,index) => index === 0 || result[index-1][sort] >= row[sort]));
});
test('Geral preserva desempate por nome pt-BR e ID', () => {
  const input = [player('z','Igão',90,0,0,0,0),player('a','Igão',90,0,0,0,0),player('c','Ana',90,0,0,0,0)];
  assert.deepEqual(sortRanking(input,'geral').map(row=>row.jogador_id),['c','a','z']);
});
test('Nota mantém jogadores sem nota válida no fim e não revela nota com uma avaliação', () => {
  const input = [null,NaN,Infinity,-1,101,80].map((value,index)=>player(String(index),`Pessoa ${index}`,value,0,0,0,0));
  input.push({...player('hidden','Oculta',99,0,0,0,0),quantidade_avaliacoes:1});
  const result=sortRanking(input,'nota');
  assert.equal(result[0].jogador_id,'5');
  for(const row of result.slice(1))assert.equal(rankingMetric(row,'nota').value,null);
});
test('métrica destacada usa valor carregado e plural correto', () => {
  const row=player('a','Ana',90,1,2,1,0);
  assert.deepEqual(rankingMetric(row,'geral'),{value:90,label:'overall'});
  assert.deepEqual(rankingMetric(row,'nota'),{value:90,label:'overall'});
  assert.deepEqual(rankingMetric(row,'gols'),{value:1,label:'gol'});
  assert.deepEqual(rankingMetric(row,'assistencias'),{value:2,label:'assistências'});
  assert.deepEqual(rankingMetric(row,'vitorias'),{value:1,label:'vitória'});
  assert.deepEqual(rankingMetric(row,'jogos'),{value:0,label:'jogos'});
  assert.deepEqual(sortRanking([],'geral'),[]);
});
