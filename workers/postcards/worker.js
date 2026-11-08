// The post office for the Postcards section of saumyalahera.com.
//
// Visitors post a note; it waits in "pending" until it is pinned from the Leabhar app.
// Only pinned postcards are ever shown on the website.
//
//   GET  /notes                  pinned postcards (public)
//   POST /notes                  {text, name, place} from the website (public, one a minute per visitor)
//   GET  /notes/pending          postcards waiting to be read           (Authorization: Bearer ADMIN_TOKEN)
//   POST /notes/:id/pin          pin a postcard to the website          (Authorization: Bearer ADMIN_TOKEN)
//   POST /notes/:id/unpin        take it down again, back to pending    (Authorization: Bearer ADMIN_TOKEN)
//   POST /notes/:id/delete       throw it away                          (Authorization: Bearer ADMIN_TOKEN)
//
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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (path === '/notes' && req.method === 'GET') {
      return json(await read(env, 'pinned'), 200, { 'Cache-Control': 'public, max-age=60' });
    }

    if (path === '/notes' && req.method === 'POST') {
      let b;
      try { b = await req.json(); } catch { return json({ error: 'That postcard was unreadable.' }, 400); }
      if (b && b.website) return json({ ok: true }, 202); // a field only robots fill in
      const text = clean(b && b.text, 280, false);
      const name = clean(b && b.name, 40, true);
      const place = clean(b && b.place, 40, true);
      if (text.length < 2 || !name) return json({ error: 'A note and a name, please.' }, 400);

      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      const slow = 'rl:' + ip;
      if (await env.POSTCARDS.get(slow)) return json({ error: 'One postcard a minute, please.' }, 429);
      await env.POSTCARDS.put(slow, '1', { expirationTtl: 60 });

      const pending = await read(env, 'pending');
      if (pending.length >= MAX_PENDING) return json({ error: 'The postbox is full. Try again soon.' }, 503);
      pending.push({ id: crypto.randomUUID(), name, place, text, at: new Date().toISOString() });
      await env.POSTCARDS.put('pending', JSON.stringify(pending));
      return json({ ok: true }, 202);
    }

    if (!authed(req, env)) return json({ error: 'Not allowed.' }, 401);

    if (path === '/notes/pending' && req.method === 'GET') {
      return json(await read(env, 'pending'), 200, { 'Cache-Control': 'no-store' });
    }

    const m = path.match(/^\/notes\/([\w-]+)\/(pin|unpin|delete)$/);
    if (m && req.method === 'POST') {
      const id = m[1], act = m[2];
      let pending = await read(env, 'pending');
      let pinned = await read(env, 'pinned');
      const card = pending.find((c) => c.id === id) || pinned.find((c) => c.id === id);
      if (!card) return json({ error: 'No such postcard.' }, 404);
      pending = pending.filter((c) => c.id !== id);
      pinned = pinned.filter((c) => c.id !== id);
      if (act === 'pin') pinned.unshift(card);
      if (act === 'unpin') pending.unshift(card);
      pinned = pinned.slice(0, MAX_PINNED);
      await env.POSTCARDS.put('pending', JSON.stringify(pending));
      await env.POSTCARDS.put('pinned', JSON.stringify(pinned));
      return json({ pending, pinned });
    }

    return json({ error: 'Not found.' }, 404);
  },
};
