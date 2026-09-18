const config = require('../config.js');

const READ_ACTIONS = new Set(['status', 'players', 'teams', 'analytics']);
const WRITE_ACTIONS = new Set(['register', 'cancel']);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

// Return JSON on this site's origin. Google ContentService redirects are followed
// here, without browser cookies/CORS, and a mutation is never retried.
module.exports = async function signup(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, data) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  };
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return send(405, {ok:false, error:'Method not allowed.'});
  }

  let body, action;
  try {
    if (req.method === 'POST') {
      body = req.body;
      if (Buffer.isBuffer(body)) body = body.toString('utf8');
      if (typeof body === 'string') body = JSON.parse(body);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
      action = body.action;
      if (!WRITE_ACTIONS.has(action)) throw new Error('Invalid action');
      if (JSON.stringify(body).length > 16000) throw new Error('Request too large');
      const fields = action === 'register'
        ? ['name', 'gender', 'throwing', 'catch', 'fitness', 'experience', 'preference', 'practice']
        : ['name', 'regId'];
      if (fields.some(key => typeof body[key] !== 'string' || !body[key].trim())) throw new Error('Missing fields');
      // Forward only the public registration contract, never cookies or tokens.
      body = Object.fromEntries(['action', ...fields].map(key => [key, body[key]]));
    } else {
      action = new URL(req.url, 'http://localhost').searchParams.get('action');
      if (!READ_ACTIONS.has(action)) throw new Error('Invalid action');
    }
  } catch (_) {
    return send(400, {ok:false, error:'Invalid signup request.'});
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let mutationSent = false;
  try {
    let target = new URL(config.endpoint);
    const upstreamOrigin = target.origin;
    let method = req.method;
    if (method === 'GET') target.searchParams.set('action', action);
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (method === 'POST') mutationSent = true;
      const response = await fetch(target, {
        method,
        headers: method === 'POST' ? {'Content-Type':'text/plain;charset=utf-8'} : {},
        ...(method === 'POST' ? {body:JSON.stringify(body)} : {}),
        redirect:'manual', cache:'no-store', signal:controller.signal
      });
      if (REDIRECTS.has(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirects === 5) throw new Error('Invalid redirect');
        const next = new URL(location, target);
        const allowed = next.origin === upstreamOrigin ||
          (next.protocol === 'https:' && next.hostname === 'script.googleusercontent.com');
        if (!allowed || (method === 'POST' && [307, 308].includes(response.status))) {
          throw new Error('Unsafe redirect');
        }
        await response.body?.cancel();
        // Apps Script has already run doPost; retrieve its output with GET.
        method = 'GET';
        target = next;
        continue;
      }

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (_) { throw new Error('Non-JSON upstream response'); }
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.ok !== 'boolean') {
        throw new Error('Invalid upstream response');
      }
      if (!response.ok) throw new Error('Upstream HTTP error');
      if (action === 'register' && data.ok && (typeof data.regId !== 'string' || !data.regId.trim())) {
        throw new Error('Missing registration receipt');
      }
      return send(200, data);
    }
  } catch (_) {
    return send(controller.signal.aborted ? 504 : 502, {
      ok:false,
      uncertain:mutationSent,
      code:mutationSent ? 'CONFIRMATION_UNAVAILABLE' : 'SERVICE_UNAVAILABLE',
      error:mutationSent
        ? 'The request may have been saved, but its confirmation could not be retrieved. Check the registered players list before submitting again.'
        : 'The registration service is temporarily unavailable. Please try again later.'
    });
  } finally {
    clearTimeout(timer);
  }
};
