const destinations = new Set(['racha', 'teams', 'results', 'evaluate', 'profile']);

export function authorized(expected, received) {
  if (typeof expected !== 'string' || expected.length < 32 || typeof received !== 'string') return false;
  let difference = expected.length ^ received.length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (received.charCodeAt(i) || 0);
  return difference === 0;
}

export function isPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && (
      url.hostname === 'fcm.googleapis.com' || url.hostname === 'web.push.apple.com' ||
      url.hostname.endsWith('.push.services.mozilla.com') || url.hostname.endsWith('.notify.windows.com')
    );
  } catch { return false; }
}

export function notificationUrl({ destination, round_id }) {
  if (!destinations.has(destination)) return '/notificacoes';
  return destination === 'profile' || !round_id
    ? `/?tab=${destination}`
    : `/rodadas/${encodeURIComponent(round_id)}?destino=${destination}`;
}

export async function dispatchPush({ claim, finish, send }) {
  const jobs = await claim();
  const counts = { sent: 0, retry: 0, gone: 0, failed: 0 };
  // Small sequential batches keep sockets and lease duration bounded.
  for (const job of jobs) {
    let outcome = 'failed';
    if (isPushEndpoint(job.endpoint)) {
      try {
        await send({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth } }, JSON.stringify({
          id: job.notification_id,
          title: 'RACHA FORTALAKA',
          body: 'Voce tem um novo aviso no racha. Abra o app para conferir.',
          url: notificationUrl(job),
        }));
        outcome = 'sent';
      } catch (error) {
        const status = Number(error?.statusCode);
        outcome = status === 404 || status === 410 ? 'gone'
          : !status || status === 429 || status >= 500 ? 'retry' : 'failed';
      }
    }
    // A failed acknowledgement must surface to the caller, never log subscriptions.
    await finish(job.id, job.claim_token, outcome);
    counts[outcome]++;
  }
  return counts;
}
