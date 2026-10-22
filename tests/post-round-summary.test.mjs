// node tests/post-round-summary.test.mjs <node_modules com esbuild e playwright>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dependencies = createRequire(resolve(process.argv[2], 'package.json'));
const { build } = dependencies('esbuild');
const { chromium } = dependencies('playwright');
const output = mkdtempSync(join(tmpdir(), 'fortalaka-artilharia-'));
const entry = join(output, 'entry.tsx');
const bundle = join(output, 'app.js');
const names = ['Gabriel Lobo', 'Igão', 'Jack', 'Paulo Henrique de Albuquerque', 'NicolasSobrenomeMuitoLongoSemEspacos', 'Fora do top', 'Último'];
writeFileSync(entry, `
import { createRoot } from 'react-dom/client';
import { PostRoundSummary } from ${JSON.stringify(resolve('src/components/results/PostRoundSummary.tsx'))};
const scenario = new URLSearchParams(location.search).get('scenario');
const names = ${JSON.stringify(names)};
const size = scenario === 'one' ? 1 : scenario === 'three' ? 3 : 7;
const jogadores = names.slice(0, size).map((nome, index) => ({ jogador_id: String(index), nome, avatar_url: null, time_id: 'a', participou: true, gols: scenario === 'zero' ? 0 : scenario === 'tie' ? 2 : Math.max(1, 5 - index), assistencias: 0 }));
const game = { id: 'finalizada', versao: 1, timeAId: 'a', timeBId: 'b', timeA: 'Time 1', timeB: 'Time 2', placarA: 2, placarB: 0, status: 'finalizada', createdAt: null, finalizadaAt: null, jogadores };
const excluded = ['aberta', 'cancelada'].map(status => ({ ...game, id: status, status, jogadores: [{ ...jogadores[0], jogador_id: status, nome: 'IGNORAR ' + status, gols: 99 }] }));
createRoot(document.getElementById('root')).render(<PostRoundSummary roundId="rodada-atual" date="2026-10-21" matches={[game, ...excluded]} />);
`);
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'browser', jsx: 'automatic', define: { 'process.env': '{}' }, tsconfig: resolve('tsconfig.json'), nodePaths: [resolve('node_modules')], plugins: [{ name: 'isolated-statistics', setup(builder) {
  builder.onResolve({ filter: /^@\/lib\/matches\/repository$/ }, () => ({ path: 'statistics', namespace: 'test' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export async function getPlayerStatistics() { return []; }' }));
} }] });
const chunks = resolve('.next/static/chunks');
const css = readdirSync(chunks).filter(name => name.endsWith('.css')).map(name => readFileSync(join(chunks, name), 'utf8')).join('\n');
const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body style="margin:0;background:#f4f4f5"><main id="root" style="max-width:430px;margin:auto;padding:16px"></main><script src="/app.js"></script></body></html>';
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/app.js' ? 'text/javascript' : request.url === '/app.css' ? 'text/css' : 'text/html; charset=utf-8');
  response.end(request.url === '/app.js' ? readFileSync(bundle) : request.url === '/app.css' ? css : html);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const width of [360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    const ranking = page.getByRole('region', { name: 'Artilharia do racha', exact: true });
    await ranking.waitFor();
    assert.equal(await ranking.locator('li').count(), 5);
    const rows = await ranking.locator('li').allTextContents();
    for (const [index, name] of names.slice(0, 5).entries()) assert(rows[index].includes(name));
    assert(rows[4].includes('1gol'));
    assert.equal(await ranking.locator('li > span.h-10').count(), 5, 'PlayerAvatar presente nas cinco linhas');
    assert.equal(await page.locator('body').evaluate(element => element.scrollWidth > innerWidth), false, `Overflow em ${width}px`);
    const geometry = await ranking.locator('li').evaluateAll(elements => elements.map(element => {
      const row = element.getBoundingClientRect();
      const name = element.children[2].getBoundingClientRect();
      const goals = element.lastElementChild.getBoundingClientRect();
      return { right: row.right, goalsRight: goals.right, overlap: name.right > goals.left, overflow: element.scrollWidth > element.clientWidth };
    }));
    assert(geometry.every(row => !row.overflow && !row.overlap), `Nomes e gols cabem em ${width}px`);
    assert(geometry.every(row => Math.abs(row.goalsRight - geometry[0].goalsRight) < 1), 'Gols alinhados');
    const shared = new URL(await page.getByRole('link', { name: 'COMPARTILHAR NO WHATSAPP', exact: true }).getAttribute('href')).searchParams.get('text');
    const section = shared.split('⚽ *ARTILHEIROS*\n')[1].split('\n\n')[0];
    assert.equal(section.split('\n').length, 5);
    for (const name of names.slice(0, 5)) assert(section.includes(name));
    assert(!shared.includes('IGNORAR'));
    await ranking.screenshot({ path: join(output, `artilharia-${width}.png`) });
  }
  for (const [scenario, size] of [['one', 1], ['three', 3], ['tie', 5]]) {
    await page.goto(`${base}/?scenario=${scenario}`);
    const ranking = page.getByRole('region', { name: 'Artilharia do racha', exact: true });
    await ranking.waitFor();
    assert.equal(await ranking.locator('li').count(), size);
    if (scenario === 'tie') assert.deepEqual(await ranking.locator('li > span:first-child').allTextContents(), Array(5).fill('1º'));
  }
  await page.goto(`${base}/?scenario=zero`);
  await page.getByRole('region', { name: 'Resumo pós-racha', exact: true }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Artilharia do racha', exact: true }).count(), 0);
  const emptyShare = new URL(await page.getByRole('link', { name: 'COMPARTILHAR NO WHATSAPP', exact: true }).getAttribute('href')).searchParams.get('text');
  assert(!emptyShare.includes('*ARTILHEIROS*'));
  assert.deepEqual(errors, []);
  console.log(`OK: artilharia mobile 360/375/390/430; 1/3/5 jogadores; empates; zero gols oculto; WhatsApp compartilhado. Capturas: ${output}`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
