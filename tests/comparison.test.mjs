import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonMetrics } from '../src/lib/players/comparison.ts';
const player={jogador_id:'a',nome:'A',jogos:0,gols:0,assistencias:0,vitorias:0,quantidade_avaliacoes:1,nota_geral_100:80};
test('sem partidas não inventa razão; nota insuficiente fica oculta',()=>{
 const rows=comparisonMetrics(player,null);
 assert.equal(rows.find(r=>r.label==='Overall').a,null);
 assert.equal(rows.find(r=>r.label==='Gols/jogo').a,null);
 assert(rows.every(r=>r.b===null));
});
test('compara dados reais e razões sem dividir por zero',()=>{
 const rows=comparisonMetrics({...player,jogos:4,gols:6,vitorias:3,quantidade_avaliacoes:2},player);
 assert.equal(rows.find(r=>r.label==='Overall').a,80);
 assert.equal(rows.find(r=>r.label==='Gols/jogo').a,1.5);
 assert.equal(rows.find(r=>r.label==='Vitórias/jogo').a,0.75);
});
