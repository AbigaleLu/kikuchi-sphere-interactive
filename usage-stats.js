/* Public totals only; independent of model rendering and download behavior. */
(() => {
  'use strict';
  const row=document.getElementById('usage-stats');
  if (!row) return;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  const hide=()=>{row.hidden=true;controller.abort();};
  window.addEventListener('offline',hide);
  Promise.all(Array.from(row.querySelectorAll('[data-usage-path]'),async node=>{
    const url='https://abigalelu.goatcounter.com/counter/'+encodeURIComponent(node.dataset.usagePath)+'.json';
    const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if (response.status===404) return [node,'0'];
    if (!response.ok) throw new Error('Counter unavailable');
    const {count}=await response.json();
    // GoatCounter returns a formatted string, including thousands separators.
    const value=String(count);
    if (!/^\d[\d, .\u00a0\u202f]*$/.test(value)) throw new Error('Invalid counter');
    return [node,value];
  })).then(counts=>{
    if (controller.signal.aborted || navigator.onLine===false) return;
    counts.forEach(([node,count])=>{node.textContent=count;});
    row.hidden=false;
  }).catch(hide).finally(()=>clearTimeout(timeout));
})();
