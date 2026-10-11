// ChartNova multi-asset widget configurator.
// Preferences are stored locally in this browser; native OS widgets require
// an iOS WidgetKit / Android App Widget implementation and synchronization.
const WIDGET_PREFERENCE_KEY="chartnova-widget-prefs-v1";
const WIDGET_DEFAULT_SYMBOLS=["USD-IRT","GOLD18-IRT","USDT-IRT","EUR-IRT"];
const WIDGET_VALID_THEMES=["dark","light","glass"];
const WIDGET_VALID_SIZES=["small","medium","large"];
const WIDGET_MAX_SYMBOLS=6;
function normalizeTickers(v,maximum=50){
 if(!Array.isArray(v))return [];
 return [...new Set(v.filter(x=>typeof x==="string"&&/^[A-Z0-9]{1,20}-[A-Z0-9]{2,10}$/.test(x)))].slice(0,maximum);
}
function loadWidgetPreferences(){
 const defaults={symbols:WIDGET_DEFAULT_SYMBOLS.slice(),favorites:WIDGET_DEFAULT_SYMBOLS.slice(),theme:"glass",size:"medium"};
 try{
  const stored=JSON.parse(localStorage.getItem(WIDGET_PREFERENCE_KEY)||"null");
  if(!stored||typeof stored!=="object")return defaults;
  return{
   symbols:normalizeTickers(stored.symbols,WIDGET_MAX_SYMBOLS).length?normalizeTickers(stored.symbols,WIDGET_MAX_SYMBOLS):defaults.symbols,
   favorites:normalizeTickers(stored.favorites,58),
   theme:WIDGET_VALID_THEMES.includes(stored.theme)?stored.theme:defaults.theme,
   size:WIDGET_VALID_SIZES.includes(stored.size)?stored.size:defaults.size
  };
 }catch{return defaults}
}
const widgetState=loadWidgetPreferences();
function saveWidgetPreferences(){try{localStorage.setItem(WIDGET_PREFERENCE_KEY,JSON.stringify(widgetState))}catch(e){}}
function widgetNotice(value){const n=el("widgetNotice");if(n)n.textContent=value}
function favoriteSymbol(symbol){
 if(!/^[A-Z0-9]{1,20}-[A-Z0-9]{2,10}$/.test(symbol))return;
 const found=widgetState.favorites.indexOf(symbol);
 if(found>=0)widgetState.favorites.splice(found,1);
 else widgetState.favorites.push(symbol);
 saveWidgetPreferences();renderMarkets();renderWidget();
}
function addWidgetSymbol(symbol){
 if(widgetState.symbols.includes(symbol)){widgetNotice("این نماد قبلاً در ویجت قرار گرفته است.");return false}
 if(widgetState.symbols.length>=WIDGET_MAX_SYMBOLS){widgetNotice("حداکثر شش نماد قابل انتخاب است.");return false}
 if(!instrument(symbol)){widgetNotice("این نماد در فهرست داده‌های معتبر موجود نیست.");return false}
 widgetState.symbols.push(symbol);saveWidgetPreferences();widgetNotice("نماد به پیش‌نمایش اضافه شد.");renderWidget();return true;
}
function removeWidgetSymbol(symbol){
 widgetState.symbols=widgetState.symbols.filter(s=>s!==symbol);
 // A widget with no selected symbols is intentional; show an empty state.
 saveWidgetPreferences();renderWidget();
}
function moveWidgetSymbol(symbol,offset){
 const i=widgetState.symbols.indexOf(symbol),next=i+offset;
 if(i<0||next<0||next>=widgetState.symbols.length)return false;
 [widgetState.symbols[i],widgetState.symbols[next]]=[widgetState.symbols[next],widgetState.symbols[i]];
 saveWidgetPreferences();renderWidget();return true;
}
function changeWidgetSetting(key,value){
 if(key==="theme"&&WIDGET_VALID_THEMES.includes(value))widgetState.theme=value;
 else if(key==="size"&&WIDGET_VALID_SIZES.includes(value))widgetState.size=value;
 else return;
 saveWidgetPreferences();renderWidget();
}
function widgetVisibleLimit(){return{small:2,medium:4,large:6}[widgetState.size]}
function widgetTime(value){const t=Date.parse(value||"");return Number.isFinite(t)?new Date(t).toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tehran"}):"نامشخص"}
function widgetSymbolChoices(){
 const select=el("widgetSymbolAdd");if(!select)return;
 const selected=select.value;select.replaceChildren();
 const available=marketState.items.filter(x=>!widgetState.symbols.includes(x.symbol)).sort((a,b)=>{
  const f=Number(widgetState.favorites.includes(b.symbol))-Number(widgetState.favorites.includes(a.symbol));
  return f||a.symbol.localeCompare(b.symbol)
 });
 for(const market of available){
  const opt=document.createElement("option");opt.value=market.symbol;
  opt.textContent=(widgetState.favorites.includes(market.symbol)?"★ ":"")+market.name+" · "+market.symbol;
  select.append(opt)
 }
 if(available.some(x=>x.symbol===selected))select.value=selected;
 el("widgetAddButton").disabled=available.length===0||widgetState.symbols.length>=WIDGET_MAX_SYMBOLS;
}
function renderWidget(){
 const preview=el("widgetPreview"),order=el("widgetOrder");if(!preview||!order)return;
 preview.replaceChildren();order.replaceChildren();
 const max=widgetVisibleLimit(),visible=widgetState.symbols.slice(0,max),extra=Math.max(0,widgetState.symbols.length-max);
 preview.className="widgetPreview widgetTheme-"+widgetState.theme+" widgetSize-"+widgetState.size;
 const header=dom("div","widgetHeader");header.append(dom("b","widgetBrand","◉ ChartNova"),dom("span","widgetClock",widgetTime(marketState.receivedAt)));
 preview.append(header);
 const list=dom("div","widgetAssetList");
 let rendered=0;
 for(const symbol of visible){
  const market=instrument(symbol);
  const r=dom("div","widgetAsset"),label=dom("div","widgetAssetLabel");
  label.append(dom("b","",market?.name||symbol),dom("small","",symbol));
  const values=dom("div","widgetAssetValues");
  values.append(dom("strong","",market?nfmt(market.sellPrice,2):"—"));
  const change=dom("small","widgetChange",market&&Number.isFinite(market.change)?(market.change>=0?"+":"")+nfmt(market.change)+"٪":"داده موجود نیست");
  if(market&&Number.isFinite(market.change))change.dataset.trend=market.change>=0?"positive":"negative";
  values.append(dom("small","widgetQuote",market?unit(market):""),change);r.append(label,values);list.append(r);rendered++;
 }
 if(!rendered)list.append(dom("p","widgetEmpty","با انتخاب نماد، قیمت‌ها اینجا نمایش داده می‌شوند."));
 preview.append(list);
 const footer=dom("div","widgetFooter");
 const isOld=!marketState.receivedAt||Date.now()-Date.parse(marketState.receivedAt)>45*60000;
 footer.append(dom("span","",isOld?"داده ذخیره‌شده · احتمال تأخیر":"آخرین قیمت منبع · غیرلحظه‌ای"),dom("span","", "هر ۱۵ دقیقه بررسی"));
 preview.append(footer);
 const info=el("widgetCapacity");
 if(info)info.textContent=nfmt(widgetState.symbols.length,0)+" نماد انتخاب‌شده · "+nfmt(visible.length,0)+" نماد در اندازه فعلی نمایش داده می‌شود"+(extra?" · "+nfmt(extra,0)+" نماد خارج از قاب":"");
 for(const [index,symbol]of widgetState.symbols.entries()){
  const row=dom("div","widgetManageRow");
  row.append(dom("span","widgetManageName",(index+1)+" · "+(instrument(symbol)?.name||symbol)+" ("+symbol+")"));
  const controls=dom("div","widgetActions");
  const up=dom("button","miniBtn","↑");up.type="button";up.title="انتقال به بالا";up.setAttribute("aria-label","انتقال "+symbol+" به بالا");up.disabled=index===0;up.addEventListener("click",()=>moveWidgetSymbol(symbol,-1));
  const down=dom("button","miniBtn","↓");down.type="button";down.title="انتقال به پایین";down.setAttribute("aria-label","انتقال "+symbol+" به پایین");down.disabled=index===widgetState.symbols.length-1;down.addEventListener("click",()=>moveWidgetSymbol(symbol,1));
  const remove=dom("button","miniBtn miniDanger","×");remove.type="button";remove.title="حذف از ویجت";remove.setAttribute("aria-label","حذف "+symbol+" از ویجت");remove.addEventListener("click",()=>removeWidgetSymbol(symbol));
  controls.append(up,down,remove);row.append(controls);order.append(row)
 }
 widgetSymbolChoices();
 const theme=el("widgetTheme"),size=el("widgetSize");if(theme)theme.value=widgetState.theme;if(size)size.value=widgetState.size;
 const favCount=el("widgetFavCount");if(favCount)favCount.textContent=nfmt(widgetState.favorites.length,0)+" علاقه‌مندی ذخیره شده";
}
function initializeWidget(){
 const add=el("widgetAddButton"),symbols=el("widgetSymbolAdd");
 if(!add||!symbols)return;
 add.addEventListener("click",()=>addWidgetSymbol(symbols.value));
 el("widgetTheme").addEventListener("change",e=>changeWidgetSetting("theme",e.target.value));
 el("widgetSize").addEventListener("change",e=>changeWidgetSetting("size",e.target.value));
 el("widgetRefresh").addEventListener("click",()=>refresh());
 renderWidget();
}
