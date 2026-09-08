const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,Image}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),output=path.join(root,'validation/lite');fs.mkdirSync(output,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await sleep(10);}throw new Error('Timed out waiting for viewer state');}
function harness(options={}){
 const elements={},docEvents={},winEvents={},frames=new Map(),requests=[],active=new Set(),blobs=new Map();
 let id=0,aborted=0,closed=0,draws=0;
 const bounds={left:0,top:0,width:options.width||390,height:options.height||480};
 const surfaces={viewer:createCanvas(bounds.width,bounds.height),'face-preview':createCanvas(512,512)};
 const faults=new Set();
 class Element{
  constructor(){this.handlers={};this.children=[];this.dataset={};this.hidden=false;}
  addEventListener(k,fn){this.handlers[k]=fn;}setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
  getBoundingClientRect(){return bounds;}focus(){}setPointerCapture(){}
 }
 const el=id=>elements[id]||(elements[id]=new Element());
 for(const [id,surface]of Object.entries(surfaces)){
  const native=surface.getContext('2d'),context=new Proxy(native,{get(t,key){if(key==='drawImage')return(image,...args)=>{assert(!image.disposed,'drawing disposed image');draws++;return t.drawImage(image,...args);};const value=t[key];return typeof value==='function'?value.bind(t):value;},set(t,key,v){t[key]=v;return true;}});
  el(id).getContext=()=>context;
  Object.defineProperties(el(id),{width:{get:()=>surface.width,set:v=>surface.width=v},height:{get:()=>surface.height,set:v=>surface.height=v}});
 }
 const buttons={models:['FCC','BCC'].map(model=>Object.assign(new Element(),{dataset:{model}})),editions:['new','original'].map(edition=>Object.assign(new Element(),{dataset:{edition}})),views:['001','110','111'].map(view=>Object.assign(new Element(),{dataset:{view}}))};
 function track(image,file){image.file=file;image.disposed=false;active.add(image);image.close=()=>{if(!image.disposed){image.disposed=true;active.delete(image);closed++;}};return image;}
 class HtmlImage extends Image{
  set src(url){const blob=blobs.get(url),file=blob?blob.file:url;this._url=url;track(this,file);super.src=fs.readFileSync(path.join(root,file));}
  get src(){return this._url;}removeAttribute(){if(this.close)this.close();}
 }
 const document={hidden:false,getElementById:el,querySelectorAll:s=>s==='[data-model]'?buttons.models:s==='[data-edition]'?buttons.editions:buttons.views,createElement:()=>new Element(),createElementNS:()=>new Element(),createTextNode:text=>({text}),addEventListener:(k,fn)=>docEvents[k]=fn};
 const sandbox={console,document,DOMException,AbortController,Image:HtmlImage,setTimeout,clearTimeout,URL:{createObjectURL(blob){const url='blob:'+ ++id;blobs.set(url,blob);return url;},revokeObjectURL(url){blobs.delete(url);}},
  requestAnimationFrame(fn){frames.set(++id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},ResizeObserver:class{observe(){}},
  window:{devicePixelRatio:3,location:{protocol:'https:'},addEventListener:(k,fn)=>winEvents[k]=fn},
  fetch:async(file,{signal})=>{
   requests.push(file);
   if(options.delay)await new Promise((resolve,reject)=>{const done=()=>{signal.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,options.delay);function abort(){clearTimeout(timer);aborted++;reject(new DOMException('cancelled','AbortError'));}signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
   if(signal.aborted)throw new DOMException('cancelled','AbortError');
   const bad=[...faults].some(part=>file.includes(part)) || options.rejectWebP && file.endsWith('.webp');
   return{ok:!bad,status:bad?503:200,blob:async()=>({file})};
  },
  createImageBitmap:options.htmlFallback?undefined:async(blob)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(track(image,blob.file));image.onerror=reject;image.src=fs.readFileSync(path.join(root,blob.file));})
 };
 vm.createContext(sandbox);
 for(const file of ['model-drawings.js','model-lite.js','texture-loader-lite.js','viewer-lite.js']){
  let source=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='viewer-lite.js')source=source.replace(/\}\)\(\);\s*$/,'window.probe={get q(){return q},get zoom(){return zoom},get key(){return textureKey()},get ready(){return ready},get selected(){return selected},get faces(){return data.faces},get pointers(){return pointers},rotate,frontFace};})();');
  vm.runInContext(source,sandbox);
 }
 const h={el,buttons,sandbox,document,docEvents,winEvents,requests,active,frames,faults,probe:sandbox.window.probe,
  get aborted(){return aborted;},get closed(){return closed;},get draws(){return draws;},
  flush(){for(let n=0;n<3&&frames.size;n++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(100+n*16));}},
  async ready(){await until(()=>el('loading').hidden&&el('detail-status').textContent==='高清细节已载入');h.flush();},
  close(){winEvents.pagehide();},
  save(name){h.flush();fs.writeFileSync(path.join(output,name+'.png'),surfaces.viewer.toBuffer('image/png'));},
  get pixelBytes(){return [...active].reduce((n,image)=>n+image.width*image.height*4,0);}
 };return h;
}

test('phone first load uses only one atlas and one lossless detail, with a bounded canvas',async()=>{
 const h=harness();try{await h.ready();assert.equal(h.requests.length,2);assert.equal(h.active.size,2);assert(h.requests.every(p=>p.includes('/lite/new-fcc/')));
 assert(h.pixelBytes<10000000);assert.equal(h.el('viewer').width,585);assert.equal(h.el('viewer').height,720);h.save('phone-new-fcc');
 const transferred=h.requests.reduce((n,file)=>n+fs.statSync(path.join(root,file)).size,0);
 fs.writeFileSync(path.join(output,'initial-metrics.json'),JSON.stringify({imageRequests:h.requests,imageTransferBytes:transferred,decodedTexturePixelBytes:h.pixelBytes,mainCanvasPixelBytes:585*720*4,previewCanvasPixelBytes:512*512*4,scope:'Native Canvas with simulated network and ImageBitmap lifetime; not measured browser process memory.'},null,2));
 }finally{h.close();}
});

