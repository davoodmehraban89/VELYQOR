import React, { useEffect, useMemo, useState } from 'react';
import {
  createPaperWorkspace, addPaperPosition, markPaperWorkspacePosition,
  closePaperWorkspacePosition, paperWorkspaceSummary, restorePaperWorkspace,
  exportPaperWorkspaceCSV
} from '../../../packages/market-domain/src/paper-workspace.mjs';
import {analyzePaperTrend,initialPaperRiskReward} from '../../../packages/market-domain/src/paper-trend.mjs';

const KEY = 'velyqor.paper-workspace.v1';
const fmt = value => Number.isFinite(value) ?
  new Intl.NumberFormat('fa-IR',{maximumFractionDigits:6}).format(value) : '—';
function PaperSparkline({prices}){
  if(!prices||prices.length<2)return <span>برای نمایش روند به حداقل دو قیمت سناریویی نیاز است.</span>;
  const min=Math.min(...prices),max=Math.max(...prices),spread=Math.max(0.000001,max-min);
  const points=prices.map((value,index)=>{
    const x=10+index*280/(prices.length-1);
    const y=65-(value-min)/spread*50;
    return x.toFixed(2)+','+y.toFixed(2);
  }).join(' ');
  return <svg viewBox="0 0 300 75" role="img" aria-label="نمودار تغییرات قیمت‌های فرضی واردشده">
    <polyline points={points} fill="none" stroke="#61dbc8" strokeWidth="2"
      strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}
