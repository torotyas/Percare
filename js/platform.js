<!-- © 2026 凱波工作室 Kaibo Studio -->
/* Platform adapter: everything that differs between the browser/PWA and a future
   Capacitor build lives here, so the rest of the app never touches native APIs directly.
   - Store: localStorage today; could be swapped for @capacitor/preferences or a backend sync.
   - Notifier: Web Notifications today; uses @capacitor/local-notifications when present.
   - Share/Download: Web Share API / <a download>; @capacitor/share + @capacitor/filesystem when present. */
(function(){
  const cap = () => window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor : null;
  const plugin = n => { const c = cap(); return c && c.Plugins ? c.Plugins[n] : null; };

  const Store = {
    get(k, def){ try{ const v = localStorage.getItem('pf.'+k); return v==null ? def : JSON.parse(v); }catch(e){ return def; } },
    set(k, v){ try{ localStorage.setItem('pf.'+k, JSON.stringify(v)); return true; }catch(e){ alert('儲存空間不足，請刪除部分照片或資料後再試。'); return false; } }
  };

  // Reminder fire time: 09:00 local on the due date.
  const fireAt = r => { const d = new Date(r.date+'T09:00:00'); return d; };
  const hashId = s => { let h=0; for(const ch of s) h=(h*31+ch.charCodeAt(0))|0; return Math.abs(h)%2147483000+1; };

  const Notifier = {
    isNative(){ return !!plugin('LocalNotifications'); },
    supported(){ return this.isNative() || ('Notification' in window); },
    state(){ if(this.isNative()) return 'native'; if(!('Notification' in window)) return 'unsupported'; return Notification.permission; },
    async request(){
      const ln = plugin('LocalNotifications');
      if(ln){ const r = await ln.requestPermissions(); return r.display; }
      if(!('Notification' in window)) return 'unsupported';
      return await Notification.requestPermission();
    },
    // Native: hand the full schedule to the OS (works when the app is closed).
    // Web: nothing to schedule; checkDue() fires while the app is open.
    async sync(reminders, label){
      const ln = plugin('LocalNotifications'); if(!ln) return;
      try{
        // Android 13+: POST_NOTIFICATIONS is a runtime permission. Ask only once there is something to remind.
        if(reminders.length){ const perm = await ln.checkPermissions(); if(perm.display==='prompt' || perm.display==='prompt-with-rationale') await ln.requestPermissions(); }
        const pend = await ln.getPending(); if(pend.notifications.length) await ln.cancel({notifications: pend.notifications.map(n=>({id:n.id}))});
        const now = Date.now();
        const list = reminders.filter(r=>fireAt(r).getTime()>now).map(r=>({id:hashId(r.id+r.date), title:'🐾 照護提醒', body:label(r), schedule:{at:fireAt(r), allowWhileIdle:true}, smallIcon:'ic_stat_paw'}));
        if(list.length) await ln.schedule({notifications:list});
      }catch(e){ console.warn('native schedule failed', e); }
    },
    async show(title, body){
      if(this.isNative() || !('Notification' in window) || Notification.permission!=='granted') return false;
      try{
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if(reg) await reg.showNotification(title,{body, icon:'icons/icon-192.png', tag:title+body});
        else new Notification(title,{body, icon:'icons/icon-192.png'});
        return true;
      }catch(e){ return false; }
    }
  };

  // Native file names: keep the extension, make the base name filesystem-safe (Chinese is fine on Android,
  // but some share targets choke on spaces/slashes).
  const safeName = n => n.replace(/[\\/:*?"<>|\s]+/g,'_');
  const toB64 = blob => new Promise((r,j)=>{const fr=new FileReader(); fr.onload=()=>r(fr.result.split(',')[1]); fr.onerror=j; fr.readAsDataURL(blob);});
  const Share = {
    // Share a file (image/PDF/ics). Native: write to app cache via @capacitor/filesystem, then open the
    // Android share sheet (@capacitor/share) so the user can save to Files/Drive, print, or send it.
    async file(blob, filename, title, text){
      const sh = plugin('Share'), fs = plugin('Filesystem');
      if(sh && fs){
        const w = await fs.writeFile({path:safeName(filename), data:await toB64(blob), directory:'CACHE'});
        try{ await sh.share({title, text, files:[w.uri], dialogTitle:title}); }
        catch(e){ if(!/cancel/i.test(e&&e.message||'')) throw e; }
        return 'shared';
      }
      const file = new File([blob], filename, {type: blob.type});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title, text}); return 'shared'; }
      return 'unsupported';
    },
    image(blob, filename, text){ return Share.file(blob, filename, filename, text); },
    async download(blob, filename){
      // In a native WebView <a download> does nothing: save to cache and open the share sheet instead.
      if(plugin('Share') && plugin('Filesystem')){
        try{ await Share.file(blob, filename, filename, filename); }catch(e){ alert('無法分享檔案：'+(e&&e.message||e)); }
        return;
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();}, 1000);
    },
    openExternal(url){ window.open(url, '_blank', 'noopener'); }
  };

  window.Platform = { Store, Notifier, Share, isNative: () => !!cap() };
})();
