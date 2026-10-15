# ChartNova — Blank/Black Screen Diagnostic (2026-10-15)

**Issue reported:** `https://app.chartnova.ir/` opens as a fully blank white or black page for the user.  
**Scope:** Read-only Cloudflare configuration inspection, external fetch and GitHub-hosted browser smoke. **No DNS/Worker/Production changes made.**

## Cloudflare evidence (live API)

- Zone `chartnova.ir`: active; authoritative nameservers `josh.ns.cloudflare.com`, `tegan.ns.cloudflare.com`.
- `app.chartnova.ir` and root apex DNS proxied AAAA records configured; Google's public resolver returned valid Cloudflare IPv4 **and** IPv6 answers. Record value `100::` behind proxy is intentionally not the public answer; **do not replace DNS merely on that observation**.
- Existing route `app.chartnova.ir/*` → Worker `velyqor-preview`; root route → the same Worker.
- Latest deployed Worker version dates to 2026-10-11; not to the current GitHub ChartNova Trading feature branch.
- Worker sends 61,148-character HTML page (inline CSS/JS), `Cache-Control: no-store`; static dashboard is visible in initial HTML and all referenced element IDs exist. It registers a versioned `chartnova-v1` Service Worker with network-first navigation fallback to cached `/` when network fails. Older cached content **could** affect an already-used browser, but this is **not proven** as the user's root cause.
- `/api/markets`, `/api/domestic`, `/api/xau`, `/api/widget` and `/api/history?symbol=EUR_USD_ECB` responded to direct external requests. The exact browser-side UI code in production has not been updated by paper-trading PR #27.

## Real browser smoke, GitHub Actions

Workflow `ChartNova Public Blank Screen Diagnostic` run [38643795890](https://github.com/davoodmehraban89/VELYQOR/actions/runs/38643795890), **SUCCESS**.

Chromium, production site with fresh browser sessions:
1. Desktop 1366×768, service workers blocked: HTTP 200; shell visible; dashboard visible; 959 body text characters; market-data status `داده بازار به‌روز · بررسی هر ۱۵ دقیقه`; **0 page JS errors, 0 console errors, 0 failed requests**.
2. Mobile 390×844, service workers blocked: HTTP 200; 939 body text chars; dashboard visible; **0 JS errors**.
3. Mobile 390×844, service workers allowed: HTTP 200; 939 body text chars; service worker controlled and `chartnova-v1` cache registered; **0 JS errors**.

Playwright WebKit (Safari-like on Linux; NOT an actual user's iOS Safari installation):
4. iPhone 13 emulation, service worker blocked: HTTP 200; 946 body text chars; dashboard visible; **0 JS or network errors**.
5. iPhone 13 emulation, service worker allowed: HTTP 200; 946 body text chars; dashboard visible; service worker controlled; **0 JS or network errors**.

Production HTML inline JavaScript also parsed without syntax exceptions by Node `vm.Script`.

**Diagnostic conclusion:** The blank screen is **not reproducible from the tested fresh browsers** and no server-wide DNS failure, origin content outage, JS syntax error or universal Safari/WebKit incompatibility was demonstrated. This does **not** rule out client-local cached or PWA state, a failing path through a specific ISP/VPN resolver, device-specific iOS/Android WebView issues, extension/content blocking, or intermittent outages not observed during testing.

## User-side isolation (non-destructive first)

1. On the **same device and same network**, compare `https://chartnova.ir/` (separate site origin, same Worker) to `https://app.chartnova.ir/`.
2. Open `https://app.chartnova.ir/` in a **private/incognito tab** to isolate old local data/service worker. Do not clear all browser data at this stage.
3. Compare Wi-Fi with mobile data and VPN enabled vs disabled, if applicable.
4. If private browsing succeeds but the normal tab stays blank: clear **site-specific** data for `app.chartnova.ir` (on iOS, Safari Website Data by site) and restart that tab. Warn that site preferences/locally saved app settings could be lost. Never instruct the user to reset all browser data unnecessarily.
5. If both private and normal mode fail only on one network: inspect DNS/VPN and secure DNS/Private Relay, not Workers.
6. Ask for **exact browser, device/OS, screenshot and whether root apex works** before shipping any production code changes.

## Acceptance gate

- Do not infer site restored for the user from fresh-browser green CI.
- No production restart/deployment, Cloudflare route/DNS rewrite or Service Worker cache invalidation was carried out.
- Keep [PR #28](https://github.com/davoodmehraban89/VELYQOR/pull/28) as a **Draft diagnostic PR** unless owner separately approves monitoring change; its workflow contacts the current public site only by HTTP GET/browser navigation.
