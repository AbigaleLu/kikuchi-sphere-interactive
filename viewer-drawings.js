/* 原生 Canvas：每面一张图纸裁图，正交投影，不计算衍射关系。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('viewer'), ctx = canvas.getContext('2d');
  const data = window.KIKUCHI_MODEL;
  if (!ctx || !data || !window.KIKUCHI_LITE) {
    $('loading-message').textContent = '模型资料未能载入，请刷新重试。也可下载下方的 A4 教学图纸。';
    $('retry').hidden = false;
    $('retry').addEventListener('click', () => location.reload());
    return;
  }
  const add = (a,b) => a.map((v,i) => v+b[i]);
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const mul = (a,s) => a.map(v => v*s);
  const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm = a => mul(a,1/Math.hypot(...a));
  const quat = (axis,angle) => [...mul(axis,Math.sin(angle/2)),Math.cos(angle/2)];
  const compose = (a,b) => norm([
    ...add(add(mul(b.slice(0,3),a[3]),mul(a.slice(0,3),b[3])),cross(a,b)),
    a[3]*b[3]-dot(a.slice(0,3),b.slice(0,3))
  ]);
  function rotate(v) {
    const t = mul(cross(q,v),2);
    return add(v,add(mul(t,q[3]),cross(q,t)));
  }
  const home = () => compose(quat([1,0,0],0.38),quat([0,1,0],-0.60));
  const params = new URLSearchParams(location.search);
  let q = home(), model = params.get('crystal') === 'BCC' ? 'BCC' : 'FCC';
  let edition = params.get('edition') === 'day' ? 'day' : 'teaching', zoom = 1, selected = null, highlight = false;
  let restoredOrientation = false;
  const sharedQ = (params.get('q') || '').split(',').map(Number);
  if (sharedQ.length === 4 && sharedQ.every(Number.isFinite) && Math.hypot(...sharedQ) > 0.1) {
    q = norm(sharedQ); restoredOrientation = true;
  }
  if (/^\d+(\.\d+)?$/.test(params.get('zoom') || '')) zoom = Math.max(0.55, Math.min(2.6, Number(params.get('zoom')) / 100));
  let width = 0, height = 0, scale = 1, visible = [], spinning = false;
  let frame = 0, lastTime = 0, ready = false;
  const radius = Math.max(...data.faces.flatMap(f => f.vertices.map(v => Math.hypot(...v))));
  const textures = Object.fromEntries(Object.keys(data.faces[0].images).map(key => [key,[]]));
  const textureKey = () => edition === 'day' ? model : model+'_original';
  const texturePath = (face, key) => window.KIKUCHI_LITE.sets[key].faces[face.id].detail;
  const loads = new Map();
  let loadSequence = 0;
  const pointers = new Map();
  let gestureStart = null, dragged = false, pinched = false;

  // 图片像素坐标到面平面的仿射基底，任意三点即可确定。
  data.faces.forEach(face => {
    const [a,b,c] = face.imagePolygon;
    const e = sub(face.vertices[1],face.vertices[0]), f = sub(face.vertices[2],face.vertices[0]);
    const bx=b[0]-a[0], by=b[1]-a[1], cx=c[0]-a[0], cy=c[1]-a[1];
    const det=bx*cy-by*cx;
    face.u = mul(sub(mul(e,cy),mul(f,by)),1/det);
    face.v = mul(sub(mul(f,bx),mul(e,cx)),1/det);
    face.origin = sub(sub(face.vertices[0],mul(face.u,a[0])),mul(face.v,a[1]));
    face.center = mul(face.vertices.reduce(add,[0,0,0]),1/face.vertices.length);
    face.normal = norm(face.center);
  });

  function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
  function project(v) { return [width/2+v[0]*scale,height/2-v[1]*scale]; }
  function draw(time) {
    frame = 0;
    if (spinning && !document.hidden && !pointers.size) {
      const dt = lastTime ? Math.min((time-lastTime)/1000,0.05) : 0;
      q = compose(quat([0,1,0],dt*0.22),q);
    }
    lastTime = time;
    const dpr = Math.min(window.devicePixelRatio || 1,2);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,width,height);
    scale = Math.min(width*0.41,(height-110)*0.47)/radius*zoom;
    visible = data.faces.map((face,i) => ({face,i,normal:rotate(face.normal),depth:rotate(face.center)[2]}))
      .filter(f => f.normal[2]>0.00001).sort((a,b) => a.depth-b.depth);
    if (ready) for (const item of visible) {
      const {face,i} = item;
      const poly = face.vertices.map(v => project(rotate(v)));
      item.screen = poly;
      ctx.save();
      ctx.beginPath(); poly.forEach((p,k) => k ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath();
      ctx.fillStyle='#fff';ctx.fill();ctx.clip();
      const o=project(rotate(face.origin)),u=rotate(face.u),v=rotate(face.v);
      ctx.transform(u[0]*scale,-u[1]*scale,v[0]*scale,-v[1]*scale,...o);
      ctx.drawImage(textures[textureKey()][i],0,0);
      ctx.restore();
      ctx.beginPath();poly.forEach((p,k) => k ? ctx.lineTo(...p) : ctx.moveTo(...p));ctx.closePath();
      ctx.strokeStyle=highlight && selected===i ? '#176d78' : '#53617055';
      ctx.lineWidth=highlight && selected===i ? 1.8 : 0.65;
      ctx.stroke();
    }
    if (spinning && !document.hidden) schedule();
  }
  function resize() {
    const rect=canvas.getBoundingClientRect(); width=rect.width;height=rect.height;
    const dpr=Math.min(window.devicePixelRatio || 1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);schedule();
  }
  function setZoom(value) {
    zoom=Math.max(0.55,Math.min(2.6,value));
    $('zoom').value=Math.round(zoom*100);$('zoom-value').value=`${Math.round(zoom*100)}%`;
    $('zoom-out').disabled=zoom<=0.55;$('zoom-in').disabled=zoom>=2.6;schedule();
  }
  function selectFace(index,mark=false) {
    selected=index;highlight=mark;
    if (!ready) return;
    const face=data.faces[index];
    $('face-label').textContent=face.label;
    $('face-preview').src=texturePath(face,textureKey());
    $('face-preview').hidden=false;
    $('face-preview').alt=`${edition==='teaching'?'低指数简明版':'Austin P. Day 原图版'} ${model} ${face.label} 晶向附近的图案`;
    $('face-description').textContent=`${face.vertices.length===3?'三角形':'正方形'}面 · 中心晶向 ${face.label}`;
    $('face-picker').value=String(index);
    schedule();
  }
  function frontFace() {
    return data.faces.reduce((best,f,i) => rotate(f.normal)[2]>rotate(data.faces[best].normal)[2]?i:best,0);
  }
  function setModel(next) {
    model=next;
    document.querySelectorAll('[data-model]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.model===model)));
    const name=model==='FCC'?'面心立方':'体心立方';
    $('model-tag').replaceChildren(document.createTextNode(model+' '));
    const span=document.createElement('span');span.textContent=name;$('model-tag').append(span);
    document.querySelectorAll('[data-edition]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.edition===edition)));
    $('edition-tag').textContent=edition==='teaching'?'低指数简明版':'Austin P. Day 原图版';
    $('edition-description').hidden=edition==='teaching';
    $('edition-description').textContent=edition==='teaching' ? '' : '保留原图中更丰富的线条与高指数标注，用于进阶观察和对照。';
    $('legend-block').hidden=edition==='day';
    $('source-note').hidden=edition==='teaching';
    $('source-note').textContent=edition==='teaching' ? '' : model==='FCC' ? 'Austin P. Day 的 FCC 展开图 · 两张组成一套' : 'Austin P. Day 的 BCC 展开图 · 一张组成一套';
    $('print-note').hidden=edition==='teaching';
    $('print-note').textContent=edition==='teaching'
      ? ''
      : model==='BCC' ? '当前 BCC 原图分辨率较低，放大后清晰度受源图限制。制作实体模型时，请按原图尺寸单独校准。' : '原图保留作者的线条与标注。制作实体模型时，请按原图尺寸单独校准。';
    $('source-links').replaceChildren();
    const sources=edition==='teaching' ? [['source/reference.pdf','下载 A4 教学图纸 · PDF']] : model==='FCC' ? [['assets/FCCpage1.jpg','查看 FCC 原图 · 第 1 张 ↗'],['assets/FCCpage2.jpg','查看 FCC 原图 · 第 2 张 ↗']] : [['assets/bcc_all2.jpg','查看 BCC 原图 ↗']];
    for (const [path,label] of sources) {
      const link=document.createElement('a');link.href=path;link.target='_blank';link.rel='noopener';
      link.textContent=label;
      if (edition==='teaching') {link.className='download-link';link.download='Kikuchi_FCC_BCC_LowIndex_A4.pdf';}
      $('source-links').append(link);
    }
    if (edition==='day') {
      const link=document.createElement('a');link.href='https://www.thingiverse.com/thing:969758';link.target='_blank';link.rel='noopener';link.textContent='访问 Austin P. Day 的作品页面 ↗';$('source-links').append(link);
    }
    $('legend').replaceChildren();
    for (const line of data.legends[model]) {
      const item=document.createElement('span');item.className='legend-item';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 6');
      const stroke=document.createElementNS(svg.namespaceURI,'line');
      Object.entries({x1:0,y1:3,x2:20,y2:3,stroke:line.color,'stroke-width':1.6,'stroke-dasharray':line.dash || ''}).forEach(([k,v]) => stroke.setAttribute(k,v));
      svg.append(stroke);item.append(svg,document.createTextNode(line.label));$('legend').append(item);
    }
    loadCurrent();
  }
  function setSpin(value) {
    spinning=value;lastTime=0;
    if (value) clearPreset();
    $('spin').setAttribute('aria-pressed',String(value));$('spin').textContent=value?'停止旋转':'自动旋转';schedule();
  }
  function setView(direction) {
    const from=norm(direction),to=[0,0,1],axis=cross(from,to),angle=Math.acos(Math.max(-1,Math.min(1,dot(from,to))));
    q=angle<0.00001?[0,0,0,1]:Math.PI-angle<0.00001?quat([1,0,0],Math.PI):quat(norm(axis),angle);
    uprightFront();setSpin(false);selectFace(frontFace());schedule();
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.view===direction.join(''))));
  }
  function uprightFront() {
    const face=data.faces[frontFace()];
    const direction=edition==='day' ? face.textDirections[model] : [1,0];
    const right=rotate(add(mul(face.u,direction[0]),mul(face.v,direction[1])));
    q=compose(quat([0,0,1],-Math.atan2(right[1],right[0])),q);
  }
  function clearPreset() {document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed','false'));}
  function reset() { q=home();uprightFront();setSpin(false);setZoom(1);selectFace(frontFace());clearPreset(); }
  document.querySelectorAll('[data-edition]').forEach(b => b.addEventListener('click',() => {
    edition=b.dataset.edition;
    setModel(model);
  }));
  document.querySelectorAll('[data-model]').forEach(b => b.addEventListener('click',() => setModel(b.dataset.model)));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click',() => setView(b.dataset.view.split('').map(Number))));
  $('zoom').addEventListener('input',e => setZoom(Number(e.target.value)/100));
  $('zoom-out').addEventListener('click',() => setZoom(zoom-0.15));
  $('zoom-in').addEventListener('click',() => setZoom(zoom+0.15));
  $('spin').addEventListener('click',() => setSpin(!spinning));$('reset').addEventListener('click',reset);
  $('face-picker').replaceChildren(...data.faces.map((face,i) => {
    const option=document.createElement('option');option.value=String(i);option.textContent=face.label+' 晶向';return option;
  }));
  $('face-picker').addEventListener('change',e => setView(data.faces[Number(e.target.value)].hkl));
  $('retry').addEventListener('click',() => loadCurrent());
  function currentViewUrl(page) {
    const url=new URL(location.protocol==='file:'?'https://abigalelu.github.io/kikuchi-sphere-teaching/index-drawings.html':location.href);url.hash='';url.search='';
    if(page) url.pathname=url.pathname.replace(/[^/]*$/,page);
    url.searchParams.set('edition',edition);url.searchParams.set('crystal',model);
    url.searchParams.set('q',q.map(v=>v.toFixed(6)).join(','));url.searchParams.set('zoom',String(Math.round(zoom*100)));
    if (selected!==null) url.searchParams.set('face',String(selected));
    return url;
  }
  $('render-mode-link').addEventListener('click',() => {setSpin(false);$('render-mode-link').href=currentViewUrl('index-lite.html').href;});
  $('share').addEventListener('click',async () => {
    setSpin(false);
    const url=currentViewUrl();
    try {await navigator.clipboard.writeText(url.href);$('share-status').textContent='已复制，可直接分享当前视角';$('share-fallback').hidden=true;}
    catch {const input=$('share-fallback');input.hidden=false;input.value=url.href;input.focus();input.select();$('share-status').textContent='请复制下面的链接';}
  });

  function local(e) { const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]; }
  function separation() { const p=[...pointers.values()];return Math.hypot(...sub(p[0],p[1])); }
  canvas.addEventListener('pointerdown',e => {
    if (e.button!==0) return;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,local(e));
    if (pointers.size===1) {gestureStart=local(e);dragged=false;pinched=false;}
    else {pinched=true;dragged=true;}
    setSpin(false);clearPreset();
  });
  canvas.addEventListener('pointermove',e => {
    if (!pointers.has(e.pointerId)) return;
    const old=pointers.get(e.pointerId),now=local(e),before=pointers.size===2?separation():0;
    pointers.set(e.pointerId,now);
    if (pointers.size===2) { if (before>1) setZoom(zoom*separation()/before);return; }
    const delta=sub(now,old);
    if (gestureStart && Math.hypot(...sub(now,gestureStart))>4) dragged=true;
    if (dragged) {q=compose(compose(quat([1,0,0],delta[1]*0.007),quat([0,1,0],delta[0]*0.007)),q);schedule();}
  });
  function release(e) {
    if (!pointers.has(e.pointerId)) return;
    if (e.type==='pointerup' && !dragged && !pinched && ready) {
      const p=local(e);
      const hit=[...visible].reverse().find(item => {
        let inside=false;const poly=item.screen;if (!poly) return false;
        for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
          const a=poly[i],b=poly[j];
          if ((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
        }return inside;
      });
      if (hit) selectFace(hit.i,true);
    }
    pointers.delete(e.pointerId);
    if (!pointers.size) gestureStart=null;
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(event => canvas.addEventListener(event,release));
  canvas.addEventListener('wheel',e => {e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?height:1;setZoom(zoom*Math.exp(-e.deltaY*unit*0.001));},{passive:false});
  canvas.addEventListener('keydown',e => {
    const keys={ArrowLeft:[[0,1,0],-0.1],ArrowRight:[[0,1,0],0.1],ArrowUp:[[1,0,0],-0.1],ArrowDown:[[1,0,0],0.1]};
    if (keys[e.key]) {e.preventDefault();setSpin(false);clearPreset();q=compose(quat(...keys[e.key]),q);schedule();}
    else if (['+','=','-','_','Home'].includes(e.key)) {e.preventDefault();e.key==='Home'?reset():setZoom(zoom+(['-','_'].includes(e.key)?-0.1:0.1));}
  });
  document.addEventListener('visibilitychange',() => {lastTime=0;if (!document.hidden) schedule();});
  new ResizeObserver(resize).observe(canvas);window.addEventListener('resize',resize);
  async function loadCurrent() {
    const sequence=++loadSequence,key=textureKey();
    ready=false;canvas.setAttribute('aria-busy','true');$('loading').hidden=false;$('retry').hidden=true;
    $('face-picker').disabled=true;$('face-preview').hidden=true;
    $('loading-message').textContent=`正在载入 ${model} ${edition==='teaching'?'简明版':'原图版（首次约 '+(model==='FCC'?'24':'19')+' MB）'}…`;
    schedule();
    if (!loads.has(key)) {
      let completed=0;
      const pending=Promise.all(data.faces.map((face,i) => new Promise((resolve,reject) => {
        const img=new Image();
        const timer=setTimeout(()=>{img.onload=null;img.onerror=null;reject(new Error('Image timeout'));},60000);
        img.onload=()=>{clearTimeout(timer);completed++;if(sequence===loadSequence)$('loading-message').textContent=`正在载入 ${model} · ${completed} / 26${edition==='day'?' · 原图较大，请稍候':''}`;resolve(img);};
        img.onerror=()=>{clearTimeout(timer);reject(new Error('Image unavailable'));};
        img.src=texturePath(face,key);
      }))).then(images=>{textures[key]=images;return images;}).catch(error=>{loads.delete(key);throw error;});
      loads.set(key,pending);
    }
    try {
      await loads.get(key);
      if(sequence!==loadSequence)return;
      ready=true;canvas.setAttribute('aria-busy','false');$('loading').hidden=true;$('face-picker').disabled=false;
      selectFace(selected===null?frontFace():selected,highlight);schedule();
    } catch {
      if(sequence!==loadSequence)return;
      canvas.setAttribute('aria-busy','false');$('loading-message').textContent='这套图案暂未载入。请重试，或切换另一套图纸；下方仍可下载纸质图纸。';$('retry').hidden=false;
    }
  }
  if (!restoredOrientation) uprightFront();
  if (/^\d+$/.test(params.get('face') || '') && Number(params.get('face'))<data.faces.length) selected=Number(params.get('face'));
  setZoom(zoom);setModel(model);resize();
})();
