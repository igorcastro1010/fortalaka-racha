// UI real + RPCs reais em PostgreSQL local. Sem credenciais ou escrita remota.
// node tests/public-profile-ui.test.mjs <node_modules com playwright/esbuild/PGlite>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const { chromium } = createRequire(resolve(process.argv[2], 'package.json'))('playwright');
const fixture = spawn(process.execPath, ['tests/preview-sorteio.mjs', process.argv[2], process.argv[2], '--app'], { stdio: ['ignore', 'pipe', 'inherit'] });
const output = mkdtempSync(join(tmpdir(), 'fortalaka-public-profile-'));
let browser;
try {
  await new Promise((done, fail) => {
    fixture.stdout.on('data', chunk => { if (chunk.toString().includes('Validação isolada:')) done(); });
    fixture.once('exit', code => fail(Error(`Fixture saiu: ${code}`)));
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [], calls = [], network = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().endsWith('/api')) calls.push(JSON.parse(r.postData())); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/missing.png')) network.push(r.url()); });
  page.on('dialog', d => d.accept());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Runtime.enable'); await cdp.send('Performance.enable');
  async function api(body) { const { data, error } = await fetch('http://127.0.0.1:3011/api', { method: 'POST', body: JSON.stringify({ role: 'jogador', ...body }) }).then(r => r.json()); assert.equal(error, null); return data; }
  const ownId = (await api({ kind: 'user' })).id;
  const all = await api({ kind: 'rpc', name: 'ler_estatisticas_jogadores', args: { p_jogador: null } });
  const other = all.find(p => p.jogador_id !== ownId && !p.avatar_url);
  const profile = () => page.getByRole('region', { name: 'Perfil público do jogador', exact: true });
  async function nav(name) { await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name, exact: true }).click(); }
  async function tab(name) { await page.getByRole('tab', { name, exact: true }).click(); }
  async function ready() { await profile().getByRole('heading', { name: 'Ficha do atleta' }).waitFor(); await profile().locator('[aria-label="Estatísticas públicas"]').waitFor(); await page.evaluate(() => document.fonts.ready); }
  async function check(name) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name);
    assert.equal(await profile().getByRole('button', { name: 'Sair da conta' }).count(), 0);
    assert.equal(await profile().getByText(/@|organizador|avaliador_id|auth id|ALTERAR FOTO/i).count(), 0);
    assert.equal(await profile().locator('img').evaluateAll(imgs => imgs.some(i => i.complete && !i.naturalWidth)), false);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  }
  for (const [width, height] of [[360,800],[375,812],[390,844],[430,932]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:3011/?role=jogador');
    await nav('Resultados'); await tab('Ranking');
    await page.getByRole('button', { name: 'Assistências', exact: true }).click();
    const ranking = page.getByRole('region', { name: 'Ranking dos jogadores' });
    const target = ranking.locator(`a[href="/perfil/${other.jogador_id}"]`);
    await target.scrollIntoViewIfNeeded(); const scroll = await page.evaluate(() => scrollY); const before = calls.length;
    await target.click(); await ready();
    assert.equal(new URL(page.url()).pathname, `/perfil/${other.jogador_id}`);
    const reads = calls.slice(before);
    assert.equal(reads.filter(c => c.name === 'ler_estatisticas_jogadores').length, 1);
    assert.equal(reads.filter(c => c.name === 'medias_jogador').length, 0, 'Jogador comum não consulta médias restritas de terceiros');
    assert.equal(reads.some(c => c.kind === 'table'), false, 'Não lê profiles nem votos individuais');
    await check(`ranking-${width}`);
    await profile().getByRole('button', { name: 'Voltar', exact: true }).click();
    await ranking.waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('button', { name: 'Assistências', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(60); assert(Math.abs(await page.evaluate(() => scrollY) - scroll) < 5, 'Scroll preservado');
    assert.equal(await target.evaluate(e => e === document.activeElement), true, 'Foco restaurado');
    await target.click(); await ready(); await page.goBack(); await ranking.waitFor({ state: 'visible' });
    await nav('Racha'); const list = page.getByRole('link', { name: /^Ver perfil de / }).first(); await list.click(); await ready(); await check(`racha-${width}`); await profile().getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('heading', { name: 'Racha', exact: true }).waitFor();
    await page.goto(`http://127.0.0.1:3011/perfil/${ownId}?role=jogador`); await ready(); await check(`proprio-${width}`);
    assert.equal(await profile().getByText('Ainda sem avaliações. Suas médias aparecerão aqui.').count(), 1);
    await profile().getByRole('button', { name: 'Voltar', exact: true }).click(); await page.getByRole('button', { name: 'Ver racha', exact: true }).waitFor();
    await page.goto('http://127.0.0.1:3011/perfil/00000000-0000-0000-0000-000000000000?role=jogador');
    await profile().getByText('Jogador não encontrado.', { exact: true }).waitFor(); await page.screenshot({ path: join(output, `inexistente-${width}.png`) });
  }
  await page.goto('http://127.0.0.1:3011/?role=organizador'); await nav('Racha'); await tab('Gestão'); await page.getByRole('button', { name: 'Fechar lista' }).click(); await page.getByRole('button', { name: 'Reabrir lista' }).waitFor();
  await nav('Times'); await tab('Ajustes'); await page.getByRole('button', { name: 'Sortear times', exact: true }).click(); await page.getByRole('button', { name: 'Ajustar times', exact: true }).click();
  assert.equal(await page.locator('div.order-10 a[href^="/perfil/"]').count(), 0, 'Modo de troca não deve abrir perfil');
  await page.getByRole('button', { name: 'Concluir ajuste', exact: true }).click(); await page.getByRole('button', { name: 'Confirmar times', exact: true }).click(); await page.getByText('Times confirmados com sucesso.').waitFor();
  await page.goto('http://127.0.0.1:3011/?role=jogador'); await nav('Times'); await page.getByRole('link', { name: /^Ver perfil de / }).first().click(); await ready(); await check('times-jogador');
  await profile().getByRole('button', { name: 'Voltar', exact: true }).click(); await page.getByRole('heading', { name: 'Times', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Abrir meu perfil' }).click(); await page.getByRole('button', { name: 'Sair da conta' }).waitFor();
  await page.goto('http://127.0.0.1:3011/?role=organizador'); await nav('Resultados');
  await page.getByRole('button', { name: 'INICIAR PRIMEIRA PARTIDA' }).click();
  await page.getByRole('button', { name: 'Aumentar placar de Time 1' }).click();
  await page.getByText('Gols · 0 registrados', { exact: true }).click();
  await page.getByRole('button', { name: /^Adicionar gols de / }).first().click();
  await page.getByRole('button', { name: 'Finalizar partida', exact: true }).click();
  await page.getByRole('dialog', { name: 'Finalizar partida?' }).getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByText('Vencedor: Time 1', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Ao vivo', exact: true }).click();
  await page.getByRole('button', { name: 'INICIAR PRÓXIMA PARTIDA', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar partida', exact: true }).click();
  const cancellations = calls.filter(call => call.name === 'salvar_partida' && call.args?.p_status === 'cancelada').length;
  await page.getByRole('dialog', { name: 'Cancelar partida?' }).getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(calls.filter(call => call.name === 'salvar_partida' && call.args?.p_status === 'cancelada').length, cancellations);
  await page.getByRole('button', { name: 'Cancelar partida', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByText('Cancelada', { exact: true }).waitFor();
  assert.equal(calls.filter(call => call.name === 'salvar_partida' && call.args?.p_status === 'cancelada').length, cancellations + 1);
  await nav('Racha'); await tab('Gestão'); await page.getByRole('button', { name: 'FINALIZAR RACHA', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'FINALIZAR', exact: true }).click();
  await page.getByText('Rodada finalizada. As avaliações poderão ser abertas.').waitFor();
  await nav('Avaliação'); await page.getByText('Gerenciar avaliações', { exact: true }).click();
  await page.getByRole('button', { name: 'ABRIR AVALIAÇÕES', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByText('Avaliacoes abertas.', { exact: true }).waitFor();
  await nav('Resultados');
  await page.getByRole('region', { name: 'Artilharia do racha', exact: true }).getByRole('link').first().click(); await ready(); await check('resumo');
  await profile().getByRole('button', { name: 'Voltar', exact: true }).click(); await tab('Histórico');
  await page.getByText('Participantes e eventos', { exact: true }).first().click();
  await page.locator('article details').getByRole('link').first().click(); await ready(); await check('historico');
  await page.goto('http://127.0.0.1:3011/?role=jogador'); await nav('Avaliação');
  await page.getByRole('button', { name: /^Avaliar / }).first().click();
  await page.getByRole('button', { name: 'Passe: 5 de 5', exact: true }).click();
  const form = page.locator('div[aria-label^="Avaliação de "]');
  await form.getByRole('link').click(); await ready(); await check('avaliacao');
  await profile().getByRole('button', { name: 'Voltar', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Passe: 5 de 5', exact: true }).getAttribute('aria-pressed'), 'true', 'Perfil não descarta rascunho da avaliação');
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
  console.log(`OK: Ranking/Racha/Times, voltar, filtro/scroll/foco, proprio, sem dados, inexistente, privacidade; quatro viewports; CDP sem excecoes. Capturas: ${output}`);
} finally { await browser?.close(); fixture.kill(); }
