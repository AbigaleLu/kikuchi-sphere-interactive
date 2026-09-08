const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,Image}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),output=path.join(root,'validation/lite');fs.mkdirSync(output,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await sleep(10);}throw new Error('Timed out waiting for viewer state');}
function harness(options={}){
 const elements={},docEvents={},winEvents={},frames=new Map(),requests=[],active=new Set(),blobs=new Map();
 let id=0,aborted=0,closed=0,draws=0,clipboard='';
 const bounds={left:0,top:0,width:options.width||390,height:options.height||480};
 const previewTransforms=[];
 const surfaces={viewer:createCanvas(bounds.width,bounds.height),'face-preview':createCanvas(512,512)};
 const faults=new Set();
 class Element{
  constructor(){this.handlers={};this.children=[];this.dataset={};this.hidden=false;}
  addEventListener(k,fn){this.handlers[k]=fn;}setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}
  append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
  getBoundingClientRect(){return bounds;}focus(){}select(){}setPointerCapture(){}
 }
 const el=id=>elements[id]||(elements[id]=new Element());
 for(const [id,surface]of Object.entries(surfaces)){
  const native=surface.getContext('2d'),context=new Proxy(native,{get(t,key){if(key==='drawImage')return(image,...args)=>{assert(!image.disposed,'drawing disposed image');draws++;if(id==='face-preview')previewTransforms.push(t.getTransform());return t.drawImage(image,...args);};const value=t[key];return typeof value==='function'?value.bind(t):value;},set(t,key,v){t[key]=v;return true;}});
  el(id).getContext=()=>context;
  Object.defineProperties(el(id),{width:{get:()=>surface.width,set:v=>surface.width=v},height:{get:()=>surface.height,set:v=>surface.height=v}});
 }
 const buttons={models:['FCC','BCC'].map(model=>Object.assign(new Element(),{dataset:{model}})),editions:['teaching','day'].map(edition=>Object.assign(new Element(),{dataset:{edition}})),views:['001','110','111'].map(view=>Object.assign(new Element(),{dataset:{view}}))};
 function track(image,file){image.file=file;image.disposed=false;active.add(image);image.close=()=>{if(!image.disposed){image.disposed=true;active.delete(image);closed++;}};return image;}
 class HtmlImage extends Image{
  set src(url){const blob=blobs.get(url),file=blob?blob.file:url;this._url=url;track(this,file);super.src=fs.readFileSync(path.join(root,file));}
  get src(){return this._url;}removeAttribute(){if(this.close)this.close();}
 }
 const document={hidden:false,getElementById:el,querySelectorAll:s=>s==='[data-model]'?buttons.models:s==='[data-edition]'?buttons.editions:buttons.views,createElement:()=>new Element(),createElementNS:()=>new Element(),createTextNode:text=>({text}),addEventListener:(k,fn)=>docEvents[k]=fn};
 const location=new URL('https://example.test/index-lite.html'+(options.query||''));
 class TestURL extends URL {
  static createObjectURL(blob){const url='blob:'+ ++id;blobs.set(url,blob);return url;}
  static revokeObjectURL(url){blobs.delete(url);}
 }
 const sandbox={console,document,DOMException,AbortController,Image:HtmlImage,setTimeout,clearTimeout,URL:TestURL,URLSearchParams,location,navigator:{clipboard:{async writeText(value){if(options.clipboardFailure)throw new Error('Clipboard unavailable');clipboard=value;}}},
  requestAnimationFrame(fn){frames.set(++id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},ResizeObserver:class{observe(){}},
  window:{devicePixelRatio:3,location,addEventListener:(k,fn)=>winEvents[k]=fn},
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
  if(file==='viewer-lite.js')source=source.replace(/\}\)\(\);\s*$/,'window.probe={get q(){return q},get zoom(){return zoom},get key(){return textureKey()},get ready(){return ready},get selected(){return selected},get faces(){return data.faces},get pointers(){return pointers},rotate,frontFace,drawPreview};})();');
  vm.runInContext(source,sandbox);
 }
 const h={surfaces,previewTransforms,el,buttons,sandbox,document,docEvents,winEvents,requests,active,frames,faults,probe:sandbox.window.probe,
  get aborted(){return aborted;},get closed(){return closed;},get draws(){return draws;},get clipboard(){return clipboard;},
  flush(){for(let n=0;n<3&&frames.size;n++){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(100+n*16));}},
  async ready(){await until(()=>el('loading').hidden&&el('detail-status').textContent==='高清细节已载入');h.flush();},
  close(){winEvents.pagehide();},
  save(name){h.flush();fs.writeFileSync(path.join(output,name+'.png'),surfaces.viewer.toBuffer('image/png'));},
  get pixelBytes(){return [...active].reduce((n,image)=>n+image.width*image.height*4,0);}
 };return h;
}

test('phone first load uses only one atlas and one lossless detail, with a bounded canvas',async()=>{
 const h=harness();try{await h.ready();assert.equal(h.requests.length,2);assert.equal(h.active.size,2);assert(h.requests.every(p=>p.includes('/lite/original-fcc/')));
 assert(h.pixelBytes<10000000);assert.equal(h.el('viewer').width,585);assert.equal(h.el('viewer').height,720);h.save('phone-teaching-fcc');
 const transferred=h.requests.reduce((n,file)=>n+fs.statSync(path.join(root,file)).size,0);
 fs.writeFileSync(path.join(output,'initial-metrics.json'),JSON.stringify({imageRequests:h.requests,imageTransferBytes:transferred,decodedTexturePixelBytes:h.pixelBytes,mainCanvasPixelBytes:585*720*4,previewCanvasPixelBytes:512*512*4,scope:'Native Canvas with simulated network and ImageBitmap lifetime; not measured browser process memory.'},null,2));
 }finally{h.close();}
});

