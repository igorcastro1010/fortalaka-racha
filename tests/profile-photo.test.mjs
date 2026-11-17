// UI real, dados isolados, nenhuma escrita remota.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium, webkit } = createRequire(resolve(process.argv[2], 'package.json'))('playwright');
const fixture = spawn(process.execPath, ['tests/preview-sorteio.mjs', process.argv[2], process.argv[2], '--app'], { stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
try {
  await new Promise((done, fail) => {
    fixture.stdout.on('data', chunk => { if (chunk.toString().includes('Validação isolada:')) done(); });
    fixture.once('exit', code => fail(Error(`Fixture saiu: ${code}`)));
  });
  browser = await (process.argv.includes('--webkit') ? webkit : chromium).launch({ headless: true });
  const page = await browser.newPage();
  // O PNG mínimo da fixture não é decodificado pelo WebKit; usa imagem sintética válida.
  await page.route('**/photo.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#dc2626"/></svg>' }));
  const captures = mkdtempSync(join(tmpdir(), 'fortalaka-profile-photo-'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { data } = await fetch('http://127.0.0.1:3011/api', { method: 'POST', body: JSON.stringify({ role: 'jogador', kind: 'rpc', name: 'ler_estatisticas_jogadores', args: { p_jogador: null } }) }).then(r => r.json());
  const player = data.find(p => p.avatar_url?.endsWith('/photo.png'));
  assert(player, 'Fixture tem foto válida');
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`http://127.0.0.1:3011/perfil/${player.jogador_id}?role=jogador`);
    const trigger = page.getByRole('button', { name: `Ampliar foto de ${player.nome}`, exact: true });
    await trigger.waitFor({ timeout: 5000 });
    const url = page.url();
    for (const close of ['button', 'escape', 'backdrop']) {
      await trigger.click();
      const scroll = await page.evaluate(() => scrollY);
      const dialog = page.getByRole('dialog', { name: `Foto de ${player.nome}`, exact: true });
      await dialog.waitFor();
      const photo = dialog.getByRole('img', { name: player.nome, exact: true });
      await photo.evaluate(img => img.decode());
      const bounds = await photo.boundingBox();
      assert(bounds.width > 250 && bounds.width <= width, 'Foto ampliada cabe na tela');
      assert.equal(page.url(), url, 'Não navega ao ampliar');
      if (close === 'button') await page.screenshot({ path: join(captures, `foto-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (close === 'button') await dialog.getByRole('button', { name: 'Fechar foto' }).click();
      if (close === 'escape') await page.keyboard.press('Escape');
      if (close === 'backdrop') await dialog.click({ position: { x: 2, y: 2 } });
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.body.style.overflow !== 'hidden');
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Restaura foco');
      assert.equal(await page.evaluate(() => scrollY), scroll, 'Preserva rolagem');
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'Libera rolagem');
    }
  }
  await page.getByRole('button', { name: `Ampliar foto de ${player.nome}`, exact: true }).click();
  await page.getByRole('dialog').getByRole('img').dispatchEvent('error');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.body.style.overflow !== 'hidden');
  assert.equal(await page.getByRole('button', { name: /^Ampliar foto/ }).count(), 0, 'Falha da foto volta às iniciais');
  const noPhoto = data.find(p => !p.avatar_url);
  await page.goto(`http://127.0.0.1:3011/perfil/${noPhoto.jogador_id}?role=jogador`);
  await page.getByRole('heading', { name: noPhoto.nome, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Ampliar foto/ }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(`OK: foto ampliada, sem navegação, fechar/botão/Esc/fundo, foco/rolagem e perfil sem foto em 360/390/430px. Capturas: ${captures}`);
} finally { await browser?.close(); fixture.kill(); }
