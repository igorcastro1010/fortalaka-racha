import assert from 'node:assert/strict';
import { dispatchPush, isPushEndpoint, notificationUrl, authorized } from '../supabase/functions/send-push/core.mjs';

assert(authorized('a'.repeat(64), 'a'.repeat(64)));
assert(!authorized('', ''));
assert(!authorized('a'.repeat(64), 'b'.repeat(64)));
for (const endpoint of ['https://fcm.googleapis.com/send/x', 'https://web.push.apple.com/x', 'https://updates.push.services.mozilla.com/x', 'https://x.notify.windows.com/x']) assert(isPushEndpoint(endpoint));
for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://fcm.googleapis.com.evil.test/x', 'https://u@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8080/x', 'https://127.0.0.1/x']) assert(!isPushEndpoint(endpoint));
assert.equal(notificationUrl({destination:'teams',round_id:'abc'}), '/rodadas/abc?destino=teams');
assert.equal(notificationUrl({destination:'https://evil.test'}), '/notificacoes');
assert.equal(notificationUrl({destination:'profile',round_id:'abc'}), '/?tab=profile');
const job = {id:'job',claim_token:'claim',endpoint:'https://fcm.googleapis.com/send/x',p256dh:'key',auth:'auth',notification_id:'note',destination:'racha',round_id:'round',title:'CPF segredo',body:'dados pessoais'};
async function scenario(error, overrides={}) {
  const finished=[], sent=[];
  const result=await dispatchPush({
    claim: async()=>[{...job,...overrides}],
    finish:async (...args)=>finished.push(args),
    send:async (subscription,payload)=>{sent.push({subscription,payload:JSON.parse(payload)});if(error)throw error;},
  });
  return {result,finished,sent};
}
const ok=await scenario();
assert.equal(ok.result.sent,1);
assert.deepEqual(ok.finished,[['job','claim','sent']]);
assert.equal(ok.sent[0].payload.id,'note');
assert(!JSON.stringify(ok.sent[0].payload).includes('segredo'));
assert(!JSON.stringify(ok.result).includes('endpoint'));
for (const code of [404,410]) assert.equal((await scenario({statusCode:code})).finished[0][2],'gone');
for (const code of [429,500,503,undefined]) assert.equal((await scenario({statusCode:code})).finished[0][2],'retry');
for (const code of [400,401,403,413]) assert.equal((await scenario({statusCode:code})).finished[0][2],'failed');
const blocked=await scenario(null,{endpoint:'https://internal.local/x'});
assert.equal(blocked.sent.length,0);
assert.equal(blocked.finished[0][2],'failed');
await assert.rejects(dispatchPush({claim:async()=>{throw Error('db')},finish:async()=>{},send:async()=>{}}));
console.log('OK: dispatcher, autenticacao, privacidade, destinos, bloqueio SSRF e retries.');
