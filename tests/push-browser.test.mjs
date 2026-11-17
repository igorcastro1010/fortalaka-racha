import { readBuiltCss } from './built-css.mjs';
// Isolated UI fixture: no Supabase connection and no real push subscription.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
const deps = createRequire(resolve(process.argv[2], 'package.json'));
const { build } = deps('esbuild');
const { chromium } = deps('playwright');
const output = mkdtempSync(join(tmpdir(), 'fortalaka-push-'));
const bundle = await build({
  stdin: { contents: `import {createRoot} from 'react-dom/client';import {PushSettings} from './src/components/notifications/PushSettings';createRoot(document.getElementById('root')).render(<PushSettings/>);`, loader: 'tsx', resolveDir: process.cwd() },
  write: false, bundle: true, jsx: 'automatic', tsconfig: resolve('tsconfig.json'), nodePaths: [resolve('node_modules')],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY': '"AQID"' },
  plugins: [{ name: 'isolated-supabase', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'stub', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createClient=()=>({rpc:window.fixtureRpc})', loader: 'js' }));
  } }],
});
const css = readBuiltCss();
const server = createServer((req, res) => {
  if (req.url === '/client.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].text); return; }
  if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main class="mx-auto max-w-[640px] p-4"><h1 class="text-3xl font-black">Notificações</h1><div id="root"></div></main><script src="/client.js"></script></body></html>');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.fixture = { permission: 'default', server: false, sub: null, prompts: 0, calls: [], fail: false };
    const f = window.fixture;
    Object.defineProperty(window, 'Notification', { configurable: true, value: { get permission() { return f.permission; }, requestPermission() { f.prompts++; f.permission = 'granted'; return Promise.resolve('granted'); } } });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
    const reg = { active: { postMessage(_, ports) { ports[0].postMessage({ type: 'FORTALAKA_PUSH_CAPABILITIES', version: 1 }); } }, getNotifications: async () => [], pushManager: {
      getSubscription: async () => f.sub,
      subscribe: async () => { f.sub = { endpoint: 'https://fcm.googleapis.com/send/isolated', toJSON: () => ({ keys: { p256dh: 'fake-key', auth: 'fake-auth' } }), unsubscribe: async () => { f.sub = null; return true; } }; return f.sub; },
    } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => reg, register: async () => reg, ready: Promise.resolve(reg) } });
    window.fixtureRpc = async (name, args) => {
      f.calls.push({ name, args });
      if (f.fail) return { error: { message: 'INTERNAL SQL technical secret' } };
      if (name === 'registrar_push') f.server = true;
      if (name === 'remover_push') f.server = false;
      return { data: name === 'push_ativo' ? f.server : true };
    };
  });
  const page = await context.newPage();
  const errors = [], consoleErrors = [];
  page.on('pageerror', e => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  cdp.on('Runtime.consoleAPICalled', event => { if (event.type === 'error') consoleErrors.push(event.args.map(arg => arg.value).join(' ')); });
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(url);
  const activate = page.getByRole('button', { name: 'Ativar neste dispositivo', exact: true });
  await activate.waitFor();
  assert.equal(await page.evaluate(() => fixture.prompts), 0);
  async function mobile(state) {
    for (const width of [360, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const bad = await page.locator('button:visible,p:visible,h2:visible').evaluateAll(elements => elements.filter(el => { const rect = el.getBoundingClientRect(); return rect.left < 0 || rect.right > innerWidth || (el.tagName === 'BUTTON' && (rect.height < 44 || rect.width < 44)); }).map(el => el.textContent));
      assert.deepEqual(bad, [], `${state} ${width}`);
      await page.screenshot({ path: join(output, `${state}-${width}.png`), fullPage: true });
    }
  }
  await mobile('desativado');
  await activate.click();
  await page.getByText('Notificações ativadas.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => fixture.prompts), 1);
  assert.equal(await page.evaluate(() => fixture.calls.filter(call => call.name === 'registrar_push').length), 1);
  await mobile('ativado');
  await page.evaluate(() => fixture.fail = true);
  await page.getByRole('button', { name: 'Desativar neste dispositivo', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.getByText('Notificações desativadas.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => fixture.sub), null);
  await page.evaluate(() => fixture.fail = false);
  await activate.click();
  await page.getByText('Notificações ativadas.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Desativar neste dispositivo', exact: true }).click();
  await page.getByText('Notificações desativadas.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => fixture.server), false);
  await page.evaluate(() => fixture.fail = true);
  await activate.click();
  await page.getByRole('alert').waitFor();
  assert(!(await page.getByRole('alert').innerText()).includes('INTERNAL'));
  await mobile('erro');
  await page.evaluate(() => { fixture.fail = false; fixture.permission = 'denied'; });
  await page.getByRole('button', { name: 'Consultar notificações do dispositivo' }).click();
  await page.getByText(/Permissão bloqueada/).waitFor();
  await mobile('bloqueado');
  await page.evaluate(() => Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' }));
  await page.getByRole('button', { name: 'Consultar notificações do dispositivo' }).click();
  await page.getByText(/No iPhone ou iPad/).waitFor();
  await mobile('iphone');
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(`OK: UI consentimento/ativacao/revogacao/erro/bloqueio/iPhone, 360/375/390/430 sem overflow, alvos44px, CDP sem erros. Capturas: ${output}`);
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