test('four model combinations retain camera and zoom, point presets correctly, and release old images',async()=>{
 const h=harness({width:1100,height:850});try{await h.ready();h.el('zoom-in').handlers.click();
 for(const edition of h.buttons.editions){
  const before=JSON.stringify(h.probe.q),zoom=h.probe.zoom;edition.handlers.click();await h.ready();assert.equal(JSON.stringify(h.probe.q),before);assert.equal(h.probe.zoom,zoom);
  for(const model of h.buttons.models){
   model.handlers.click();await h.ready();assert.equal(h.active.size,2);assert.equal(h.probe.key,model.dataset.model+(edition.dataset.edition==='original'?'_original':''));
   for(const b of h.buttons.views){b.handlers.click();await h.ready();const f=h.probe.faces[h.probe.frontFace()];assert.equal(f.hkl.join(''),b.dataset.view);}
   h.el('reset').handlers.click();await h.ready();h.save('desktop-'+edition.dataset.edition+'-'+model.dataset.model);
  }
 }
 assert(h.closed>10);assert(h.el('viewer').width*h.el('viewer').height<=1503000);
 }finally{h.close();assert.equal(h.active.size,0);}
});

test('rapid FCC/BCC switching cancels outdated downloads without stale textures',async()=>{
 const h=harness({delay:40});try{
 h.buttons.models[1].handlers.click();h.buttons.models[0].handlers.click();h.buttons.editions[1].handlers.click();h.buttons.editions[0].handlers.click();
 await h.ready();assert(h.aborted>=3);assert.equal(h.active.size,2);assert([...h.active].every(i=>i.file.includes('/lite/new-fcc/')));
 }finally{h.close();}
});

test('detail failure keeps the sphere usable and retry restores detail',async()=>{
 const h=harness({delay:30});try{
 h.faults.add('/face-');h.faults.add('assets/drawings/');await until(()=>!h.el('retry-detail').hidden&&h.probe.ready);
 h.flush();assert(h.draws>0);assert.equal(h.active.size,1);assert.equal(h.el('loading').hidden,true);
 h.faults.clear();h.el('retry-detail').handlers.click();await h.ready();assert.equal(h.active.size,2);
 }finally{h.close();}
});

test('atlas failure offers retry rather than claiming local assets are incomplete',async()=>{
 const h=harness({delay:30});try{
 h.faults.add('/atlas.');await until(()=>!h.el('retry-model').hidden);assert.equal(h.probe.ready,false);assert.match(h.el('loading-message').textContent,/网络/);
 h.faults.clear();h.el('retry-model').handlers.click();await h.ready();assert.equal(h.active.size,2);
 }finally{h.close();}
});

test('JPEG/PNG fallback and image elements work when WebP or ImageBitmap is unavailable',async()=>{
 const h=harness({htmlFallback:true,rejectWebP:true});try{await h.ready();assert.equal(h.active.size,2);assert(h.requests.some(p=>p.endsWith('atlas.jpg')));assert(h.requests.some(p=>p.startsWith('assets/drawings/')&&p.endsWith('.png')));h.save('phone-compatible-fallback');}
 finally{h.close();assert.equal(h.active.size,0);}
});

test('background suspends drawing and releases detail; page cache restoration reloads without changing angle',async()=>{
 const h=harness();try{await h.ready();h.el('spin').handlers.click();h.flush();assert(h.frames.size>0);
 h.document.hidden=true;h.docEvents.visibilitychange();assert.equal(h.frames.size,0);assert.equal(h.active.size,1);
 h.document.hidden=false;h.docEvents.visibilitychange();h.el('spin').handlers.click();await sleep(200);await h.ready();
 const q=JSON.stringify(h.probe.q),zoom=h.probe.zoom;h.winEvents.pagehide();assert.equal(h.active.size,0);h.winEvents.pageshow({persisted:true});await h.ready();assert.equal(JSON.stringify(h.probe.q),q);assert.equal(h.probe.zoom,zoom);
 }finally{h.close();}
});

test('drag and pinch still rotate and zoom while keeping only the settled front face in high resolution',async()=>{
 const h=harness();try{await h.ready();const canvas=h.el('viewer'),q=JSON.stringify(h.probe.q);
 const event=(id,x,y,type='pointerdown')=>({pointerId:id,clientX:x,clientY:y,button:0,type,preventDefault(){}});
 canvas.handlers.pointerdown(event(1,100,100));canvas.handlers.pointermove(event(1,130,110));canvas.handlers.pointerup(event(1,130,110,'pointerup'));await sleep(200);await h.ready();assert.notEqual(JSON.stringify(h.probe.q),q);assert.equal(h.probe.selected,h.probe.frontFace());
 canvas.handlers.pointerdown(event(1,100,100));canvas.handlers.pointerdown(event(2,200,100));canvas.handlers.pointermove(event(2,250,100));canvas.handlers.pointerup(event(2,250,100,'pointerup'));canvas.handlers.pointerup(event(1,100,100,'pointerup'));assert.equal(h.probe.zoom,1.5);assert.equal(h.probe.pointers.size,0);await sleep(200);await h.ready();assert.equal(h.active.size,2);
 }finally{h.close();}
});
