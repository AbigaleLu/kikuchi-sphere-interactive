/* Each slot owns at most one decoded image. Replaced ImageBitmaps are explicitly closed. */
(() => {
  'use strict';
  const cancelled = () => new DOMException('Image request cancelled', 'AbortError');

  function imageElement(url, signal, revoke = false) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      function dispose() { image.removeAttribute('src'); if (revoke) URL.revokeObjectURL(url); }
      function cleanup() { image.onload = image.onerror = null; signal.removeEventListener('abort', abort); }
      function abort() { cleanup(); dispose(); reject(cancelled()); }
      if (signal.aborted) { dispose(); reject(cancelled()); return; }
      image.onload = () => { cleanup(); resolve({image, dispose}); };
      image.onerror = () => { cleanup(); dispose(); reject(new Error('Image decode failed')); };
      signal.addEventListener('abort', abort, {once:true});
      image.src = url;
    });
  }

  async function download(url, signal) {
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, {once:true});
    const timeout = setTimeout(abort, 20000);
    try {
      if (signal.aborted) throw cancelled();
      if (window.location && window.location.protocol === 'file:') return await imageElement(url, request.signal);
      const response = await fetch(url, {signal:request.signal, credentials:'omit', cache:'force-cache'});
      if (!response.ok) throw new Error('HTTP '+response.status);
      const blob = await response.blob();
      if (request.signal.aborted) throw cancelled();
      if (typeof createImageBitmap === 'function') {
        try {
          const image = await createImageBitmap(blob);
          if (request.signal.aborted) { image.close(); throw cancelled(); }
          return {image, dispose:() => image.close()};
        } catch (error) {
          if (request.signal.aborted) throw error;
          // Some browsers decode an image element but not the same format via ImageBitmap.
        }
      }
      return await imageElement(URL.createObjectURL(blob), request.signal, true);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }

  window.KikuchiTextureSlot = class {
    constructor() { this.version=0; this.resource=null; this.request=null; }
    get image() { return this.resource && this.resource.image; }
    clear() {
      this.version++;
      if (this.request) this.request.abort();
      if (this.resource) this.resource.dispose();
      this.request=this.resource=null;
    }
    async load(primary, fallback) {
      this.clear();
      const version=this.version, request=new AbortController();
      this.request=request;
      let error;
      for (const url of [primary, fallback]) {
        if (!url) continue;
        try {
          const resource=await download(url, request.signal);
          if (version!==this.version || request.signal.aborted) { resource.dispose(); return null; }
          this.resource=resource;this.request=null;return resource.image;
        } catch (failure) {
          if (version!==this.version || request.signal.aborted) return null;
          error=failure;
        }
      }
      if (version===this.version) this.request=null;
      throw error || new Error('Image unavailable');
    }
  };
})();
