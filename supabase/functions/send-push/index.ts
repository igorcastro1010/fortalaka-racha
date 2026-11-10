import { getVapidHeaders, sendNotification } from 'npm:web-push@4.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { authorized, dispatchPush } from './core.mjs';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (!authorized(Deno.env.get('PUSH_DISPATCH_SECRET'), request.headers.get('x-push-secret'))) {
    return new Response(null, { status: 401 });
  }
  const publicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY');
  const privateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
  const subject = Deno.env.get('WEB_PUSH_SUBJECT');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!publicKey || !privateKey || !subject || !url || !key) {
    return Response.json({ error: 'Configuracao de push incompleta.' }, { status: 503 });
  }
  try {
    // Reject malformed server configuration before consuming delivery attempts.
    await getVapidHeaders('https://fcm.googleapis.com', subject, publicKey, privateKey, 'aes128gcm');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const counts = await dispatchPush({
      claim: async () => {
        const { data, error } = await client.rpc('reclamar_push', { p_limite: 10 });
        if (error) throw new Error('claim');
        return data ?? [];
      },
      finish: async (id: string, token: string, outcome: string) => {
        const { data, error } = await client.rpc('finalizar_push', { p_id: id, p_claim_token: token, p_resultado: outcome });
        if (error || data !== true) throw new Error('ack');
      },
      send: (subscription: object, payload: string) => sendNotification(subscription, payload, {
        vapidDetails: { subject, publicKey, privateKey }, TTL: 3600, urgency: 'normal', timeout: 5000,
      }),
    });
    return Response.json(counts);
  } catch {
    // Provider errors contain endpoints and encryption keys: never serialize them.
    console.error('Falha ao processar fila push.');
    return Response.json({ error: 'Falha temporaria no envio.' }, { status: 503 });
  }
});
