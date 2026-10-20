# Portfolio WhatsApp Alerts (Netlify + CallMeBot)

Get a WhatsApp message when someone downloads your resume (and, optionally, when someone opens your portfolio).

**How it works:** the page sends a tiny ping to a Netlify function, `netlify/functions/notify.js`. The function holds your secrets and asks CallMeBot to message you. No keys or phone numbers appear in the front-end code, and no visitor data (IP, name, device) is collected or sent.

## Files

```
index.html                      <- full portfolio (alert code already built in)
Lakshmi_Pakala_GENAI.pdf        <- resume served by the Download button
netlify.toml
netlify/functions/notify.js
```

## Option A (use this now): Telegram alerts, free and reliable

CallMeBot's WhatsApp bot can be full (no free slots). Telegram needs no waiting and has no expiry.

1. Install Telegram, open it, search for **@BotFather** and send `/newbot`.
2. Give the bot a name, then a username ending in `bot`. BotFather replies with a **token** like `123456789:ABC...`. Keep it private.
3. Search for your new bot, open it, press **Start**, then send it any message (for example `hi`).
4. In your browser open `https://api.telegram.org/botYOUR_TOKEN/getUpdates` (replace YOUR_TOKEN). Find `"chat":{"id":123456789` and note that number. That is your **chat id**.
5. In Netlify add these two variables instead of the WhatsApp ones: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

If both Telegram and CallMeBot variables exist, Telegram is used.

## Option B: WhatsApp via CallMeBot (only when the bot has free slots)

### Get your CallMeBot API key

1. Open https://www.callmebot.com/blog/free-api-whatsapp-messages/ and check the current CallMeBot WhatsApp number listed there (it can change).
2. Save that number in your phone contacts (any name, e.g. "CallMeBot").
3. From **your own WhatsApp**, send that contact the exact activation message shown on the page (at the time of writing: `I allow callmebot to send me messages`).
4. Wait for the reply with your **API key**. It can take a few minutes. If nothing arrives, wait 24 hours and retry.
5. Note your phone number in international format, e.g. `+919876543210`.

## 2. Add the environment variables in Netlify (Telegram pair or CallMeBot pair)

1. Netlify dashboard > your site > **Site configuration** > **Environment variables**.
2. **Add a variable** and create both:
   - `WHATSAPP_PHONE` = your number with country code (e.g. `+919876543210`)
   - `CALLMEBOT_API_KEY` = the key CallMeBot sent you
3. Make sure the **Functions** scope is ticked for each (all scopes is fine).
4. **Redeploy** after saving. Variables only apply to new deploys.

## 3. Deploy

Drag-and-drop deploys **do not run functions**. Use one of these:

**Option A: GitHub-connected deploy (recommended)**
1. Push the project (with `netlify.toml` and the `netlify/functions` folder) to a GitHub repo.
2. Netlify > **Add new site** > **Import an existing project** > pick the repo.
3. Leave the build command empty. Publish directory is already set by `netlify.toml`. Deploy.

**Option B: Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
netlify link          # or: netlify init
netlify deploy --prod
```

## 4. Test with curl

Replace `YOUR-SITE` with your Netlify domain:

```bash
# Should send a WhatsApp message and return {"ok":true,"sent":true}
curl -X POST https://YOUR-SITE.netlify.app/.netlify/functions/notify \
  -H "Content-Type: application/json" \
  -d '{"event":"resume_download","page":"https://YOUR-SITE.netlify.app/","time":"2026-01-01T10:00:00Z"}'

# Visit alert
curl -X POST https://YOUR-SITE.netlify.app/.netlify/functions/notify \
  -H "Content-Type: application/json" -d '{"event":"page_visit"}'

# Should return 405 (only POST is allowed)
curl -i https://YOUR-SITE.netlify.app/.netlify/functions/notify
```

Then open your live site and click **Download resume** as a final check.

Local testing: `netlify dev` runs the site and function on your machine. Put the two variables in a local `.env` file and **add `.env` to `.gitignore`**.

## 5. Turn visit alerts off

In `index.html`, change:

```js
var SEND_VISIT_ALERTS = true;
```
to
```js
var SEND_VISIT_ALERTS = false;
```
and redeploy. Resume-download alerts keep working.

## Notes and limits

- **Rate limit:** at most 5 alerts per minute per event type. The counter lives in memory inside one function instance, so treat it as a safety net rather than an exact global limit.
- **Your resume button:** the snippet watches `#download-resume, a[download]`. If your button uses another id or class, edit `RESUME_BUTTON_SELECTOR`.
- **Reliability:** CallMeBot is a free, unofficial service. Messages can be delayed or occasionally dropped. Check the Netlify function logs (Netlify > Logs > Functions) if alerts stop. Logs never contain your key.
- **Security:** if the key ever leaks, request a new one from CallMeBot and update the Netlify variable.

## Alternatives

- **Twilio WhatsApp API:** official and more reliable, but needs a Twilio account, a WhatsApp sender (sandbox for testing), and has a small per-message cost. You would replace the CallMeBot `fetch` in `notify.js` with a call to Twilio's Messages API, using your Account SID and Auth Token as environment variables.
- **Email fallback:** use a service such as Resend, SendGrid or Formspree from the same function. It is free at this volume and works well as a backup if WhatsApp delivery fails.
