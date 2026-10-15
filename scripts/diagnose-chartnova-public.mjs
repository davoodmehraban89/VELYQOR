import { chromium } from 'playwright';
import { Script } from 'node:vm';

const HOST = 'https://app.chartnova.ir/';
const TIMEOUT = 25_000;
const report = { target: HOST, checkedAt: new Date().toISOString(), html: {}, sessions: [] };
const safe = err => String(err?.message ?? err).slice(0, 400);
let failed = false;

// External GET only, no account sign-in, no credential collection, no cloud mutations.
try {
  const response = await fetch(HOST, { signal: AbortSignal.timeout(TIMEOUT), headers: { 'Cache-Control': 'no-cache' } });
  const html = await response.text();
  const match = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  report.html = {
    status: response.status, type: response.headers.get('content-type'),
    bytes: html.length, inlineScripts: match.length,
    hasVisibleAppMarkup: html.includes('class="shell"'),
    cacheControl: response.headers.get('cache-control'),
  };
  for (const [i, item] of match.entries()) {
    if (item[1].includes('src=')) continue;
    try { new Script(item[2], { filename: 'production-inline-' + i + '.js' }); }
    catch (err) { failed = true; report.html.syntaxError = safe(err); }
  }
  if (!response.ok || !report.html.hasVisibleAppMarkup) failed = true;
} catch (e) { failed = true; report.html.networkError = safe(e); }

const browser = await chromium.launch({ headless: true });
try {
  const suites = [
    { name: 'desktop-sw-blocked', viewport: { width: 1366, height: 768 }, mobile: false, serviceWorkers: 'block' },
    { name: 'mobile-sw-blocked', viewport: { width: 390, height: 844 }, mobile: true, serviceWorkers: 'block' },
    { name: 'mobile-sw-allowed', viewport: { width: 390, height: 844 }, mobile: true, serviceWorkers: 'allow' }
  ];
  for (const spec of suites) {
    const context = await browser.newContext({
      viewport: spec.viewport, isMobile: spec.mobile, hasTouch: spec.mobile,
      serviceWorkers: spec.serviceWorkers,
    });
    const page = await context.newPage();
    const result = { scenario: spec.name, jsErrors: [], consoleErrors: [], failedRequests: [] };
    page.on('pageerror', err => result.jsErrors.push(safe(err)));
    page.on('console', msg => { if (msg.type() === 'error') result.consoleErrors.push(msg.text().slice(0, 260)); });
    page.on('requestfailed', req => { if (result.failedRequests.length < 10) result.failedRequests.push({ path: new URL(req.url()).pathname, reason: req.failure()?.errorText }); });
    try {
      const response = await page.goto(HOST, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      result.httpStatus = response?.status() ?? null;
      await page.waitForTimeout(3500);
      result.ui = await page.evaluate(async () => {
        const shell = document.querySelector('.shell');
        const main = document.querySelector('main');
        const box = shell?.getBoundingClientRect();
        const css = shell ? getComputedStyle(shell) : null;
        let serviceWorkerController = false;
        let cacheKeys = [];
        try {
          serviceWorkerController = !!navigator.serviceWorker?.controller;
          cacheKeys = ('caches' in window) ? await caches.keys() : [];
        } catch {}
        return {
          readyState: document.readyState,
          title: document.title, bodyChars: document.body?.innerText.length ?? 0,
          shellExists: !!shell, shellWidth: box?.width ?? 0, shellHeight: box?.height ?? 0,
          shellDisplay: css?.display ?? null, shellVisibility: css?.visibility ?? null,
          mainExists: !!main, mainTextChars: main?.innerText.length ?? 0,
          initialDashboardVisible: document.getElementById('dashboard')?.hidden === false,
          status: document.getElementById('status')?.innerText.slice(0, 180) ?? null,
          serviceWorkerController, cacheKeys
        };
      });
      if (result.httpStatus !== 200 || !result.ui?.shellExists || result.ui?.shellWidth < 50 || result.ui?.bodyChars < 90 || result.jsErrors.length) failed = true;
    } catch (err) {
      failed = true; result.navigationError = safe(err);
    }
    report.sessions.push(result);
    await context.close();
  }
} finally { await browser.close(); }
console.log('CHARTNOVA_PUBLIC_BROWSER_DIAGNOSTIC ' + JSON.stringify(report));
if (failed) process.exitCode = 1;
