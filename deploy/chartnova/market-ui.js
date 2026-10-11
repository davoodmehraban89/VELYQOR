// ChartNova market terminal: reads only cached, validated server data.
const marketState={items:[],receivedAt:null,source:null,error:null,selected:"USD-IRT",period:168,filter:"all",search:"",loaded:false};
const groupNames={CURRENCY:"ارز",GOLD:"طلا و فلزات",COIN:"سکه",CRYPTOCURRENCY:"رمزارز"};
const prioritized=["USD-IRT","GOLD18-IRT","GOLDO-USD","SEKE-IRT","USDT-IRT","BTC-USD","EUR-IRT","AED-IRT"];
const nfmt=(x,d=2)=>Number.isFinite(x)?new Intl.NumberFormat("fa-IR",{maximumFractionDigits:d}).format(x):"—";
const fmtDate=x=>{const z=Date.parse(x||"");return Number.isFinite(z)?new Date(z).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"}):"نامشخص"};
const unit=m=>m?.quote==="IRT"?"تومان":m?.quote==="USD"?"دلار":m?.quote||"";
const instrument=code=>marketState.items.find(m=>m.symbol===code);
const svgNS="http://www.w3.org/2000/svg";
function dom(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e}
function elem(tag,attrs={}){const e=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e}
function avg(values,len){if(values.length<len)return null;let sum=0;for(let i=values.length-len;i<values.length;i++)sum+=values[i];return sum/len}
function smaSeries(values,len){let sum=0;return values.map((v,i)=>{sum+=v;if(i>=len)sum-=values[i-len];return i+1>=len?sum/len:null})}
function emaSeries(values,len){const out=Array(values.length).fill(null);if(values.length<len)return out;let e=avg(values.slice(0,len),len);out[len-1]=e;const alpha=2/(len+1);for(let i=len;i<values.length;i++){e=(values[i]-e)*alpha+e;out[i]=e}return out}
function rsiSeries(values,len=14){const r=Array(values.length).fill(null);if(values.length<len+1)return r;let g=0,l=0;for(let i=1;i<=len;i++){const d=values[i]-values[i-1];g+=Math.max(0,d);l+=Math.max(0,-d)}g/=len;l/=len;const calc=()=>l===0?(g===0?50:100):100-100/(1+g/l);r[len]=calc();for(let i=len+1;i<values.length;i++){const d=values[i]-values[i-1];g=(g*(len-1)+Math.max(0,d))/len;l=(l*(len-1)+Math.max(0,-d))/len;r[i]=calc()}return r}
function analysis(values){if(!values||values.length<35)return null;const clean=values.every(x=>Number.isFinite(x)&&x>0);if(!clean)return null;const s20=smaSeries(values,20),s50=smaSeries(values,50),e20=emaSeries(values,20),e12=emaSeries(values,12),e26=emaSeries(values,26),rs=rsiSeries(values),macd=values.map((_,i)=>e12[i]!==null&&e26[i]!==null?e12[i]-e26[i]:null),valid=macd.filter(x=>x!==null),signal=emaSeries(valid,9).at(-1);const last=values.at(-1);return{values,close:last,sma20:s20.at(-1),sma50:s50.at(-1),ema20:e20.at(-1),rsi:rs.at(-1),macd:macd.at(-1),signal,macdHistogram:signal===null?null:macd.at(-1)-signal,change24:values.length>=25?(last/values.at(-25)-1)*100:null,range24:[Math.min(...values.slice(-24)),Math.max(...values.slice(-24))],smaSeries:s20,emaSeries:e20}}
function metric(name,value,description,tone){const root=dom("div","techmetric");root.append(dom("span","small",name),dom("strong","",value),dom("small","",description||""));if(tone)root.dataset.tone=tone;return root}
function drawSeries(target,values,period=168,withAverages=true){
 target.replaceChildren();
 if(!Array.isArray(values)||values.length<2){target.append(dom("p","small","داده تاریخی معتبر برای رسم نمودار موجود نیست."));return}
 const n=Math.min(period,values.length),slice=values.slice(-n);if(slice.some(x=>!Number.isFinite(x)||x<=0)){target.append(dom("p","small","داده تاریخی ناقص است."));return}
 const a=analysis(values),ma=a?.smaSeries?.slice(-n)||[],ema=a?.emaSeries?.slice(-n)||[];
 const series=[slice,...(withAverages?[ma,ema]:[])],good=series.flat().filter(Number.isFinite);
 let lo=Math.min(...good),hi=Math.max(...good);const padding=Math.max((hi-lo)*.11,hi*.0006);lo-=padding;hi+=padding;
 const w=900,h=275,x0=78,y0=14,plotW=804,plotH=208;
 const x=i=>x0+(i/(n-1))*plotW,y=v=>y0+(hi-v)/(hi-lo)*plotH;
 const svg=elem("svg",{viewBox:"0 0 900 275",role:"img","aria-label":"نمودار خطی واقعی تاریخچه قیمت، به همراه میانگین متحرک","preserveAspectRatio":"xMidYMid meet"});
 svg.style.width="100%";svg.style.height="auto";svg.style.direction="ltr";
 for(let row=0;row<=4;row++){const v=lo+(hi-lo)*(1-row/4),yy=y(v);svg.append(elem("line",{x1:x0,y1:yy,x2:x0+plotW,y2:yy,stroke:"var(--line)","stroke-width":1}));const label=elem("text",{x:x0-7,y:yy+4,"text-anchor":"end",fill:"var(--sub)","font-size":12});label.textContent=nfmt(v,0);svg.append(label)}
 function pathFor(arr){let out="",started=false;for(let i=0;i<arr.length;i++){const v=arr[i];if(!Number.isFinite(v)){started=false;continue}out+=(started?"L":"M")+x(i).toFixed(2)+" "+y(v).toFixed(2)+" ";started=true}return out.trim()}
 const defs=elem("defs"),grad=elem("linearGradient",{id:"chartNovaArea",x1:"0",x2:"0",y1:"0",y2:"1"});grad.append(elem("stop",{offset:"0%","stop-color":"var(--accent)","stop-opacity":".28"}),elem("stop",{offset:"100%","stop-color":"var(--accent)","stop-opacity":"0"}));defs.append(grad);svg.append(defs);
 const linePath=pathFor(slice);const area=elem("path",{d:linePath+" L"+x(n-1)+" "+(y0+plotH)+" L"+x0+" "+(y0+plotH)+" Z",fill:"url(#chartNovaArea)"});svg.append(area);
 svg.append(elem("path",{d:linePath,fill:"none",stroke:"var(--accent)","stroke-width":2.6,"stroke-linejoin":"round","stroke-linecap":"round"}));
 if(withAverages){svg.append(elem("path",{d:pathFor(ma),fill:"none",stroke:"#f59e0b","stroke-width":1.7,"stroke-dasharray":"5 4"}));svg.append(elem("path",{d:pathFor(ema),fill:"none",stroke:"#b28cff","stroke-width":1.7}))}
 const dot=elem("circle",{cx:x(n-1),cy:y(slice.at(-1)),r:4.3,fill:"var(--accent)",stroke:"var(--panel)","stroke-width":2});svg.append(dot);
 const marks=[["-"+(n-1)+" ساعت",x0],["اکنون",x(n-1)]];for(const [label,pos]of marks){const t=elem("text",{x:pos,y:254,"text-anchor":pos===x0?"start":"end",fill:"var(--sub)","font-size":13});t.textContent=label;svg.append(t)}
 const title=elem("title");title.textContent="سری "+n+" نمونه ساعتی؛ آخرین مقدار "+nfmt(slice.at(-1));svg.prepend(title);target.append(svg);
 const leg=dom("div","chartLegend");leg.append(dom("span","legendPrice","قیمت بسته‌شدن"));if(withAverages){leg.append(dom("span","legendSMA","SMA 20"),dom("span","legendEMA","EMA 20"))}target.append(leg)
}
function renderMarkets(){
 const root=el("marketgrid");if(!root)return;root.replaceChildren();
 const q=marketState.search.trim().toLocaleLowerCase(),group=marketState.filter;
 const list=marketState.items.filter(m=>(group==="all"||m.category===group)&&(!q||(m.symbol+" "+m.name+" "+m.base).toLocaleLowerCase().includes(q)))
 .sort((a,b)=>{const ia=prioritized.indexOf(a.symbol),ib=prioritized.indexOf(b.symbol);return(ia<0?100:ia)-(ib<0?100:ib)||a.symbol.localeCompare(b.symbol)});
 el("marketCount").textContent=marketState.items.length? nfmt(list.length,0)+" نماد از "+nfmt(marketState.items.length,0):"هنوز داده نمادها دریافت نشده";
 el("marketUpdated").textContent=marketState.receivedAt?"آخرین دریافت: "+fmtDate(marketState.receivedAt)+(Date.now()-Date.parse(marketState.receivedAt)>45*60000?" · نیازمند به‌روزرسانی":""):"در انتظار اولین همگام‌سازی";
 if(!list.length){root.append(dom("p","small",marketState.error||"نمادی با این فیلتر یافت نشد."));return}
 const frag=document.createDocumentFragment();
 for(const m of list){const item=dom("article","marketitem instrument");const top=dom("div","instrumentTop");top.append(dom("code","ticker",m.symbol),dom("span","marketTag",groupNames[m.category]||m.category));item.append(top,dom("div","instrumentName",m.name||m.symbol));item.append(dom("strong","instrumentPrice",nfmt(m.sellPrice)+" "+unit(m)));
 const change=Number.isFinite(m.change)?(m.change>=0?"+":"")+nfmt(m.change)+"٪":"—";const movement=dom("span","priceChange",change);movement.dataset.tone=m.change>=0?"up":"down";
 const low=dom("div","instrumentBottom");low.append(movement,dom("span","small",m.history?.length+" نمونه ساعتی"));item.append(low);
 const b=dom("button","pill","نمودار و تکنیکال ←");b.type="button";b.addEventListener("click",()=>marketAsset(m.symbol));item.append(b);
 frag.append(item)}root.append(frag);
 const src=el("sources");if(src){src.replaceChildren();src.append(dom("div","rowitem","منبع فهرست: قیمت آنلاین (GHEYMAT)"),dom("div","rowitem","نرخ نمایش‌داده‌شده: قیمت فروش به واحد نماد"),dom("div","rowitem","شناسه هر نماد بر پایه جفت‌ارز رسمی API است."),dom("div","rowitem","تاریخ نمونه‌ها طبق مستندات: ۱۶۸ قیمت ساعتی، نه OHLC"))}
}
function renderTechnical(){
 const m=instrument(marketState.selected),sel=el("techSymbol");if(!sel)return;
 if(sel.options.length!==marketState.items.length){sel.replaceChildren();for(const item of marketState.items){const opt=document.createElement("option");opt.value=item.symbol;opt.textContent=item.symbol+" · "+item.name;sel.append(opt)}}
 if(m)sel.value=m.symbol;
 const title=el("techTitle"),sub=el("techSub"),main=el("techChart"),result=el("techIndicators"),stat=el("techStatus");
 result.replaceChildren();
 if(!m){title.textContent="نماد انتخاب نشده";sub.textContent="در انتظار دریافت داده‌های بازار";main.replaceChildren();stat.textContent="برای تحلیل تکنیکال به داده تاریخی معتبر نیاز است.";return}
 title.textContent=(m.name||m.symbol)+" · "+m.symbol;
 sub.textContent="نرخ فروش: "+nfmt(m.sellPrice)+" "+unit(m)+" · زمان منبع: "+fmtDate(m.updatedAt);
 const history=m.history||[];
 const a=analysis(history);
 if(!a){main.replaceChildren();main.append(dom("p","small","تاریخچه معتبر کافی برای اندیکاتورها موجود نیست."));stat.textContent="اندیکاتور محاسبه نشد";return}
 drawSeries(main,history,marketState.period,true);
 const show=x=>nfmt(x,3),tone=x=>!Number.isFinite(x)?null:x>=0?"up":"down";
 result.append(metric("RSI (14)",show(a.rsi),a.rsi>70?"بالاتر از ۷۰":a.rsi<30?"پایین‌تر از ۳۰":"محدوده میانی",a.rsi>70?"down":a.rsi<30?"up":null));
 result.append(metric("SMA (20)",show(a.sma20),"میانگین متحرک ساده"));
 result.append(metric("EMA (20)",show(a.ema20),"میانگین متحرک نمایی"));
 result.append(metric("SMA (50)",show(a.sma50),"میانگین متحرک ساده ۵۰ساعته"));
 result.append(metric("MACD (12,26)",show(a.macd),"بر اساس قیمت‌های بسته‌شدن",tone(a.macd)));
 result.append(metric("Signal (9)",show(a.signal),"خط سیگنال MACD"));
 result.append(metric("هیستوگرام MACD",show(a.macdHistogram),"اختلاف MACD و Signal",tone(a.macdHistogram)));
 result.append(metric("تغییر ۲۴ساعته",a.change24===null?"—":(a.change24>=0?"+":"")+nfmt(a.change24)+"٪","محاسبه از نمونه‌های ساعتی",tone(a.change24)));
 result.append(metric("کمینه ۲۴ ساعت",nfmt(a.range24[0]),unit(m)+" · قیمت بسته‌شدن"));
 result.append(metric("بیشینه ۲۴ ساعت",nfmt(a.range24[1]),unit(m)+" · قیمت بسته‌شدن"));
 stat.textContent="داده تاریخی "+history.length+" نمونه ساعتی · منبع: "+(marketState.source||"قیمت آنلاین")+(m.isUpToDate?"":" · منبع، نماد را قدیمی اعلام کرده")+(marketState.receivedAt&&Date.now()-Date.parse(marketState.receivedAt)>45*60000?" · کش قدیمی":"")+"؛ نمودار خطی است و کندل یا حجم معاملات ندارد.";
 document.querySelectorAll("[data-period]").forEach(b=>b.classList.toggle("active",Number(b.dataset.period)===marketState.period));
}
function asset(k){chosen=k;document.querySelectorAll("[data-asset]").forEach(b=>b.classList.toggle("active",b.dataset.asset===k));renderSelected()}
function renderSelected(){
 const d=data[chosen];el("charttitle").textContent="نمودار "+names[chosen];el("selectedAsset").textContent=names[chosen];el("selectedPrice").textContent=d?nfmt(d.price)+(chosen==="xau"?" دلار":" تومان"):"ناموجود";el("selectedDate").textContent=d?.date||"نامشخص";el("selectedSource").textContent=d?.source||"نامشخص";
 const code=chosen==="usd"?"USD-IRT":chosen==="gold18"?"GOLD18-IRT":"GOLDO-USD",m=instrument(code);
 if(m?.history?.length>1){drawSeries(el("chartbox"),m.history,168,true);el("dashboardChartInfo").textContent="سری ساعتی قیمت آنلاین · "+m.symbol+(chosen==="xau"?" · نرخ کارت از Gold API است":"") }
 else{el("chartbox").textContent="هنوز سری تاریخی تأییدشده برای "+names[chosen]+" دریافت نشده است.";el("dashboardChartInfo").textContent="منتظر همگام‌سازی تاریخچه"}
}
function marketAsset(code){marketState.selected=code;show("technical");renderTechnical()}
async function loadMarkets(){
 try{const response=await fetch("/api/markets",{cache:"no-store"});if(!response.ok)throw Error("HTTP "+response.status);const payload=await response.json();if(!payload.ok||!Array.isArray(payload.markets)||!payload.markets.length)throw Error("No market data");
 marketState.items=payload.markets;marketState.receivedAt=payload.fetchedAt;marketState.source=payload.source;marketState.error=null;marketState.loaded=true;
 if(!instrument(marketState.selected))marketState.selected=marketState.items[0].symbol;
 }catch(e){marketState.error="فهرست نمادها در دسترس نیست؛ آخرین داده بارگذاری‌شده حفظ شده است."}
 renderMarkets();renderTechnical();renderSelected();
}
async function refresh(){
 el("status").textContent="در حال دریافت داده‌های ذخیره‌شده...";
 await Promise.allSettled([loadDomestic(),loadGold(),loadMarkets()]);
 renderSelected();renderMarkets();renderTechnical();
 const age=Date.parse(marketState.receivedAt||"");
 el("status").textContent=marketState.loaded?(Number.isFinite(age)&&Date.now()-age<=45*60000?"داده بازار به‌روز · بررسی هر ۱۵ دقیقه":"آخرین داده ذخیره‌شده · غیرلحظه‌ای"):"در انتظار داده نمادها · قیمت‌های موجود";
}
const originalShow=show;
show=function(k){for(const id of ["dashboard","markets","technical","settings"])el(id).hidden=id!==k;document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===k));el("pagetitle").textContent={dashboard:"داشبورد بازار",markets:"دیده‌بان ۵۸ نماد",technical:"تحلیل تکنیکال",settings:"شخصی‌سازی تجربه"}[k];if(k==="markets")renderMarkets();if(k==="technical")renderTechnical()};
function initializeMarkets(){
 const search=el("marketSearch");search.addEventListener("input",e=>{marketState.search=e.target.value;renderMarkets()});
 const cat=el("marketCategory");cat.addEventListener("change",e=>{marketState.filter=e.target.value;renderMarkets()});
 el("techSymbol").addEventListener("change",e=>{marketState.selected=e.target.value;renderTechnical()});
 document.querySelectorAll("[data-period]").forEach(b=>b.addEventListener("click",()=>{marketState.period=Number(b.dataset.period);renderTechnical()}));
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden)refresh()},3*60000);
}
initializeMarkets();
