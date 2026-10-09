import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignGoalkeepers, changeGoalkeeper, drawTeams, getTeamCount, hasCompleteTeams, swapPlayers } from '../src/lib/teams/draw.ts';

for (const [count, sizes] of [[4,[4]],[8,[4,4]],[10,[5,5]],[13,[5,4,4]],[20,[5,5,5,5]],[23,[5,5,5,4,4]]]) {
  test(`${count} jogadores: equilíbrio, máximo 5, IDs únicos e fotos preservadas`, () => {
    const players=Array.from({length:count},(_,i)=>({id:`p${i}`,name:`Jogador ${i}`,avatarUrl:i===0?'https://example.invalid/foto.png':null}));
    const before=structuredClone(players); const draw=drawTeams(players);
    assert.equal(draw.teams.length,getTeamCount(count));
    assert.deepEqual(draw.teams.map(t=>t.players.length),sizes);
    assert.equal(hasCompleteTeams(draw),true);
    assert.deepEqual(new Set(draw.teams.flatMap(t=>t.players.map(p=>p.id))),new Set(players.map(p=>p.id)));
    assert.deepEqual(players,before);
    assert.equal(draw.teams.flatMap(t=>t.players).find(p=>p.id==='p0').avatarUrl,players[0].avatarUrl);
  });
}
test('troca 1 por 1 preserva foto, IDs e entrada',()=>{
  const draw=drawTeams(Array.from({length:8},(_,i)=>({id:`p${i}`,name:`Jogador ${i}`,avatarUrl:`https://example.invalid/${i}.png`})));const before=structuredClone(draw);
  const a=draw.teams[0].players[0],b=draw.teams[1].players[0];const swapped=swapPlayers(draw,a.id,b.id);
  assert.deepEqual(draw,before);assert.deepEqual(swapped.teams[0].players[0],b);assert.deepEqual(swapped.teams[1].players[0],a);
  assert.equal(hasCompleteTeams(swapped),true);
});
test('rejeita sorteio vazio, duplicatas e composição inválida',()=>{
  assert.throws(()=>drawTeams([]));assert.throws(()=>drawTeams([{id:'a',name:'A'},{id:'a',name:'A'}]));
  assert.equal(hasCompleteTeams({teams:[]}),false);
  assert.equal(hasCompleteTeams({teams:[{id:'t1',number:1,name:'Time',players:Array.from({length:6},(_,i)=>({id:String(i),name:String(i)}))}]}),false);
  const draw=drawTeams(Array.from({length:8},(_,i)=>({id:String(i),name:String(i)})));draw.teams[0].players[0]=draw.teams[1].players[0];
  assert.equal(hasCompleteTeams(draw),false);
});


test('goleiros ficam separados; troca e ajuste da linha preservam associação sem duplicar',()=>{
  const original=drawTeams(Array.from({length:10},(_,i)=>({id:`p${i}`,name:`Jogador ${i}`})));
  const keepers=[{id:'g1',name:'Goleiro 1'},{id:'g2',name:'Goleiro 2'}];
  const draw=assignGoalkeepers(original,keepers);
  assert(draw.teams.every(t=>t.players.length===5));
  assert(draw.teams.every(t=>!t.players.some(p=>p.id.startsWith('g'))));
  const swapped=changeGoalkeeper(draw,draw.teams[0].id,keepers[1]);
  assert.deepEqual(swapped.teams.map(t=>t.goalkeeper.id),['g2','g1']);
  assert.deepEqual(draw.teams.map(t=>t.goalkeeper.id),['g1','g2']);
  const adjusted=swapPlayers(swapped,swapped.teams[0].players[0].id,swapped.teams[1].players[0].id);
  assert.deepEqual(adjusted.teams.map(t=>t.goalkeeper.id),['g2','g1']);
  assert.equal(assignGoalkeepers(original,[]).teams[0].goalkeeper,null);
});
