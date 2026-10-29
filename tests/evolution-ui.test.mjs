// Somente dados fictícios e servidor local. --serve mantém a demonstração para MCPs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dependencies=createRequire(resolve(process.argv[2],'package.json'));
const {build}=dependencies('esbuild');
const {chromium}=dependencies('playwright');
const output=mkdtempSync(join(tmpdir(),'fortalaka-evolution-'));
const players=[
 {jogador_id:'a',nome:'Ana Albuquerque Sobrenome Muito Longo',jogos:25,gols:10,assistencias:25,vitorias:10,nota_geral_100:80,quantidade_avaliacoes:2,avatar_url:null},
 {jogador_id:'b',nome:'BrunoSobrenomeMuitoLongoSemEspacos',jogos:0,gols:0,assistencias:0,vitorias:0,nota_geral_100:null,quantidade_avaliacoes:0,avatar_url:null},
 ...Array.from({length:4},(_,i)=>({jogador_id:'p'+i,nome:'Jogador '+i,jogos:10,gols:6-i,assistencias:1,vitorias:2,nota_geral_100:70-i,quantidade_avaliacoes:2,avatar_url:null})),
];
const client=join(output,'client.ts');
writeFileSync(client,`
let notes=[{id:'n1',round_id:'round-local',title:'Times confirmados',body:'Confira os times da rodada.',destination:'teams',created_at:'2026-10-29T12:00:00Z',read_at:null},{id:'n2',round_id:null,title:'Nova conquista',body:'Primeiro gol registrado.',destination:'profile',created_at:'2026-10-29T11:00:00Z',read_at:null}];
if(location.pathname.includes('paginadas'))notes=Array.from({length:21},(_,i)=>({...notes[0],id:'n'+i,read_at:i<20?'2026-10-29T12:01:00Z':null}));
export function createClient(){return {from(table){let head=false,unread=false;const q={select(c,o){head=o?.head;return q},eq(){return q},is(){unread=true;return q},order(){return q},range(){return q},abortSignal(){return q},then(resolve){return Promise.resolve(location.pathname.includes('indisponivel')?{data:null,error:{message:'fixture unavailable'}}:{data:head?null:table==='notifications'?notes:[],count:unread?notes.filter(n=>!n.read_at).length:notes.length,error:null}).then(resolve)}};return q},rpc:async(name,args)=>{if(location.pathname.includes('parcial')&&name==='medias_jogador'&&args.p_jogador==='b')throw new Error('Falha sintética');if(name==='marcar_notificacoes_lidas'){notes=notes.map(n=>!args.p_ids||args.p_ids.includes(n.id)?{...n,read_at:new Date().toISOString()}:n);return {data:1,error:null};}return {data:[{quantidade:2,passe:8,chute:7,velocidade:9,defesa:6,fisico:8}],error:null};}};}
`);
const entry=join(output,'entry.tsx');
writeFileSync(entry,`
import {createRoot} from 'react-dom/client';import {useState} from 'react';import {PlayerComparison} from ${JSON.stringify(resolve('src/components/players/PlayerComparison.tsx'))};
import {PlayerAchievements} from ${JSON.stringify(resolve('src/components/players/PlayerAchievements.tsx'))};
import {VisualShareCard} from ${JSON.stringify(resolve('src/components/results/VisualShareCard.tsx'))};
import {rankingVisualCard} from ${JSON.stringify(resolve('src/lib/results/visual-card.ts'))};
import {NotificationCenter} from ${JSON.stringify(resolve('src/components/notifications/NotificationCenter.tsx'))};
import {NotificationBell} from ${JSON.stringify(resolve('src/components/notifications/NotificationBell.tsx'))};
const players=${JSON.stringify(players)};
function Cards(){const [revision,setRevision]=useState(0);return <><button onClick={()=>setRevision(n=>n+1)}>Atualizar dados idênticos</button><span hidden>{revision}</span><VisualShareCard cards={[{id:'ranking',label:'Ranking · Gols',data:rankingVisualCard(players,'gols','Gols')}]}/></>}
createRoot(document.getElementById('root')).render(<><p>Demonstração local · dados fictícios</p><NotificationBell />{location.pathname.startsWith('/notificacoes')?<NotificationCenter />:location.pathname==='/cards'?<Cards/>:location.pathname==='/conquistas'?<PlayerAchievements playerId="a" stats={players[0]}/>:<PlayerComparison viewerId="a" organizer={location.pathname.includes('parcial')} initialA="a" initialB="b"/>}</>);
`);
await build({entryPoints:[entry],outfile:join(output,'app.js'),bundle:true,jsx:'automatic',define:{'process.env':'{}'},tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@\/lib\/supabase\/client$/},()=>({path:client}));
 b.onResolve({filter:/^@\/lib\/matches\/repository$/},()=>({path:'stats',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function getPlayerStatistics(id){const rows=${JSON.stringify(players)};return id?rows.filter(p=>p.jogador_id===id):rows;}`}));
}}]});
const css=readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>readFileSync(join('.next/static/chunks',n),'utf8')).join('\n');
const server=createServer((request,response)=>{
 const path=new URL(request.url,'http://localhost').pathname;
 if(path==='/fortalaka-escudo.jpeg'){response.setHeader('Content-Type','image/jpeg');response.end(readFileSync('public/fortalaka-escudo.jpeg'));return;}
 response.setHeader('Content-Type',path==='/app.js'?'text/javascript':path==='/app.css'?'text/css':'text/html; charset=utf-8');
 response.end(path==='/app.js'?readFileSync(join(output,'app.js')):path==='/app.css'?css:'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><main id="root" style="max-width:640px;margin:auto;padding:20px"></main><script src="/app.js"></script></body></html>');
});
await new Promise(done=>server.listen(process.argv.includes('--serve')?3012:0,'127.0.0.1',done));
const url=`http://127.0.0.1:${server.address().port}`;
if(process.argv.includes('--serve'))console.log(`Demonstração isolada: ${url}`);
else {
 let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.getByLabel('Jogador A').selectOption('a');await page.getByLabel('Jogador B').selectOption('b');
  assert.equal(await page.getByLabel('Jogador B').locator('option[value="a"]').count(),0);
  assert.equal(await page.locator('dt').filter({hasText:/^Gols\/jogo$/}).locator('..').innerText(),'0,4\nGols/jogo\n--');
  await page.goto(url+'/comparacao-parcial');await page.getByRole('status').filter({hasText:/médias.*indisponíveis/i}).waitFor();assert.equal(await page.locator('dt').filter({hasText:'Passe /10'}).locator('..').innerText(),'8\nPasse /10\n--','Falha de B preserva a média válida de A');
  await page.goto(url+'/conquistas');await page.getByText('Primeiro gol',{exact:true}).waitFor();assert.equal(await page.getByRole('listitem').filter({hasText:'10 gols'}).count(),1);
  await page.goto(url+'/cards');await page.getByRole('button',{name:'Gerar preview'}).click();const image=page.getByAltText('Preview: RANKING');await image.waitFor();assert.deepEqual(await image.evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1080,1920]);
  await page.getByRole('button',{name:'Atualizar dados idênticos'}).click();assert.equal(await image.count(),1,'Revalidar dados idênticos preserva o preview');
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Salvar imagem'}).click();const file=await download;assert.equal(file.suggestedFilename(),'fortalaka-story.png');await file.saveAs(join(output,'story.png'));console.log('PNG verificado: '+join(output,'story.png'));
  await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));
  await page.getByRole('button',{name:'Compartilhar',exact:true}).click();await page.getByRole('status').filter({hasText:'Use Salvar imagem'}).waitFor();
  await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.sharedFile={name:data.files[0].name,size:data.files[0].size,type:data.files[0].type};}});});
  await page.getByRole('button',{name:'Compartilhar',exact:true}).click();await page.getByRole('status').filter({hasText:'Imagem compartilhada.'}).waitFor();assert.equal((await page.evaluate(()=>window.sharedFile)).type,'image/png');
  await page.goto(url+'/notificacoes');await page.getByRole('link',{name:'Notificações, 2 não lidas',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Ver times'}).getAttribute('href'),'/rodadas/round-local?destino=teams');
  await page.getByRole('button',{name:'Marcar como lida',exact:true}).first().click();await page.getByRole('status').filter({hasText:'Notificação lida.'}).waitFor();
  await page.getByRole('button',{name:'Marcar todas como lidas'}).click();await page.getByRole('status').filter({hasText:'Todas as notificações'}).waitFor();assert.equal(await page.getByRole('button',{name:'Marcar como lida',exact:true}).count(),0);
  await page.goto(url+'/notificacoes-indisponivel');await page.getByRole('alert').filter({hasText:'indisponível'}).waitFor();
  await page.goto(url+'/notificacoes-paginadas');await page.getByRole('button',{name:'Carregar mais avisos'}).waitFor();assert.equal(await page.getByRole('button',{name:'Marcar todas como lidas'}).isEnabled(),true,'Permite marcar aviso não lido fora da página carregada');
  for(const route of ['/','/conquistas','/cards','/notificacoes']){await page.goto(url+route);for(const [width,height] of [[360,800],[375,812],[390,844],[430,932],[1280,900]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} ${width}`);}}
  assert.deepEqual(errors,[]);console.log('OK: comparação, privacidade de atributos, conquistas e cinco larguras sem overflow.');
 }finally{await browser?.close();await new Promise(done=>server.close(done));}
}
