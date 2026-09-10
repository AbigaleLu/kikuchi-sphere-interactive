const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../usage-stats.js'),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const nodes=['/kikuchi/lite','/kikuchi/full','download-a4-pdf'].map(usagePath=>({dataset:{usagePath},textContent:'0'}));
 const row={hidden:true,querySelectorAll:()=>nodes},win={},doc={},requests=[],timers=new Map();
 let now=1e9,interval,id=0;
 const h={nodes,row,win,doc,requests,values:['13','3','1'],failure:null,advance:()=>now+=300001,tick:()=>interval()};
 const document={hidden:false,getElementById:()=>row,addEventListener:(k,f)=>doc[k]=f};h.document=document;
 const sandbox={document,navigator:{onLine:true},window:{addEventListener:(k,f)=>win[k]=f},AbortController,Date:{now:()=>now},setTimeout:(f,ms)=>{timers.set(++id,f);return id;},clearTimeout:i=>timers.delete(i),setInterval:f=>interval=f,fetch:async(url,options)=>{
  requests.push({url,options});const index=nodes.findIndex(n=>url.includes(encodeURIComponent(n.dataset.usagePath)+'.json'));
  if(h.failure==='network')throw Error('blocked');
  return {status:h.failure===index?404:h.failure===403?403:200,ok:h.failure!==403,json:async()=>({count:h.failure==='invalid'?'<b>0</b>':h.values[index]})};
 }};
 vm.runInNewContext(source,sandbox);return h;
}
test('official range preserves the three paths and renders public formatted totals',async()=>{const h=harness();await settle();assert(!h.row.hidden);assert.deepEqual(h.nodes.map(n=>n.textContent),['13','3','1']);assert.equal(h.requests.length,3);for(const r of h.requests){assert(r.url.endsWith('?start=2000-01-01'));assert.equal(r.options.cache,'no-store');assert.equal(r.options.credentials,'omit');}});
test('visible pages refresh after five minutes; hidden tabs send no periodic requests',async()=>{const h=harness();await settle();h.values=['14','4','1'];h.advance();h.tick();await settle();assert.equal(h.nodes[0].textContent,'14');h.document.hidden=true;h.advance();h.tick();await settle();assert.equal(h.requests.length,6);h.document.hidden=false;h.doc.visibilitychange();await settle();assert.equal(h.requests.length,9);});
test('individual missing paths show zero; disabled, blocked and malformed counters hide the row',async()=>{for(const failure of [1,403,'network','invalid']){const h=harness();await settle();h.failure=failure;h.advance();h.tick();await settle();assert.equal(h.row.hidden,failure!==1);if(failure===1)assert.equal(h.nodes[1].textContent,'0');}});
test('offline hides the row and online restores fresh totals',async()=>{const h=harness();await settle();h.win.offline();assert(h.row.hidden);h.values=['15','4','2'];h.win.online();await settle();assert(!h.row.hidden);assert.equal(h.nodes[0].textContent,'15');});
test('page cache restoration refreshes counts without registering a view or event',async()=>{const h=harness();await settle();h.win.pagehide();assert(h.row.hidden);h.win.pageshow({persisted:true});await settle();assert.equal(h.requests.length,6);assert(h.requests.every(r=>r.url.includes('/counter/')));});
