import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve(process.argv[2] ?? 'node_modules', 'package.json'));
const { transformSync } = require('esbuild');
const source = readFileSync('src/lib/notifications/push.ts', 'utf8').replace("import { createClient } from '@/lib/supabase/client';", 'const createClient = globalThis.createClient;');
const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
function fixture() {
  let endpoint = null, sub = null, server = false, permission = 'default', fail = '', subscribed = 0, registered = 0, prompts = 0;
  const calls = [];
  const reg = { active: { postMessage: (_, ports) => ports[0].postMessage({ type: 'FORTALAKA_PUSH_CAPABILITIES', version: 1 }) }, getNotifications: async () => [], pushManager: { getSubscription: async () => sub, subscribe: async () => { subscribed++; sub = { endpoint: 'https://push.test/device', toJSON: () => ({ keys: { p256dh: 'key', auth: 'auth' } }), unsubscribe: async () => { calls.push('unsubscribe'); sub = null; return true; } }; return sub; } } };
  const navigator = { userAgent: 'Chrome', platform: 'Windows', locks: { request: async (_, action) => action() }, serviceWorker: { getRegistration: async () => reg, register: async () => { registered++; return reg; }, ready: Promise.resolve(reg) } };
  const context = { exports: {}, process: { env: { NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: 'AQID' } }, navigator, window: { isSecureContext: true, PushManager: {}, Notification: {}, matchMedia: () => ({ matches: false }) },
    Notification: { get permission() { return permission; }, requestPermission: async () => { prompts++; permission = 'granted'; return permission; } },
    Uint8Array, atob, MessageChannel, setTimeout: fn => setTimeout(fn, 100), clearTimeout,
    createClient: () => ({ rpc: async (name, args) => { calls.push([name, args]); if (fail === name) return { error: new Error('offline') }; if (name === 'registrar_push') server = true; if (name === 'remover_push') server = false; return { data: name === 'push_ativo' ? server : null }; } }),
    indexedDB: { open() { const req = {}; queueMicrotask(() => { req.result = { close() {}, transaction() { const tx = { objectStore: () => ({ get() { const read = { result: endpoint }; queueMicrotask(() => tx.oncomplete()); return read; }, put(value) { endpoint = value; queueMicrotask(() => tx.oncomplete()); } }) }; return tx; } }; req.onsuccess(); }); return req; } },
  };
  context.module = { exports: {} };
  runInNewContext(code, context);
  return { api: context.module.exports, context, navigator, reg, calls, setFail: v => fail = v, setServer: v => server = v, setPermission: v => permission = v,
    snapshot: () => ({ endpoint, sub, subscribed, registered, prompts }) };
}
{
  const f = fixture(); assert.equal(await f.api.getPushStatus(), 'disabled'); assert.equal(f.snapshot().prompts, 0); assert.equal(f.snapshot().registered, 0);
  const activation = f.api.enablePush();
  assert.equal(f.snapshot().prompts, 1, 'Permission requested synchronously in the gesture, before async work');
  await Promise.all([activation, f.api.enablePush()]);
  assert.equal(f.snapshot().subscribed, 1); assert.equal(f.snapshot().endpoint, 'https://push.test/device');
  assert.equal(await f.api.getPushStatus(), 'enabled');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c => c[0] === 'registrar_push')[1])), { p_endpoint: 'https://push.test/device', p_p256dh: 'key', p_auth: 'auth' });
  f.setServer(false); assert.equal(await f.api.getPushStatus(), 'disabled'); assert.equal(f.snapshot().endpoint, null);
  f.setServer(true); assert.equal(await f.api.getPushStatus(), 'disabled', 'Server state cannot silently re-enable local consent');
  await f.api.enablePush(); f.setFail('remover_push');
  await assert.rejects(f.api.disablePush()); assert.equal(f.snapshot().endpoint, null); assert.equal(f.snapshot().sub, null, 'RPC failure must not prevent browser unsubscribe');
  f.setFail(''); await f.api.cleanupPushOnLogout(); assert.equal(f.snapshot().sub, null);
  assert(f.calls.indexOf('unsubscribe') < f.calls.findIndex(c => c[0] === 'remover_push'), 'Stop browser delivery before waiting for remote cleanup');
}
{
  const f = fixture(); f.setFail('registrar_push'); await assert.rejects(f.api.enablePush()); assert.equal(f.snapshot().endpoint, null);
}
{
  const f = fixture(); f.navigator.serviceWorker.ready = new Promise(() => {});
  await assert.rejects(f.api.enablePush(), /demorou/); assert.equal(f.snapshot().subscribed, 0);
}
{
  const f = fixture(); f.reg.active.postMessage = () => {};
  await assert.rejects(f.api.enablePush(), /Atualize o app/);
  assert.equal(f.snapshot().subscribed, 0, 'Old active worker cannot activate push while an update waits');
  assert.equal(f.snapshot().endpoint, null);
}
{
  const f = fixture(); f.context.atob = () => { throw new Error('InvalidCharacterError: technical'); };
  await assert.rejects(f.api.enablePush(), error => !f.api.pushErrorMessage(error).includes('technical'));
  f.reg.pushManager.getSubscription = () => new Promise(() => {});
  await assert.rejects(f.api.getPushStatus(), /demorou/);
  await assert.rejects(f.api.cleanupPushOnLogout(), /desativação/);
}
{
  const f = fixture(); await f.api.enablePush();
  f.context.indexedDB.open = () => { throw new Error('SecurityError'); };
  await assert.rejects(f.api.cleanupPushOnLogout(), /desativação/);
  assert.equal(f.snapshot().sub, null, 'IDB failure cannot prevent browser unsubscribe');
}
{
  const f = fixture(); delete f.reg.pushManager;
  await f.api.cleanupPushOnLogout();
}
// Exercise the actual logout handler with failing/unavailable push capabilities.
{
  const app = readFileSync('src/components/app/FortalakaApp.tsx', 'utf8');
  const start = app.indexOf('  async function handleSignOut()');
  const handler = app.slice(start, app.indexOf('\n  }', start) + 4);
  for (const scenario of ['noIDB', 'noPushManager', 'offlineRPC', 'unsupported']) {
    const f = fixture(); await f.api.enablePush();
    if (scenario === 'noIDB') delete f.context.indexedDB;
    if (scenario === 'noPushManager') delete f.reg.pushManager;
    if (scenario === 'offlineRPC') f.setFail('remover_push');
    if (scenario === 'unsupported') delete f.navigator.serviceWorker;
    let signouts = 0, redirects = 0, error = '';
    const context = { isSigningOut: false, setIsSigningOut() {}, setSignOutError: value => error = value,
      cleanupPushOnLogout: f.api.cleanupPushOnLogout,
      createClient: () => ({ auth: { signOut: async () => { signouts++; return {}; } } }),
      router: { replace: () => redirects++, refresh() {} } };
    await runInNewContext(`${handler}\nhandleSignOut()`, context);
    assert.equal(signouts, 1, scenario); assert.equal(redirects, 1, scenario); assert.equal(error, '', scenario);
  }
}
{
  const f = fixture(); f.setPermission('denied'); assert.equal(await f.api.getPushStatus(), 'denied'); await assert.rejects(f.api.enablePush()); assert.equal(f.snapshot().prompts, 0);
  f.navigator.userAgent = 'iPhone'; assert.equal(f.api.pushAvailability(), 'homescreen');
  f.navigator.userAgent = 'Chrome'; f.context.window.isSecureContext = false; assert.equal(f.api.pushAvailability(), 'unsupported');
}
console.log('OK: user-gesture permission, subscription reuse, server/local authority, worker handshake, safe errors, timeouts; logout survives missing IDB/PushManager, offline RPC and unsupported browser.');