function init(){
  try {
    const raw=window.localStorage.getItem(KEY);
    return {workspace:raw?restorePaperWorkspace(raw):createPaperWorkspace(),blocked:false,warning:''};
  } catch {
    return {workspace:createPaperWorkspace(),blocked:true,
      warning:'بازیابی ایمن داده‌های قبلی ناموفق بود. برای جلوگیری از پاک‌شدن آن‌ها، ذخیره‌سازی متوقف است. داده‌ها را جداگانه بررسی یا بازنشانی کن.'};
  }
}
function nextTime(last){
  const t=last?Date.parse(last):0;
  return new Date(Math.max(Date.now(),t+1)).toISOString();
}
export default function PaperTradingPanel({symbol,onPositionChange}){
  const [initial]=useState(init);
  const [workspace,setWorkspace]=useState(initial.workspace);
  const [blocked,setBlocked]=useState(initial.blocked);
  const [storageWarning,setStorageWarning]=useState(initial.warning);
  const [selectedId,setSelectedId]=useState(null);
  const [side,setSide]=useState('LONG');
  const [entry,setEntry]=useState('');
  const [capital,setCapital]=useState('1000');
  const [stopLoss,setStopLoss]=useState('1.2');
  const [takeProfit,setTakeProfit]=useState('2');
  const [useTrailing,setUseTrailing]=useState(true);
  const [trailing,setTrailing]=useState('1');
  const [commission,setCommission]=useState('0');
  const [slippage,setSlippage]=useState('0');
  const [nextPrice,setNextPrice]=useState('');
  const [error,setError]=useState('');
  const summary=useMemo(()=>paperWorkspaceSummary(workspace),[workspace]);
  const localPositions=workspace.positions.filter(p=>p.position.symbol===symbol);
  const selected=localPositions.find(p=>p.id===selectedId)??localPositions.at(-1)??null;
  const position=selected?.position??null;
  const report=position?summary.positions.find(p=>p.id===selected.id):null;
  const trend=position?analyzePaperTrend(position):null;
  const ratio=position?initialPaperRiskReward(position):null;

  useEffect(()=>{
    if(blocked)return;
    try {window.localStorage.setItem(KEY,JSON.stringify(workspace));setStorageWarning('')}
    catch {setStorageWarning('ذخیره محلی در این مرورگر موفق نبود؛ با بستن صفحه ممکن است اطلاعات از دست برود.')}
  },[workspace,blocked]);
  useEffect(()=>{onPositionChange(position)},[position,onPositionChange]);

  function update(fn){
    try {
      const updated=fn(workspace);
      setWorkspace(updated);setError('');
    }catch(ex){setError(ex instanceof Error?ex.message:String(ex))}
  }
  function create(){
    if(blocked){setError('بازیابی مخدوش است؛ ابتدا با دکمه بازنشانی، وضعیت مرورگر را تعیین تکلیف کن.');return}
    update(w=>{
      const next=addPaperPosition(w,{
        symbol,side,entryPrice:entry,capital,
        stopLossPercent:stopLoss,takeProfitPercent:takeProfit,
        trailingStopPercent:useTrailing?trailing:null,
        commissionBps:commission,slippageBps:slippage,
        at:nextTime()
      });
      setSelectedId(next.positions.at(-1).id);
      setNextPrice(entry);
      return next;
    });
  }
  function tick(){
    if(!selected||!position||position.status!=='OPEN')return;
    update(w=>markPaperWorkspacePosition(w,selected.id,{price:nextPrice,at:nextTime(position.lastAt)}));
  }
  function manualExit(){
    if(!selected||!position||position.status!=='OPEN')return;
    update(w=>closePaperWorkspacePosition(w,selected.id,{price:nextPrice,at:nextTime(position.lastAt)}));
  }
  function downloadAudit(){
    const csv=exportPaperWorkspaceCSV(workspace);
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='velyqor-paper-scenarios.csv';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  function reset(){
    if(!window.confirm('تمام موقعیت‌های آزمایشی ذخیره‌شده در همین مرورگر پاک شوند؟ این کار برگشت‌پذیر نیست.'))return;
    try{window.localStorage.removeItem(KEY)}catch{}
    setWorkspace(createPaperWorkspace());
    setSelectedId(null);setNextPrice('');setError('');
    setBlocked(false);setStorageWarning('');
  }
  return <section className="paper-trading" aria-label="مدیریت چند موقعیت آزمایشی بدون معامله واقعی">
    <div className="paper-title">
      <h3>مدیریت ریسک و معاملات آزمایشی</h3>
      <span className="paper-badge">PAPER ONLY</span>
    </div>
    <p className="paper-disclosure">
      هیچ خریدوفروشی انجام نمی‌شود. قیمت ورود و قیمت هر مرحله را دستی وارد کن؛
      داده مرجع ECB و نمودارهای تاریخی هیچ‌وقت به‌عنوان قیمت قابل معامله استفاده نمی‌شوند.
      تغییرات فقط در همین مرورگر نگهداری می‌شوند.
    </p>
    <div className="paper-metrics">
      <div><span>موقعیت‌های فرضی باز (تمام نمادها)</span><strong>{fmt(summary.open)}</strong></div>
      <div><span>موقعیت‌های فرضی بسته</span><strong>{fmt(summary.closed)}</strong></div>
    </div>
    <label className="paper-picker">سناریوهای نماد {symbol}
      <select value={selected?.id??''} onChange={e=>{setSelectedId(e.target.value);const found=localPositions.find(x=>x.id===e.target.value);setNextPrice(String(found?.position.markPrice??''))}}>
        {localPositions.length===0&&<option value="">هنوز سناریویی ثبت نشده</option>}
        {localPositions.map(item=><option value={item.id} key={item.id}>
          {item.id} · {item.position.side} · {item.position.status==='OPEN'?'باز':'بسته'} · {fmt(item.position.entryPrice)}
        </option>)}
      </select>
    </label>
    <details className="paper-setup">
      <summary>ساخت موقعیت آزمایشی جدید</summary>
      <div className="paper-grid">
        <label>نوع موقعیت
          <select value={side} onChange={e=>setSide(e.target.value)}>
            <option value="LONG">خرید فرضی / Long</option>
            <option value="SHORT">فروش فرضی / Short (بدون اعتبار یا اهرم واقعی)</option>
          </select>
        </label>
        <label>قیمت ورود فرضی
          <input aria-label="قیمت ورود" type="number" min="0" step="any" value={entry} onChange={e=>setEntry(e.target.value)} placeholder="دستی" />
        </label>
        <label>سرمایه فرضی (واحد ارز مظنه)
          <input type="number" min="0" step="any" value={capital} onChange={e=>setCapital(e.target.value)} />
        </label>
        <label>حد ضرر (%)
          <input type="number" min="0" max="99" step="any" value={stopLoss} onChange={e=>setStopLoss(e.target.value)} />
        </label>
        <label>حد سود (%)
          <input type="number" min="0" max="99" step="any" value={takeProfit} onChange={e=>setTakeProfit(e.target.value)} />
        </label>
        <label className="paper-switch">
          <input type="checkbox" checked={useTrailing} onChange={e=>setUseTrailing(e.target.checked)}/>
          حد ضرر متحرک
        </label>
        {useTrailing&&<label>فاصله Trailing (%)
          <input type="number" min="0" max="99" step="any" value={trailing} onChange={e=>setTrailing(e.target.value)} />
        </label>}
        <label>کارمزد فرضی (bps)
          <input type="number" min="0" max="500" step="any" value={commission} onChange={e=>setCommission(e.target.value)} />
        </label>
        <label>لغزش فرضی (bps)
          <input type="number" min="0" max="500" step="any" value={slippage} onChange={e=>setSlippage(e.target.value)} />
        </label>
      </div>
      <button className="paper-action" type="button" disabled={blocked||summary.open>=10} onClick={create}>
        ایجاد موقعیت فرضی
      </button>
    </details>
    {position&&<>
      <div className="paper-metrics" aria-live="polite">
        <div><span>وضعیت</span><strong>{position.status==='OPEN'?'باز (فرضی)':'بسته (فرضی)'}</strong></div>
        <div><span>نوع</span><strong>{report.side}</strong></div>
        <div><span>ورود</span><strong>{fmt(report.entryPrice)}</strong></div>
        <div><span>آخرین قیمت سناریو</span><strong>{fmt(report.markPrice)}</strong></div>
        <div><span>حد ضرر مؤثر</span><strong>{fmt(report.stopPrice)}</strong></div>
        <div><span>حد سود</span><strong>{fmt(report.takeProfitPrice)}</strong></div>
        <div><span>سود/زیان فرضی پس از هزینه</span>
          <strong className={report.netPnL>=0?'paper-positive':'paper-negative'}>{fmt(report.netPnL)} ({fmt(report.netPnLPct)}٪)</strong>
        </div>
      </div>
      {trend&&<section className="paper-trend-card" aria-label="تحلیل توصیفی سناریوی دستی">
        <strong>روند سناریوی آموزشی، نه پیش‌بینی بازار</strong>
        <PaperSparkline prices={trend.points}/>
        <div className="paper-metrics">
          <div><span>وضعیت نمونه‌های دستی</span><strong>{trend.classification==='UP'?'صعودی':
            trend.classification==='DOWN'?'نزولی':trend.classification==='SIDEWAYS'?'خنثی':'داده ناکافی'}</strong></div>
          <div><span>تعداد نمونه</span><strong>{fmt(trend.sampleCount)}</strong></div>
          <div><span>تغییر پنج نمونه اخیر (%)</span><strong>{fmt(trend.momentumPercent)}</strong></div>
          <div><span>نسبت سود هدف به ریسک اولیه</span><strong>{fmt(ratio)} به ۱</strong></div>
        </div>
        <small>این محاسبات فقط روی قیمت‌های فرضی واردشده انجام می‌شوند و سیگنال خریدوفروش نیستند.</small>
      </section>}
      {position.status==='OPEN'&&<div className="paper-manual">
        <label>قیمت مرحله بعد (فقط سناریوی دستی)
          <input type="number" min="0" step="any" value={nextPrice}
            onChange={e=>setNextPrice(e.target.value)} />
        </label>
        <div className="paper-buttons">
          <button className="paper-action" type="button" disabled={blocked} onClick={tick}>ثبت تغییر و ارزیابی حدود</button>
          <button className="paper-plain" type="button" disabled={blocked} onClick={manualExit}>خروج فرضی دستی</button>
        </div>
      </div>}
      {position.exit&&<p className="paper-outcome" role="status">
        موقعیت بسته شد: {position.exit.reason==='STOP'?'حد ضرر / متحرک':
          position.exit.reason==='TAKE_PROFIT'?'حد سود':'خروج دستی'}.
        قیمت خروج مدل‌شده: {fmt(position.exit.fillPrice)}؛ تضمین قیمت اجرای واقعی نیست.
      </p>}
      <details className="paper-events">
        <summary>تاریخچه تغییرات ({position.events.length})</summary>
        <ol>{position.events.map((item,i)=><li key={i}>
          {item.type} · {fmt(item.price??item.observedPrice)} <small dir="ltr">{item.at}</small>
        </li>)}</ol>
      </details>
    </>}
    <div className="paper-buttons paper-tools">
      <button type="button" className="paper-plain" onClick={downloadAudit} disabled={summary.total===0}>خروجی CSV سناریوها</button>
      <button type="button" className="paper-reset" onClick={reset}>پاک‌کردن تمام موقعیت‌های آزمایشی</button>
    </div>
    {storageWarning&&<p className="paper-error" role="alert">{storageWarning}</p>}
    {error&&<p className="paper-error" role="alert">{error}</p>}
    <p className="paper-footnote">
      محدودیت: حداکثر ۱۰ موقعیت باز، بدون اتصال سرور/حساب کاربری.
      بازسازی از تاریخچه رویدادها صحت محاسبات را کنترل می‌کند، ولی داده‌های مرورگر مدرک معاملات واقعی نیستند.
      سود و زیان نمادهایی با ارزهای متفاوت با هم جمع نمی‌شوند.
    </p>
  </section>;
}
