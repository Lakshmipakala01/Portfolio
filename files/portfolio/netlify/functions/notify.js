// netlify/functions/notify.js
// ---------------------------------------------------------------
// Receives a tiny "something happened" ping from the portfolio page
// and forwards it to your phone.
//
// Secrets live ONLY in Netlify environment variables. Use ONE option:
//   Option A (Telegram, recommended):  TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
//   Option B (WhatsApp via CallMeBot): WHATSAPP_PHONE and CALLMEBOT_API_KEY
// If the Telegram pair is set, it is used; otherwise CallMeBot is used.
// ---------------------------------------------------------------

// Only these two events are accepted. The WhatsApp text comes from
// this fixed list, so nothing a visitor sends can end up in your message.
const MESSAGES = {
  resume_download: (time) => `Portfolio alert: resume downloaded at ${time}`,
  page_visit: () => 'Portfolio alert: someone opened your portfolio',
};

// Rate limit: at most 5 alerts per minute for each event type.
// Note: this memory lives inside one running function instance, so it is a
// simple safety net, not a perfect global limit. It is enough to stop spam.
const MAX_PER_MINUTE = 5;
const WINDOW_MS = 60 * 1000;
const recent = {}; // { eventName: [timestamps] }

function isRateLimited(eventName) {
  const now = Date.now();
  const stamps = (recent[eventName] || []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_PER_MINUTE) {
    recent[eventName] = stamps;
    return true;
  }
  stamps.push(now);
  recent[eventName] = stamps;
  return false;
}

// Small helper so every reply is short JSON and never leaks details.
function reply(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  // 1) Only POST is allowed. Everything else gets 405.
  if (event.httpMethod !== 'POST') {
    return reply(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }

  // 2) Read and validate the JSON body (small and well-formed only).
  let data;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';
    if (raw.length > 2000) return reply(400, { ok: false });
    data = JSON.parse(raw);
  } catch (e) {
    return reply(400, { ok: false });
  }

  const eventName = data && data.event;
  if (!Object.prototype.hasOwnProperty.call(MESSAGES, eventName)) {
    return reply(400, { ok: false });
  }

  // 3) Rate limit per event type. Extra pings are quietly ignored.
  if (isRateLimited(eventName)) {
    return reply(200, { ok: true, sent: false });
  }

  // 4) Read secrets from environment variables (never from code).
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  const phone = process.env.WHATSAPP_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;
  const useTelegram = Boolean(tgToken && tgChat);
  if (!useTelegram && !(phone && apiKey)) {
    console.error('notify: missing environment variables');
    return reply(500, { ok: false });
  }

  // 5) Build the message. Time is taken from the server clock, shown in IST.
  const timeIST = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const text = MESSAGES[eventName](timeIST + ' IST');

  // 6) Send it (Telegram or CallMeBot).
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000); // give up after 8s
    let res;
    if (useTelegram) {
      res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text }),
        signal: controller.signal,
      });
    } else {
      const url =
        'https://api.callmebot.com/whatsapp.php' +
        `?phone=${encodeURIComponent(phone)}` +
        `&text=${encodeURIComponent(text)}` +
        `&apikey=${encodeURIComponent(apiKey)}`;
      res = await fetch(url, { signal: controller.signal });
    }
    clearTimeout(timer);

    if (!res.ok) {
      // Log only the status code. URLs and bodies contain secrets, so never log them.
      console.error('notify: provider responded with status', res.status);
      return reply(502, { ok: false });
    }
    return reply(200, { ok: true, sent: true });
  } catch (e) {
    console.error('notify: request failed', e && e.name); // name only, no URL
    return reply(502, { ok: false });
  }
};
