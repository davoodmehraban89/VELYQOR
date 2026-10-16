/**
 * Version-specific read-only public-asset parity diagnostic.
 * No production or Cloudflare API mutation; hashes PUBLIC frontend assets only.
 * v26 and v27 Preview are separate ephemeral origins, not production deployment.
 */
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const workers=[
 {label:'v26',url:'https://85177f9d-velyqor-preview.davoodmehraban89.workers.dev/'},
 {label:'v27',url:'https://2cbeb4e2-velyqor-preview.davoodmehraban89.workers.dev/'}
];
async function safeGet(url){
 for(let n=0;n<3;n++){
  try{
   const result=await fetch(url,{signal:AbortSignal.timeout(16000)});
   if(result.ok) return result.text();
  }catch{}
  if(n<2)await new Promise(resolve=>setTimeout(resolve,(n+1)*700));
 }
 throw Error('PUBLIC_ASSET_UNAVAILABLE');
}
function hash(s){return createHash('sha256').update(s,'utf8').digest('hex')}
function scriptFrom(html){
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 if(scripts.length!==1)throw Error('Unexpected number of inline scripts');
 new Script(scripts[0][1]);
 return scripts[0][1];
}
const assets=await Promise.all(workers.map(async w=>{
 const [html,sw]=await Promise.all([safeGet(w.url),safeGet(w.url+'sw.js')]);
 const script=scriptFrom(html);
 if(!html.includes('class="shell"')||!sw.includes('chartnova-v1'))throw Error('Unexpected app asset');
 return {
  label:w.label,url:w.url,html,sw,script,
  hash:{html:hash(html),sw:hash(sw),inlineJS:hash(script)},
  bytes:{html:Buffer.byteLength(html),sw:Buffer.byteLength(sw),script:Buffer.byteLength(script)}
 };
}));
const [v26,v27]=assets;
const stripScript=h=>h.replace(/<script>[\s\S]*?<\/script>/,
  '<script>__INLINE_JS_VERSION_SLOT__</script>');
const outerEqual=stripScript(v26.html)===stripScript(v27.html);
const swEqual=v26.sw===v27.sw;
const expectedPatch=v27.script.includes('chartnovaRefreshInFlight')&&
  !v26.script.includes('chartnovaRefreshInFlight');
const result={
 verdict:swEqual&&outerEqual&&expectedPatch?'FRONTEND_SCOPE_CONFIRMED':'DIFFERENCE_REQUIRES_REVIEW',
 liveDeploymentNotChanged:true,
 originalWorkerBackendNotCompared:true,
 previewVersions:assets.map(({label,url,hash,bytes})=>({label,url,sha256:hash,bytes})),
 serviceWorkerByteIdentical:swEqual,
 htmlOutsideInlineJavascriptIdentical:outerEqual,
 expectedJavascriptPatchMarker:expectedPatch
};
console.log('CHARTNOVA_V26_V27_PUBLIC_ASSET_DIFF '+JSON.stringify(result));
if(!swEqual||!outerEqual||!expectedPatch)process.exitCode=1;
