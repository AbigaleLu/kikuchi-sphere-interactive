/* Public totals only; independent of model rendering and download behavior. */
(() => {
  'use strict';
  const row=document.getElementById('usage-stats');
  if (!row) return;
  const nodes=Array.from(row.querySelectorAll('[data-usage-path]'));
  const refreshAfter=5*60*1000;
  let active=null,lastAttempt=0,retryTimer=null,failures=0;
  const hide=()=>{row.hidden=true;if (active) active.abort();};
  async function refresh(force=false) {
    if (document.hidden || navigator.onLine===false || active || (!force && Date.now()-lastAttempt<refreshAfter)) return;
    const controller=new AbortController();active=controller;lastAttempt=Date.now();
    const timeout=setTimeout(()=>controller.abort(),8000);
    try {
      const counts=await Promise.all(nodes.map(async node=>{
        // Official start-date parameter: includes all project history (launched 2026).
        // Avoid the stale default-total response without inventing count values.
        const url='https://abigalelu.goatcounter.com/counter/'+encodeURIComponent(node.dataset.usagePath)+'.json?start=2000-01-01';
        const response=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
        if (response.status===404) return '0';
        if (!response.ok) throw new Error('Counter unavailable');
        const {count}=await response.json();
        const value=String(count);
        if (!/^\d[\d, .\u00a0\u202f]*$/.test(value)) throw new Error('Invalid counter');
        return value;
      }));
      if (controller.signal.aborted || navigator.onLine===false) return;
      nodes.forEach((node,i)=>{node.textContent=counts[i];});row.hidden=false;
      failures=0;clearTimeout(retryTimer);retryTimer=null;
    } catch (_) {
      hide();
      // Recover from a brief connection failure without waiting five minutes.
      clearTimeout(retryTimer);
      if (++failures<=2) retryTimer=setTimeout(()=>refresh(true),failures===1?10000:30000);
    }
    finally {clearTimeout(timeout);active=null;}
  }
  window.addEventListener('offline',hide);
  window.addEventListener('online',()=>refresh(true));
  window.addEventListener('pagehide',hide);
  window.addEventListener('pageshow',e=>{if(e.persisted) refresh(true);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) refresh(row.hidden);});
  setInterval(()=>refresh(),refreshAfter);
  refresh(true);
})();
