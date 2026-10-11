// Historical-data panel: one-year ECB daily reference observations from Neon or its verified KV fallback.
// IMPORTANT: this series is NOT OHLC, not intraday market-executable prices.
const ecbHistoryState={symbol:"EUR_USD_ECB",cache:new Map(),busy:false,error:null};
const ecbHistoryNames={EUR_USD_ECB:"یورو / دلار آمریکا",EUR_GBP_ECB:"یورو / پوند بریتانیا",EUR_CHF_ECB:"یورو / فرانک سوئیس"};
function historyFormat(x){return Number(x).toLocaleString("fa-IR",{minimumFractionDigits:2,maximumFractionDigits:5})}
function historyDate(date){if(!/^\d{4}-\d\d-\d\d$/.test(date||""))return "نامشخص";const d=new Date(date+"T12:00:00Z");return Number.isFinite(d.valueOf())?d.toLocaleDateString("fa-IR",{timeZone:"UTC"}):"نامشخص"}
async function loadEcbHistory(force=false){
 const symbol=ecbHistoryState.symbol;
 if(ecbHistoryState.busy||(!force&&ecbHistoryState.cache.has(symbol))){renderEcbHistory();return}
 ecbHistoryState.busy=true;ecbHistoryState.error=null;renderEcbHistory();
 try{
   const response=await fetch("/api/history?symbol="+encodeURIComponent(symbol),{cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const data=await response.json();
   if(data.ok!==true||data.symbol!==symbol||data.dataKind!=="daily_reference_point_not_ohlc"||!Array.isArray(data.series)||data.series.length<35)throw Error("داده معتبر دریافت نشد.");
   const entries=data.series;
   if(entries.some((r,i)=>!/^\d{4}-\d\d-\d\d$/.test(r.date)||!Number.isFinite(r.close)||r.close<=0||(i>0&&r.date<=entries[i-1].date)))throw Error("سری زمانی نامعتبر است.");
   ecbHistoryState.cache.set(symbol,data);
 }catch(err){ecbHistoryState.error="دریافت تاریخچه ممکن نشد؛ "+(err?.message||"خطای شبکه")}
 finally{ecbHistoryState.busy=false;renderEcbHistory()}
}
function paintEcbHistory(svgHost,rows,withSMA=true){
 svgHost.replaceChildren();
 if(!rows?.length){svgHost.append(dom("p","small","داده‌ای موجود نیست."));return}
 const values=rows.map(r=>r.close),sma=smaSeries(values,20),hi0=Math.max(...values),lo0=Math.min(...values),pad=Math.max((hi0-lo0)*.12,hi0*.005);
 const max=hi0+pad,min=lo0-pad,w=900,h=284,x0=78,y0=18,pw=800,ph=207;
 const X=i=>x0+i*pw/(rows.length-1),Y=v=>y0+(max-v)*ph/(max-min);
 const svg=elem("svg",{viewBox:"0 0 900 284",role:"img","aria-label":"نمودار یک‌ساله نرخ مرجع روزانه بانک مرکزی اروپا؛ داده کندل نیست."});
 svg.style.width="100%";svg.style.direction="ltr";
 for(let i=0;i<5;i++){const v=min+(max-min)*(4-i)/4,y=Y(v);svg.append(elem("line",{x1:x0,y1:y,x2:x0+pw,y2:y,stroke:"var(--line)","stroke-width":1}));const label=elem("text",{x:x0-8,y:y+4,"text-anchor":"end",fill:"var(--sub)","font-size":12});label.textContent=v.toFixed(3);svg.append(label)}
 const pathFor=(series)=>series.map((v,i)=>Number.isFinite(v)?(i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1):"").join(" ");
 svg.append(elem("path",{d:pathFor(values),fill:"none",stroke:"var(--accent)","stroke-width":2.5,"stroke-linecap":"round","stroke-linejoin":"round"}));
 if(withSMA)svg.append(elem("path",{d:sma.map((v,i)=>v===null?"":(i===19?"M":"L")+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" "),fill:"none",stroke:"#f59e0b","stroke-width":1.6,"stroke-dasharray":"5 4"}));
 for(const [position,label,align]of [[x0,rows[0].date,"start"],[x0+pw/2,rows[Math.floor(rows.length/2)].date,"middle"],[x0+pw,rows.at(-1).date,"end"]]){
   const n=elem("text",{x:position,y:255,"text-anchor":align,fill:"var(--sub)","font-size":12});n.textContent=label;svg.append(n)
 }
 const title=elem("title");title.textContent=ecbHistoryNames[ecbHistoryState.symbol]+": "+rows.length+" نرخ مرجع روزانه، نه کندل";svg.prepend(title);svgHost.append(svg);
 const legend=dom("div","chartLegend");legend.append(dom("span","legendPrice","نرخ روزانه ECB"),dom("span","legendSMA","SMA ۲۰روز کاری"));svgHost.append(legend)
}
function renderEcbHistory(){
 const status=el("historyStatus"),chart=el("historyChart"),metrics=el("historyMetrics");
 if(!status||!chart||!metrics)return;
 const data=ecbHistoryState.cache.get(ecbHistoryState.symbol);
 metrics.replaceChildren();
 if(ecbHistoryState.busy&&!data){status.textContent="در حال دریافت داده تاریخی معتبر...";chart.replaceChildren();return}
 if(!data){status.textContent=ecbHistoryState.error||"برای بارگذاری تاریخچه نماد را انتخاب کن.";chart.replaceChildren();return}
 const rows=data.series,values=rows.map(r=>r.close),a=analysis(values),first=rows[0],last=rows.at(-1);
 const staleNotice=Date.now()-Date.parse(last.date+"T23:59:59Z")>7*86400000;
 status.textContent=rows.length+" مشاهده روزانه | از "+historyDate(first.date)+" تا "+historyDate(last.date)+(staleNotice?" | آرشیو نیازمند همگام‌سازی":"")+" | منبع: بانک مرکزی اروپا";
 paintEcbHistory(chart,rows);
 const change=(last.close/first.close-1)*100;
 metrics.append(metric("نرخ آخر دوره",historyFormat(last.close),data.quoteCurrency+" در برابر ۱ یورو"));
 metrics.append(metric("تغییر کل دوره",(change>=0?"+":"")+change.toFixed(2)+"٪","صرفاً تغییر نرخ مرجع",change>=0?"up":"down"));
 metrics.append(metric("SMA ۲۰روز",a?historyFormat(a.sma20):"—","میانگین ۲۰ مشاهده"));
 metrics.append(metric("SMA ۵۰روز",a?historyFormat(a.sma50):"—","میانگین ۵۰ مشاهده"));
 metrics.append(metric("RSI ۱۴",a?a.rsi.toFixed(2):"—","براساس نرخ‌های مرجع روزانه"));
 metrics.append(metric("MACD ۱۲/۲۶",a?a.macd.toFixed(4):"—","براساس نرخ‌های مرجع روزانه"));
 const provenance=el("historyProvenance");
 if(provenance)provenance.textContent="مبدأ: ECB EXR (نرخ مرجع روزانه) · مسیر دریافت: "+(data.storage||"نسخه تاریخی کش‌شده")+" · زمان دریافت این نسخه: "+(data.fetchedAt?new Date(data.fetchedAt).toLocaleString("fa-IR"):"نامشخص");
}
function initializeEcbHistory(){
 const select=el("historySymbol");if(!select)return;
 select.addEventListener("change",e=>{ecbHistoryState.symbol=e.target.value;loadEcbHistory()});
 el("historyReload").addEventListener("click",()=>loadEcbHistory(true));
}
initializeEcbHistory();
