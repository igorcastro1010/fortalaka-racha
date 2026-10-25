// Componentes reais com PostgreSQL local; nunca escreve em produção.
// node tests/visual-remodel.test.mjs <node_modules com esbuild, PGlite, playwright> [URL auth local]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const { chromium } = createRequire(resolve(process.argv[2], 'package.json'))('playwright');
const fixture = spawn(process.execPath, ['tests/preview-sorteio.mjs', process.argv[2], process.argv[2], '--app'], { stdio: ['ignore', 'pipe', 'inherit'] });
const output = mkdtempSync(join(tmpdir(), 'fortalaka-remodel-'));
const results = [];
let browser;
try {
  await new Promise((done, fail) => {
    fixture.stdout.on('data', chunk => { if (chunk.toString().includes('Validação isolada:')) done(); });
    fixture.once('exit', code => fail(Error(`Fixture encerrou: ${code}`)));
    fixture.once('error', fail);
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  const failed = [];
  const consoleMessages = [];
  const apiCalls = [];
  let requests = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (['error','warning'].includes(m.type()) && !m.location().url?.endsWith('/missing.png')) consoleMessages.push({ type: m.type(), text: m.text(), url: m.location().url }); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/missing.png')) failed.push(`${r.status()} ${r.url()}`); });
  page.on('request', r => { if (r.url().endsWith('/api')) { requests++; apiCalls.push(JSON.parse(r.postData())); } });
  page.on('dialog', d => d.accept());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  async function nav(name) {
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(120);
  }
  async function tab(name) { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(80); }
  async function shot(name) {
    await page.locator('[role="status"][aria-label^="Carregando"]:visible').waitFor({ state: 'hidden' }).catch(() => {});
    await page.waitForTimeout(70);
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, broken: [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.src), bad: [...document.querySelectorAll('button, input, select, summary')].filter(e => e.getClientRects().length && !e.disabled).filter(e => (e.matches('input[type=checkbox], input[type=file]') ? e.closest('label') ?? e : e).getBoundingClientRect().height < 43).map(e => (e.textContent || e.getAttribute('aria-label') || e.tagName).slice(0, 80)) }));
    assert(layout.scroll <= layout.width + 1, `${name}: overflow ${JSON.stringify(layout)}`);
    assert.deepEqual(layout.broken, [], `${name}: imagens sem fallback`);
    assert.deepEqual(layout.bad, [], `${name}: alvo de toque insuficiente`);
    await page.screenshot({ path: join(output, `${name}.png`), fullPage: true, animations: 'disabled' });
    results.push({ name, ...layout });
  }
  await page.goto('http://127.0.0.1:3011/');
  await page.getByRole('button', { name: 'Ver racha', exact: true }).waitFor();
  await shot('organizador-lista-aberta-home');
  await nav('Racha'); await tab('Gestão'); await page.getByRole('button', { name: 'Fechar lista', exact: true }).click();
  await page.getByRole('button', { name: 'Reabrir lista' }).waitFor();
  await nav('Times'); await tab('Ajustes'); await page.getByRole('button', { name: 'Sortear times', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar times' }).click();
  await page.getByText('Times confirmados com sucesso.').waitFor();
  await nav('Resultados'); await page.getByRole('button', { name: 'INICIAR PRIMEIRA PARTIDA' }).click();
  await page.getByRole('button', { name: 'Aumentar placar de Time 1' }).click();
  await page.getByText('Gols · 0 registrados', { exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar gols de', exact: false }).first().click();
  await shot('organizador-partida-ao-vivo');
  await page.getByRole('button', { name: 'Finalizar partida', exact: true }).click();
  await page.getByText('Vencedor: Time 1', { exact: true }).waitFor();
  await nav('Racha'); await tab('Gestão'); await page.getByRole('button', { name: 'FINALIZAR RACHA', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'FINALIZAR', exact: true }).click();
  await page.getByText('Rodada finalizada. As avaliações poderão ser abertas.').waitFor();
  await nav('Avaliação'); await tab('Progresso'); await page.getByText('Gerenciar avaliações', { exact: true }).click();
  await page.evaluate(() => { window.confirm = () => { throw new Error('Native confirmation is blocked'); }; });
  for (const width of [360, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const writes = apiCalls.filter(call => call.name === 'alterar_avaliacoes_rodada').length;
    await page.getByRole('button', { name: 'ABRIR AVALIAÇÕES', exact: true }).click();
    await page.getByRole('dialog', { name: 'Abrir avaliações?' }).waitFor();
    await shot(`confirmar-avaliacoes-${width}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(apiCalls.filter(call => call.name === 'alterar_avaliacoes_rodada').length, writes);
  }
  await page.getByRole('button', { name: 'ABRIR AVALIAÇÕES', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.getByText('Avaliacoes abertas.', { exact: true }).waitFor();
  assert.equal(apiCalls.filter(call => call.name === 'alterar_avaliacoes_rodada').length, 1);
  await page.evaluate(() => { window.confirm = () => true; });

  for (const role of ['organizador', 'jogador']) {
    for (const [width, height] of [[360,800],[375,812],[390,844],[430,932],[1280,900]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`http://127.0.0.1:3011/?role=${role}`);
      await page.getByRole('button', { name: 'Ver racha', exact: true }).waitFor();
      const prefix = `${role}-${width}`;
      await shot(`${prefix}-home`);
      await nav('Racha'); await shot(`${prefix}-racha-lista`);
      if (role === 'organizador') { await tab('Gestão'); await shot(`${prefix}-racha-gestao`); }
      else assert.equal(await page.getByRole('tab', { name: 'Gestão' }).count(), 0);
      await nav('Times'); await shot(`${prefix}-times`);
      if (role === 'organizador') { await tab('Ajustes'); await shot(`${prefix}-times-ajustes`); }
      else assert.equal(await page.getByRole('tab', { name: 'Ajustes' }).count(), 0);
      await nav('Resultados'); await shot(`${prefix}-resumo`);
      await page.waitForTimeout(100); const before = requests;
      await tab('Histórico'); await shot(`${prefix}-historico`);
      await tab('Ao vivo'); await tab('Resumo');
      assert.equal(requests, before, 'Trocar visualizações das partidas não deve consultar novamente');
      await page.getByRole('button', { name: 'VER RESUMO', exact: true }).click(); await shot(`${prefix}-sheet`);
      await page.getByRole('button', { name: 'Fechar resumo', exact: true }).click();
      await tab('Ranking'); await page.getByRole('button', { name: 'Gols', exact: true }).click(); await shot(`${prefix}-ranking`);
      const evaluationStart = apiCalls.length;
      await nav('Avaliação'); await tab('Avaliar'); await shot(`${prefix}-avaliar`);
      assert.equal(apiCalls.slice(evaluationStart).filter(call => call.name === 'ler_avaliacoes_atual').length, 1, 'Avaliar e Progresso compartilham a leitura pessoal');
      if (role === 'jogador') {
        await page.getByRole('button', { name: /^Avaliar / }).first().click(); await shot(`${prefix}-notas`);
        await page.getByRole('button', { name: 'Voltar aos companheiros' }).click();
      }
      await tab('Progresso'); await shot(`${prefix}-progresso`);
      await page.getByRole('button', { name: 'Abrir meu perfil' }).click(); await shot(`${prefix}-perfil`);
      await tab('Estatísticas'); await shot(`${prefix}-estatisticas`);
      await tab('Avaliações'); await shot(`${prefix}-radar`);
      await tab('Visão geral');
      await page.getByRole('tab', { name: 'Visão geral' }).focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await page.getByRole('tab', { name: 'Estatísticas' }).getAttribute('aria-selected'), 'true');
    }
  }
  if (process.argv[3]) {
    for (const [width,height] of [[360,800],[375,812],[390,844],[430,932],[1280,900]]) {
      await page.setViewportSize({ width, height });
      for (const route of ['login','cadastro','reset-password']) {
        await page.goto(`${process.argv[3]}/${route}`);
        await page.locator('h1').waitFor(); await shot(`auth-${route}-${width}`);
      }
    }
  }
  assert.deepEqual(errors, [], 'Console sem exceções JavaScript');
  assert.deepEqual(consoleMessages, [], 'Console sem erros ou warnings inesperados');
  assert.deepEqual(failed, [], 'Network sem falhas inesperadas');
  const metrics = await cdp.send('Performance.getMetrics');
  writeFileSync(join(output, 'report.json'), JSON.stringify({ results, errors, consoleMessages, failed, metrics }, null, 2));
  console.log(`OK: ${results.length} capturas, 5 viewports, ambas roles, tabs/teclado/targets/imagens/overflow/network. Evidências: ${output}`);
} finally { await browser?.close(); fixture.kill(); }
