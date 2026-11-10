// Execute with Deno: validates the real npm imports, not only TypeScript syntax.
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { generateRequestDetails, generateVAPIDKeys } from 'npm:web-push@4.0.0';
const vapid = generateVAPIDKeys();
const receiver = createECDH('prime256v1');
receiver.generateKeys();
const encrypted = await generateRequestDetails({
  endpoint: 'https://fcm.googleapis.com/send/ficticio',
  keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
}, JSON.stringify({ title: 'Aviso ficticio' }), {
  vapidDetails: { subject: 'https://fortalaka-racha.vercel.app', ...vapid }, TTL: 3600,
});
assert.equal(encrypted.method, 'POST');
assert.equal(encrypted.headers['Content-Encoding'], 'aes128gcm');
assert(encrypted.body.byteLength > 0);
assert(!encrypted.body.toString().includes('Aviso ficticio'));
let handler;
Object.defineProperty(Deno, 'serve', { value: (callback) => { handler = callback; } });
await import('../supabase/functions/send-push/index.ts');
for (const name of ['PUSH_DISPATCH_SECRET', 'WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY', 'WEB_PUSH_SUBJECT']) Deno.env.delete(name);
assert.equal((await handler(new Request('https://edge.test/', { method: 'GET' }))).status, 405);
assert.equal((await handler(new Request('https://edge.test/', { method: 'POST' }))).status, 401);
Deno.env.set('PUSH_DISPATCH_SECRET', 'x'.repeat(64));
assert.equal((await handler(new Request('https://edge.test/', { method: 'POST', headers: { 'x-push-secret': 'bad' } }))).status, 401);
assert.equal((await handler(new Request('https://edge.test/', { method: 'POST', headers: { 'x-push-secret': 'x'.repeat(64) } }))).status, 503);
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (input, init) => {
  calls.push({ url: String(input), method: init.method, body: init.body });
  return Response.json([]);
};
try {
  Deno.env.set('SUPABASE_URL', 'https://isolated.supabase.co');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fictitious-test-key');
  Deno.env.set('WEB_PUSH_PUBLIC_KEY', vapid.publicKey);
  Deno.env.set('WEB_PUSH_PRIVATE_KEY', vapid.privateKey);
  Deno.env.set('WEB_PUSH_SUBJECT', 'https://fortalaka-racha.vercel.app');
  const response = await handler(new Request('https://edge.test/', { method: 'POST', headers: { 'x-push-secret': 'x'.repeat(64) } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: 0, retry: 0, gone: 0, failed: 0 });
  assert.equal(calls.length, 1);
  assert(calls[0].url.endsWith('/rest/v1/rpc/reclamar_push'));
  assert.deepEqual(JSON.parse(calls[0].body), { p_limite: 10 });
} finally { globalThis.fetch = originalFetch; }
console.log('OK: runtime Edge, imports npm reais, metodo, segredo e configuracao incompleta.');
