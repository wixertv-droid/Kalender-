// DOM-free business-logic smoke tests for the existing event module.
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const contents=fs.readFileSync(path.join(__dirname,'..','events.js'),'utf8');
function core(){
 const state=new Map();
 const sandbox={
    console,
    localStorage:{getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,String(v))},
    document:{addEventListener:()=>{},getElementById:()=>({})},
    navigator:{clipboard:{writeText:async()=>{}}},
    alert(){},
    confirm(){return true;},
    Date, Number, String, Math
 };
 vm.createContext(sandbox);
 vm.runInContext(contents,sandbox);
 return sandbox;
}
test('capacity counts only active guests',()=>{
 const c=core();
 assert.equal(c.eventCapacity({kapazitaet:8}),8);
 assert.equal(c.eventCapacity({kapazitaet:0}),0);
 assert.equal(c.eventCapacity({kapazitaet:-2}),0);
 assert.equal(c.occupiesSeat({status:'warteliste'}),false);
 assert.equal(c.occupiesSeat({status:'noshow'}),false);
 assert.equal(c.occupiesSeat({status:'bestaetigt'}),true);
});
test('event revenue reflects actual payments, not check-ins',()=>{
 const c=core();
 const event={preis:80,kosten:40,guests:[
  {status:'erschienen',preis:80,anzahlung:20,restzahlung:60},
  {status:'bestaetigt',preis:100,anzahlung:10,restzahlung:0},
  {status:'warteliste',preis:80,anzahlung:0,restzahlung:0}
 ]};
 const r=c.eventFinance(event);
 assert.equal(r.received,90);
 assert.equal(r.expected,180);
 assert.equal(r.costs,40);
 assert.equal(r.profit,50);
 assert.equal(r.open,90);
});
test('status markup never directly uses unescaped names',()=>{
 const c=core();
 assert.equal(c.escEvent('<img src=x onerror="attack">'),'&lt;img src=x onerror=&quot;attack&quot;&gt;');
});
