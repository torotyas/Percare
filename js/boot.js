<!-- © 2026 凱波工作室 Kaibo Studio -->
/* iOS Safari / WKWebView zoom in on a quick second tap or a pinch. Block those
   gestures, but never cancel touchend on a control: preventDefault there swallows
   the click. Repeat care check-ins stay on the 10s debounce in home.js. */
(function(){
  let last=0;
  const clickable=el=>{ const n=el&&el.nodeType===3?el.parentElement:el; return !!(n&&n.closest&&n.closest('a,button,input,select,textarea,label')); };
  document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
  document.addEventListener('touchend',e=>{
    if(e.touches.length||e.changedTouches.length!==1){ last=0; return; }
    const now=Date.now();
    if(now-last<=300&&!clickable(e.target)) e.preventDefault();
    last=now;
  },{passive:false});
})();
(async function(){
const PC=window.PC;
document.getElementById('tabs').onclick=e=>{ const b=e.target.closest('[data-t]'); if(b) PC.go(b.dataset.t); };
document.getElementById('sheet').onclick=e=>{ if(e.target.id==='sheet'||e.target.closest('[data-close]')) PC.closeSheet(); };
try{ await PC.DB.open(); await PC.load(); }catch(e){ document.body.innerHTML='<div class="empty"><div class="big">⚠️</div>無法開啟本機資料庫（IndexedDB）。<br>請確認不是無痕模式，或換一個瀏覽器。</div>'; return; }
const start=(location.hash||'#home').slice(1);
PC.go(['home','pets','track','care','passport','sos'].includes(start)?start:'home');
PC.checkDue(); setInterval(PC.checkDue,60000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ PC.checkDue(); if(PC.current==='care') PC.rerender(); } });
PC.syncNotifs();
if('serviceWorker' in navigator && !window.Platform.isNative() && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
window.__app=PC; PC.ready=true;
})();
