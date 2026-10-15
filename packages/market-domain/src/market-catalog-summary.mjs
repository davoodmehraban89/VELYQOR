/**
 * Project a provider-verified cached market catalog to a lightweight read-only
 * snapshot. It never synthesizes prices, converts units or fabricates OHLC.
 *
 * Self-contained by design: this function is embedded unchanged into the
 * Cloudflare Worker by the source-gated deployment patcher.
 */
export function marketCatalogSummary(catalog, nowMs = Date.now()) {
  const unavailable = {ok:false,error:'market_data_not_collected'};
  if (!catalog || catalog.ok!==true || catalog.source!=='gheymat.online' ||
      !Array.isArray(catalog.markets) || catalog.markets.length<1 ||
      catalog.markets.length>200 || !Number.isFinite(nowMs)) return unavailable;
  const ms=Date.parse(catalog.fetchedAt);
  if (!Number.isFinite(ms) || ms>nowMs+300000) return unavailable;
  const seen=new Set(), rows=[];
  for(const m of catalog.markets) {
    if(!m || typeof m.symbol!=='string' ||
       !/^[A-Z0-9]{1,20}-[A-Z0-9]{2,10}$/.test(m.symbol) ||
       seen.has(m.symbol) || typeof m.name!=='string' ||
       !m.name.trim() || m.name.length>160 ||
       typeof m.base!=='string' || m.base!==m.symbol.split('-')[0] ||
       typeof m.quote!=='string' || m.quote!==m.symbol.split('-')[1] ||
       typeof m.category!=='string' || !/^[A-Z_]{3,30}$/.test(m.category) ||
       !Number.isFinite(m.sellPrice) || m.sellPrice<=0 ||
       !(m.buyPrice===null || m.buyPrice===undefined || (Number.isFinite(m.buyPrice)&&m.buyPrice>0)) ||
       !(m.change===null || m.change===undefined || Number.isFinite(m.change)) ||
       typeof m.updatedAt!=='string' || !Number.isFinite(Date.parse(m.updatedAt)) ||
       Date.parse(m.updatedAt)>nowMs+300000 ||
       typeof m.isUpToDate!=='boolean' || !Array.isArray(m.history) ||
       m.history.length>168 || !m.history.every(v=>Number.isFinite(v)&&v>0))return unavailable;
    seen.add(m.symbol);
    // Explicit allowlist: do not leak 168-point arrays to the initial screen.
    rows.push({
      symbol:m.symbol,name:m.name,base:m.base,quote:m.quote,category:m.category,
      sellPrice:m.sellPrice,buyPrice:m.buyPrice??null,change:m.change??null,
      updatedAt:m.updatedAt,isUpToDate:m.isUpToDate,
      historyCount:m.history.length,
      historyKind:'provider_price_points_not_ohlc'
    });
  }
  return {
    ok:true,source:catalog.source,fetchedAt:catalog.fetchedAt,
    stale:nowMs-ms>45*60000,
    quoteSide:'sell',
    dataKind:'provider_market_snapshots_not_executable_quotes',
    markets:rows
  };
}
