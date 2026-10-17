const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'..','webmeldungen.js'),'utf8');
const settings=fs.readFileSync(path.join(__dirname,'..','einstellungen.html'),'utf8');

function setup(initial={}, notificationPermission=null) {
  const store=new Map(Object.entries(initial));
  const listeners={};
  const nodes={};
  function field(id){
    const listenersFor={};
    return nodes[id]={
      id, value:'', textContent:'', checked:false, disabled:false, hidden:false, dataset:{},
      style:{}, rows:[],
      addEventListener(event,callback){listenersFor[event]=callback;},
      trigger(event){assert.ok(listenersFor[event]);return listenersFor[event]();},
      replaceChildren(){this.rows=[];this.textContent='';},
      append(node){this.rows.push(node);}
    };
  }
  for(const id of ['reminderEnabled','reminderLead','reminderPermissionBtn',
                   'reminderPermissionInfo','reminderPermissionStatus','reminderUpcoming']) field(id);
  let created=0;
  const document={
    addEventListener(event,callback){listeners[event]=callback;},
    getElementById(id){return nodes[id]||null;},
    createElement(type){
      created++;
      return {type,style:{},setAttribute(){},append(){}};
    }
  };
  const localStorage={
    getItem(key){return store.get(key)||null;},
    setItem(key,value){store.set(key,value);}
  };
  const sandbox={
    document, localStorage, window:{addEventListener(){}},
    setTimeout(){},setInterval(){},Date,Number,String,JSON,Set,
    navigator:{},console
  };
  if(notificationPermission!==null){
    sandbox.Notification={
      permission:notificationPermission,
      requestPermission:async()=>notificationPermission
    };
  }
  vm.runInNewContext(js,sandbox);
  listeners.DOMContentLoaded();
  return {nodes,store,created:()=>created};
}
test('settings show saved preferences and do not create any floating bell',()=>{
  const x=setup({'kalender-webmeldungen':JSON.stringify({active:false,lead:60,browser:false})});
  assert.equal(x.nodes.reminderEnabled.checked,false);
  assert.equal(x.nodes.reminderLead.value,'60');
  assert.equal(x.nodes.reminderLead.disabled,true);
  assert.equal(x.created(),0);
  assert.equal(x.nodes.reminderPermissionBtn.hidden,true);
});
test('controls store preference for this device without touching appointments',()=>{
  const x=setup({'appTermine':'[{"id":1}]'});
  x.nodes.reminderEnabled.checked=false;
  x.nodes.reminderEnabled.trigger('change');
  assert.equal(JSON.parse(x.store.get('kalender-webmeldungen')).active,false);
  assert.equal(x.store.get('appTermine'),'[{"id":1}]');
  x.nodes.reminderEnabled.checked=true;
  x.nodes.reminderEnabled.trigger('change');
  x.nodes.reminderLead.value='120';
  x.nodes.reminderLead.trigger('change');
  assert.equal(JSON.parse(x.store.get('kalender-webmeldungen')).lead,120);
});
test('unsupported browser disables system notification permission request',()=>{
  const x=setup();
  assert.equal(x.nodes.reminderPermissionBtn.disabled,true);
  assert.equal(x.nodes.reminderPermissionBtn.hidden,true);
  assert.equal(x.nodes.reminderPermissionStatus.dataset.state,'unavailable');
  assert.match(x.nodes.reminderPermissionStatus.textContent,/nicht verfügbar/);
});
test('allowed notifications show a small informational state instead of an inactive button',()=>{
  const x=setup({},'granted');
  assert.equal(x.nodes.reminderPermissionStatus.dataset.state,'allowed');
  assert.equal(x.nodes.reminderPermissionBtn.hidden,true);
  assert.match(x.nodes.reminderPermissionStatus.textContent,/erlaubt/);
});
test('blocked notifications hide the permission request and explain device settings',()=>{
  const x=setup({},'denied');
  assert.equal(x.nodes.reminderPermissionStatus.dataset.state,'blocked');
  assert.equal(x.nodes.reminderPermissionBtn.hidden,true);
  assert.match(x.nodes.reminderPermissionInfo.textContent,/Geräte/);
});
test('permission request action is visible only when supported and not yet decided',()=>{
  const x=setup({},'default');
  assert.equal(x.nodes.reminderPermissionStatus.dataset.state,'available');
  assert.equal(x.nodes.reminderPermissionBtn.hidden,false);
  assert.equal(x.nodes.reminderPermissionBtn.disabled,false);
});
test('responsive reminder card uses scoped typography and overflow protection',()=>{
  assert.match(settings,/#reminderSettings #reminderPermissionBtn/);
  assert.match(settings,/font: 600 14px\/1\.4/);
  assert.match(settings,/overflow-wrap: anywhere/);
  assert.match(settings,/#reminderSettings \[hidden\]/);
  assert.match(settings,/class="reminder-permission"/);
});
test('reminder controls live under system settings, not a floating bell',()=>{
  for(const id of ['reminderSettings','reminderEnabled','reminderLead',
                   'reminderPermissionBtn','reminderPermissionStatus','reminderUpcoming']){
    assert.match(settings,new RegExp('id="'+id+'"'));
  }
  assert.doesNotMatch(js,/position:fixed;right:12px;top:12px/);
  assert.doesNotMatch(js,/🔔.*textContent/);
});
