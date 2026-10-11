import React,{useEffect,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {createChart,CandlestickSeries,LineSeries,CrosshairMode} from "lightweight-charts";
import {normalizeHistoryResponse,normalizeStreamUpdate} from "../../../packages/market-feed/src/chart-adapter.mjs";
import "./style.css";

const SYMBOLS=[
 {value:"EUR_USD_ECB",label:"EUR/USD · نرخ مرجع بانک مرکزی اروپا"},
 {value:"EUR_GBP_ECB",label:"EUR/GBP · نرخ مرجع بانک مرکزی اروپا"},
 {value:"EUR_CHF_ECB",label:"EUR/CHF · نرخ مرجع بانک مرکزی اروپا"},
];
const REST_BASE=(import.meta.env.VITE_MARKET_REST_BASE||"").replace(/\/$/,"");
const WS_BASE=(import.meta.env.VITE_MARKET_WS_BASE||"").replace(/\/$/,"");
const allowedSymbol=(symbol)=>SYMBOLS.some(item=>item.value===symbol);
const number=(value)=>new Intl.NumberFormat("fa-IR",{maximumFractionDigits:6}).format(value);

function ChartPane({model,lastTick,chartRef}){
 const host=useRef(null);
 const series=useRef(null);
 const lastTime=useRef(null);
 useEffect(()=>{
  if(!host.current||!model)return;
  const chart=createChart(host.current,{
   autoSize:true,
   layout:{background:{type:"solid",color:"#101c2d"},textColor:"#c8d5eb",fontFamily:"Vazirmatn, Tahoma, sans-serif"},
   grid:{vertLines:{color:"#1f3146"},horzLines:{color:"#1f3146"}},
   crosshair:{mode:CrosshairMode.Normal},
   rightPriceScale:{borderColor:"#37506b"},timeScale:{borderColor:"#37506b",timeVisible:model.timeframe==="1h",secondsVisible:false},
  });
  series.current=model.kind==="candle"?
   chart.addSeries(CandlestickSeries,{upColor:"#1cbba3",downColor:"#ef6d78",borderVisible:false,wickUpColor:"#1cbba3",wickDownColor:"#ef6d78"}):
   chart.addSeries(LineSeries,{color:"#58bfff",lineWidth:2,priceLineVisible:true});
  series.current.setData(model.data);
  lastTime.current=model.data.at(-1)?.time;
  chart.timeScale().fitContent();
  chartRef.current=chart;
  return ()=>{chartRef.current=null;series.current=null;lastTime.current=null;chart.remove()};
 },[model,chartRef]);
 useEffect(()=>{
  if(!series.current||!lastTick||!model)return;
  const value=lastTick.time;
  const newer=typeof value===typeof lastTime.current&&value>=lastTime.current;
  if(!newer)return;
  try{series.current.update(lastTick);lastTime.current=value}catch{}
 },[lastTick,model]);
 return <div className="chart-frame" ref={host} role="img" aria-label={model?.kind==="candle"?"نمودار کندل منبع دارای مجوز":"نمودار خطی نرخ مرجع روزانه"} />;
}
function App(){
 const [symbol,setSymbol]=useState("EUR_USD_ECB");
 const [model,setModel]=useState(null);
 const [status,setStatus]=useState("در انتظار دریافت تاریخچه...");
 const [wsStatus,setWsStatus]=useState("غیرفعال: درگاه استریم هنوز منتشر نشده");
 const [lastTick,setLastTick]=useState(null);
 const chartRef=useRef(null);
 const [reloadVersion,setReloadVersion]=useState(0);
 useEffect(()=>{
  if(!allowedSymbol(symbol))return;
  const controller=new AbortController();
  setModel(null);setLastTick(null);setStatus("در حال دریافت داده از REST...");
  (async()=>{
   try{
    const response=await fetch(REST_BASE+"/api/history?symbol="+encodeURIComponent(symbol),{signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    const json=await response.json(),output=normalizeHistoryResponse(json,symbol);
    if(controller.signal.aborted)return;
    setModel(output);
    setStatus(output.data.length+" مشاهده واقعی • "+output.source+" • "+(output.kind==="reference"?"نرخ مرجع؛ بدون کندل":"OHLC دارای مجوز"));
   }catch(e){
    if(!controller.signal.aborted){setStatus("تاریخچه در دسترس نیست: "+e.message);setModel(null)}
   }
  })();
  return ()=>controller.abort();
 },[symbol,reloadVersion]);
 useEffect(()=>{
  if(!model||!WS_BASE){setWsStatus("غیرفعال: درگاه WebSocket هنوز پیکربندی نشده");return}
  if(!/^wss:\/\//.test(WS_BASE)){setWsStatus("آدرس WebSocket باید امن (wss) باشد");return}
  let socket,closed=false,reconnectTimer=null,attempt=0,sequence=0,everConnected=false;
  const connect=()=>{
   if(closed)return;
   const streamUrl=new URL(WS_BASE);streamUrl.searchParams.set("symbol",symbol);
   try{socket=new WebSocket(streamUrl)}catch{setWsStatus("اتصال WebSocket پیکربندی نادرست دارد");return}
   setWsStatus("در حال اتصال WebSocket...");
   socket.onopen=()=>{
    if(everConnected)setReloadVersion(x=>x+1);
    everConnected=true;attempt=0;sequence=0;setWsStatus("متصل؛ در انتظار رویداد واقعی");
    socket.send(JSON.stringify({type:"stream.subscribe",version:1,symbols:[symbol]}));
   };
   socket.onmessage=(event)=>{
    let msg;try{msg=JSON.parse(event.data)}catch{return}
    if(msg.type!=="market.update"||!Number.isSafeInteger(msg.sequence)||msg.sequence<=sequence)return;
    if(sequence!==0&&msg.sequence!==sequence+1){setWsStatus("گپ استریم شناسایی شد؛ تاریخچه مجدداً دریافت می‌شود");setReloadVersion(x=>x+1);return}
    const update=normalizeStreamUpdate(msg,symbol,model.kind,model.timeframe);
    if(!update)return;
    sequence=msg.sequence;setLastTick(update);
   };
   socket.onerror=()=>setWsStatus("خطای اتصال استریم");
   socket.onclose=()=>{
    if(closed)return;
    setWsStatus("ارتباط قطع شد؛ تلاش برای اتصال مجدد");
    const ms=Math.min(15000,1000*Math.pow(2,Math.min(4,attempt++)));
    reconnectTimer=setTimeout(connect,ms);
   };
  };
  connect();
  return ()=>{closed=true;if(reconnectTimer!==null)clearTimeout(reconnectTimer);if(socket){socket.onclose=null;socket.close()}}
 },[symbol,model?.kind,model?.source]);
 const last=model?.data.at(-1);
 const close=last?(model.kind==="candle"?last.close:last.value):null;
 return <div className="shell">
  <header className="header">
   <div><div className="eyebrow">CHARTNOVA / MARKET TERMINAL</div><h1>چارت‌نوا <span>ترمینال بازارهای مالی</span></h1></div>
   <span className="status-indicator">نمایش داده معتبر و قابل‌ردیابی</span>
  </header>
  <main className="layout">
   <section className="main-column">
    <div className="toolbar">
     <label htmlFor="symbol">نماد</label>
     <select id="symbol" value={symbol} onChange={e=>setSymbol(e.target.value)}>
      {SYMBOLS.map(s=><option value={s.value} key={s.value}>{s.label}</option>)}
     </select>
     <span className="pill">{model?.kind==="candle"?"شمع‌های واقعی OHLC":"نمودار خطی · نرخ مرجع روزانه"}</span>
    </div>
    <div className="chart-card">
     <div className="chart-heading">
      <div><h2>{SYMBOLS.find(s=>s.value===symbol)?.label}</h2><p>{status}</p></div>
      <div className="last-price">{close===null?"—":number(close)} <small>{model?.unit??""}</small></div>
     </div>
     {model?<ChartPane model={model} lastTick={lastTick} chartRef={chartRef}/>:<div className="chart-empty">{status}</div>}
    </div>
    <p className="license">نمودار با <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">Lightweight Charts™ توسط TradingView</a> ساخته شده است. این محصول وابسته به TradingView نیست.</p>
   </section>
   <aside className="aside">
    <h3>سلامت جریان داده</h3>
    <div className="datum"><span>تاریخچه</span><strong>{model?.data.length??"—"} مشاهده</strong></div>
    <div className="datum"><span>منبع</span><strong>{model?.source??"نامشخص"}</strong></div>
    <div className="datum"><span>مسیر ذخیره</span><strong>{model?.storage??"نامشخص"}</strong></div>
    <div className="datum"><span>WebSocket</span><strong>{wsStatus}</strong></div>
    <div className="notice"><strong>تفکیک الزامی داده‌ها</strong><p>نرخ مرجع ECB فقط در نمودار خطی دیده می‌شود. شمع‌ها صرفاً وقتی API داده OHLC واقعی با حق انتشار تأییدشده برگرداند ایجاد می‌شوند.</p></div>
    <p className="small">{model?.attribution??"برای اطلاعات منبع به API رجوع کنید."}</p>
   </aside>
  </main>
 </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
