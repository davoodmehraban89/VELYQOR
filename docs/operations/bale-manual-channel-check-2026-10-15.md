# Bale bot: one owner-only message test — NOT EXECUTED

Date: 2026-10-15. **This is a local operator procedure and mock-tested script only**, not operational proof or a live alert adapter.

Official Bale Bot API: https://docs.bale.ai/ ; create a bot by sending instructions to **@botfather in Bale**; API requests use HTTPS endpoint https://tapi.bale.ai/bot{TOKEN}/METHOD, including sendMessage and getUpdates. API success returns a JSON ok:true, result.message_id; this proves **API acceptance, not human delivery/read**. Bale official 2026 free message quota and guaranteed reachability: **تأییدنشده**. The official documentation explicitly states normal bot send rate limits depend on chat interaction. **Business/bulk-message API requires a charged Bale business account and per-message balance**; this is outside the owner's zero-cost constraint and MUST NOT be used. Official https://docs.bale.ai/ (section «افزایش سقف ارسال و ارسال پیام انبوه»). An initial one-user test does not prove reliable future unattended notifications.

### Inputs — keep them on YOUR trusted device, never paste into ChatGPT/GitHub/issues

1. **BALE_BOT_TOKEN**: private new/test bot token issued by @botfather. Never send over chat or put in URL shown in history. Use a dedicated test bot if you already have an active production webhook.
2. **BALE_CHAT_ID**: numeric ID of YOUR private opted-in Bale conversation with that bot. The account must open bot and send /start first; an arbitrary username is not enough.
3. **BALE_TEST_CONSENT = I_OWN_THIS_CHAT**: explicit local send unlock, no automatic retry, maximum ONE message.
4. Optional **BALE_DISCOVERY_NONCE**: random local 8–64 ASCII identifier that you send in a private message to the bot (e.g. /start followed by the nonce) so the read-only --discover mode outputs ONLY the intended chat ID. The script ignores other chats. If getUpdates conflicts with an existing webhook, DO NOT delete/replace that webhook without owner approval; use a new test bot.

### Local steps (Node.js 22+)

In a trusted shell with no command-history capture of secret values:

- First validate dry-run (requires no token and causes no network):
    node scripts/diagnostics/bale-one-message-test.mjs --dry-run
- Set BALE_BOT_TOKEN through an **interactive hidden input / local secret environment manager**, not an argument on the command line, in a repo file, or a GitHub Action. Do not print it.
- Generate your own random BALE_DISCOVERY_NONCE locally, tell only your bot the message /start <nonce> in Bale, and set the identical nonce as local environment variable.
- Run chat discovery:
    node scripts/diagnostics/bale-one-message-test.mjs --discover
  This makes a getUpdates call; it prints only the matching numeric chat ID, not other users' messages. If multiple/missing matches it refuses.
- Set local BALE_CHAT_ID to that private numeric ID, and local BALE_TEST_CONSENT to literal I_OWN_THIS_CHAT.
- Run exactly one real send manually:
    node scripts/diagnostics/bale-one-message-test.mjs --send
- On HTTP 200, verified ok:true and the expected target chat/message ID, result reads **Bale_API_ACCEPTED_NOT_READ_CONFIRMED**. Check the Bale app yourself: actual delivery visible? Record local success/failure timestamp and masked message ID. Only then mark the channel **tested to this one account**, not a general delivery SLA.
- Immediately clear BALE_BOT_TOKEN, BALE_CHAT_ID and consent variables from the local shell. If token was exposed, rotate in BotFather.

### Safety and test coverage

Code: scripts/diagnostics/bale-one-message-test.mjs; test: same path ending .test.mjs. Dry run is default. Unit tests mock fetch: safe dry run, missing-token/consent gates, exactly one POST, redact API error, nonce-based chat discovery. CI **never calls --send or --discover** and has no bot credentials. Script logs no full response or token; no retries are attempted (avoids duplicate sends after network uncertainty).

**NOT COMPLETE:** No live token was used, no real message sent or delivered in Stage 2, recipient feedback and any Bale bot quota are **تأییدنشده**. Requires owner-run local smoke and written result, no production Worker integration.
