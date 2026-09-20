// Backs the ordering app's shared "storage" with Netlify Blobs, so every
// visitor's browser reads and writes the same data instead of its own
// local copy. All keys used by this app are shared (the whole point of
// the board is that every device sees the same tables/stock/menu), so
// the "shared" flag from the client is accepted but not otherwise used —
// there's a single shared store either way.

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'bands-in-park';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  let payload = {};
  try {
    payload = event.httpMethod === 'POST'
      ? JSON.parse(event.body || '{}')
      : (event.queryStringParameters || {});
  } catch (err) {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { op, key, value, prefix } = payload;

  try {
    const store = getStore(STORE_NAME);

    if (op === 'get') {
      if (!key) return json(400, { error: 'Missing key' });
      const stored = await store.get(key);
      if (stored === null) return json(200, null);
      return json(200, { key, value: stored, shared: true });
    }

    if (op === 'set') {
      if (!key) return json(400, { error: 'Missing key' });
      await store.set(key, value == null ? '' : String(value));
      return json(200, { key, value, shared: true });
    }

    if (op === 'delete') {
      if (!key) return json(400, { error: 'Missing key' });
      await store.delete(key);
      return json(200, { key, deleted: true, shared: true });
    }

    if (op === 'list') {
      const { blobs } = await store.list({ prefix: prefix || '' });
      return json(200, { keys: blobs.map((b) => b.key), prefix: prefix || '', shared: true });
    }

    return json(400, { error: 'Unknown op: ' + op });
  } catch (err) {
    console.error('storage function error', err);
    return json(500, { error: String((err && err.message) || err) });
  }
};
