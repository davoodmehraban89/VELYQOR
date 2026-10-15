# Stage 2 — ten interview questions for real Iranian day traders

**Interviews conducted by project owner, not ChatGPT.** No user data collected by us in Stage 2. Seek participants' permission; record anonymized themes and raw durations separately.

Don't anchor users with vendor quota numbers until Q1–4: first measure genuine need, then test the two realistic slow-service scenarios.

1. What market(s), instruments and times of day do you monitor, and what decision have you recently made from a price change? Ask about a concrete event, not a theoretical preference.
2. What is the maximum *observed delay* from a threshold crossing to notification that would still let you do the intended task? Request seconds/minutes/hours, and why.
3. What difference would a notification make if the move briefly crossed a threshold but recovered **between samples**? Would a missed transient be harmful, or is end-of-window monitoring enough?
4. Which exact quotation matters for an informational threshold: a supplier's **selling price**, buying price, reference rate, or spread? Would you trust a notification without showing side, source and timestamp?
5. Suppose the service checks only **every six hours** (Navasan free's theoretical one-request monthly quota floor). For which, if any, monitoring scenarios is that useful? Not "would you trade on it?"
6. Suppose the service checks at minimum roughly **every 5 minutes 45.6 seconds** (Gheymat Online one-request quota floor), and a safe pilot may poll every **10 minutes**. Is that useful, for what purpose, and what latency/reliability is unacceptable?
7. If the source becomes stale or two sources disagree, do you prefer no price alert plus a transparent source-state warning, or an unverified price notification? Why?
8. Which notification channel do you reliably see in Iran (Bale, Eita, Web Push, Telegram or none) and how often do messages arrive too late? Would a single test bot be acceptable?
9. What would you need to see before trusting this as a *non-advisory information tool* — sample age, provenance, uptime history, delay distributions, terms/rights, or incident history?
10. If there were a reliable version versus a delayed free version, how would you compare them? **Without implying that a paid release exists**, ask for an acceptable monthly price band (0 / small amount / custom), and what independently verified service level would justify paying.

### Capture anonymously

Interview date, user category (not identity), instrument, actual workflow, tolerance expressed *before anchoring*, reaction to six-hour and 5m45.6s quota floors, minimum necessary evidence, preferred channel, explicit willingness-to-pay band, red flags, and exact quoted answer where consented. No names, phone numbers, account numbers, transaction history or other identifying data in public GitHub.

### Analysis gate

Interview 2–5 consenting traders initially; summarize observed patterns, outlier needs, recurring safety concerns and rejections. Do not interpret hypothetical willingness-to-pay as revenue. Confirm supplier rights/quote side before any real source-driven pilot. Data lag/cadence is NOT a guaranteed notification-delivery SLA.

**Status: questions prepared, interviews not conducted, findings NOT VERIFIED.**
