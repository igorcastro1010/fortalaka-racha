import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=createRequire(resolve(process.argv[2],'package.json'))('@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;`);
for(const name of ['schema','sorteio-times','validacao-sorteio-avatars','partidas-estatisticas','avaliacoes','finalizar-rodada','entrada-avaliacoes','fluxo-principal','fluxo-sem-posicoes','avaliacoes-elegibilidade','empates-e-correcoes','empates-e-correcoes']) await db.exec(readFileSync(`supabase/${name}.sql`,'utf8'));
const admin=randomUUID(),players=Array.from({length:12},()=>randomUUID());
for(const [i,id] of [admin,...players].entries()) await db.query('insert into auth.users values($1,$2,$3)',[id,'test@example.invalid',JSON.stringify({name:`Pessoa ${i}`})]);
await db.query("update profiles set role='organizador' where id=$1",[admin]);
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
async function user(id=admin){await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function invalid(fn,pattern){await db.exec('savepoint invalid');await assert.rejects(fn,pattern);await db.exec('rollback to invalid');}
async function fixture(count){
 await db.exec('reset role');
 const round=await scalar("insert into rachas(nome,estado) values('Teste','aberto') returning id");
 const teams=[];
 for(let i=0;i<count*3;i++)await db.query("insert into racha_participantes(racha_id,jogador_id,nome,tipo) values($1,$2,'Pessoa','linha')",[round,players[i]]);
 for(let i=0;i<count;i++){
  const team=await scalar("insert into times(racha_id,nome,numero,confirmado) values($1,$2,$3,true) returning id",[round,`Time ${i+1}`,i+1]);teams.push(team);
  for(const id of players.slice(i*3,i*3+3))await db.query('insert into time_jogadores(time_id,jogador_id,participante_id) select $1,$2,id from racha_participantes where racha_id=$3 and jogador_id=$2',[team,id,round]);
 }
 await db.query("update rachas set estado='times_confirmados' where id=$1",[round]);
 await db.query('insert into fila_times(racha_id,ordem_inicial,ordem) values($1,$2,$2)',[round,teams]);
 await user();
 const match=await scalar('select criar_partida($1,$2,$3)',[round,teams[0],teams[1]]);
 return {round,teams,match};
}
const read=round=>scalar('select ler_partidas_rodada($1)',[round]);
async function save(f,winner=null,a=1,b=1,status='finalizada',legacy=false){const m=(await read(f.round)).partidas.find(m=>m.id===f.match);return scalar(legacy?'select salvar_partida($1,$2,$3,$4,$5,$6)':'select salvar_partida_com_desempate($1,$2,$3,$4,$5,$6,$7)',[m.id,m.versao,a,b,status,JSON.stringify(m.jogadores),...legacy?[]:[winner]]);}
let checks=0;
async function check(name,fn){await db.exec('begin');try{await user();await fn();console.log('PASS '+name);checks++;}finally{await db.exec('rollback');}}
await check('dois aguardando trocam ambos; sem aguardando permanecem',async()=>{
 for(const count of [2,4]){const f=await fixture(count);await save(f);assert.deepEqual((await read(f.round)).fila.order,count===2?f.teams:[...f.teams.slice(2),...f.teams.slice(0,2)]);}
});
await check('um aguardando exige penaltis inclusive RPC legada; vencedor A ou B permanece',async()=>{
 for(const winnerIndex of [0,1]){
  const f=await fixture(3);
  await invalid(()=>save(f),/penaltis/);await invalid(()=>save(f,null,1,1,'finalizada',true),/penaltis/);
  await invalid(()=>save(f,f.teams[2]),/times da partida/);
  await save(f,f.teams[winnerIndex]);
  const state=await read(f.round);assert.deepEqual(state.fila.order,[f.teams[winnerIndex],f.teams[2],f.teams[1-winnerIndex]]);
  assert.equal(state.partidas[0].placarA,1);assert.equal(state.partidas[0].placarB,1);
  const stats=await scalar('select coalesce(sum(vitorias),0) from ler_estatisticas_jogadores(null)');assert.equal(Number(stats),0);
  await invalid(()=>scalar('select salvar_partida_com_desempate($1,0,1,1,$2,$3,null)',[f.match,'finalizada',JSON.stringify(state.partidas[0].jogadores)]),/alterada/);
 }
});
await check('penaltis nao se aplicam sem um aguardando nem com placar diferente',async()=>{
 const f=await fixture(4);await invalid(()=>save(f,f.teams[0]),/so se aplicam/);await invalid(()=>save(f,f.teams[0],2,1),/empatada/);
 await save(f,null,2,1);assert.deepEqual((await read(f.round)).fila.order,[f.teams[0],f.teams[2],f.teams[3],f.teams[1]]);
});
await check('correcao apos encerramento preserva fila, estado e participacao; permissao e concorrencia',async()=>{
 const f=await fixture(2);await save(f);await scalar('select finalizar_rodada($1)',[f.round]);
 const before=(await read(f.round)).fila;
 await save(f,null,2,1);assert.deepEqual((await read(f.round)).fila,before);assert.equal((await read(f.round)).roundStatus,'finalizado');
 await invalid(()=>save(f,null,2,1,'cancelada'),/encerrada/);
 await invalid(()=>save(f,null,2,1,'aberta'),/encerrada|reabrir/);
 const m=(await read(f.round)).partidas[0];m.jogadores[0].participou=false;
 await invalid(()=>scalar('select salvar_partida_com_desempate($1,$2,2,1,$3,$4,null)',[m.id,m.versao,'finalizada',JSON.stringify(m.jogadores)]),/participacao/);
 await user(players[0]);await invalid(()=>save(f,null,3,1),/organizadores/);
});
await check('pendencias somente organizadores, parciais continuam, concluidas saem, sem notas',async()=>{
 const f=await fixture(2);await save(f);await scalar('select finalizar_rodada($1)',[f.round]);await scalar('select alterar_avaliacoes_rodada($1,true)',[f.round]);
 let list=await scalar('select ler_pendencias_avaliacoes($1)',[f.round]);assert.equal(list.length,6);assert.equal(list[0].total,2);
 await user(players[0]);await invalid(()=>scalar('select ler_pendencias_avaliacoes($1)',[f.round]),/organizadores/);
 await scalar('select salvar_avaliacao($1,$2,3::smallint,3::smallint,3::smallint,3::smallint,3::smallint)',[f.round,players[1]]);
 await user();list=await scalar('select ler_pendencias_avaliacoes($1)',[f.round]);assert.equal(list.find(p=>p.id===players[0]).respondidas,1);
 assert.deepEqual(Object.keys(list[0]).sort(),['avatar_url','id','nome','respondidas','total']);
 await user(players[0]);await scalar('select salvar_avaliacao($1,$2,3::smallint,3::smallint,3::smallint,3::smallint,3::smallint)',[f.round,players[2]]);
 await user();list=await scalar('select ler_pendencias_avaliacoes($1)',[f.round]);assert.equal(list.length,5);assert.ok(!list.some(p=>p.id===players[0]));
 await save(f,null,2,1);
 await user(players[0]);assert.equal(Number(await scalar('select count(*) from avaliacoes where racha_id=$1',[f.round])),2);
 await user();
 const before=await read(f.round);
 await db.exec('reset role');await db.exec(readFileSync('supabase/empates-e-correcoes.sql','utf8'));await user();
 assert.deepEqual(await read(f.round),before);
 await db.exec('reset role;set role anon');await assert.rejects(()=>scalar('select ler_pendencias_avaliacoes($1)',[f.round]),/permission denied/);
});
await check('gol rapido atomico, repeticao, desfazer e autorizacao',async()=>{
 const f=await fixture(2),before=(await read(f.round)).partidas[0];
 const team=before.jogadores.filter(p=>p.time_id===before.timeAId);
 const next=structuredClone(before.jogadores);
 next.find(p=>p.jogador_id===team[0].jogador_id).gols++;
 next.find(p=>p.jogador_id===team[1].jogador_id).assistencias++;
 const args=[before.id,before.versao,1,0,'aberta',JSON.stringify(next)];
 const write=values=>scalar('select salvar_partida_com_desempate($1,$2,$3,$4,$5,$6,null)',values);
 await user(players[0]);await invalid(()=>write(args),/organizadores/);await user();
 assert.deepEqual((await read(f.round)).partidas[0],before);
 await write(args);
 const saved=(await read(f.round)).partidas[0];
 assert.equal(saved.placarA,1);assert.equal(saved.jogadores.find(p=>p.jogador_id===team[0].jogador_id).gols,1);
 assert.equal(saved.jogadores.find(p=>p.jogador_id===team[1].jogador_id).assistencias,1);
 await invalid(()=>write(args),/alterada/);
 assert.deepEqual((await read(f.round)).partidas[0],saved,'Repeticao nao duplica lance');
 const broken=structuredClone(next);broken[0].gols=-1;
 await invalid(()=>write([before.id,saved.versao,2,0,'aberta',JSON.stringify(broken)]),/gol|evento|negativ|inteir|inv.lid/i);
 assert.deepEqual((await read(f.round)).partidas[0],saved,'Erro nao grava placar parcial');
 await write([before.id,saved.versao,0,0,'aberta',JSON.stringify(before.jogadores)]);
 const undone=(await read(f.round)).partidas[0];assert.equal(undone.placarA,0);assert.deepEqual(undone.jogadores,before.jogadores);
});
await db.close();console.log(`${checks} cenarios passaram.`);
