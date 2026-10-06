// PostgreSQL isolado; nunca acessa Supabase. Passe node_modules com PGlite.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { drawTeams } from '../src/lib/teams/draw.ts';
const { PGlite }=createRequire(resolve(process.argv[2],'package.json'))('@electric-sql/pglite');
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
grant usage on schema storage to authenticated,anon;
grant select,insert,update,delete on storage.objects to authenticated;
grant select on storage.objects to anon;`);
for(const path of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/validacao-sorteio-avatars.sql'])await db.exec(readFileSync(path,'utf8'));
await db.exec(readFileSync('supabase/validacao-sorteio-avatars.sql','utf8'));
const organizer=randomUUID(),viewer=randomUUID();
const ids=Array.from({length:27},()=>randomUUID());
for(const id of [organizer,viewer,...ids])await db.query("insert into auth.users values($1,'test@example.invalid','{\"name\":\"Teste\"}')",[id]);
await db.query("update public.profiles set role='organizador' where id=$1",[organizer]);
await db.query("update public.profiles set avatar_url='https://example.invalid/photo.png' where id=$1",[ids[0]]);
const round=randomUUID();await db.query("insert into public.rachas(id,nome,data) values($1,'Teste isolado','2026-10-08')",[round]);
const participants=[];
for(let i=0;i<27;i++){
  const type=i<23?'linha':i<25?'goleiro':'suplente';
  const {rows:[p]}=await db.query('insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status) values($1,$2,$3,$4,$5) returning id', [round,ids[i],`Pessoa ${i}`,type,i===26?'ausente':'confirmado']);
  participants.push({id:p.id,jogadorId:ids[i],name:`Pessoa ${i}`,avatarUrl:i===0?'https://example.invalid/photo.png':null});
}
async function user(id=organizer,role='authenticated'){await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function snapshot(){return (await db.query('select public.ler_times_rodada() as result')).rows[0].result;}
async function save(teams,version){return db.query('select public.salvar_rascunho_times($1,$2,$3)',[round,version,JSON.stringify(teams.map(t=>({numero:t.number,nome:t.name,jogadores:t.players.map(p=>p.id)})))]);}
async function invalid(fn,pattern){await db.exec('savepoint invalid');await assert.rejects(fn,pattern);await db.exec('rollback to invalid');}
let passed=0;
async function check(name,fn){await db.exec('begin');try{await user();await fn();console.log('PASS '+name);passed++;}finally{await db.exec('rollback');await user();}}
try{
  for(const count of [4,8,10,13,20,23])await check(`${count}: persistência, recarga, troca, reroll, confirmação sem recriar e leitura por jogador`,async()=>{
    await db.exec('reset role');await db.query("update public.racha_participantes set status='ausente' where racha_id=$1 and tipo='linha' and jogador_id=any($2::uuid[])",[round,ids.slice(count,23)]);await user();
    await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[round]);let state=await snapshot();
    assert.equal(state.fieldPlayers.length,count);assert.equal(state.goalkeepers.length,2);
    assert.equal(state.fieldPlayers[0].avatarUrl,'https://example.invalid/photo.png');
    const draw=drawTeams(state.fieldPlayers);await save(draw.teams,state.version);state=await snapshot();
    const persisted=structuredClone(state.teams);await user(viewer);assert.deepEqual((await snapshot()).teams,[]);await user();
    assert.deepEqual((await snapshot()).teams,persisted); // Outra sessão/leitura não depende do React.
    if(state.teams.length>1){const a=state.teams[0].players[0],b=state.teams[1].players[0];state.teams[0].players[0]=b;state.teams[1].players[0]=a;await save(state.teams,state.version);state=await snapshot();assert.equal(state.teams[0].players.some(p=>p.id===b.id),true);}
    await save(drawTeams(state.fieldPlayers).teams,state.version);state=await snapshot();
    assert.equal((await db.query('select count(*)::int as n from public.time_jogadores')).rows[0].n,count);
    const teamIds=state.teams.map(t=>t.id);const membership=state.teams.map(t=>t.players.map(p=>p.id));
    await db.query('select public.confirmar_rascunho_times($1,$2)',[round,state.version]);state=await snapshot();
    assert.equal(state.confirmed,true);assert.deepEqual(state.teams.map(t=>t.id),teamIds);assert.deepEqual(state.teams.map(t=>t.players.map(p=>p.id)),membership);
    await user(viewer);assert.deepEqual((await snapshot()).teams,state.teams);
    assert.equal((await db.query('select count(*)::int as n from public.time_jogadores j left join public.times t on t.id=j.time_id where t.id is null')).rows[0].n,0);
  });
  await check('falha de composição é atômica, mantém rascunho anterior e bloqueia versão velha',async()=>{
    await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[round]);let state=await snapshot();await save(drawTeams(state.fieldPlayers).teams,state.version);state=await snapshot();
    for(const id of [participants[23].id,participants[25].id,participants[26].id,randomUUID(),state.teams[1].players[0].id]){
      const bad=structuredClone(state.teams);bad[0].players[0].id=id;
      await invalid(()=>save(bad,state.version));assert.deepEqual((await snapshot()).teams,state.teams);
    }
    await invalid(()=>save(state.teams,state.version-1),/A rodada foi alterada/);
  });
  await check('jogador não salva/confirma times e organizador não escreve tabela diretamente',async()=>{
    await db.query("select public.alterar_estado_rodada($1,'lista_fechada')",[round]);const state=await snapshot();const draw=drawTeams(state.fieldPlayers);
    await user(viewer);await invalid(()=>save(draw.teams,state.version),/Somente organizadores/);
    await invalid(()=>db.query('select public.confirmar_rascunho_times($1,$2)',[round,state.version]),/Somente organizadores/);
    await user();await invalid(()=>db.query("insert into public.times(racha_id,nome,numero) values($1,'Time',1)",[round]),/permission denied/);
  });
  await check('foto de outro jogador aparece sem liberar profiles e-mails',async()=>{
    await user(viewer);assert.equal((await snapshot()).fieldPlayers[0].avatarUrl,'https://example.invalid/photo.png');
    assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n,1);
    assert.equal((await db.query('update public.profiles set avatar_url=$1 where id=$2 returning id',['https://example.invalid/hack.png',ids[0]])).rows.length,0);
    assert.equal((await db.query('update public.profiles set avatar_url=$1 where id=$2 returning id',['https://example.invalid/own.png',viewer])).rows.length,1);
  });
  await check('storage permite somente pasta própria, leitura pública, bucket limitado a imagens',async()=>{
    await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)",[organizer+'/foto.png']);
    await user(viewer);await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)",[viewer+'/foto.png']);
    await invalid(()=>db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)",[organizer+'/hack.png']),/row-level security/);
    assert.equal((await db.query("delete from storage.objects where name=$1 returning id",[organizer+'/foto.png'])).rows.length,0);
    assert.equal((await db.query("update storage.objects set name=$1 where name=$2 returning id",[viewer+'/roubada.png',organizer+'/foto.png'])).rows.length,0);
    await user(viewer,'anon');assert.equal((await db.query("select * from storage.objects where bucket_id='avatars'")).rows.length,2);
    await db.exec('reset role');const bucket=(await db.query("select * from storage.buckets where id='avatars'")).rows[0];assert.equal(bucket.file_size_limit,2097152);
  });
  console.log(`${passed} cenários PostgreSQL passaram.`);
}finally{await db.close();}
