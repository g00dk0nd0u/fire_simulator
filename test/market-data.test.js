'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const context={window:{},document:{addEventListener(){}},console,Float64Array,Math};
vm.createContext(context);
vm.runInContext(fs.readFileSync('docs/market-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('docs/app.js','utf8'),context);
for(const id of ['sp500','acwi','nasdaq100']){
  const rate=vm.runInContext(`getBaseRate({baseMarket:'${id}'})`,context);
  assert(Number.isFinite(rate)&&rate>-1,`${id} Base CAGR`);
}
const levels={start:'2020-01',nomTRP:[100,101,103,102,106]};
context.window.__marketData=Object.assign({},context.window.__marketData,{test:{id:'test',label:'Test',nominalCagr:.1,monthlyLevels:levels}});
vm.runInContext("selectMarketHistory('test')",context);
const recent=vm.runInContext('getRecentWindow(2,.1)',context);
assert.strictEqual(recent.recentStart,'2020-04');
assert.strictEqual(recent.recentEnd,'2020-05');
const expected=Math.pow(106/103,6)-1;
assert(Math.abs(recent.scenarioRate-expected)<1e-12,'Recent uses tail H months');
const v={currentAge:61,lifeAge:61.25,monthlyExpense:1,sp500Asset:0,annualSp500Contribution:0,annualPension:0,pensionStartAge:65,inflationRate:0,baseMarket:'test'};
const plans=vm.runInContext(`buildConservativeRequirements(${JSON.stringify(v)})`,context);
const returns=[.01,103/101-1,102/103-1,106/102-1];
function brute(duration){let worst=-Infinity,start=-1;for(let s=0;s<=returns.length-duration;s++){let req=0;for(let i=duration-1;i>=0;i--)req=(req+1)/(1+returns[s+i]);if(req>worst){worst=req;start=s}}return{worst,start}}
const actual=plans.get(61*12),wanted=brute(3);
assert(Math.abs(actual.requiredTotalAtRetirement-wanted.worst)<1e-12,'DP equals brute force');
assert.strictEqual(actual.worstStart,wanted.start);
vm.runInContext("selectMarketHistory('acwi')",context);
assert.strictEqual(vm.runInContext('HIST_RETURNS.length',context),0,'no cross-index fallback');

// S&P 500 preserves the legacy 1946-01 cut-off even when the raw series starts earlier.
context.window.__lfcSpData={start:'1945-10',nomTRP:[90,91,92,93,94,95]};
context.window.__marketData=Object.assign({},context.window.__marketData,{sp500:Object.assign({},context.window.__marketData.sp500,{monthlyLevels:null})});
vm.runInContext("selectMarketHistory('sp500')",context);
assert.strictEqual(vm.runInContext('HISTORY_META.start',context),'1946-01');
assert.strictEqual(vm.runInContext('HIST_RETURNS.length',context),3);

// A local monthly series is the single source for Base and Recent retirement rates.
context.window.__marketData.test={id:'test',label:'Test',historyStart:'2020-01',nominalCagr:.99,monthlyLevels:levels};
vm.runInContext("selectMarketHistory('test')",context);
const dataBase=vm.runInContext("getBaseRate({baseMarket:'test'})",context);
const fullCagr=Math.pow(106/100,12/4)-1;
assert(Math.abs(dataBase-fullCagr)<1e-12,'Base is calculated from monthly levels');
const recentScenario=vm.runInContext(`calculateRecentScenario(${JSON.stringify(v)},${dataBase})`,context);
assert.strictEqual(recentScenario.retirementRate,dataBase,'Recent retirement rate equals Base rate');

// Invalid or non-positive levels invalidate the complete history instead of silently bridging gaps.
for(const bad of [[100,null,102],[100,0,102],[100,-1,102]]){
  context.window.__marketData.bad={id:'bad',label:'Bad',monthlyLevels:{start:'2020-01',nomTRP:bad}};
  vm.runInContext("selectMarketHistory('bad')",context);
  assert.strictEqual(vm.runInContext('HIST_RETURNS.length',context),0);
}
// Invalid keys are rejected; only loadState performs explicit legacy-value migration.
assert.strictEqual(vm.runInContext("getBaseMarket('missing')",context),null);

// Displayed Base rate uses the same monthly-series CAGR as the calculation.
vm.runInContext("selectMarketHistory('test')",context);
const elements={};
for(const id of ['currentAge','lifeAge','monthlyExpense','sp500Asset','annualSp500Contribution','annualPension','pensionStartAge','inflationRate']){
  elements[id]={value:v[id],min:0,max:120,style:{setProperty(){}}};
  elements[id+'Display']={textContent:''};
}
elements.baseMarketDisplay={textContent:''};
elements.pensionPlanDisplay={textContent:''};
const cards={innerHTML:'',children:[],appendChild(x){this.children.push(x)}};
elements['cards-grid']=cards;
context.document.getElementById=id=>elements[id]||null;
context.document.createElement=()=>({className:'',innerHTML:''});
vm.runInContext(`updateSliderDisplays(${JSON.stringify(Object.assign({},v,{baseMarket:'test'}))})`,context);
assert.strictEqual(elements.baseMarketDisplay.textContent,`${Number((dataBase*100).toFixed(2))}% / 年`);

// Unavailable cards preserve H and explicitly label Conservative as insufficient history.
vm.runInContext("ACTIVE_MARKET={id:'acwi',label:'MSCI ACWI'}",context);
const unavailable=vm.runInContext(`makeUnavailableScenario(${JSON.stringify({ ...v,currentAge:45,lifeAge:100,baseMarket:'acwi'})},'history_missing')`,context);
assert.strictEqual(unavailable.lookbackMonths,55*12);
context.unavailable=unavailable;
vm.runInContext("renderCards({recent:unavailable,conservative:unavailable})",context);
assert(cards.children[0].innerHTML.includes('直近55年 · 月次履歴未収録'));
assert(cards.children[1].innerHTML.includes('MSCI ACWI · 月次履歴未収録'));
assert(!cards.children[1].innerHTML.includes('Worst Path'));

assert.strictEqual(vm.runInContext("historyStatusLabel('history_missing')",context),'月次履歴未収録');
assert.strictEqual(vm.runInContext("historyStatusLabel('history_too_short')",context),'履歴期間不足');
assert.strictEqual(vm.runInContext("historyStatusLabel('invalid_history')",context),'月次履歴エラー');

console.log('market-data tests passed');
