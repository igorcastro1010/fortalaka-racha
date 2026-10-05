// Prévia isolada para verificação visual. Somente fixtures locais, sem Supabase.
// node tests/preview-sorteio.mjs <diretório node_modules com esbuild>
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
const require = createRequire(resolve(process.argv[2], 'package.json'));
const { build } = require('esbuild');
const output = mkdtempSync(join(tmpdir(), 'fortalaka-preview-'));
const mock = join(output, 'repository.ts');
writeFileSync(mock, `
const query = new URLSearchParams(location.search);
const count = Number(query.get('count') ?? 20);
const player = query.get('role') === 'jogador';
let confirmed = query.get('confirmed') === '1';
let version = 1;
let participants = [
  ...Array.from({length:count}, (_, i) => ({id:'p'+i,name:'Linha '+(i+1),tipo:'linha',status:'presente'})),
  {id:'g1',name:'Gabriel Sol',tipo:'goleiro_fixo',status:'presente'},
  {id:'g2',name:'Kauan Gustavo',tipo:'goleiro_fixo',status:'presente'},
  {id:'s1',name:'Suplente teste',tipo:'suplente',status:'presente'},
  {id:'a1',name:'Ausente teste',tipo:'linha',status:'ausente'},
  {id:'r1',name:'Removido teste',tipo:'linha',status:'removido'},
];
let teams = confirmed ? Array.from({length:4}, (_, i)=>({numero:i+1,nome:'Time '+(i+1),cor:null,jogadores:participants.slice(i*5,i*5+5).map(p=>p.id)})) : [];
function round() { return {id:'round1',nome:'Rodada de teste isolada',data:'2026-10-08',versao:version,confirmado:confirmed}; }
export async function listRounds() {return [round()];}
export async function loadRound() {return {rodada:round(),participantes:structuredClone(participants),times:structuredClone(teams)};}
export async function createRound() {if(player) throw Error('Não autorizado');return 'round1';}
export async function saveParticipants(r, p) {if(player) throw Error('Não autorizado');participants=structuredClone(p);version++;confirmed=false;teams=[];}
export async function confirmTeams(r, t) {if(player) throw Error('Não autorizado');teams=structuredClone(t);version++;confirmed=true;}
`);
writeFileSync(join(output, 'main.tsx'), `
import { createRoot } from 'react-dom/client';
import { TeamsScreen } from ${JSON.stringify(resolve('src/components/teams/TeamsScreen.tsx'))};
const role = new URLSearchParams(location.search).get('role') === 'jogador' ? 'jogador' : 'organizador';
createRoot(document.getElementById('root')!).render(<main className="mx-auto min-h-screen max-w-[430px] bg-zinc-100 p-4"><TeamsScreen profile={{id:'test',name:'Teste',email:null,role,active:true}} /></main>);
`);
await build({entryPoints:[join(output,'main.tsx')],outfile:join(output,'app.js'),bundle:true,jsx:'automatic',
  tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],plugins:[{
    name:'isolated-repository',setup(build) {build.onResolve({filter:/^@\/lib\/teams\/repository$/},()=>({path:mock}));}
  }]});
const chunks = resolve('.next/static/chunks');
const css = readdirSync(chunks).find(name => name.endsWith('.css'));
writeFileSync(join(output,'app.css'),css ? readFileSync(join(chunks,css)) : '');
writeFileSync(join(output,'index.html'), '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teste isolado — Sorteio</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
createServer((req,res)=>{
  const path = req.url?.split('?')[0];
  const file = path === '/app.js' ? 'app.js' : path === '/app.css' ? 'app.css' : 'index.html';
  res.setHeader('Content-Type',file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(readFileSync(join(output,file)));
}).listen(3011, '127.0.0.1',()=>console.log('Prévia isolada: http://127.0.0.1:3011 (não acessa Supabase)'));
