// The post office for the Postcards section of saumyalahera.com.
//
// Visitors post a note; it waits in "pending" until it is pinned from the Leabhar app.
// Only pinned postcards are ever shown on the website.
//
// Each postcard carries a sender tag: a scrambled fingerprint of the sender's internet
// address (never the address itself), so Leabhar can tell when several notes come from
// the same place and block that sender. Tags are never shown on the website.
//
//   GET  /notes                  pinned postcards (public, without sender tags)
//   POST /notes                  {text, name, place} from the website (public, one a minute per sender)
//   GET  /notes/pending          postcards waiting to be read                    (admin)
//   GET  /notes/pinned           pinned postcards with their sender tags          (admin)
//   GET  /blocked                blocked sender tags                             (admin)
//   POST /notes/:id/pin          pin a postcard to the website                   (admin)
//   POST /notes/:id/unpin        take it down again, back to pending             (admin)
//   POST /notes/:id/delete       throw it away                                   (admin)
//   POST /notes/:id/clear        throw away every waiting postcard from its sender (admin)
//   POST /notes/:id/block        block its sender and throw away their waiting postcards (admin)
//   POST /senders/:tag/unblock   let a blocked sender post again                 (admin)
//
// Admin calls send "Authorization: Bearer ADMIN_TOKEN".
// Bindings: a KV namespace bound as POSTCARDS, and a secret ADMIN_TOKEN (see README.md).

const MAX_PINNED = 60;
const MAX_PENDING = 200;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });
}

// Plain text only, without control characters, trimmed to a length.
function clean(s, n, oneLine) {
  let t = String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  t = oneLine ? t.replace(/\s+/g, ' ') : t.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim().slice(0, n);
}

async function read(env, key) {
  const v = await env.POSTCARDS.get(key, 'json');
  return Array.isArray(v) ? v : [];
}

function authed(req, env) {
  const h = req.headers.get('Authorization') || '';
  return Boolean(env.ADMIN_TOKEN) && h === 'Bearer ' + env.ADMIN_TOKEN;
}

// A short, salted fingerprint of the sender's address. The secret salt means the tag
// can't be turned back into an address, even by someone who reads the stored data.
async function senderTag(ip, env) {
  const data = new TextEncoder().encode('postcards:' + (env.ADMIN_TOKEN || '') + ':' + ip);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(hash.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

const forPublic = (cards) => cards.map(({ from, ...card }) => card);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (path === '/notes' && req.method === 'GET') {
      return json(forPublic(await read(env, 'pinned')), 200, { 'Cache-Control': 'public, max-age=60' });
    }

    if (path === '/notes' && req.method === 'POST') {
      let b;
      try { b = await req.json(); } catch { return json({ error: 'That postcard was unreadable.' }, 400); }
      if (b && b.website) return json({ ok: true }, 202); // a field only robots fill in
      const text = clean(b && b.text, 280, false);
      const name = clean(b && b.name, 40, true);
      const place = clean(b && b.place, 40, true);
      if (text.length < 2 || !name) return json({ error: 'A note and a name, please.' }, 400);

      const from = await senderTag(req.headers.get('CF-Connecting-IP') || 'unknown', env);
      // a blocked sender is told it went through, and nothing is kept
      if ((await read(env, 'blocked')).includes(from)) return json({ ok: true }, 202);

      const slow = 'rl:' + from;
      if (await env.POSTCARDS.get(slow)) return json({ error: 'One postcard a minute, please.' }, 429);
      await env.POSTCARDS.put(slow, '1', { expirationTtl: 60 });

      const pending = await read(env, 'pending');
      if (pending.length >= MAX_PENDING) return json({ error: 'The postbox is full. Try again soon.' }, 503);
      pending.push({ id: crypto.randomUUID(), name, place, text, at: new Date().toISOString(), from });
      await env.POSTCARDS.put('pending', JSON.stringify(pending));
      return json({ ok: true }, 202);
    }

    if (!authed(req, env)) return json({ error: 'Not allowed.' }, 401);

    if (path === '/notes/pending' && req.method === 'GET') {
      return json(await read(env, 'pending'), 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/notes/pinned' && req.method === 'GET') {
      return json(await read(env, 'pinned'), 200, { 'Cache-Control': 'no-store' });
    }
    if (path === '/blocked' && req.method === 'GET') {
      return json(await read(env, 'blocked'), 200, { 'Cache-Control': 'no-store' });
    }

    const u = path.match(/^\/senders\/([0-9a-f]+)\/unblock$/);
    if (u && req.method === 'POST') {
      const blocked = (await read(env, 'blocked')).filter((t) => t !== u[1]);
      await env.POSTCARDS.put('blocked', JSON.stringify(blocked));
      return json({ pending: await read(env, 'pending'), pinned: await read(env, 'pinned'), blocked });
    }

    const m = path.match(/^\/notes\/([\w-]+)\/(pin|unpin|delete|clear|block)$/);
    if (m && req.method === 'POST') {
      const id = m[1], act = m[2];
      let pending = await read(env, 'pending');
      let pinned = await read(env, 'pinned');
      let blocked = await read(env, 'blocked');
      const card = pending.find((c) => c.id === id) || pinned.find((c) => c.id === id);
      if (!card) return json({ error: 'No such postcard.' }, 404);

      if (act === 'clear' || act === 'block') {
        // everything waiting from this sender goes, this card included; pinned ones stay up
        pending = pending.filter((c) => c.id !== id && !(card.from && c.from === card.from));
        if (act === 'block' && card.from && !blocked.includes(card.from)) {
          blocked.push(card.from);
          await env.POSTCARDS.put('blocked', JSON.stringify(blocked));
        }
      } else {
        pending = pending.filter((c) => c.id !== id);
        pinned = pinned.filter((c) => c.id !== id);
        if (act === 'pin') pinned.unshift(card);
        if (act === 'unpin') pending.unshift(card);
      }
      pinned = pinned.slice(0, MAX_PINNED);
      await env.POSTCARDS.put('pending', JSON.stringify(pending));
      await env.POSTCARDS.put('pinned', JSON.stringify(pinned));
      return json({ pending, pinned, blocked });
    }

    return json({ error: 'Not found.' }, 404);
  },
};
