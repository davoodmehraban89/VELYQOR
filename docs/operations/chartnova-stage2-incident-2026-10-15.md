# Stage 2 — v27 rollback incident, read-only diagnosis (2026-10-15)

**Scope:** incident reproduction in existing version-specific Worker Preview and disposable GitHub Actions browsers. NO production Worker deploy, data edits, secrets, mail, messages or real trades.

## A. Exact deployment and Preview evidence

Direct Cloudflare read-only API verification (2026-10-15):
- Production Worker: **velyqor-preview**, **v26** ID **85177f9d-09c0-4763-b28c-2c6ba5ae5be5** at **100%**.
- **v27** ID **2cbeb4e2-4a3e-414f-b3ad-035e2378650b**, stored but no share of production traffic.
- Independent version Preview: https://2cbeb4e2-velyqor-preview.davoodmehraban89.workers.dev/ responded successfully.
- Both versions expose the same binding names/types (not values): MARKET_CACHE / kv_namespace, NAVASAN_API_KEY / secret_text, OANOR_API_KEY / secret_text; fetch and scheduled handlers. Secret values not retrieved.
- HTML script signature identifies version 27: 33129 inline JavaScript characters and chartnovaRefreshInFlight marker. Production v26: 32522 inline JavaScript characters and marker absent.

## Browser evidence: version 27 isolated test

