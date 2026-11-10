import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';

const handlers = {};
const shown = [], opened = [], focused = [];
let enabled = null, clients = [], notifications = [];
const indexedDB = { open() {
  const request = {};
  queueMicrotask(() => {
    request.result = { close() {}, transaction() {
      const tx = { objectStore: () => ({ get() { const read = { result: enabled }; queueMicrotask(() => tx.oncomplete()); return read; } }) };
      return tx;
    } };
    request.onsuccess();
  });
  return request;
} };
const source = readFileSync('public/sw.js', 'utf8');
runInNewContext(source, { indexedDB, URL, self: {
  location: { origin: 'https://fortalaka.test' }, addEventListener: (type, fn) => handlers[type] = fn,
  registration: { pushManager: { getSubscription: async () => ({ endpoint: 'device-a' }) },
    getNotifications: async ({ tag } = {}) => notifications.filter(n => !tag || n.tag === tag),
    showNotification: async (title, options) => { shown.push({ title, ...options }); notifications.push({ tag: options.tag, close() { notifications = notifications.filter(n => n !== this); } }); } },
  clients: { matchAll: async () => clients, openWindow: async url => opened.push(url) },
} });
assert.equal(typeof handlers.push, 'function', 'Worker must handle push');
assert.equal(typeof handlers.notificationclick, 'function', 'Worker must handle clicks');
let capabilities;
handlers.message({ data: { type: 'FORTALAKA_PUSH_CAPABILITIES' }, ports: [{ postMessage: value => capabilities = value }] });
assert.equal(capabilities.version, 1);
async function push(payload = { id: 'notice-1', title: 'PRIVATE', body: 'PRIVATE', url: '/?tab=racha' }) {
  let work; handlers.push({ data: { json: () => payload }, waitUntil: p => work = p }); await work;
}
async function click(url) {
  let work, closed = false;
  handlers.notificationclick({ notification: { data: { url }, close: () => closed = true }, waitUntil: p => work = p });
  await work; assert(closed);
}
await push(); assert.equal(shown.length, 0);
enabled = 'other-device'; await push(); assert.equal(shown.length, 0);
enabled = 'device-a'; await push(); assert.equal(shown.length, 1);
assert.equal(shown[0].title, 'Racha Fortalaka'); assert(!JSON.stringify(shown).includes('PRIVATE'));
await push(); assert.equal(shown.length, 1, 'Suppress duplicate tag');
await push(null); await push({ id: {} }); assert.equal(shown.length, 1);
for (const url of ['https://evil.test', '//evil.test', '/\\evil.test', '/login', '/api/private', '/?token=secret', '/?tab=racha&tab=profile', '/rodadas/../login', 'https://user:pass@fortalaka.test/', '/%2f%2fevil.test', '/?tab=racha#secret']) {
  await click(url); assert.equal(opened.at(-1), 'https://fortalaka.test/notificacoes', url);
}
for (const url of ['/?tab=profile', '/rodadas/abc-123?destino=results', '/notificacoes']) {
  await click(url); assert.equal(opened.at(-1), 'https://fortalaka.test' + url);
}
clients = [{ url: 'https://fortalaka.test/?tab=racha', focus: async () => focused.push('exact') }];
await click('/?tab=racha'); assert.deepEqual(focused, ['exact']);
clients = [{ url: 'https://fortalaka.test/', navigate: async url => { assert.equal(url, 'https://fortalaka.test/notificacoes'); return { focus: async () => focused.push('navigated') }; } }];
await click('/notificacoes'); assert.equal(focused.at(-1), 'navigated');
enabled = null; const before = opened.length; await click('/?tab=profile'); await push({ id: 'after-logout' });
assert.equal(opened.length, before); assert.equal(shown.length, 1);
console.log('OK: consent, privacy, duplicate tags, malformed payloads, safe URLs, focus/navigate/open and logout suppression.');
