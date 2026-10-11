// Provider capabilities are intentionally advisory; a provider being named here
// does not authorize commercial storage or redistribution.
export const PROVIDERS=Object.freeze({
  coingecko:Object.freeze({region:"crypto",history:"reference_point",live:"poll",permission:"review_required",status:"not_connected"}),
  binance:Object.freeze({region:"crypto",history:"source_ohlc",live:"exchange_websocket",permission:"review_required",status:"network_blocked_prior_451"}),
  yfinance:Object.freeze({region:"global",history:"source_ohlc",live:"none",permission:"research_only",status:"research_adapter_only"}),
  polygon:Object.freeze({region:"global",history:"licensed_contract",live:"vendor_websocket",permission:"subscription_required",status:"not_connected"}),
  navasan:Object.freeze({region:"iran",history:"source_ohlc",live:"rest_poll",permission:"commercial_rights_unverified",status:"adapter_exists_not_licensed_for_publication"}),
  bonbast:Object.freeze({region:"iran",history:"unverified",live:"unverified",permission:"contract_required",status:"api_not_verified"}),
});
function int(x,label){if(!Number.isSafeInteger(x)||x<=0)throw Error(label+" must be positive integer")}
function utcWindow(startMs,endMs){
 int(startMs,"startMs");int(endMs,"endMs");
 if(startMs>=endMs||endMs>Date.now()+60_000)throw Error("invalid historical time window");
}
export function coinGeckoRangeRequest({coinId,quote="usd",startMs,endMs}){
 utcWindow(startMs,endMs);
 if(typeof coinId!=="string"||!/^[a-z0-9-]{2,80}$/.test(coinId))throw Error("invalid CoinGecko id");
 if(!["usd","eur","btc"].includes(quote))throw Error("unsupported CoinGecko quote");
 // 90d slices reduce huge responses; actual coverage/granularity depends on API plan.
 if(endMs-startMs>90*86_400_000)throw Error("request exceeds 90-day slice");
 const url=new URL("https://api.coingecko.com/api/v3/coins/"+encodeURIComponent(coinId)+"/market_chart/range");
 url.searchParams.set("vs_currency",quote);
 url.searchParams.set("from",String(Math.floor(startMs/1000)));
 url.searchParams.set("to",String(Math.floor(endMs/1000)));
 return Object.freeze({url:url.toString(),method:"GET",providerCode:"coingecko",dataKind:"reference_point",
  expectedFields:["prices","market_caps","total_volumes"],notCandles:true,requiresServerKey:true,permission:"review_required"});
}
export function binanceKlinesRequest({symbol,interval,startMs,endMs,limit=1000}){
 utcWindow(startMs,endMs);
 if(typeof symbol!=="string"||!/^[A-Z0-9]{5,24}$/.test(symbol))throw Error("invalid Binance pair");
 if(!["1h","1d"].includes(interval))throw Error("unsupported Binance interval");
 int(limit,"limit");
 if(limit>1000)throw Error("Binance limit exceeds one response window");
 const url=new URL("https://api.binance.com/api/v3/klines");
 for(const [k,v] of Object.entries({symbol,interval,startTime:startMs,endTime:endMs,limit}))url.searchParams.set(k,String(v));
 return Object.freeze({url:url.toString(),method:"GET",providerCode:"binance",dataKind:"source_ohlc",
  requiresCommercialLicensingReview:true,needsNetworkProbe:true,permission:"review_required"});
}
export function providerCanPubliclyRedistribute(providerCode){
 if(!Object.hasOwn(PROVIDERS,providerCode))throw Error("unknown provider");
 // Must be enabled per contract and instrument; no provider is authorized by default.
 return false;
}
