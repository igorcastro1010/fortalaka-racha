// PostgreSQL local isolado: nenhuma conexao com producao.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID as uuid } from 'node:crypto';
import assert from 'node:assert/strict';
const { PGlite } = createRequire(resolve(process.argv[2], 'package.json'))('@electric-sql/pglite');
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;`);
for (const path of ['schema.sql','sorteio-times.sql','partidas-estatisticas.sql','avaliacoes.sql']) {
  await db.exec(readFileSync('supabase/' + path, 'utf8'));
}
const migration = readFileSync('supabase/migrations/20261117231523_player_evolution_v12.sql','utf8');
await db.exec(migration); await db.exec(migration);
const [player, other, voter, outsider] = [uuid(),uuid(),uuid(),uuid()];
for (const id of [player,other,voter,outsider]) await db.query('insert into auth.users values($1,$2,$3)',[id,'test@example.invalid',JSON.stringify({name:'Teste'})]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[player]);
// Seeds historicos sinteticos, incluindo registros incompletos: triggers operacionais nao sao objeto deste teste.
await db.exec('set session_replication_role=replica');
async function round(date, score=4, open=false) {
  const r=uuid(), a=uuid(), b=uuid();
  await db.query("insert into rachas(id,nome,data,estado,avaliacoes_abertas) values($1,'Rodada',$2,'finalizado',$3)",[r,date,open]);
  await db.query("insert into times(id,racha_id,nome,numero,confirmado) values($1,$3,'Time A',1,true),($2,$3,'Time B',2,true)",[a,b,r]);
  async function match(result='V', goals=1, status='finalizada', participated=true, index=0) {
    const id=uuid(); const [pa,pb]=result==='V'?[2,0]:result==='E'?[1,1]:[0,2];
    await db.query('insert into partidas(id,racha_id,time_a_id,time_b_id,placar_a,placar_b,status,created_at) values($1,$2,$3,$4,$5,$6,$7,$8)',[id,r,a,b,pa,pb,status,`${date}T20:${String(index).padStart(2,'0')}:00Z`]);
    for (const p of [player,other,voter]) await db.query('insert into partida_jogadores(partida_id,jogador_id,time_id,participou) values($1,$2,$3,$4)',[id,p,a,p===player?participated:true]);
    if(goals) await db.query("insert into eventos_partida(partida_id,jogador_id,tipo,quantidade) values($1,$2,'gol',$3)",[id,player,goals]);
    return id;
  }
  const id=await match();
  if(score!==null) for(const [target,reviewers] of [[player,[other,voter]],[other,[player,voter]]]) for (const reviewer of reviewers)
    await db.query('insert into avaliacoes(racha_id,avaliador_id,avaliado_id,time_id,passe,chute,velocidade,defesa,fisico) values($1,$2,$3,$4,$5,$5,$5,$5,$5)',[r,reviewer,target,a,score]);
  return {r,a,b,id,match};
}
const r1=await round('2026-01-01',3);
const r2=await round('2026-01-08',5);
const r3=await round('2026-01-15',null);
await r3.match('E',0,'finalizada',true,1);
await r3.match('D',0,'finalizada',true,2);
await r3.match('V',50,'aberta',true,3);
await r3.match('V',50,'cancelada',true,4);
await r3.match('V',50,'finalizada',false,5);
await round('2026-01-22',1,true);
await db.exec('set session_replication_role=origin;set role authenticated');
async function read(section='resumo', page=0, id=player) { return (await db.query('select ler_evolucao_jogador($1,$2,$3) value',[id,section,page])).rows[0].value; }
let result=await read();
assert.deepEqual([result.stats.jogos,result.stats.gols,result.stats.vitorias,result.stats.empates,result.stats.derrotas],[6,4,4,1,1]);
assert.equal(result.overall.media,80); assert.equal(result.overall.melhor,100);
assert.deepEqual(result.overall.ultimas.map(x=>x.overall),[100,60]);
assert.equal(result.overall.rodadas,2,'sem avaliacao e avaliacoes abertas nao viram zero');
assert.equal(result.marcos['sequencia-3'].earned,true);
assert.equal(result.marcos['sequencia-5'].earned,false);
assert.equal(result.marcos.artilheiro.earned,true);
assert.equal(result.marcos.destaque.earned,true,'empates compartilham destaque');
assert.equal(Object.keys(result.marcos).length,21,'sem duplicatas e preserva marcos anteriores');
assert.equal((await read('notas')).items.length,2);
assert.equal((await read('rodadas')).items.length,4);
assert.equal((await read('partidas')).items.length,6);
assert.equal((await read('partidas',1)).items.length,0);
assert.equal((await read('resumo',0,outsider)).stats.jogos,0,'inscricao nao prova participacao');
assert.equal((await read('resumo',0,outsider)).overall.media,null);
assert.equal((await read('resumo',0,other)).overall.media,80,'Outro perfil ativo acessivel sem revelar votos');
assert.ok(!JSON.stringify(result).includes('avaliador'));
await db.exec('reset role;begin;set session_replication_role=replica');
for(let i=1;i<=20;i++) {
  const extra=await round(`2026-02-${String(i).padStart(2,'0')}`,null);
  await db.query('update eventos_partida set quantidade=3 where partida_id=$1',[extra.id]);
}
await db.exec('set session_replication_role=origin;set role authenticated');
const extended=await read();
for(const n of [1,10,25,50])assert.equal(extended.marcos['gols-'+n].earned,true);
for(const n of [5,10,20])assert.equal(extended.marcos['presencas-'+n].earned,true);
assert.equal(extended.marcos['sequencia-5'].earned,true);
const page0=await read('partidas',0),page1=await read('partidas',1),page2=await read('partidas',2);
assert.deepEqual([page0.items.length,page1.items.length,page2.items.length],[12,12,2]);
assert.deepEqual([page0.hasMore,page1.hasMore,page2.hasMore],[true,true,false]);
assert.equal(new Set([...page0.items,...page1.items,...page2.items].map(x=>x.id)).size,26);
assert.equal((await read('rodadas')).items.length,12);
assert.equal((await read('rodadas',1)).items.length,12);
await db.exec('reset role;rollback;set role authenticated');
await db.exec('reset role;begin;set session_replication_role=replica');
await db.query('update partidas set time_b_id=$1 where id=$2',[r2.b,r1.id]);
await db.exec('set session_replication_role=origin;set role authenticated');
assert.equal((await read()).stats.jogos,5,'Time de outra rodada invalida partida');
assert.equal((await read()).overall.media,100,'Mesma partida estruturalmente invalida nao sustenta notas');
assert.equal((await read('notas')).items.length,1);
await db.exec('reset role;rollback;set role authenticated');
await assert.rejects(()=>db.query('select * from v12_notas($1)',[player]),/permission denied/);
await assert.rejects(()=>db.query('select * from v12_jogos($1)',[player]),/permission denied/);
await assert.rejects(()=>read('partidas',-1),/Consulta invalida/);
await assert.rejects(()=>read('resumo',0,uuid()),/Perfil indisponivel/);
await db.exec('reset role;set session_replication_role=replica');
await db.query('update partidas set placar_a=0,placar_b=2 where id=$1',[r2.id]);
await db.query('delete from eventos_partida where partida_id=$1',[r1.id]);
await db.query('delete from avaliacoes where racha_id=$1 and avaliador_id=$2',[r2.r,voter]);
await db.query('delete from avaliacoes where avaliado_id=$1',[other]);
await db.exec('set session_replication_role=origin;set role authenticated');
result=await read(); assert.equal(result.stats.gols,3); assert.equal(result.marcos['sequencia-3'].earned,false);
assert.equal(result.overall.media,60,'uma resposta nao revela nota');
assert.equal(result.marcos.destaque.earned,false,'um unico candidato nao ganha destaque');
await db.exec('reset role;set role anon');
await assert.rejects(()=>read(),/permission denied/);
await db.exec('reset role'); await db.query('update profiles set active=false where id=$1',[player]); await db.exec('set role authenticated');
await assert.rejects(()=>read(),/Perfil indisponivel/);
await db.exec('reset role');
await db.exec(readFileSync('supabase/rollback-evolucao-v12.sql','utf8')); await db.exec(migration);
console.log('PASS V1.2: SQL idempotente/reversivel, overall, privacidade, estados, participacao, empates, sequencias e correcao historica');
await db.close();
