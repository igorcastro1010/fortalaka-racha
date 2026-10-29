import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAchievements, getRoundHonours } from '../src/lib/players/achievements.ts';
const stats={jogos:0,gols:0,assistencias:0,vitorias:0};
test('sem conquistas, primeiro gol e limites exatos',()=>{
 assert.equal(getAchievements(stats).filter(a=>a.earned).length,0);
 assert.deepEqual(getAchievements({...stats,gols:1}).filter(a=>a.earned).map(a=>a.id),['gols-1']);
 for(const gols of [10,11])assert.equal(getAchievements({...stats,gols}).filter(a=>a.earned).length,2);
 assert.equal(getAchievements({...stats,gols:50,jogos:50,assistencias:25,vitorias:25}).filter(a=>a.earned).length,12);
});
test('artilheiros empatados recebem conquista; zero e partidas inválidas não contam',()=>{
 const match={id:'m',racha_id:'r',status:'finalizada',time_a_id:'t1',time_b_id:'t2',rachas:{estado:'finalizado'},partida_jogadores:[{jogador_id:'a',time_id:'t1',participou:true},{jogador_id:'b',time_id:'t2',participou:true}],eventos_partida:[{jogador_id:'a',tipo:'gol',quantidade:2},{jogador_id:'b',tipo:'gol',quantidade:2},{jogador_id:'ghost',tipo:'gol',quantidade:20}]};
 for(const id of ['a','b'])assert.equal(getRoundHonours([match,match],id).scorer,1);
 assert.equal(getRoundHonours([match],'a').assists,0);
 assert.equal(getRoundHonours([{...match,status:'aberta'}],'a').scorer,0);
 assert.equal(getRoundHonours([{...match,rachas:{estado:'em_andamento'}}],'a').scorer,0);
});
