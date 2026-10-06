// Banco isolado, sem conexão com Supabase real.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const { PGlite }=createRequire(resolve(process.argv[2],'package.json'))('@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;`);
for(const p of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/medias-perfil.sql','supabase/medias-perfil.sql'])await db.exec(readFileSync(p,'utf8'));
const ids=Array.from({length:4},()=>randomUUID()),round=randomUUID(),team=randomUUID();
for(const id of ids)await db.query("insert into auth.users values($1,'teste@example.invalid','{\"name\":\"Teste\"}')",[id]);
await db.query("insert into public.rachas(id,estado) values($1,'times_confirmados')",[round]);
await db.query("insert into public.times(id,racha_id,nome,numero,confirmado) values($1,$2,'Time 1',1,true)",[team,round]);
for(const id of ids.slice(0,3)){
  const p=(await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status) values($1,$2,'Teste','linha','confirmado') returning id",[round,id])).rows[0];
  await db.query('insert into public.time_jogadores(time_id,jogador_id,participante_id) values($1,$2,$3)',[team,id,p.id]);
}
async function user(id){await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function summary(){return (await db.query('select * from public.medias_jogador($1)',[ids[0]])).rows[0];}
await user(ids[0]);assert.equal((await summary()).quantidade,0);assert.equal((await summary()).passe,null);
await user(ids[1]);await db.query('insert into public.avaliacoes_jogadores(racha_id,jogador_id,passe,chute,velocidade,defesa,fisico) values($1,$2,8,6,9,5,6)',[round,ids[0]]);
await user(ids[2]);await db.query('insert into public.avaliacoes_jogadores(racha_id,jogador_id,passe,chute,velocidade,defesa,fisico) values($1,$2,6,10,7,9,10)',[round,ids[0]]);
await user(ids[0]);let s=await summary();assert.equal(s.quantidade,2);assert.deepEqual([s.passe,s.chute,s.velocidade,s.defesa,s.fisico].map(Number),[7,8,8,7,8]);
await user(ids[1]);await db.query('update public.avaliacoes_jogadores set passe=10 where jogador_id=$1',[ids[0]]);
await user(ids[0]);s=await summary();assert.equal(Number(s.passe),8);assert.equal(s.quantidade,2);
await user(ids[3]);await assert.rejects(()=>summary(),/Sem permissão/);
await assert.rejects(()=>db.query('insert into public.avaliacoes_jogadores(racha_id,jogador_id,passe,chute,velocidade,defesa,fisico) values($1,$2,8,8,8,8,8)',[round,ids[0]]),/row-level security/);
await user(ids[1]);await assert.rejects(()=>db.query('insert into public.avaliacoes_jogadores(racha_id,jogador_id,passe,chute,velocidade,defesa,fisico) values($1,$2,8,8,8,8,8)',[round,ids[0]]),/unique constraint/);
await assert.rejects(()=>db.query('update public.avaliacoes_jogadores set chute=11 where jogador_id=$1',[ids[0]]),/check constraint/);
await assert.rejects(()=>db.query('update public.avaliacoes_jogadores set jogador_id=$1',[ids[3]]),/permission denied/);
await user(ids[0]);assert.equal((await db.query('update public.avaliacoes_jogadores set passe=0 returning id')).rows.length,0);
console.log('PASS médias reais, atualização, vazio, privacidade, companheiros, duplicatas, faixa 0–10 e proteção de autoria');
await db.close();

