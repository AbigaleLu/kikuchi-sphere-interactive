const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../texture-loader-lite.js'),'utf8');
function setup(fetch){const timers=new Map(),events=[];let id=0;const window={location:{protocol:'https:'}};const context={window,fetch,AbortController,DOMException,Blob,Date,setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:i=>timers.delete(i),createImageBitmap:async blob=>({width:1,height:1,close(){}})};vm.runInNewContext(source,context);return {slot:new window.KikuchiTextureSlot(),timers,events};}
test('streamed bytes report real totals then decode, and clear waiting timers',async()=>{
 const h=setup(async()=>({ok:true,headers:new Headers({'Content-Length':'6'}),body:new ReadableStream({start(c){c.enqueue(new Uint8Array(2));c.enqueue(new Uint8Array(4));c.close();}})}));
 await h.slot.load('a',null,p=>h.events.push(p));const end=h.events.at(-1);assert.equal(end.phase,'decode');assert.equal(end.loaded,6);assert.equal(end.total,6);assert.equal(h.timers.size,0);h.slot.clear();
});
test('unknown length stays indeterminate and fallback restarts its own byte count',async()=>{
 const h=setup(async url=>url==='bad'?{ok:false,status:503}:{ok:true,headers:new Headers(),body:new ReadableStream({start(c){c.enqueue(new Uint8Array(3));c.close();}})});
 await h.slot.load('bad','good',p=>h.events.push(p));assert(h.events.some(p=>p.fallback));assert.equal(h.events.at(-1).total,0);assert.equal(h.events.at(-1).loaded,3);h.slot.clear();
});
test('stalled request reports waiting; cancellation prevents stale progress and releases timers',async()=>{
 const h=setup((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')))));
 const request=h.slot.load('slow',null,p=>h.events.push(p));[...h.timers.values()].find(t=>t.ms===5000).f();assert.equal(h.events.at(-1).phase,'stalled');h.slot.clear();assert.equal(await request,null);assert.equal(h.timers.size,0);
});
