const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const customer=fs.readFileSync(path.join(root,'kunden.html'),'utf8');
const pages=['woche.html','tag.html'].map(f=>({name:f,html:fs.readFileSync(path.join(root,f),'utf8')}));

test('all customer forms have quick/detail tabs and preserve original customer IDs',()=>{
  assert.match(customer,/id="kundeModeQuick"/);
  assert.match(customer,/id="kundeModeDetail"/);
  assert.match(customer,/function setKundeFormMode\(mode\)/);
  for(const p of pages){
    assert.match(p.html,/id="bookingModeQuick"/,p.name);
    assert.match(p.html,/id="bookingModeDetail"/,p.name);
    for(const id of ['terminKundeId','terminName','terminKontakt','terminPlattform',
       'terminPlattform2','terminKontakt2','terminProfilLink','terminVorlieben','terminKundenNotizen',
       'terminStart','terminEnde','terminDatum','bookingCustomerAdvanced']){
      assert.equal([...p.html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,
        id+' on '+p.name);
    }
    assert.match(p.html,/onclick="setBookingCustomerMode\('detail'\)"/);
    assert.match(p.html,/class="customer-row"/);
    assert.doesNotMatch(p.html,/id="kPerf"/);
  }
});
test('customer forms are mobile responsive and do not distort existing UI',()=>{
  for(const scope of ['#kundeModal','#terminModal']){
    assert.ok(css.includes(scope+' .modal-content'));
    assert.ok(css.includes(scope+' .customer-row'));
    assert.ok(css.includes(scope+' .customer-mode-toggle'));
  }
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/#terminModal \.calendar-picker-native/);
  assert.match(css,/font-size:16px/);
});
test('no new-customer performance metrics are requested',()=>{
  assert.match(customer,/id="kundeReviews"/);
  assert.match(customer,/reviews\.hidden=!detail\|\|!currentKundeId/);
  assert.match(customer,/id='kPerf'|id="kPerf"/);
  assert.match(app,/vibe: 0, perf: 0, noshows: 0/);
  assert.match(app,/status: 'none'/);
});
function setup(){
  const values=new Map();
  const storage=new Map([
     ['appKunden',JSON.stringify([])],['appTermine',JSON.stringify([])],
     ['appSperrzeiten',JSON.stringify([])],['appEvents',JSON.stringify([])],
     ['appEinstellungen',JSON.stringify({})]
  ]);
  const element=id=>{
    if(!values.has(id))values.set(id,{
        id,value:'',dataset:{},style:{},hidden:false,scrollTop:0,
        setAttribute(k,v){this[k]=v},addEventListener(){},
        querySelectorAll(){return []},
        querySelector(){return {scrollTop:0}}
    });
    return values.get(id);
  };
  const modal=element('terminModal');
  modal.querySelectorAll=()=>[];
  modal.querySelector=()=>({scrollTop:0});
  const doc={
    getElementById:element,querySelectorAll:()=>[],addEventListener(){},
    querySelector:()=>null,documentElement:{style:{setProperty(){}}}
  };
  const sandbox={
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:doc,window:{location:{search:'?d=2027-02-16'}},
    URLSearchParams,Option:class{constructor(label,value){this.label=label;this.value=value}},
    console,Date,JSON,Math,Number,parseInt,isNaN,setTimeout(){},
    alert(msg){throw new Error('Unexpected alert: '+msg)}
  };
  vm.createContext(sandbox);
  vm.runInContext(app,sandbox);
  vm.runInContext('refreshAllViews=()=>{};closeModal=()=>{};',sandbox);
  return {sandbox,element,storage};
}
test('new customer saved from booking retains optional details, not fake ratings',()=>{
  const t=setup();
  const names={
    terminName:'Testkunde Neu',terminDatum:'2027-02-16',
    terminStart:'14:00',terminEnde:'15:00',terminKategorie:'kat1',
    terminPlattform:'WhatsApp',terminKontakt:'testkontakt',
    terminPreis:'80',terminPraeferenz:'none',
    terminPlattform2:'Telegram',terminKontakt2:'second-contact',
    terminProfilLink:'https://example.org/profile',terminVorlieben:'bekannt',
    terminKundenNotizen:'Vor der ersten Buchung',
    terminNotizen:'Buchungstest',terminKundeId:''
  };
  for(const [id,value] of Object.entries(names))t.element(id).value=value;
  t.sandbox.saveAppointment();
  const k=JSON.parse(t.storage.get('appKunden'));
  const appointments=JSON.parse(t.storage.get('appTermine'));
  assert.equal(k.length,1);
  assert.equal(appointments.length,1);
  assert.equal(appointments[0].kunde_id,k[0].id);
  assert.equal(k[0].plattform2,'Telegram');
  assert.equal(k[0].kontakt2,'second-contact');
  assert.equal(k[0].vorlieben,'bekannt');
  assert.equal(k[0].notizen,'Vor der ersten Buchung');
  assert.equal(k[0].status,'none');
  assert.equal(k[0].perf,0);
  assert.equal(k[0].vibe,0);
  assert.equal(k[0].noshows,0);
  assert.equal(appointments[0].preis,'80');
});
test('switching quick/detail keeps input values untouched and date selects the viewed day',()=>{
  const t=setup();
  t.element('bookingModeQuick');
  t.element('bookingModeDetail');
  t.element('bookingModeHint');
  t.element('bookingCustomerAdvanced');
  t.element('terminKundeId').value='';
  t.element('terminVorlieben').value='bekannte Angaben';
  t.sandbox.setBookingCustomerMode('quick');
  assert.equal(t.element('bookingCustomerAdvanced').hidden,true);
  t.sandbox.setBookingCustomerMode('detail');
  assert.equal(t.element('bookingCustomerAdvanced').hidden,false);
  assert.equal(t.element('terminVorlieben').value,'bekannte Angaben');
  // The modal requires a container with optional input pickers.
  t.element('terminModal').querySelectorAll=()=>[];
  t.sandbox.openModal();
  assert.equal(t.element('terminDatum').value,'2027-02-16');
  assert.equal(t.element('bookingCustomerAdvanced').hidden,true);
});
