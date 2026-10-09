import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const {PGlite}=createRequire(resolve(process.argv[2],'package.json'))('@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;`);
for(const p of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/validacao-sorteio-avatars.sql','supabase/partidas-estatisticas.sql','supabase/avaliacoes.sql','supabase/avaliacoes.sql'])await db.exec(readFileSync(p,'utf8'));

const organizer=randomUUID(), ids=Array.from({length:8},()=>randomUUID()), round=randomUUID(), teamA=randomUUID(), teamB=randomUUID();
const names=['Igor','Jack','PH','Lobo','Dede','Levi','Bruno','Arthur'];
for(const [i,id] of [organizer,...ids].entries())await db.query('insert into auth.users values($1,$2,$3)',[id,`u${i}@example.invalid`,JSON.stringify({name:i?'Conta':'Organizador'})]);
for(let i=0;i<ids.length;i++)await db.query('update public.profiles set name=$2 where id=$1',[ids[i],names[i]]);
await db.query("update public.profiles set role='organizador' where id=$1",[organizer]);
await db.query("insert into public.rachas(id,nome,data,estado) values($1,'Rodada avaliacao','2026-10-09','aberto')",[round]);
for(let i=0;i<8;i++)await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status) values($1,$2,$3,'linha','confirmado')",[round,ids[i],names[i]]);
await db.query("insert into public.times(id,racha_id,nome,numero,confirmado) values($1,$2,'Time 1',1,true),($3,$2,'Time 2',2,true)",[teamA,round,teamB]);
for(let i=0;i<8;i++)await db.query('insert into public.time_jogadores(time_id,jogador_id,participante_id) select $1,$2,id from public.racha_participantes where jogador_id=$2 and racha_id=$3',[i<4?teamA:teamB,ids[i],round]);
await db.query("update public.rachas set estado='times_confirmados' where id=$1",[round]);

async function user(id){await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function invalid(fn,pattern){await db.exec('savepoint invalid');await assert.rejects(fn,pattern);await db.exec('rollback to invalid');}
async function readEval(){return (await db.query('select public.ler_avaliacoes_rodada() as result')).rows[0].result;}
async function save(target,scores=[4,5,4,3,4]){
  return db.query('select public.salvar_avaliacao($1,$2,$3,$4,$5,$6,$7)',[round,target,...scores]);
}

await user(organizer);
const matchId=(await db.query('select public.criar_partida($1,$2,$3) as id',[round,teamA,teamB])).rows[0].id;
let match=(await db.query('select public.ler_partidas_rodada($1) as result',[round])).rows[0].result.partidas[0];
match.placarA=3;match.placarB=2;
await db.query('select public.salvar_partida($1,$2,$3,$4,$5,$6)',[matchId,match.versao,match.placarA,match.placarB,'finalizada',JSON.stringify(match.jogadores)]);

await db.exec('begin');
await user(ids[0]);
await invalid(()=>save(ids[1]),/abertas|companheiros|avaliacoes/i);

await user(organizer);
let progress=(await db.query('select public.alterar_avaliacoes_rodada($1,true) as result',[round])).rows[0].result;
assert.deepEqual([progress.total,progress.respondentes,progress.abertas],[8,0,true]);

await user(ids[0]);
let state=await readEval();
assert.equal(state.canEvaluate,true);
assert.deepEqual(state.players.map(p=>p.nome),['Jack','Lobo','PH']);
await invalid(()=>save(ids[0]),/companheiros|auto|avaliar/i);
await invalid(()=>save(ids[4]),/companheiros|time/i);
await save(ids[1]);
await save(ids[1],[5,5,5,5,5]);
assert.equal((await db.query('select count(*)::int n from public.avaliacoes where avaliador_id=$1 and avaliado_id=$2',[ids[0],ids[1]])).rows[0].n,1);
state=await readEval();
assert.equal(state.players.find(p=>p.jogador_id===ids[1]).avaliado,true);

await user(organizer);
let summary=(await db.query('select * from public.medias_jogador($1)',[ids[1]])).rows[0];
assert.equal(summary.quantidade,1);
assert.equal(summary.passe,null);

await user(ids[2]);
await save(ids[1],[5,4,4,4,5]);
await user(organizer);
summary=(await db.query('select * from public.medias_jogador($1)',[ids[1]])).rows[0];
assert.deepEqual([summary.quantidade,Number(summary.passe),Number(summary.chute),Number(summary.velocidade),Number(summary.defesa),Number(summary.fisico)],[2,10,9,9,9,10]);
const ranking=(await db.query('select * from public.ler_estatisticas_jogadores($1)',[ids[1]])).rows[0];
assert.equal(ranking.nota_geral_100,94);
progress=(await db.query('select public.ler_progresso_avaliacoes($1) as result',[round])).rows[0].result;
assert.deepEqual([progress.total,progress.respondentes,progress.abertas],[8,2,true]);

await db.query('select public.alterar_avaliacoes_rodada($1,false)',[round]);
await user(ids[0]);
await invalid(()=>save(ids[2]),/fechadas|abertas/i);

await db.exec('commit');
await db.close();
console.log('PASS avaliacoes pos-jogo: elegibilidade, duplicidade, medias e fechamento');
