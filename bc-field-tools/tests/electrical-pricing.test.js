"use strict";
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
function load() {
  const data = new Map();
  const localStorage = {
    getItem:k=>data.get(k) || null,
    setItem:(k,v)=>data.set(k,String(v)),
    removeItem:k=>data.delete(k),
  };
  const sandbox={window:{},localStorage,console};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../estimate.js"),"utf8"),sandbox);
  return {E:sandbox.window.BCEstimate, localStorage};
}
function pick(st,id,qty=1) {st.selected[id]={checked:true,qty};return st;}
describe("electrical pricing 2026-11-07 (new cases only)",()=>{
 let E,ls;
 beforeEach(()=>({E,localStorage:ls}=load()));
 it("catalog contains approved, tax inclusive menu",()=>{
  for(const [id,amount] of [["dedicated_std",22000],["volt_change",5500],["breaker_branch",5500],["outlet_with_work",3300],["outlet_visit",5500],["dedicated_excess_m",1650]])assert.equal(E.itemById[id].price,amount);
 });
 it("old menu IDs and prices remain available for existing quotes",()=>{
  for(const [id,amount] of [["dedicated",18000],["breaker",15000],["outlet",5000],["wire_ext",2200]])assert.equal(E.itemById[id].price,amount);
 });
 it("new circuit includes ordinary parts and voltage change not added",()=>{
   const b=E.buildFieldLines({workType:"専用コンセント新設",dedicatedCircuit:"なし",voltChange:"必要",wireDistance:10});
   assert.deepEqual(Array.from(b.lines.map(x=>x.id)),["dedicated_std"]);
   const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{});
   E.mergeLinesIntoState(st,b.lines,{});
   assert.equal(E.totals(st).total,22000);
 });
 it("13m new circuit costs 26950 with 3m excess",()=>{
   const b=E.buildFieldLines({dedicatedCircuit:"なし",wireDistance:13,voltChange:"必要",billableWireM:3});
   const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{});
   E.mergeLinesIntoState(st,b.lines,{});
   assert.equal(st.selected.dedicated_excess_m.qty,3);
   assert.equal(E.totals(st).total,26950);
   assert.equal(b.lines.some(x=>x.id==="wire_ext"),false);
 });
 it("unknown length does not silently charge extra",()=>{
   const b=E.buildFieldLines({dedicatedCircuit:"なし",wireDistanceUnknown:true});
   assert.equal(b.lines.some(x=>x.id==="dedicated_excess_m"),false);
   assert.ok(b.notices.some(x=>x.title.includes("距離")));
 });
 it("existing circuit voltage switch is separate from new circuit",()=>{
   const b=E.buildFieldLines({dedicatedCircuit:"あり",voltChange:"必要"});
   assert.deepEqual(Array.from(b.lines.map(x=>x.id)),["volt_change"]);
 });
 it("voltage switch and branch breaker can be combined",()=>{
   const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{});
   pick(st,"volt_change");pick(st,"breaker_branch");
   assert.equal(E.electricConflicts(st),"");
   assert.equal(E.totals(st).total,11000);
 });
 it("a new circuit cannot be double charged with voltage/parts",()=>{
   for(const id of ["volt_change","outlet","breaker","breaker_branch","wire_ext","outlet_visit","dedicated"]){
     const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{});
     pick(st,"dedicated_std");
     pick(st,id);
     assert.ok(E.electricConflicts(st),id);
   }
 });
 it("new circuits can charge genuinely separate additional outlet when concurrent",()=>{
   const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{});
   pick(st,"dedicated_std");pick(st,"outlet_with_work");
   assert.equal(E.electricConflicts(st),"");
   assert.equal(E.totals(st).total,25300);
 });
 it("standalone versus concurrent outlet mutually exclusive",()=>{
   const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{});
   pick(st,"outlet_visit");pick(st,"outlet_with_work");
   assert.ok(E.electricConflicts(st));
 });
 it("legacy selected quote amount stays at 18000 after new catalog pricing",()=>{
   const snapshot={selected:{dedicated:{checked:true,qty:1}},custom:[],note:"",memo:""};
   const st=E.hydrateFromCaseEstimate(snapshot,{});
   assert.equal(st.pricingVersion,"legacy");
   assert.equal(E.totals(st).total,18000);
   assert.equal(st.lockedPrices.dedicated,18000);
 });
 it("locked historical prices survive master adjustment and case reopening",()=>{
   const state=E.hydrateFromCaseEstimate({selected:{dedicated:{checked:true,qty:1}},custom:[]},{dedicated:19000});
   assert.equal(E.totals(state).total,19000);
   const snap=E.extractCaseEstimate(state);
   const restored=E.hydrateFromCaseEstimate(snap,{dedicated:55000});
   assert.equal(E.totals(restored).total,19000);
   assert.equal(restored.lockedPrices.dedicated,19000);
 });
 it("new selected prices lock per case without overwriting shared master",()=>{
   const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{dedicated_std:22000});
   pick(st,"dedicated_std");E.lockLinePrice(st,"dedicated_std");
   const snap=E.extractCaseEstimate(st);
   const reopened=E.hydrateFromCaseEstimate(snap,{dedicated_std:33000});
   assert.equal(E.totals(reopened).total,22000);
   assert.equal(E.effectivePrices(reopened).dedicated_std,33000);
 });
 it("new case snapshots start with latest version",()=>{
   const st=E.emptyCaseEstimate();
   assert.equal(st.pricingVersion,E.ELECTRIC_PRICE_VERSION);
 });
 it("original legacy item remains hidden when not selected",()=>{
   const st=E.loadState();
   const cat=E.initialCatalog.find(x=>x.category==="軽い電気工事");
   const ids=E.catalogItemsForDisplay(cat.items,st).map(x=>x.id);
   assert.equal(ids.includes("breaker"),false);
   assert.ok(ids.includes("breaker_branch"));
 });
 it("submitted customer amount is unaffected by catalog sample: 53900 explicit quote",()=>{
  const st=E.hydrateFromCaseEstimate(E.emptyCaseEstimate(),{});
  st.custom=[{name:"取外し",price:6600,qty:1,unit:"台"},{name:"標準取付",price:22000,qty:1,unit:"台"},{name:"専用回路（提示済み）",price:22000,qty:1,unit:"式"},{name:"高所作業",price:3300,qty:1,unit:"式"}];
  assert.equal(E.totals(st).total,53900);
 });
});
