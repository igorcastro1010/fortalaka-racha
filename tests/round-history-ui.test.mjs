// node tests/round-history-ui.test.mjs <deps com playwright/esbuild/PGlite>
// PostgreSQL local, RLS real, sem credenciais ou escritas remotas.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(resolve(process.argv[2], 'package.json'))('playwright');
const fixture = process.argv.includes('--running') ? null : spawn(process.execPath, ['tests/preview-sorteio.mjs', process.argv[2], process.argv[2], '--app', '--history'], { stdio: ['ignore', 'pipe', 'inherit'] });
const output = mkdtempSync(join(tmpdir(), 'fortalaka-history-'));
let browser;
try {
  if (fixture) await new Promise((done, fail) => { fixture.stdout.on('data', chunk => { if (chunk.toString().includes('Validação isolada:')) done(); }); fixture.once('exit', code => fail(Error(`Fixture saiu: ${code}`))); });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const calls = [], errors = [], network = [], logs = [];
  page.on('request', request => { if (request.url().endsWith('/api')) calls.push(JSON.parse(request.postData())); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['warning','error'].includes(message.type()) && !message.text().includes('private fixture error') && !message.location().url?.endsWith('/missing.png')) logs.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/missing.png')) network.push(response.status()); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Runtime.enable'); await cdp.send('Performance.enable');
  let mode = 'empty';
  await page.route('**/api', async route => {
    const body = JSON.parse(route.request().postData());
    const list = body.table === 'rachas' && body.columns?.includes('partidas(');
    const detail = body.table === 'rachas' && body.single && body.filters?.some(([key]) => key === 'id');
    if (list && mode === 'empty') return route.fulfill({ json: { data: [], error: null } });
    if (list && mode === 'single') { const response = await route.fetch(); const body = await response.json(); return route.fulfill({ json: { ...body, data: body.data.slice(0, 1) } }); }
    if ((list && mode === 'error') || (detail && mode === 'detailError')) return route.fulfill({ json: { data: null, error: { message: 'private fixture error' } } });
    return route.continue();
  });
  const history = () => page.getByRole('region', { name: 'Histórico de Rodadas', exact: true });
  const nav = name => page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name, exact: true }).click();
  async function enter() { await page.goto('http://127.0.0.1:3011/?role=jogador'); await nav('Resultados'); await page.getByRole('tab', { name: 'Histórico', exact: true }).click(); }
  async function check(name) {
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name);
    assert.equal(await history().locator('img').evaluateAll(images => images.some(image => image.complete && !image.naturalWidth)), false, name);
    const small = await history().locator('button, a, summary').evaluateAll(elements => elements.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').filter(e => e.getBoundingClientRect().height < 43).map(e => e.textContent));
    assert.deepEqual(small, [], `${name}: touch targets`);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  }
  await enter(); await history().getByText('Nenhuma rodada finalizada ainda.', { exact: true }).waitFor(); await check('empty');
  mode = 'single'; await enter(); await history().locator('ol > li').first().waitFor(); assert.equal(await history().locator('ol > li').count(), 1); assert.equal(await history().getByRole('button', { name: 'Carregar mais' }).count(), 0); await check('single');
  mode = 'error'; await enter(); await history().getByRole('alert').waitFor(); assert(!(await history().textContent()).includes('private fixture error'));
  mode = null; const beforeList = calls.length; await history().getByRole('button', { name: 'Tentar novamente' }).click();
  await history().locator('ol > li').nth(7).waitFor();
  assert.equal(calls.slice(beforeList).filter(call => call.name === 'ler_partidas_rodada').length, 0, 'List does not read individual details');
  assert.equal(calls.slice(beforeList).filter(call => call.table === 'rachas').length, 1, 'One request per page, no N+1');
  assert.match(await history().locator('ol > li').first().textContent(), /25 de set/);
  assert.match(await history().locator('ol > li').first().textContent(), /3 participantes · 1 partida · 3 gols/);
  const beforeMore = calls.length;
  await history().getByRole('button', { name: 'Carregar mais', exact: true }).evaluate(button => { button.click(); button.click(); }); await history().locator('ol > li').nth(9).waitFor();
  assert.equal(calls.slice(beforeMore).filter(call => call.table === 'rachas').length, 1, 'Double click does not duplicate pagination requests');
  assert.deepEqual(calls.slice(beforeMore).find(call => call.table === 'rachas').range, [8,16]);
  assert.equal(await history().locator('ol > li').count(), 10, 'Only finalized rounds, excluding current/open and in-progress');
  assert.equal(await history().getByRole('button', { name: 'Carregar mais' }).count(), 0);
  const rows = await history().locator('ol > li').allTextContents(); assert.match(rows.at(-1), /16 de set/);
  mode = 'detailError'; await history().locator('ol > li button').first().click(); await history().getByRole('alert').waitFor();
  assert(!(await history().textContent()).includes('private fixture error'));
  mode = null; await history().getByRole('button', { name: 'Tentar novamente' }).click();
  await history().getByRole('heading', { name: 'Times da rodada', exact: true }).waitFor();
  assert.match(await history().textContent(), /Rodada histórica 1/);
  assert.equal(await history().getByRole('region', { name: 'Maiores notas' }).count(), 0, 'Never label historical overall as round ratings');
  assert.equal(calls.filter(call => call.table === 'avaliacoes' || call.name === 'medias_jogador').length, 0, 'No individual votes or restricted averages');
  const goals = history().getByRole('region', { name: 'Artilharia do racha', exact: true });
  assert.match(await goals.textContent(), /1gol/);
  const share = history().getByRole('link', { name: 'COMPARTILHAR NO WHATSAPP', exact: true });
  const text = new URL(await share.getAttribute('href')).searchParams.get('text');
  assert(text.includes('25/09/2026') && text.includes('Time 1 2 x 1 Time 2') && text.includes('1 gol'));
  assert(!text.includes('99'), 'Cancelled matches never contribute');
  await history().getByRole('button', { name: 'Voltar ao histórico' }).click();
  for (const [width, height] of [[360,800],[375,812],[390,844],[430,932]]) {
    await page.setViewportSize({ width, height }); await check(`list-${width}`);
    const row = history().locator('ol > li button').nth(1); await row.scrollIntoViewIfNeeded(); const scroll = await page.evaluate(() => scrollY);
    const before = calls.length; await row.click(); await history().getByRole('heading', { name: 'Times da rodada', exact: true }).waitFor();
    assert.match(await goals.textContent(), /2gols/, 'Selected round only, not historical total');
    await check(`detail-${width}`);
    await history().getByText(/^Time 1 ·/).click(); await history().getByText(/^VER PARTICIPANTES/).click(); await check(`teams-players-${width}`);
    assert.equal(await history().getByRole('button', { name: /Sortear|Confirmar time|Salvar|Editar resultado/ }).count(), 0, 'Historical view is read-only');
    const detailCalls = calls.slice(before);
    if (width === 360) assert.equal(detailCalls.filter(call => call.name === 'ler_partidas_rodada').length, 1);
    else assert.equal(detailCalls.filter(call => call.name === 'ler_partidas_rodada').length, 0, 'Reopening same round reuses detail cache');
    const link = history().getByRole('link', { name: /^Ver perfil de / }).first(); await link.click();
    await page.getByRole('region', { name: 'Perfil público do jogador', exact: true }).getByRole('heading', { name: 'Ficha do atleta' }).waitFor();
    await page.getByRole('region', { name: 'Perfil público do jogador', exact: true }).getByRole('button', { name: 'Voltar', exact: true }).click();
    await history().getByRole('heading', { name: 'Times da rodada', exact: true }).waitFor();
    await history().getByRole('button', { name: 'Voltar ao histórico' }).click();
    await page.waitForTimeout(50); assert(Math.abs(await page.evaluate(() => scrollY) - scroll) < 5, 'Scroll restored');
    assert.equal(await row.evaluate(e => e === document.activeElement), true, 'Focus restored');
  }
  await page.goto('http://127.0.0.1:3011/?role=organizador'); await nav('Resultados'); await page.getByRole('tab', { name: 'Histórico', exact: true }).click();
  await history().locator('ol > li button').first().click(); await history().getByRole('heading', { name: 'Times da rodada' }).waitFor();
  assert.equal(await history().getByRole('button', { name: /Sortear|Confirmar time|Salvar|Editar resultado/ }).count(), 0, 'Organizers also get a read-only historical detail');
  assert.deepEqual(errors, []); assert.deepEqual(network, []); assert.deepEqual(logs, []);
  console.log(`PASS history: empty/error/retry, 10 finalized rounds, pagination, stable dates, isolated metrics/events/teams, profile/back/scroll/focus, WhatsApp, RLS, no N+1 or duplicate detail reads; four mobile widths, CDP. Evidence: ${output}`);
} finally { await browser?.close(); fixture?.kill(); }
