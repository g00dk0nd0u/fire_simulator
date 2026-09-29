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
console.log('market-data tests passed');
