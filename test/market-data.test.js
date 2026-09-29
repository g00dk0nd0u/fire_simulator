'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');

function runDataFile(path){
  const c={window:{}};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path,'utf8'),c);
  return c.window.__lfcSpData;
}

// The Pages copy must be byte-for-byte equivalent at the data level to the
// pinned source file committed in data/.
const sourceData=runDataFile('data/sp500.js');
const localData=runDataFile('docs/sp500-data.js');
assert.strictEqual(sourceData.start,'1871-01');
assert.strictEqual(sourceData.end,'2026-08');
assert.strictEqual(sourceData.nomTRP.length,1868);
assert.strictEqual(localData.start,sourceData.start);
assert.strictEqual(localData.end,sourceData.end);
assert.deepStrictEqual(localData.nomTRP,sourceData.nomTRP);

const context={window:{},document:{addEventListener(){}},console,Float64Array,Math};
vm.createContext(context);
vm.runInContext(fs.readFileSync('docs/sp500-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('docs/market-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('docs/app.js','utf8'),context);

// S&P 500 now uses the bundled monthly history and preserves the 1946 cut-off.
vm.runInContext("selectMarketHistory('sp500')",context);
assert.strictEqual(vm.runInContext('HISTORY_STATUS',context),'available');
assert.strictEqual(vm.runInContext('HISTORY_META.start',context),'1946-01');
assert.strictEqual(vm.runInContext('HISTORY_META.end',context),'2026-08');
assert.strictEqual(vm.runInContext('HIST_RETURNS.length',context),968);
const spBase=vm.runInContext("getBaseRate({baseMarket:'sp500'})",context);
assert(Number.isFinite(spBase)&&spBase>-1,'S&P 500 Base CAGR from local monthly history');

for(const id of ['acwi','nasdaq100']){
  const rate=vm.runInContext(`getBaseRate({baseMarket:'${id}'})`,context);
  assert(Number.isFinite(rate)&&rate>-1,`${id} published Base CAGR`);
}

const levels={start:'2020-01',nomTRP:[100,101,103,102,106]};
context.window.__marketData=Object.assign({},context.window.__marketData,{test:{id:'test',label:'Test',baseRateSource:'monthly_history',nominalCagr:.1,monthlyLevels:levels}});
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
assert.strictEqual(vm.runInContext('HISTORY_STATUS',context),'history_missing');

// A local monthly series is the single source for Base and Recent retirement rates.
context.window.__marketData=Object.assign({},context.window.__marketData,{test:{id:'test',label:'Test',baseRateSource:'monthly_history',historyStart:'2020-01',nominalCagr:.99,monthlyLevels:levels}});
vm.runInContext("selectMarketHistory('test')",context);
const dataBase=vm.runInContext("getBaseRate({baseMarket:'test'})",context);
const fullCagr=Math.pow(106/100,12/4)-1;
assert(Math.abs(dataBase-fullCagr)<1e-12,'Base is calculated from monthly levels');
const recentScenario=vm.runInContext(`calculateRecentScenario(${JSON.stringify(v)},${dataBase})`,context);
assert.strictEqual(recentScenario.retirementRate,dataBase,'Recent retirement rate equals Base rate');

// Invalid or non-positive levels invalidate the complete history instead of silently bridging gaps.
for(const bad of [[100,null,102],[100,0,102],[100,-1,102]]){
  context.window.__marketData=Object.assign({},context.window.__marketData,{bad:{id:'bad',label:'Bad',baseRateSource:'monthly_history',monthlyLevels:{start:'2020-01',nomTRP:bad}}});
  vm.runInContext("selectMarketHistory('bad')",context);
  assert.strictEqual(vm.runInContext('HIST_RETURNS.length',context),0);
  assert.strictEqual(vm.runInContext("getBaseRate({baseMarket:'bad'})",context),null);
}

assert.strictEqual(vm.runInContext("getBaseMarket('missing')",context),null);
assert.strictEqual(vm.runInContext("historyStatusLabel('history_missing')",context),'月次履歴未収録');
assert.strictEqual(vm.runInContext("historyStatusLabel('history_too_short')",context),'履歴期間不足');
assert.strictEqual(vm.runInContext("historyStatusLabel('invalid_history')",context),'月次履歴エラー');

// The HTML must use the local market file rather than the external S&P CDN.
const html=fs.readFileSync('docs/index.html','utf8');
assert(html.includes('<script src="sp500-data.js"></script>'));
assert(!html.includes('cdn.jsdelivr.net/gh/GaMa96/lfc-sp500-data'));

console.log('market-data tests passed');
