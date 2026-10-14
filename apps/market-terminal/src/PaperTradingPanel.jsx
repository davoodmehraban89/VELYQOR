import React, { useState } from 'react';
import {
  openPaperPosition, markPaperPosition, closePaperPosition, paperRiskSummary
} from '../../../packages/market-domain/src/paper-position.mjs';

const format = (x) => Number.isFinite(x) ?
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 5 }).format(x) : '—';
const nextTimestamp = (prev) => {
  const previous = prev ? Date.parse(prev) : 0;
  return new Date(Math.max(Date.now(), previous + 1)).toISOString();
};

export default function PaperTradingPanel({ symbol, onPositionChange }) {
  const [position, setPosition] = useState(null);
  const [side, setSide] = useState('LONG');
  const [entry, setEntry] = useState('');
  const [capital, setCapital] = useState('1000');
  const [stopLoss, setStopLoss] = useState('1.2');
  const [takeProfit, setTakeProfit] = useState('2');
  const [trailing, setTrailing] = useState('1');
  const [useTrailing, setUseTrailing] = useState(true);
  const [commission, setCommission] = useState('0');
  const [slippage, setSlippage] = useState('0');
  const [nextPrice, setNextPrice] = useState('');
  const [error, setError] = useState('');

  function commit(next) {
    setPosition(next);
    onPositionChange(next);
    setError('');
  }
  function open() {
    try {
      const p = openPaperPosition({
        symbol, side, entryPrice: entry, capital,
        stopLossPercent: stopLoss, takeProfitPercent: takeProfit,
        trailingStopPercent: useTrailing ? trailing : null,
        commissionBps: commission, slippageBps: slippage,
        at: nextTimestamp()
      });
      setNextPrice(String(p.entryPrice));
      commit(p);
    } catch (e) { setError(e.message); }
  }
  function evaluate() {
    try {
      if (!position || position.status !== 'OPEN') return;
      commit(markPaperPosition(position, {
        price: nextPrice, at: nextTimestamp(position.lastAt)
      }));
    } catch (e) { setError(e.message); }
  }
  function exitManual() {
    try {
      if (!position || position.status !== 'OPEN') return;
      commit(closePaperPosition(position, {
        price: nextPrice, at: nextTimestamp(position.lastAt)
      }));
    } catch (e) { setError(e.message); }
  }
  function restart() {
    setPosition(null);
    onPositionChange(null);
    setNextPrice('');
    setError('');
  }
  const report = position ? paperRiskSummary(position) : null;
  const fieldsDisabled = Boolean(position);
  return (
    <section className="paper-trading" aria-label="مدیریت موقعیت آزمایشی بدون معامله واقعی">
      <div className="paper-title">
        <h3>مدیریت معامله آزمایشی</h3>
        <span className="paper-badge">PAPER ONLY · بدون سفارش واقعی</span>
      </div>
      <p className="paper-disclosure">
        این پنل فقط سناریوهای عددی را شبیه‌سازی می‌کند؛ هیچ سفارشی به صرافی یا کارگزاری ارسال نمی‌شود.
        قیمت‌ها را خودت وارد می‌کنی. نرخ مرجع ECB و داده تاریخی، قیمت قابل‌اجرای معامله نیستند.
      </p>
      <div className="paper-grid">
        <label>جهت فرضی معامله
          <select value={side} disabled={fieldsDisabled} onChange={e => setSide(e.target.value)}>
            <option value="LONG">خرید / Long</option>
            <option value="SHORT">فروش / Short (شبیه‌سازی مفهومی)</option>
          </select>
        </label>
        <label>قیمت ورود فرضی ({symbol})
          <input inputMode="decimal" type="number" min="0" step="any" value={entry}
            disabled={fieldsDisabled} onChange={e => setEntry(e.target.value)} placeholder="دستی وارد کنید" />
        </label>
        <label>سرمایه فرضی (واحد ارز مظنه)
          <input inputMode="decimal" type="number" min="0" step="any" value={capital}
            disabled={fieldsDisabled} onChange={e => setCapital(e.target.value)} />
        </label>
        <label>حد ضرر (%)
          <input inputMode="decimal" type="number" min="0" max="99" step="any" value={stopLoss}
            disabled={fieldsDisabled} onChange={e => setStopLoss(e.target.value)} />
        </label>
        <label>حد سود (%)
          <input inputMode="decimal" type="number" min="0" max="99" step="any" value={takeProfit}
            disabled={fieldsDisabled} onChange={e => setTakeProfit(e.target.value)} />
        </label>
        <label className="paper-switch"><input type="checkbox" checked={useTrailing}
          disabled={fieldsDisabled} onChange={e => setUseTrailing(e.target.checked)} />
          حد ضرر متحرک
        </label>
        {useTrailing && <label>فاصله Trailing (%)
          <input inputMode="decimal" type="number" min="0" max="99" step="any" value={trailing}
            disabled={fieldsDisabled} onChange={e => setTrailing(e.target.value)} />
        </label>}
        <label>کارمزد فرضی (bps)
          <input inputMode="decimal" type="number" min="0" max="500" step="any"
            value={commission} disabled={fieldsDisabled} onChange={e => setCommission(e.target.value)} />
        </label>
        <label>لغزش فرضی (bps)
          <input inputMode="decimal" type="number" min="0" max="500" step="any"
            value={slippage} disabled={fieldsDisabled} onChange={e => setSlippage(e.target.value)} />
        </label>
      </div>
      {!position ? (
        <button type="button" className="paper-action" onClick={open}>ساخت موقعیت آزمایشی</button>
      ) : (
        <>
          <div className="paper-metrics" aria-live="polite">
            <div><span>وضعیت</span><strong>{position.status === 'OPEN' ? 'باز (فرضی)' : 'بسته (فرضی)'}</strong></div>
            <div><span>ورود</span><strong>{format(report.entryPrice)}</strong></div>
            <div><span>آخرین سناریو</span><strong>{format(report.markPrice)}</strong></div>
            <div><span>حد ضرر مؤثر</span><strong>{format(report.stopPrice)}</strong></div>
            <div><span>حد سود</span><strong>{format(report.takeProfitPrice)}</strong></div>
            <div><span>سود / زیان فرضی، پس از هزینه</span>
              <strong className={report.netPnL >= 0 ? 'paper-positive' : 'paper-negative'}>
                {format(report.netPnL)} ({format(report.netPnLPct)}٪)
              </strong></div>
          </div>
          {position.status === 'OPEN' && (
            <div className="paper-manual">
              <label>قیمت سناریوی بعدی (دستی)
                <input inputMode="decimal" type="number" min="0" step="any"
                  value={nextPrice} onChange={e => setNextPrice(e.target.value)} />
              </label>
              <div className="paper-buttons">
                <button type="button" className="paper-action" onClick={evaluate}>ثبت قیمت و ارزیابی حدود</button>
                <button type="button" className="paper-plain" onClick={exitManual}>بستن فرضی موقعیت</button>
              </div>
            </div>
          )}
          {position.exit && (
            <p className="paper-outcome" role="status">
              موقعیت فرضی بسته شد: {position.exit.reason === 'STOP' ? 'حد ضرر / متحرک' :
                position.exit.reason === 'TAKE_PROFIT' ? 'حد سود' : 'بستن دستی'}.
              قیمت مدل‌شده خروج: {format(position.exit.fillPrice)}؛ این قیمت تضمین اجرای واقعی نیست.
            </p>
          )}
          <details className="paper-events">
            <summary>تاریخچه رویدادهای سناریو ({position.events.length})</summary>
            <ol>{position.events.map((event, i) => (
              <li key={i}><span>{event.type}</span> — {format(event.price ?? event.observedPrice)}
                <small dir="ltr">{event.at}</small></li>
            ))}</ol>
          </details>
          <button type="button" className="paper-reset" onClick={restart}>سناریوی جدید</button>
        </>
      )}
      {error && <p role="alert" className="paper-error">{error}</p>}
      <p className="paper-footnote">این شبیه‌سازی پس از بارگذاری مجدد صفحه پاک می‌شود؛ هنوز ذخیره‌سازی حساب، اجرای سفارش، اتصال قیمت قابل معامله و پایش سروری ندارد.</p>
    </section>
  );
}
