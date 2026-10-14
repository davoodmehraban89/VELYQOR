import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createPaperWorkspace,addPaperPosition,markPaperWorkspacePosition,closePaperWorkspacePosition,
 paperWorkspaceSummary,restorePaperWorkspace,exportPaperWorkspaceCSV
} from '../src/paper-workspace.mjs';

const stamp=n=>'2026-10-14T12:00:'+String(n).padStart(2,'0')+'Z';
const options=(symbol='XAU_USD',n=0)=>({
 symbol,entryPrice:100,capital:1000,side:'LONG',stopLossPercent:1,
 takeProfitPercent:2,trailingStopPercent:1,at:stamp(n)
});
const one=()=>addPaperPosition(createPaperWorkspace(),options());
const id=w=>w.positions[0].id;
test('creates empty paper-only workspace with no implied traded capital',()=>{
 const w=createPaperWorkspace();
 assert.deepEqual(paperWorkspaceSummary(w),{total:0,open:0,closed:0,positions:[]});
});
test('supports several independent manual positions without summing quote units',()=>{
 let w=one();w=addPaperPosition(w,options('EUR_USD_ECB',1));
 let s=paperWorkspaceSummary(w);
 assert.equal(s.open,2);assert.deepEqual(s.positions.map(p=>p.symbol),['XAU_USD','EUR_USD_ECB']);
 assert.ok(!('netPnL' in s));
});
test('manual marks update only target position and close at most once',()=>{
 let w=one(),first=id(w);
 w=addPaperPosition(w,options('GOLD18_IRT',1));
 w=markPaperWorkspacePosition(w,first,{price:101,at:stamp(2)});
 assert.equal(w.positions[0].position.markPrice,101);
 assert.equal(w.positions[1].position.markPrice,100);
 w=closePaperWorkspacePosition(w,first,{price:100.5,at:stamp(3)});
 assert.equal(w.positions[0].position.exit.reason,'MANUAL');
 assert.throws(()=>closePaperWorkspacePosition(w,first,{price:100,at:stamp(4)}),/OPEN/);
});
test('automatic stop and TP states are preserved through round-trip storage',()=>{
 let w=one();w=markPaperWorkspacePosition(w,id(w),{price:102,at:stamp(1)});
 assert.equal(w.positions[0].position.status,'CLOSED');
 const restored=restorePaperWorkspace(JSON.stringify(w));
 assert.deepEqual(restored,w);
 assert.equal(restored.positions[0].position.exit.reason,'TAKE_PROFIT');
});
test('trailing mark, manual close and open positions can all roundtrip',()=>{
 let w=one();
 w=markPaperWorkspacePosition(w,id(w),{price:100.25,at:stamp(1)});
 assert.deepEqual(restorePaperWorkspace(JSON.stringify(w)),w);
 w=closePaperWorkspacePosition(w,id(w),{price:100.1,at:stamp(2)});
 assert.deepEqual(restorePaperWorkspace(JSON.stringify(w)),w);
});
test('tampered derived P&L fails restore even if valid JSON',()=>{
 const p=JSON.parse(JSON.stringify(one()));
 p.positions[0].position.estimatedPnL=1000000;
 assert.throws(()=>restorePaperWorkspace(JSON.stringify(p)),/does not match/);
});
test('rejects forged sources, mutated opening timestamps and injected events',()=>{
 const base=one();
 const p=structuredClone(base);p.positions[0].position.events[0].source='LIVE_TRADE';
 assert.throws(()=>restorePaperWorkspace(JSON.stringify(p)),/opening event/);
 const q=structuredClone(base);q.positions[0].position.events.push({type:'EXECUTE',at:stamp(1)});
 assert.throws(()=>restorePaperWorkspace(JSON.stringify(q)),/unsupported/);
});
test('rejects inconsistent ID sequence and duplicate IDs',()=>{
 const w=one();
 const p=structuredClone(w);p.nextId=1;
 assert.throws(()=>restorePaperWorkspace(JSON.stringify(p)),/sequence/);
 const q=structuredClone(w);q.positions.push(structuredClone(q.positions[0]));q.nextId=3;
 assert.throws(()=>restorePaperWorkspace(JSON.stringify(q)),/duplicate/);
});
test('rejects missing source text, corrupted JSON and oversized payloads',()=>{
 assert.throws(()=>restorePaperWorkspace(''),/invalid/);
 assert.throws(()=>restorePaperWorkspace('{oops'),/JSON/);
 assert.throws(()=>restorePaperWorkspace('x'.repeat(300001)),/payload/);
});
test('stops at ten open positions without deleting existing history',()=>{
 let w=createPaperWorkspace();
 for(let i=0;i<10;i++)w=addPaperPosition(w,options('XAU_USD',i));
 assert.equal(paperWorkspaceSummary(w).open,10);
 assert.throws(()=>addPaperPosition(w,options('XAU_USD',10)),/maximum 10/);
 assert.equal(w.positions.length,10);
});
test('rejects missing identifiers and nonmonotonic timestamps',()=>{
 let w=one();
 assert.throws(()=>markPaperWorkspacePosition(w,'P9999',{price:101,at:stamp(1)}),/not found/);
 assert.throws(()=>markPaperWorkspacePosition(w,id(w),{price:101,at:stamp(0)}),/increase/);
});
test('CSV export is scoped to manual events and contains no broker claims',()=>{
 let w=one();w=markPaperWorkspacePosition(w,id(w),{price:102,at:stamp(1)});
 const csv=exportPaperWorkspaceCSV(w);
 assert.match(csv,/XAU_USD/);assert.match(csv,/TAKE_PROFIT/);
 assert.doesNotMatch(csv,/BROKER|EXECUTED_ORDER/);
});
test('workspace snapshots have no mutable link back to earlier states',()=>{
 let w=one();
 const prev=w;
 w=markPaperWorkspacePosition(w,id(w),{price:101,at:stamp(1)});
 assert.equal(prev.positions[0].position.events.length,1);
 assert.equal(w.positions[0].position.events.length,2);
});
