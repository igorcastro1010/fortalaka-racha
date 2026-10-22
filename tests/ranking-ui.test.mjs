// node tests/ranking-ui.test.mjs <node_modules com esbuild e playwright>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dependencies=createRequire(resolve(process.argv[2],'package.json'));
const { build }=dependencies('esbuild');
const { chromium }=dependencies('playwright');
const output=mkdtempSync(join(tmpdir(),'fortalaka-ranking-'));
const entry=join(output,'entry.tsx');
const bundle=join(output,'app.js');
const rows=[
  {jogador_id:'a',nome:'Zeca',nota_geral_100:80,gols:2,assistencias:1,vitorias:4,jogos:5},
  {jogador_id:'b',nome:'Ana Albuquerque Sobrenome Muito Longo',nota_geral_100:90,gols:1,assistencias:4,vitorias:1,jogos:8},
  {jogador_id:'c',nome:'BrunoSobrenomeMuitoLongoSemEspacos',nota_geral_100:90,gols:6,assistencias:0,vitorias:3,jogos:2},
  {jogador_id:'d',nome:'Diego',nota_geral_100:null,gols:0,assistencias:2,vitorias:0,jogos:0},
  {jogador_id:'e',nome:'Eva',nota_geral_100:70,gols:6,assistencias:2,vitorias:5,jogos:4},
  {jogador_id:'f',nome:'Fabio',nota_geral_100:null,gols:0,assistencias:0,vitorias:0,jogos:1},
].map(row=>({...row,avatar_url:null,quantidade_avaliacoes:row.nota_geral_100==null?0:2}));
writeFileSync(entry,`
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RankingScreen } from ${JSON.stringify(resolve('src/components/players/StatisticsViews.tsx'))};
function App(){const [sort,setSort]=useState('geral');return <RankingScreen sort={sort} onSortChange={setSort} />;}
createRoot(document.getElementById('root')).render(<App />);
`);
await build({entryPoints:[entry],outfile:bundle,bundle:true,platform:'browser',jsx:'automatic',define:{'process.env':'{}'},tsconfig:resolve('tsconfig.json'),nodePaths:[resolve('node_modules')],plugins:[{name:'isolated-statistics',setup(builder){
  builder.onResolve({filter:/^@\/lib\/matches\/repository$/},()=>({path:'statistics',namespace:'test'}));
  builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"export async function getPlayerStatistics(){return fetch('/stats').then(response=>response.json());}"}));
}}]});
const chunks=resolve('.next/static/chunks');
const css=readdirSync(chunks).filter(name=>name.endsWith('.css')).map(name=>readFileSync(join(chunks,name),'utf8')).join('\n');
let requests=0;
const server=createServer((request,response)=>{
  if(request.url==='/stats'){requests++;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(rows));return;}
  response.setHeader('Content-Type',request.url==='/app.js'?'text/javascript':request.url==='/app.css'?'text/css':'text/html; charset=utf-8');
  response.end(request.url==='/app.js'?readFileSync(bundle):request.url==='/app.css'?css:'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body style="margin:0;background:#f4f4f5"><main id="root" style="max-width:430px;margin:auto;padding:16px"></main><script src="/app.js"></script></body></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  const errors=[];const network=[];
  const devtools=await page.context().newCDPSession(page);
  await devtools.send('Runtime.enable');await devtools.send('Network.enable');await devtools.send('Log.enable');
  devtools.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails.text));
  devtools.on('Log.entryAdded',event=>{if(event.entry.level==='error')errors.push(event.entry.text);});
  devtools.on('Network.responseReceived',event=>{if(event.response.url.endsWith('/stats'))network.push(event.response.status);});
  for(const width of [360,375,390,430]){
    await page.setViewportSize({width,height:900});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('article').first().waitFor();
    const filters=page.getByRole('group',{name:'Ordenação do ranking'});
    assert.equal(await filters.getByRole('button',{name:'Geral',exact:true}).getAttribute('aria-pressed'),'true');
    const before=requests;
    const expected=[['Geral','bcaedf'],['Nota','bcaedf'],['Gols','ceabdf'],['Assistências','bedacf'],['Vitórias','eacbdf'],['Jogos','baecfd'],['Geral','bcaedf']];
    for(const [label,order] of expected){
      const chip=filters.getByRole('button',{name:label,exact:true});await chip.click();
      assert.equal(await chip.getAttribute('aria-pressed'),'true');
      const names=await page.locator('article h3').allTextContents();
      assert.deepEqual(names,[...order].map(id=>rows.find(row=>row.jogador_id===id).nome));
      assert.deepEqual(await page.locator('article [aria-label*="Top 3"]').allTextContents(),['1º','2º','3º']);
      if(label==='Gols')assert.equal(await page.locator('article').first().getByLabel('6 gols',{exact:true}).count(),1);
      if(label==='Nota')assert.equal(await page.locator('article').last().getByLabel('Nota media ainda nao disponivel').count(),1);
      assert.equal(await page.locator('body').evaluate(element=>element.scrollWidth>innerWidth),false,`Overflow em ${width}px`);
      assert.equal(await chip.evaluate(element=>element.getBoundingClientRect().height>=44),true);
      assert.equal(await page.locator('article > div:first-child').evaluateAll(elements=>elements.some(element=>{
        const bounds=element.getBoundingClientRect();const name=element.querySelector('h3').getBoundingClientRect();const metric=element.lastElementChild.getBoundingClientRect();
        return name.right>metric.left || metric.right>bounds.right+1 || element.scrollWidth>element.clientWidth;
      })),false,'Nome, posição e estatística devem caber sem sobreposição');
    }
    assert.equal(requests,before,'Filtros não devem disparar requisições');
    await page.keyboard.press('Tab');
    assert(await page.locator(':focus-visible').count()>0,'Foco visível por teclado');
    await filters.getByRole('button',{name:'Jogos',exact:true}).click();
    assert(await filters.evaluate(element=>element.scrollLeft>0),'Scroll horizontal dos filtros funciona');
    assert.equal(await page.locator('article').evaluateAll(elements=>elements.some(element=>element.scrollWidth>element.clientWidth)),false);
    await filters.getByRole('button',{name:'Gols',exact:true}).click();
    await page.screenshot({path:join(output,`ranking-${width}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);assert(network.length>=4 && network.every(status=>status===200));
  console.log(`OK: seis filtros, empates, zero/sem nota, Top 3, sem requests extras; 360/375/390/430px; console e rede CDP OK. Capturas: ${output}`);
} finally {await browser?.close();await new Promise(done=>server.close(done));}
