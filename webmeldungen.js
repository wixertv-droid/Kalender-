/* Browser-Webmeldungen, nur wenn die Kalenderseite geöffnet ist. */
(function(){
'use strict';
var KEY='kalender-webmeldungen';
var pref={active:true,lead:30,browser:false};
try{Object.assign(pref,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){}
var seenKey='kalender-webmeldungen-gesehen';
var seen=new Set();
try{JSON.parse(localStorage.getItem(seenKey)||'[]').forEach(function(x){seen.add(x);});}catch(e){}
var list,badge;
function read(key){
  try{var d=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(d)?d:[];}catch(e){return [];}
}
function soon(){
  var now=Date.now();
  return read('appTermine').map(function(x){return Object.assign({},x,{kind:'Termin'});})
  .concat(read('appEvents').map(function(x){return Object.assign({},x,{kind:'Event'});}))
  .map(function(x){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x.datum||''))||!/^\d{1,2}:\d{2}$/.test(String(x.start||'')))return null;
    var d=new Date(x.datum+'T'+x.start.padStart(5,'0')+':00');
    return Object.assign({},x,{when:d.getTime()});
  }).filter(function(x){return x&&Number.isFinite(x.when)&&x.when>=now&&x.when-now<=pref.lead*60000;})
  .sort(function(a,b){return a.when-b.when;});
}
function toast(message){
  var box=document.createElement('div');
  box.setAttribute('role','status');
  box.style.cssText='position:fixed;bottom:18px;right:18px;z-index:100000;background:#191b27;color:#fff;border:1px solid #05d9e8;padding:12px 16px;border-radius:10px;max-width:min(90vw,400px);box-shadow:0 6px 30px #0009;font:14px system-ui';
  box.textContent=message;
  document.body.append(box);
  setTimeout(function(){box.remove();},6500);
}
window.webmeldung=toast;
function refresh(){
  if(!list)return;
  list.replaceChildren();
  var entries=pref.active?soon():[];
  badge.textContent=String(entries.length);
  badge.hidden=!entries.length;
  entries.slice(0,35).forEach(function(x){
    var line=document.createElement('div');
    line.textContent=x.kind+': '+(x.name||'Ohne Name')+' · '+x.datum+' · '+x.start+' Uhr';
    line.style.cssText='padding:9px 0;border-bottom:1px solid #353c4a;font-size:13px';
    list.append(line);
    var key=[x.kind,x.id||x.name,x.datum,x.start].join(':');
    if(seen.has(key))return;
    seen.add(key);
    localStorage.setItem(seenKey,JSON.stringify(Array.from(seen).slice(-300)));
    toast(x.kind+' beginnt bald um '+x.start+' Uhr');
    if(pref.browser&&'Notification' in window&&Notification.permission==='granted'){
      try{new Notification('Kalender-Erinnerung',{body:'Ein '+x.kind+' beginnt um '+x.start+' Uhr.',tag:'kalender-'+key,icon:'/icon-192.png'});}catch(e){}
    }
  });
  if(!entries.length){
    var no=document.createElement('p');
    no.textContent=pref.active?'Keine bald anstehenden Termine.':'Erinnerungen sind deaktiviert.';
    no.style.color='#b5b6c2';list.append(no);
  }
}
function init(){
  if(document.getElementById('kalender-webmeldungen'))return;
  var root=document.createElement('div');
  root.id='kalender-webmeldungen';
  root.style.cssText='position:fixed;right:12px;top:12px;z-index:99999;font-family:system-ui,sans-serif';
  var trigger=document.createElement('button');
  trigger.type='button';trigger.title='Webmeldungen öffnen';
  trigger.setAttribute('aria-label','Webmeldungen');
  trigger.style.cssText='position:relative;background:#0e1624;border:1px solid #05d9e8;color:#fff;border-radius:99px;padding:10px 13px;cursor:pointer;font-size:21px';
  trigger.textContent='🔔';
  badge=document.createElement('span');badge.hidden=true;
  badge.style.cssText='font-size:11px;background:#ff4268;border-radius:40px;position:absolute;top:-5px;right:-5px;padding:2px 5px';
  trigger.append(badge);
  var panel=document.createElement('div');panel.hidden=true;
  panel.style.cssText='width:min(350px,calc(100vw - 24px));max-height:70vh;overflow:auto;margin-top:8px;padding:15px;border:1px solid #05d9e8;background:#111621;color:#fff;border-radius:13px;box-shadow:0 12px 35px #000a';
  var title=document.createElement('strong');title.textContent='🔔 Webmeldungen';
  var help=document.createElement('p');help.textContent='Termine und Events: Meldungen erscheinen, solange die Kalenderseite geöffnet ist.';
  help.style.cssText='font-size:12px;line-height:1.4;color:#bcc5d2';
  var label=document.createElement('label');label.style.cssText='display:block;margin:12px 0;font-size:13px';
  var checked=document.createElement('input');checked.type='checkbox';checked.checked=!!pref.active;
  checked.addEventListener('change',function(){pref.active=checked.checked;localStorage.setItem(KEY,JSON.stringify(pref));refresh();});
  label.append(checked,document.createTextNode(' Erinnerungen aktiv'));
  var select=document.createElement('select');select.setAttribute('aria-label','Vorwarnzeit');
  select.style.cssText='width:100%;padding:9px;background:#191d29;color:#fff;border:1px solid #536173;border-radius:7px;margin:0 0 12px';
  [5,15,30,60,120].forEach(function(minutes){var o=document.createElement('option');o.value=minutes;o.textContent=minutes+' Minuten vorher';select.append(o);});
  select.value=String(pref.lead);
  select.addEventListener('change',function(){pref.lead=Number(select.value);localStorage.setItem(KEY,JSON.stringify(pref));refresh();});
  var enable=document.createElement('button');enable.type='button';enable.textContent='Browser-Benachrichtigungen aktivieren';
  enable.style.cssText='width:100%;padding:10px;background:#05d9e8;color:#050711;border:0;border-radius:8px;cursor:pointer';
  enable.addEventListener('click',async function(){
    if(!('Notification' in window)){toast('Browser-Benachrichtigungen werden auf diesem Gerät nicht unterstützt.');return;}
    var allowed=await Notification.requestPermission();
    pref.browser=allowed==='granted';localStorage.setItem(KEY,JSON.stringify(pref));
    toast(pref.browser?'Browser-Benachrichtigungen aktiviert.':'Browser-Benachrichtigungen nicht erlaubt.');
  });
  list=document.createElement('div');list.style.marginTop='12px';
  panel.append(title,help,label,select,enable,list);
  trigger.addEventListener('click',function(){panel.hidden=!panel.hidden;});
  root.append(trigger,panel);document.body.append(root);
  refresh();
  setInterval(refresh,60000);
  window.addEventListener('storage',function(e){if(e.key==='appTermine'||e.key==='appEvents')refresh();});
}
document.addEventListener('DOMContentLoaded',function(){setTimeout(init,1400);});
})();