test('four model combinations retain camera and zoom, point presets correctly, and release old images',async()=>{
 const h=harness({width:1100,height:850});try{await h.ready();h.el('zoom-in').handlers.click();
 for(const edition of h.buttons.editions){
  const before=JSON.stringify(h.probe.q),zoom=h.probe.zoom;edition.handlers.click();await h.ready();assert.equal(JSON.stringify(h.probe.q),before);assert.equal(h.probe.zoom,zoom);
  for(const model of h.buttons.models){
   model.handlers.click();await h.ready();assert.equal(h.active.size,2);assert.equal(h.probe.key,model.dataset.model+(edition.dataset.edition==='teaching'?'_original':''));
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
 await h.ready();assert(h.aborted>=3);assert.equal(h.active.size,2);assert([...h.active].every(i=>i.file.includes('/lite/original-fcc/')));
 }finally{h.close();}
});

test('detail failure keeps the sphere usable and retry restores detail',async()=>{
 const h=harness({delay:30});try{
 h.faults.add('/face-');h.faults.add('assets/fcc-');await until(()=>!h.el('retry-detail').hidden&&h.probe.ready);
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
 const h=harness({htmlFallback:true,rejectWebP:true});try{await h.ready();assert.equal(h.active.size,2);assert(h.requests.some(p=>p.endsWith('atlas.jpg')));assert(h.requests.some(p=>p.startsWith('assets/fcc-')&&p.endsWith('.png')));h.save('phone-compatible-fallback');}
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

test('all 26 crystal directions are selectable, including the antipodal [00-1] face',async()=>{
 const h=harness();try{await h.ready();assert.equal(h.el('face-picker').children.length,26);
 for(let i=0;i<h.probe.faces.length;i++){
  h.el('face-picker').handlers.change({target:{value:String(i)}});await h.ready();
  assert.equal(h.probe.frontFace(),i);assert.equal(h.probe.selected,i);
  assert(h.probe.q.every(Number.isFinite));assert.equal(h.el('face-label').textContent,h.probe.faces[i].label);
 }
 }finally{h.close();}
});

test('sharing and rendering-mode changes preserve edition, crystal, angle, zoom and selected face',async()=>{
 const h=harness({query:'?edition=day&crystal=BCC&q=0.1,0.2,0.3,0.9&zoom=135&face=19'});let restored;
 try{await h.ready();assert.equal(h.probe.key,'BCC');assert.equal(h.probe.selected,19);assert.equal(h.probe.zoom,1.35);
 await h.el('share').handlers.click();const shared=new URL(h.clipboard);
 assert.equal(shared.searchParams.get('edition'),'day');assert.equal(shared.searchParams.get('crystal'),'BCC');assert.equal(shared.searchParams.get('face'),'19');
 restored=harness({query:shared.search});await restored.ready();
 assert.equal(restored.probe.selected,h.probe.selected);assert.equal(restored.probe.zoom,h.probe.zoom);
 h.probe.q.forEach((v,i)=>assert(Math.abs(v-restored.probe.q[i])<0.000002));
 h.el('render-mode-link').handlers.click();const mode=new URL(h.el('render-mode-link').href);
 assert.equal(mode.pathname,'/index-drawings.html');assert.equal(mode.search,shared.search);
 }finally{h.close();if(restored)restored.close();}
});

test('sharing offers a selectable URL when clipboard permission is unavailable',async()=>{
 const h=harness({clipboardFailure:true});try{await h.ready();await h.el('share').handlers.click();
 assert.equal(h.el('share-fallback').hidden,false);assert.match(h.el('share-fallback').value,/edition=teaching&crystal=FCC/);assert.match(h.el('share-status').textContent,/请复制/);
 }finally{h.close();}
});


test('all 104 local previews keep the center text upright and the entire image inside the canvas',async()=>{
 const sheet=createCanvas(8*210,13*230),sc=sheet.getContext('2d');sc.fillStyle='#fff';sc.fillRect(0,0,sheet.width,sheet.height);
 let cell=0;
 for(const edition of ['teaching','day'])for(const crystal of ['FCC','BCC']){
  const h=harness({query:`?edition=${edition}&crystal=${crystal}`});
  try{await h.ready();
   for(let i=0;i<26;i++){
    h.el('face-picker').handlers.change({target:{value:String(i)}});await h.ready();
    const m=h.previewTransforms.at(-1),face=h.probe.faces[i];
    const [dx,dy]=edition==='day'?face.textDirections[crystal]:[1,0];
    assert(Math.abs(m.b*dx+m.d*dy)<1e-5,`${edition} ${crystal} ${i}: text is tilted`);
    assert(m.a*dx+m.c*dy>0,`${edition} ${crystal} ${i}: text is upside down`);
    const [w,height]=h.sandbox.window.KIKUCHI_LITE.sets[h.probe.key].faces[i].size;
    for(const [x,y]of [[0,0],[w,0],[0,height],[w,height]]){
     const px=m.a*x+m.c*y+m.e,py=m.b*x+m.d*y+m.f;
     assert(px>=-.001&&px<=512.001&&py>=-.001&&py<=512.001,'preview clipped');
    }
    const x=cell%8*210,y=Math.floor(cell/8)*230;
    sc.drawImage(h.surfaces['face-preview'],x,y,200,200);sc.fillStyle='#111';sc.font='14px sans-serif';sc.fillText(`${edition} ${crystal} #${i}`,x+5,y+218);cell++;
    assert.equal(h.active.size,2);
   }
  }finally{h.close();}
 }
 fs.writeFileSync(path.join(output,'all-preview-directions.png'),sheet.toBuffer('image/png'));
});