GitHub Actions run [38765420366](https://github.com/davoodmehraban89/VELYQOR/actions/runs/38765420366), job **116527224644** passed. Script [diagnose-chartnova-v27-preview.mjs](../../scripts/diagnose-chartnova-v27-preview.mjs) tested five fresh isolated scenarios, with all API calls intercepted by test fixtures rather than sent to market providers or shared KV:
1. Chromium mobile / blocked SW / deliberately 503 APIs / reload
2. Chromium mobile / 7-second intentionally delayed market list
3. Chromium mobile / synthetic service worker allowed / 503 APIs / reload
4. WebKit mobile / blocked SW / deliberately 503 APIs / reload
5. WebKit mobile / 7-second deliberately delayed market list

**NOT REPRODUCED** in those five scenarios. Page shell/dashboard visibly rendered, HTML 200 and **no uncaught JavaScript exceptions**. As expected, the Browser Console recorded the deliberately generated HTTP 503 resource errors; a few requests were aborted while reloading. These are test fixture failures, **not proof that production is error-free**. During market delay the UI displayed an explicit incomplete-data status.

## Public-asset A/B comparison: v26 versus v27 (new evidence)

GitHub Actions [run 38773838137](https://github.com/davoodmehraban89/VELYQOR/actions/runs/38773838137), job **116556236854**, passed the immutable-version read-only comparison using [script](../../scripts/diagnose-chartnova-version-assets.mjs).

- Exact versioned public responses for both v26 and v27 were retrieved by GET; HTML and JavaScript were parsed and hashed with SHA-256.
- **Service Worker 507 bytes, byte-identical across v26 and v27:** SHA-256 `008057765a2bc7b9e94946136023db073f1113e573d1a8cb8b0236fa32911687`. Thus the deployment itself did not introduce a *new Service Worker script*.
- **HTML outside the single inline `<script>` element is byte-identical** (normalizing only that element). Neither root HTML markup nor external shell was changed between these two immutable assets.
- Inline JS SHA-256 v26: `975790c7aa98555ad598de5e3af9d06bcff9fa98bcc72522a3f0eb726aae807e`; v27: `0ef7cd41f63d28e82070ea1f6a15c85ba6e3876518d0d09e8ef119b0ef943535`; code differs and the known `chartnovaRefreshInFlight` marker is present only in v27.
- The hash record is of **public HTML/SW/inline JS from preview**, NOT the complete Worker/backend module, full provider adapter code, or all HTTP response headers. No claim is made that server-side behavior cannot differ.

**Decision:** Narrow investigation to inline JS runtime, network/CSP, old-device browser/PWA state and non-frontend Worker differences. A corrupted-cache fallback is a possible failure mechanism shared by both versions, not evidence of a v27-specific Service Worker regression. **Actual incident root cause: تأییدنشده.**

## Actual Service Worker mechanism and limits

Read-only Preview GET of /sw.js returned version 27 Service Worker code: cache key **chartnova-v1**, install precaches root plus icon and manifest, and navigation uses network-first fetch with fallback to cache.match('/'). An **existing browser cache** can therefore influence the navigation response during loss of network. However, the first five-scenario test used a synthetic SW (without this cache behavior); it does **not** prove the real SW safe. Separate [real-SW browser test](../../scripts/diagnose-chartnova-v27-sw-cache.mjs) tests cache fallback and intentionally corrupted **disposable** browser cache. Any blank page created by injecting a corrupt cache is a hypothetical mechanism, **not proof this occurred for the owner**.

**Verified isolated real-SW test:** GitHub Actions [run 38766991373](https://github.com/davoodmehraban89/VELYQOR/actions/runs/38766991373), job 116532678634, passed with the actual v27 Service Worker (507-byte script). A fresh disposable browser profile with **healthy cached HTML** remained visible offline; after deliberately replacing only that disposable profile's cache entry with empty/black HTML, a subsequent offline navigation became **blank**; restoring network recovered the visible site. Zero JS exceptions. This **proves a possible offline corrupted-cache fallback mechanism**; it **does not** establish that the user had this cache state, nor that v27 introduced it. The first attempt at the experiment failed because the browser route was still serving mocked HTML while offline; the simulation was corrected and rerun. **No real cache, Worker or production state was modified.**

Actual root cause of prior v27 device failure: **تأییدنشده**. Record of rollback decision: [documented incident](https://github.com/davoodmehraban89/VELYQOR/blob/ops/chartnova-emergency-rollback-2026-10-15/PROJECT_STATE.md). The owner reported the public app stopped opening; rollback to v26 was a **precaution**, not a proven identification of a v27 JavaScript defect.

## Exact information needed from owner for a conclusive device-level diagnosis

Supply SANITIZED screenshots and status only; never paste credentials, session cookies, API tokens, whole HAR exports or personal address:

1. Device model, OS version, browser version, and whether it is Safari tab, installed PWA/home-screen shortcut or embedded webview.
2. Exact failing URL, date/time + timezone, and whether app.chartnova.ir vs chartnova.ir, Private vs normal mode differ.
3. Wi-Fi/cellular/VPN/Private Relay enabled? Compare an alternate network if convenient, without revealing IP or location.
4. Screenshot of blank page with address bar, with any identifiers redacted.
5. Browser Console: original error text, stack trace, script file, line and column on a failing attempt.
6. Network summary for document /, SW /sw.js, /api/domestic, /api/xau, /api/markets: HTTP status, elapsed time, initiator, resource size, cache/service-worker indication; redact all user query values and headers. Do not send unredacted HAR.
7. Registration/state of SW, cache names and whether the browser is offline. **Capture evidence before clearing site data**; deleting cache can erase the repro.
8. For iPhone Safari, use a *trusted Mac* with Safari Web Inspector (Mac Safari Develop menu → iPhone → affected Safari page). If no Mac is available, collect points 1–4; do not invent Console logs.

## Rollback / acceptance

No production change to roll back from Stage 2. Close/revert Draft diagnostics PR if undesirable; keep production v26. Verdict is either (1) confirmed on-device root cause with stack/DOM/network evidence, (2) NOT REPRODUCED under controlled conditions, or (3) artificially reproduced *mechanism only*. Those are distinct. Another release of v27 is **not authorized** by this diagnostic.

**Still incomplete:** affected user's original cache, JS exception and network trace, verified v26 Worker source hash, provider licensing and actual end-to-end alert delivery; all **تأییدنشده**.
