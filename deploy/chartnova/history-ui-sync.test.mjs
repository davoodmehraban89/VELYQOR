import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const worker=fs.readFileSync(new URL("./worker.mjs",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("./history-ui.js",import.meta.url),"utf8").trimEnd();
test("historical chart implementation and embedded Worker UI remain in sync",()=>{
 const at=worker.lastIndexOf("return new Response(")+"return new Response(".length;
 assert(at>=20);
 const match=worker.slice(at).match(/^("(?:\\.|[^"\\])*")/);
 assert(match,"HTML response must have a string literal");
 const html=JSON.parse(match[1]);
 assert(html.includes(ui),"Worker's embedded HTML must contain exactly the maintained history UI");
 assert(html.includes("id=\"historyChart\""));
 assert(html.includes("id=\"historyProvenance\""));
});
test("chart provenance distinguishes direct Neon reads from historical KV fallback",()=>{
 assert.match(ui,/data\.storage/);
 assert(!ui.includes("نسخه خوانش: Cloudflare KV"));
 assert.match(ui,/daily_reference_point_not_ohlc/);
});
