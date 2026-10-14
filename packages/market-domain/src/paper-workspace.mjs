/**
 * Local paper portfolio for educational/manual price scenarios.
 * This has no real orders, server persistence or user authentication.
 * P&L for different quote currencies MUST NOT be aggregated.
 */
import {
  openPaperPosition, markPaperPosition, closePaperPosition, paperRiskSummary
} from './paper-position.mjs';

const MAX_POSITIONS=50;
const MAX_OPEN=10;
const MAX_EVENTS=150;
const MAX_BYTES=300_000;
const idFor=(value)=>'P'+String(value).padStart(4,'0');
const validWorkspace=(w)=>{
  if (!w||w.kind!=='PAPER_WORKSPACE'||w.version!==1||
      !Number.isSafeInteger(w.nextId)||w.nextId<1||
      !Array.isArray(w.positions)||w.positions.length>MAX_POSITIONS)
    throw new TypeError('invalid paper workspace');
  return w;
};
export function createPaperWorkspace(){
  return {kind:'PAPER_WORKSPACE',version:1,nextId:1,positions:[]};
}
function copyWithPosition(w,index,position){
  const positions=w.positions.slice();positions[index]={id:w.positions[index].id,position};
  return {...w,positions};
}
function findIndex(w,id){
  const index=w.positions.findIndex(row=>row.id===id);
  if(index<0)throw new RangeError('paper position id not found');
  return index;
}
export function addPaperPosition(w,options){
  validWorkspace(w);
  if(w.positions.length>=MAX_POSITIONS)throw new RangeError('paper workspace history is full; export audit then reset');
  if(w.positions.filter(row=>row.position.status==='OPEN').length>=MAX_OPEN)
    throw new RangeError('maximum 10 simultaneously open paper positions');
  const position=openPaperPosition(options);
  const id=idFor(w.nextId);
  if(w.positions.some(row=>row.id===id))throw new Error('duplicate paper position id');
  return {...w,nextId:w.nextId+1,positions:[...w.positions,{id,position}]};
}
export function markPaperWorkspacePosition(w,id,scenario){
  validWorkspace(w);
  const index=findIndex(w,id),old=w.positions[index].position;
  if(old.events.length>=MAX_EVENTS)throw new RangeError('scenario event history limit');
  return copyWithPosition(w,index,markPaperPosition(old,scenario));
}
export function closePaperWorkspacePosition(w,id,scenario){
  validWorkspace(w);
  const index=findIndex(w,id),old=w.positions[index].position;
  if(old.events.length>=MAX_EVENTS)throw new RangeError('scenario event history limit');
  return copyWithPosition(w,index,closePaperPosition(old,scenario));
}
export function paperWorkspaceSummary(w){
  validWorkspace(w);
  return {
    total:w.positions.length,
    open:w.positions.filter(row=>row.position.status==='OPEN').length,
    closed:w.positions.filter(row=>row.position.status==='CLOSED').length,
    // Important: return PER-POSITION results, never sum EUR, USD, IRR etc.
    positions:w.positions.map(({id,position})=>({id,...paperRiskSummary(position)}))
  };
}
const stable=(o)=>JSON.stringify(o);
function reconstructStoredPosition(original){
  if(!original || original.kind!=='PAPER_POSITION' ||
      !Array.isArray(original.events)||original.events.length<1||
      original.events.length>MAX_EVENTS+1||original.events[0]?.type!=='OPEN')
    throw new TypeError('invalid stored paper position');
  const opening=original.events[0];
  let p=openPaperPosition({
    symbol:original.symbol,side:original.side,
    entryPrice:original.entryPrice,capital:original.capital,
    stopLossPercent:original.rules?.stopLossPercent,
    takeProfitPercent:original.rules?.takeProfitPercent,
    trailingStopPercent:original.rules?.trailingStopPercent,
    commissionBps:original.rules?.commissionBps,
    slippageBps:original.rules?.slippageBps,at:opening.at
  });
  if(opening.source!=='MANUAL_SCENARIO'||opening.price!==p.entryPrice)
    throw new TypeError('invalid opening event');
  for(let i=1;i<original.events.length;i++){
    const event=original.events[i];
    if(event?.type==='MARK' && p.status==='OPEN'){
      if(event.source!=='MANUAL_SCENARIO')throw new TypeError('untrusted price source');
      p=markPaperPosition(p,{price:event.price,at:event.at});
    }else if(event?.type==='CLOSE'){
      if(p.status==='OPEN' && event.reason==='MANUAL'){
        p=closePaperPosition(p,{price:event.observedPrice,at:event.at});
      }
      const predicted=p.events.at(-1);
      if(p.status!=='CLOSED'||predicted.type!=='CLOSE'||predicted.at!==event.at||
        predicted.reason!==event.reason||predicted.observedPrice!==event.observedPrice)
        throw new TypeError('inconsistent closed position');
    }else{
      throw new TypeError('unsupported or conflicting event sequence');
    }
  }
  // Reject altered financial fields/status/fee estimates; derive truth from events.
  if(stable(p)!==stable(original))
    throw new TypeError('paper position history does not match derived state');
  return p;
}
export function restorePaperWorkspace(json){
  if(typeof json!=='string'||json.length>MAX_BYTES||json.length<2)
    throw new TypeError('invalid paper workspace storage payload');
  let parsed;
  try{parsed=JSON.parse(json)}catch{throw new TypeError('invalid paper workspace JSON')}
  validWorkspace(parsed);
  const ids=new Set();
  const positions=parsed.positions.map(row=>{
    if(typeof row?.id!=='string'||!/^P\d{4,12}$/.test(row.id)||ids.has(row.id))
      throw new TypeError('invalid or duplicate paper id');
    ids.add(row.id);
    if(Number(row.id.slice(1))>=parsed.nextId)throw new TypeError('paper id sequence inconsistent');
    const position=reconstructStoredPosition(row.position);
    return {id:row.id,position};
  });
  const restored={...parsed,positions};
  if(stable(restored)!==json)throw new TypeError('paper workspace was altered or has unsupported fields');
  if(positions.filter(row=>row.position.status==='OPEN').length>MAX_OPEN)
    throw new RangeError('too many open positions');
  return restored;
}
function csvCell(value){
  const text=String(value??'');
  return '"'+text.replaceAll('"','""')+'"';
}
export function exportPaperWorkspaceCSV(w){
  validWorkspace(w);
  const result=[['position_id','symbol','side','event_type','event_at','scenario_price','reason','status','net_pnl_quote_units'].map(csvCell).join(',')];
  for(const {id,position} of w.positions){
    for(const event of position.events){
      result.push([id,position.symbol,position.side,event.type,event.at,
        event.price??event.observedPrice??'',event.reason??'',position.status,
        event.type==='CLOSE'?position.realizedPnL:''
      ].map(csvCell).join(','));
    }
  }
  return result.join('\r\n')+'\r\n';
}
