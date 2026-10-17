const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','events.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','events.js'),'utf8');

test('event form keeps every required input ID and label exactly once',()=>{
    const ids=[
       'evName','evDatum','evStart','evEnde','evColor','evStadt','evLocation',
       'evPreis','evCapacity','evKosten','evGirlName','evGirlAge',
       'evGirlHeight','evGirlWeight','evGirlType','evVorlieben','evTabus',
       'evPraef','evTowels','evNS'
    ];
    for(const id of ids){
        const matches=[...html.matchAll(new RegExp('id="'+id+'"','g'))];
        assert.equal(matches.length,1,id+' is missing or duplicated');
        assert.match(html,new RegExp('<label for="'+id+'">'));
    }
});
test('mobile event fields use scoped one-column responsive grid',()=>{
    assert.match(html,/#eventSetupModal \.event-grid-primary/);
    assert.match(html,/@media\(max-width:640px\)/);
    assert.match(html,/grid-template-columns:minmax\(0,1fr\)/);
    assert.match(html,/#eventSetupModal \.event-setup-content/);
    assert.match(html,/z-index:12000/);
    assert.match(html,/max-height:calc\(100dvh - 16px\)/);
    assert.match(html,/font-size:16px/);
    assert.match(html,/\.event-picker-face/);
    assert.doesNotMatch(html,/id="evName"[^>]*style="flex:/);
});
test('date/time pickers are left aligned with full-size native input',()=>{
    for(const [id,type] of [['evDatum','date'],['evStart','time'],['evEnde','time']]){
        assert.match(html,new RegExp('<input type="'+type+'" id="'+id+'" class="event-native-picker"'));
        assert.match(html,new RegExp('data-for="'+id+'"'));
    }
    assert.match(html,/#eventSetupModal \.event-native-picker \{position:absolute/);
    assert.match(html,/opacity:0;cursor:pointer/);
    assert.match(html,/text-align:left/);
    assert.match(js,/input\.addEventListener\('change', refreshEventPickerFaces\)/);
    assert.match(js,/refreshEventPickerFaces\(\);\s*document\.getElementById\('eventSetupModal'\)/);
});
test('photo/video controls and generated references are removed',()=>{
    assert.doesNotMatch(html,/evBilder|evVideo|Bilder verfügbar|Videos \(Optional\)/i);
    assert.doesNotMatch(js,/getElementById\('evBilder'\)|getElementById\('evVideo'\)/);
    assert.doesNotMatch(js,/Heiße Bilder|📸 \*Videos/);
    assert.match(js,/\.\.\.\(original \|\| \{\}\)/);
});
test('opening saved event refreshes picker text from existing date/time',()=>{
    const inputs=new Map();
    for(const id of ['evName','evDatum','evStart','evEnde','evColor','evStadt','evLocation',
     'evPreis','evCapacity','evKosten','evTowels','evGirlName','evGirlAge','evGirlHeight',
     'evGirlWeight','evGirlType','evVorlieben','evTabus','evNS','evPraef','btnDelete','promoBox',
     'eventDashboardModal','eventSetupModal']){
       inputs.set(id,{value:'',style:{},innerText:'',scrollTop:9});
    }
    const faces=['evDatum','evStart','evEnde'].map(id=>({
       dataset:{for:id},textContent:'',classList:{toggle(){}}
    }));
    const document={
       getElementById(id){return inputs.get(id)},
       querySelectorAll(sel){return sel.includes('.event-picker-value')?faces:[]},
       querySelector(){return {scrollTop:99}},
       addEventListener(){}
    };
    const item={id:55,name:'Alt Event',datum:'2026-12-21',start:'16:00',ende:'18:00',
        preis:'80',kosten:30,video:'legacy-value',bilder:'legacy',guests:[]};
    const context={
       document,
       localStorage:{getItem:key=>key==='appEvents'?JSON.stringify([item]):'[]'},
       Date,console,window:{},navigator:{clipboard:{writeText(){}}},
       alert(){},confirm(){return false},setTimeout(){},Number,Math,
       location:{search:''}
    };
    vm.createContext(context);
    vm.runInContext(js,context);
    context.currentEditEventId=55;
    context.openEventSetup(false);
    assert.equal(inputs.get('evStart').value,'16:00');
    assert.equal(inputs.get('evDatum').value,'2026-12-21');
    assert.equal(faces[0].textContent,'21.12.2026');
    assert.equal(faces[1].textContent,'16:00');
    assert.equal(faces[2].textContent,'18:00');
    assert.equal(inputs.get('eventSetupModal').style.display,'flex');
});
