// UI real + RPCs reais em PostgreSQL isolado. Nunca acessa Supabase remoto.
// node tests/preview-sorteio.mjs <node_modules com esbuild> <node_modules com PGlite>
// Adicione --app para validar as cinco abas do app principal.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
const { build }=createRequire(resolve(process.argv[2],'package.json'))('esbuild');
const { PGlite }=createRequire(resolve(process.argv[3],'package.json'))('@electric-sql/pglite');
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
for(const path of ['supabase/schema.sql','supabase/sorteio-times.sql','supabase/validacao-sorteio-avatars.sql','supabase/partidas-estatisticas.sql','supabase/avaliacoes.sql','supabase/finalizar-rodada.sql','supabase/entrada-avaliacoes.sql'])await db.exec(readFileSync(path,'utf8'));
const organizer=randomUUID(),viewer=randomUUID();const ids=Array.from({length:14},()=>randomUUID());
for(const [i,id] of [organizer,viewer,...ids].entries())await db.query('insert into auth.users values($1,$2,$3)',[id,'test@example.invalid',JSON.stringify({name:i<2?'Conta teste':`Pessoa ${i-2}`})]);
await db.query("update public.profiles set role='organizador' where id=$1",[organizer]);
// A conta de jogador também participa da rodada para validar o fluxo de avaliação.
ids[0]=viewer;
await db.query('update public.profiles set avatar_url=$2 where id=$1',[ids[0],'http://127.0.0.1:3011/photo.png']);
await db.query('update public.profiles set avatar_url=$2 where id=$1',[ids[2],'http://127.0.0.1:3011/missing.png']);
const round=randomUUID();await db.query("insert into public.rachas(id,nome,data) values($1,'Rodada isolada','2026-10-08')",[round]);
for(let i=0;i<8;i++)await db.query("insert into public.racha_participantes(racha_id,jogador_id,nome,tipo) values($1,$2,$3,'linha')",[round,ids[i],`Pessoa ${i}`]);
for(let i=10;i<14;i++)await db.query('insert into public.racha_participantes(racha_id,jogador_id,nome,tipo,status) values($1,$2,$3,$4,$5)',[round,ids[i],`Pessoa ${i}`,i<12?'goleiro':i===12?'suplente':'linha',i===13?'ausente':'confirmado']);
const output=mkdtempSync(join(tmpdir(),'fortalaka-validation-'));
const client=join(output,'client.ts');
writeFileSync(client,`
const role=new URLSearchParams(location.search).get('role')==='jogador'?'jogador':'organizador';
async function request(body){const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,role})});return r.json();}
export function createClient(){return {
 rpc:(name,args)=>request({kind:'rpc',name,args}),
 from(table){let body={kind:'table',table,op:'select',filters:[],single:false};const q={select(){return q},eq(k,v){body.filters.push([k,v]);return q},order(){return q},limit(){return q},returns(){return q},maybeSingle(){body.single=true;return q},single(){body.single=true;return q},insert(value){body.op='insert';body.value=value;return q},update(value){body.op='update';body.value=value;return q},delete(){body.op='delete';return q},then(a,b){return request(body).then(a,b)}};return q},
 auth:{async getUser(){const r=await request({kind:'user'});return {data:{user:r.data},error:r.error}}},
 storage:{from(){return {async upload(path,file){const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(const b of bytes)text+=String.fromCharCode(b);return request({kind:'upload',path,type:file.type,base64:btoa(text)})},getPublicUrl(path){return {data:{publicUrl:location.origin+'/avatar/'+path}}},remove(paths){return request({kind:'remove',paths})}}}}
};}
`);
writeFileSync(join(output,'main.tsx'),`
import { useState } from 'react';import { createRoot } from 'react-dom/client';
import { FortalakaApp } from ${JSON.stringify(resolve('src/components/app/FortalakaApp.tsx'))};
import { TeamsScreen } from ${JSON.stringify(resolve('src/components/teams/TeamsScreen.tsx'))};
import { RachaScreen } from ${JSON.stringify(resolve('src/components/rounds/RachaScreen.tsx'))};
import { RankingScreen, PlayerStatisticsCard } from ${JSON.stringify(resolve('src/components/players/StatisticsViews.tsx'))};
import { ProfilePhoto } from ${JSON.stringify(resolve('src/components/players/ProfilePhoto.tsx'))};
const role=new URLSearchParams(location.search).get('role')==='jogador'?'jogador':'organizador';
const profile={id:role==='jogador'?${JSON.stringify(viewer)}:${JSON.stringify(organizer)},name:'Conta teste',email:null,active:true,role};
function App(){const [tab,setTab]=useState('racha');return <main className="mx-auto min-h-screen max-w-[430px] bg-zinc-100 p-4"><nav className="mb-4 flex gap-4">{['racha','times','ranking','perfil'].map(t=><button key={t} onClick={()=>setTab(t)}>{t}</button>)}</nav>{tab==='racha'?<RachaScreen profile={profile}/>:tab==='times'?<TeamsScreen profile={profile}/>:tab==='ranking'?<RankingScreen/>:<><PlayerStatisticsCard playerId={profile.id}/><ProfilePhoto profile={profile}/></>}</main>}
createRoot(document.getElementById('root')!).render(${process.argv.includes('--app') ? '<FortalakaApp profile={profile}/>' : '<App/>'});
`);
const navigation=join(output,'navigation.ts');
writeFileSync(navigation,`export function useRouter(){return {replace(){},refresh(){}};}`);
await build({entryPoints:[join(output,'main.tsx')],outfile:join(output,'app.js'),bundle:true,jsx:'automatic',define:{'process.env':'{}'},tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],plugins:[{name:'isolated-client',setup(b){b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:client}));b.onResolve({filter:/^next\/navigation$/},()=>({path:navigation}));}}]});
const chunks=resolve('.next/static/chunks');const css=readdirSync(chunks).find(n=>n.endsWith('.css'));
writeFileSync(join(output,'app.css'),readFileSync(join(chunks,css)));
writeFileSync(join(output,'index.html'),'<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Validação isolada</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const uploaded=new Map();let queue=Promise.resolve();
async function api(input){
 await db.exec('begin;set local role authenticated');
 try{
  const uid=input.role==='jogador'?viewer:organizer;await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);let data;
  if(input.kind==='user')data={id:uid};
  else if(input.kind==='rpc'){
   const specs={ler_avaliacoes_atual:['p_racha'],ler_progresso_avaliacoes:['p_racha'],alterar_avaliacoes_rodada:['p_racha','p_abertas'],salvar_avaliacao:['p_racha','p_avaliado','p_passe','p_chute','p_velocidade','p_defesa','p_fisico'],finalizar_rodada:['p_racha'],ler_estatisticas_jogadores:['p_jogador'],ler_partidas_rodada:['p_racha'],criar_partida:['p_racha','p_time_a','p_time_b'],salvar_partida:['p_partida','p_versao','p_placar_a','p_placar_b','p_status','p_jogadores'],ler_times_rodada:[],avatars_da_rodada:['p_racha'],alterar_estado_rodada:['p_racha','p_estado'],salvar_rascunho_times:['p_racha','p_versao','p_times'],confirmar_rascunho_times:['p_racha','p_versao']};
   const keys=specs[input.name];if(!keys)throw Error('RPC inválida');const values=keys.map(k=>['p_times','p_jogadores'].includes(k)?JSON.stringify(input.args[k]):input.args[k]);
   const rows=(await db.query('select * from public.'+input.name+'('+values.map((_,i)=>'$'+(i+1)).join(',')+')',values)).rows;
   data=['avatars_da_rodada','ler_estatisticas_jogadores'].includes(input.name)?rows:rows[0]?.[input.name];
  }else if(input.kind==='table'){
   const fields={profiles:['id','name','email','avatar_url','role','active'],rachas:['id','nome','data','estado','horario','endereco','versao','created_at'],racha_participantes:['id','racha_id','jogador_id','nome','tipo','status','created_at']};
   if(!fields[input.table])throw Error('Tabela inválida');const params=[];const clauses=(input.filters??[]).map(([k,v])=>{if(!fields[input.table].includes(k))throw Error('Campo inválido');params.push(v);return k+'=$'+params.length;});const where=clauses.length?' where '+clauses.join(' and '):'';
   let sql='select '+fields[input.table].join(',')+' from public.'+input.table+where;
   if(input.op==='insert'){const keys=Object.keys(input.value);if(keys.some(k=>!fields[input.table].includes(k)))throw Error('Campo inválido');sql='insert into public.'+input.table+'('+keys.join(',')+') values('+keys.map(k=>{params.push(input.value[k]);return '$'+params.length}).join(',')+') returning *';}
   if(input.op==='update'){const keys=Object.keys(input.value);if(keys.some(k=>!fields[input.table].includes(k)))throw Error('Campo inválido');sql='update public.'+input.table+' set '+keys.map(k=>{params.push(input.value[k]);return k+'=$'+params.length}).join(',')+where+' returning *';}
   if(input.op==='delete')sql='delete from public.'+input.table+where+' returning *';
   const rows=(await db.query(sql,params)).rows;data=input.single?(rows[0]??null):rows;
  }else if(input.kind==='upload'){
   const bytes=Buffer.from(input.base64,'base64');if(bytes.length>2097152||!['image/png','image/jpeg','image/webp'].includes(input.type))throw Error('Imagem inválida');
   await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)",[input.path]);uploaded.set(input.path,{bytes,type:input.type});data={path:input.path};
  }else if(input.kind==='remove'){for(const path of input.paths){await db.query('delete from storage.objects where name=$1',[path]);uploaded.delete(path);}data=[];}
  await db.exec('commit');return {data,error:null};
 }catch(error){await db.exec('rollback');return {data:null,error:{message:error.message,code:error.code}};}
}
createServer(async(req,res)=>{
 if(req.url==='/api'){
  const parts=[];for await(const chunk of req)parts.push(chunk);const input=JSON.parse(Buffer.concat(parts).toString());const job=queue.then(()=>api(input));queue=job.catch(()=>{});
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await job));return;
 }
 if(req.url==='/photo.png'){res.setHeader('Content-Type','image/png');res.end(photo);return;}
 if(req.url?.startsWith('/avatar/')){const image=uploaded.get(req.url.slice(8));if(image){res.setHeader('Content-Type',image.type);res.end(image.bytes);return;}}
 if(req.url?.endsWith('.png')){res.statusCode=404;res.end('missing');return;}
 const path=req.url?.split('?')[0];const file=path==='/app.js'?'app.js':path==='/app.css'?'app.css':'index.html';
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(join(output,file)));
}).listen(3011,'127.0.0.1',()=>console.log('Validação isolada: http://127.0.0.1:3011; dados apenas no PostgreSQL local.'));
