(async function(){
const PC=window.PC;
document.getElementById('tabs').onclick=e=>{ const b=e.target.closest('[data-t]'); if(b) PC.go(b.dataset.t); };
document.getElementById('sheet').onclick=e=>{ if(e.target.id==='sheet'||e.target.closest('[data-close]')) PC.closeSheet(); };
try{ await PC.DB.open(); await PC.load(); }catch(e){ document.body.innerHTML='<div class="empty"><div class="big">⚠️</div>無法開啟本機資料庫（IndexedDB）。<br>請確認不是無痕模式，或換一個瀏覽器。</div>'; return; }
const start=(location.hash||'#pets').slice(1);
PC.go(['pets','track','care','passport','sos'].includes(start)?start:'pets');
PC.checkDue(); setInterval(PC.checkDue,60000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ PC.checkDue(); if(PC.current==='care') PC.rerender(); } });
PC.syncNotifs();
if('serviceWorker' in navigator && !window.Platform.isNative() && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
window.__app=PC; PC.ready=true;
})();
