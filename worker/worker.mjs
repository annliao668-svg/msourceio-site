import { validateInquiryPayload, sendInquiryEmail } from '../functions/lib/inquiry-email.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS_HEADERS)
  });
}

export async function onRequest(context) {
  // Cloudflare Pages Functions compatibility; fallback if used in Pages.
  const req = context.request;
  const url = new URL(req.url);
  if (url.pathname !== '/api/inquiry') {
    return new Response('Not found', { status: 404 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);
  }

  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    return jsonResponse({ ok: false, message: 'Invalid JSON' }, 400);
  }

  // honeypot
  if (payload.website) {
    return jsonResponse({ ok: true, message: 'Inquiry submitted successfully.' });
  }

  const validation = validateInquiryPayload(payload);
  if (!validation.ok) return jsonResponse({ ok: false, message: validation.message }, 400);

  // Build config from environment (Pages/Worker bindings)
  const env = (context.env || {});
  const emailResult = await sendInquiryEmail({ env, payload, fetchImpl: fetch });

  if (!emailResult.ok) {
    return jsonResponse({ ok: false, message: "Sorry — we couldn't send your inquiry. For immediate assistance, please contact us on WhatsApp.", error: emailResult.error }, emailResult.status || 502);
  }

  return jsonResponse({ ok: true, message: 'Inquiry submitted successfully. It has been sent to our email inbox for follow-up.', deliveryStatus: 'sent' });
}

// Worker runtime fetch handler (for wrangler publish to workers.dev)
addEventListener('fetch', event => {
  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/inquiry') {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);

    let payload;
    try { payload = await request.json(); } catch { return jsonResponse({ ok: false, message: 'Invalid JSON' }, 400); }
    if (payload.website) return jsonResponse({ ok: true, message: 'Inquiry submitted successfully.' });
    const validation = validateInquiryPayload(payload);
    if (!validation.ok) return jsonResponse({ ok: false, message: validation.message }, 400);

    const emailResult = await sendInquiryEmail({ env: GLOBAL_ENV || {}, payload, fetchImpl: fetch });
    if (!emailResult.ok) {
      return jsonResponse({ ok: false, message: "Sorry — we couldn't send your inquiry. For immediate assistance, please contact us on WhatsApp.", error: emailResult.error }, emailResult.status || 502);
    }
    return jsonResponse({ ok: true, message: 'Inquiry submitted successfully. It has been sent to our email inbox for follow-up.', deliveryStatus: 'sent' });
  }

  return new Response('Not found', { status: 404 });
}
