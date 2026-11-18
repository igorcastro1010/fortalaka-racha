// Medições locais reais de rede da UI + PostgreSQL isolado. Não são métricas
// de produção, nem de aparelho físico. --minute mede uma janela real de 60 s.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const deps=process.argv[2],{chromium}=createRequire(resolve(deps,'package.json'))('playwright');
const fixture=spawn(process.execPath,['tests/preview-sorteio.mjs',deps,deps,'--app','--payments'],{stdio:['ignore','pipe','inherit']});
let browser;
try {
  await new Promise((done,fail)=>{fixture.stdout.on('data',c=>{if(String(c).includes('Validação isolada:'))done()});fixture.once('error',fail);fixture.once('exit',c=>fail(Error('Fixture saiu: '+c)));});
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
  const calls=[],errors=[];page.on('request',r=>{if(r.url().endsWith('/api'))calls.push(r.postDataJSON())});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${process.env.FORTALAKA_TEST_PORT || 3011}/`);
  const nav=name=>page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name,exact:true}).click();
  await page.getByRole('region',{name:'Painel do Organizador'}).getByText('Próxima ação',{exact:true}).waitFor();
  await page.waitForTimeout(800);
  await nav('Racha');await page.getByRole('tab',{name:'Gestão',exact:true}).waitFor();await page.waitForTimeout(500);
  const before=calls.length;
  await nav('Início');await page.getByRole('region',{name:'Painel do Organizador'}).waitFor();await page.waitForTimeout(500);
  const returnReads=calls.slice(before).filter(c=>c.table==='rachas'||['ler_partidas_rodada','ler_times_rodada','avatars_da_rodada'].includes(c.name));
  assert.equal(returnReads.length,0,'Voltar à Home dentro do TTL não refaz leituras válidas');
  await page.getByRole('button',{name:'Abrir meu perfil',exact:true}).click();await page.getByRole('heading',{name:'Meu perfil',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Estatisticas reais',exact:true}).waitFor();await page.waitForTimeout(700);
  await page.getByRole('button',{name:'Evolução, histórico e conquistas'}).click();
  await page.getByText('Evolução ainda indisponível').waitFor();
  await nav('Início');await page.waitForTimeout(700);const start=calls.length;
  const duration=process.argv.includes('--minute')?60000:6100;
  const at=performance.now();await page.waitForTimeout(duration);const elapsed=performance.now()-at;
  const idle=calls.slice(start),counts={};for(const call of idle){const name=call.name??call.table??call.kind;counts[name]=(counts[name]??0)+1;}
  assert.equal(idle.filter(c=>c.table==='profiles'||c.name==='medias_jogador'||c.name==='ler_estatisticas_jogadores').length,0,'Perfil oculto não consulta foto, médias nem estatísticas');
  assert.equal(idle.filter(c=>c.name==='ler_evolucao_jogador').length,0,'Painel V1.2 aberto antes de ocultar nao continua consultando');
  assert.equal(idle.filter(c=>c.name==='ler_partidas_rodada').length,0,'Realtime saudável não faz polling de partidas');
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('navigation').length),1,'Abas sem recarga de documento');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({scenario:'organizador, 390x844, Home ociosa, Realtime local saudável',elapsedMs:Math.round(elapsed),requests:idle.length,counts,returnHomeReads:returnReads.length,hiddenProfileReads:0},null,2));
} finally {await browser?.close();fixture.kill();}
