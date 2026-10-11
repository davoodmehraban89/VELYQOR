"use client";
import React,{useEffect,useRef,useState} from "react";
import {
  createChart,CandlestickSeries,LineSeries,
  type IChartApi,type ISeriesApi,type Time,type UTCTimestamp,
} from "lightweight-charts";

type Quality="GOOD"|"DEGRADED"|"STALE"|"INVALID";
type Point={date:string;close:number;quality:Quality};
type Candle={openTime:string;sessionDate?:string;open:string|number;high:string|number;low:string|number;close:string|number;quality:Quality};
type History={
  ok:boolean;symbol:string;source:string;storage:string;
  dataKind:"source_ohlc"|"daily_reference_point_not_ohlc"|"reference_point";
  timeframe?:string;series:(Point|Candle)[];quoteCurrency?:string;unit?:string;
  attribution?:string;rights?:string;usageNotice?:string;
};
type Frame={type:"market.update";version:1;sequence:number;publishedAt:string;
 payload:{symbol:string;dataKind:"reference_point"|"source_ohlc";source:string;unit:string;sourceTimestamp:string;
 quality:Quality;timeframe?:string;price?:number|string;openTime?:string;open?:number|string;high?:number|string;low?:number|string;close?:number|string}};
type Props={
  symbol:string;from:string;to:string;timeframe:"1h"|"1d";
  // Backend owns auth, provider selection, licensing and signed database credentials.
  historyEndpoint:string; websocketUrl?:string; className?:string;
};
function safeTime(t:string,day:boolean):Time{
  if(day){
    const date=t.slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z")))throw Error("Invalid market day");
    return date;
  }
  const value=Date.parse(t);
  if(!Number.isFinite(value))throw Error("Invalid UTC market timestamp");
  return Math.floor(value/1000) as UTCTimestamp;
}
function pointValue(p:Point):number{
  if(!Number.isFinite(p.close)||p.close<=0)throw Error("Invalid reference rate");
  return p.close;
}
function candleValue(c:Candle){
  const [open,high,low,close]=[c.open,c.high,c.low,c.close].map(Number);
  if(![open,high,low,close].every(n=>Number.isFinite(n)&&n>0)||low>open||low>close||high<open||high<close)throw Error("Invalid provider OHLC");
  return {open,high,low,close};
}
export function LightweightMarketChart({symbol,from,to,timeframe,historyEndpoint,websocketUrl,className}:Props){
  const container=useRef<HTMLDivElement>(null);
  const chartRef=useRef<IChartApi|null>(null);
  const seriesRef=useRef<ISeriesApi<"Candlestick">|ISeriesApi<"Line">|null>(null);
  const lastEvent=useRef(new Map<string,number>());
  const [status,setStatus]=useState("در انتظار تاریخچه معتبر");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    if(!container.current)return;
    const chart=createChart(container.current,{
      width:Math.max(300,container.current.clientWidth),height:430,
      layout:{background:{color:"#0b1423"},textColor:"#d8e8f6",attributionLogo:true},
      grid:{vertLines:{color:"#243246"},horzLines:{color:"#243246"}},
      timeScale:{timeVisible:timeframe!=="1d"},
    });
    chartRef.current=chart;
    const observer=new ResizeObserver(items=>{
      const width=items[0]?.contentRect.width;
      if(width&&chartRef.current)chart.applyOptions({width:Math.floor(width)});
    });
    observer.observe(container.current);
    const stop=new AbortController();
    let disposed=false,ws:WebSocket|undefined,retry:ReturnType<typeof setTimeout>|undefined,attempt=0;
    let kind:History["dataKind"]|null=null;
    async function load(){
      try{
        const url=new URL(historyEndpoint,window.location.href);
        // Select only bounded, canonical market symbols; never interpolate SQL.
        if(!/^[A-Z0-9_]{3,48}$/.test(symbol))throw Error("نماد نامعتبر");
        url.searchParams.set("symbol",symbol);
        url.searchParams.set("from",from);url.searchParams.set("to",to);
        url.searchParams.set("timeframe",timeframe);
        const response=await fetch(url.toString(),{signal:stop.signal,credentials:"same-origin"});
        if(!response.ok)throw Error("HTTP "+response.status);
        const data=await response.json() as History;
        if(!data.ok||data.symbol!==symbol||!Array.isArray(data.series))throw Error("پاسخ تاریخچه نامعتبر است");
        if(data.rights&&data.rights!=="approved_public")throw Error("مجوز نمایش داده تأیید نشده");
        if(data.dataKind!=="source_ohlc"&&data.dataKind!=="reference_point"&&data.dataKind!=="daily_reference_point_not_ohlc")throw Error("نوع داده پشتیبانی نمی‌شود");
        if(data.series.length===0)throw Error("داده تاریخی قابل نمایش نیست");
        const isCandle=data.dataKind==="source_ohlc";
        if(isCandle&&data.timeframe&&data.timeframe!==timeframe)throw Error("بازه زمانی کندل ناسازگار است");
        const mapped=isCandle?data.series.map(p=>{
          if(!("openTime" in p))throw Error("Missing source candle");
          return {time:safeTime(timeframe==="1d"?(p.sessionDate??p.openTime):p.openTime,timeframe==="1d"),...candleValue(p)};
        }):data.series.map(p=>{
          if(!("date" in p))throw Error("Missing point timestamp");
          return {time:safeTime(p.date,true),value:pointValue(p)};
        });
        for(let i=1;i<mapped.length;i++){
          // Data must already be sorted and deduplicated by the provider adapter.
          if(String(mapped[i].time)<=String(mapped[i-1].time))throw Error("داده نامرتب یا تکراری");
        }
        if(disposed)return;
        if(seriesRef.current)chart.removeSeries(seriesRef.current);
        if(isCandle){
          const s=chart.addSeries(CandlestickSeries,{
            upColor:"#1cc38b",downColor:"#f26b6b",wickUpColor:"#1cc38b",wickDownColor:"#f26b6b",
            borderVisible:false,
          });
          s.setData(mapped as {time:Time;open:number;high:number;low:number;close:number}[]);
          seriesRef.current=s;
        }else{
          const s=chart.addSeries(LineSeries,{color:"#43b9e8",lineWidth:2});
          s.setData(mapped as {time:Time;value:number}[]);
          seriesRef.current=s;
        }
        kind=data.dataKind;
        chart.timeScale().fitContent();
        setStatus(data.source+" · "+data.storage+" · "+data.series.length+" مشاهده");
        setNotice(isCandle?"کندل‌های منبع · کیفیت و حقوق بازنشر را بررسی کنید":
          "نرخ مرجع/نقطه قیمت · نه کندل OHLC؛ حجم و باز/بسته‌شدن روزانه ادعا نمی‌شود.");
      }catch(err){
        if(!disposed&&!stop.signal.aborted){setStatus("تاریخچه در دسترس نیست");setNotice(String(err instanceof Error?err.message:err));}
      }
    }
    void load();
    function connect(){
      if(disposed||!websocketUrl)return;
      if(!websocketUrl.startsWith("wss://")){setNotice("فقط اتصال رمزنگاری‌شده WebSocket مجاز است");return;}
      ws=new WebSocket(websocketUrl);
      ws.onopen=()=>{
        attempt=0;
        ws?.send(JSON.stringify({type:"subscribe",version:1,symbols:[symbol],timeframe}));
      };
      ws.onmessage=(event)=>{
        try{
          if(typeof event.data!=="string"||event.data.length>8192)return;
          const frame=JSON.parse(event.data) as Frame;
          if(frame.type!=="market.update"||frame.version!==1||!Number.isSafeInteger(frame.sequence))return;
          const p=frame.payload;
          if(!p||p.symbol!==symbol||p.quality==="INVALID"||!seriesRef.current)return;
          if((kind==="source_ohlc")!==(p.dataKind==="source_ohlc"))return;
          if(p.dataKind==="source_ohlc"&&p.timeframe!==timeframe)return;
          const channel=p.symbol+"|"+(p.timeframe??"point")+"|"+p.source;
          const previous=lastEvent.current.get(channel)??0;
          if(frame.sequence<=previous)return;
          lastEvent.current.set(channel,frame.sequence);
          if(previous!==0&&frame.sequence!==previous+1){
            setNotice("شکاف در جریان داده؛ بازخوانی تاریخچه از REST");
            void load();
            return;
          }
          if(p.dataKind==="source_ohlc"){
            if(!p.openTime)return;
            const value=candleValue(p as Candle);
            (seriesRef.current as ISeriesApi<"Candlestick">).update({
              time:safeTime(p.openTime,timeframe==="1d"),...value,
            });
          }else{
            if(p.price===undefined)return;
            const value=Number(p.price);
            if(!Number.isFinite(value)||value<=0)return;
            (seriesRef.current as ISeriesApi<"Line">).update({time:safeTime(p.sourceTimestamp,true),value});
          }
        }catch{setNotice("یک پیام زنده نامعتبر کنار گذاشته شد");}
      };
      ws.onclose=()=>{
        if(disposed)return;
        const delay=Math.min(30_000,1000*2**Math.min(attempt++,5));
        retry=setTimeout(()=>{void load();connect();},delay);
      };
      ws.onerror=()=>ws?.close();
    }
    connect();
    return ()=>{
      disposed=true;stop.abort();
      if(retry)clearTimeout(retry);
      ws?.close();observer.disconnect();chart.remove();
      chartRef.current=null;seriesRef.current=null;lastEvent.current.clear();
    };
  },[symbol,from,to,timeframe,historyEndpoint,websocketUrl]);
  return <section className={className} aria-label={"نمودار بازار "+symbol}>
    <div ref={container} role="img" aria-label={symbol+" · نمودار واقعی با Lightweight Charts"}/>
    <p role="status">{status}</p><p>{notice}</p>
    <small>Charting library by <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView</a> · Lightweight Charts™</small>
  </section>;
}
