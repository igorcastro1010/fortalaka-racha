import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
const {PGlite}=createRequire(resolve(process.argv[2],'package.json'))('@electric-sql/pglite');
const db=new PGlite();const tables=['rachas','racha_participantes','times','time_jogadores','partidas','partida_jogadores','eventos_partida','fila_times'];
try{
 for(const table of [...tables,'profiles','avaliacoes','notificacoes'])await db.exec(`create table public.${table}(id int primary key, valor text);alter table public.${table} enable row level security;insert into public.${table} values(1,'preservado');`);
 const sql=readFileSync('supabase/realtime-operacao.sql','utf8');await db.exec(sql);await db.exec(sql);
 const rows=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows;
 assert.deepEqual(rows.map(r=>r.tablename),[...tables].sort());
 for(const table of [...tables,'profiles','avaliacoes','notificacoes'])assert.equal((await db.query(`select valor from public.${table}`)).rows[0].valor,'preservado');
 await db.exec('alter table public.partidas disable row level security;');
 await assert.rejects(()=>db.exec(sql),/RLS precisa estar habilitada/);await db.exec('rollback;');
 assert.equal((await db.query('select count(*)::int as total from pg_policies')).rows[0].total,0);
 console.log('OK: publicação idempotente, oito tabelas, RLS obrigatória, dados preservados, sem perfis/notas/notificações nem policies novas.');
}finally{await db.close();}
