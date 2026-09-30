'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
(async()=>{

function createIndexedDbStub(){
  const databases=new Map();
  return{fail:false,blocked:false,nextTransaction:'complete',opens:0,open(name){
    const request={},controller=this;this.opens++;
    queueMicrotask(()=>{
      if(controller.blocked){if(request.onblocked)request.onblocked();return}
      if(this.fail){request.error=new Error('storage failure');if(request.onerror)request.onerror();return}
      const fresh=!databases.has(name);if(fresh)databases.set(name,new Map());const data=databases.get(name);
      request.result={
        createObjectStore(){},close(){},
        transaction(){const mode=controller.nextTransaction;controller.nextTransaction='complete';const tx={objectStore(){return{
          get(key){return operation(tx,mode,()=>data.get(key))},
          put(value,key){return operation(tx,mode,()=>{data.set(key,value)})},
          delete(key){return operation(tx,mode,()=>{data.delete(key)})}
        }}};return tx}
      };
      if(fresh&&request.onupgradeneeded)request.onupgradeneeded();if(request.onsuccess)request.onsuccess()
    });
    return request
  }};
  function operation(tx,mode,fn){const request={};queueMicrotask(()=>{try{if(mode==='complete')request.result=fn();else if(mode==='abort' || mode==='error')request.result=undefined;if(request.onsuccess)request.onsuccess();queueMicrotask(()=>{if(mode==='abort'&&tx.onabort)tx.onabort();else if(mode==='error'&&tx.onerror)tx.onerror();else if(mode==='complete'&&tx.oncomplete)tx.oncomplete()})}catch(e){request.error=e;if(request.onerror)request.onerror();if(tx.onerror)tx.onerror()}});return request}
}

function runDataFile(path){
  const c={window:{}};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path,'utf8'),c);
  return c.window.__localSp500Data;
}

// The Pages copy must be exactly equivalent at the data level to the pinned
// source file committed in data/. JSON comparison avoids cross-vm prototypes.
const sourceData=runDataFile('data/sp500.js');
const localData=runDataFile('docs/sp500-data.js');
assert.strictEqual(sourceData.start,'1871-01');
assert.strictEqual(sourceData.end,'2026-08');
assert.strictEqual(sourceData.nomTRP.length,1868);
assert.strictEqual(localData.start,sourceData.start);
assert.strictEqual(localData.end,sourceData.end);
assert.strictEqual(JSON.stringify(localData.nomTRP),JSON.stringify(sourceData.nomTRP));

const indexedDB=createIndexedDbStub();
const context={window:{},document:{addEventListener(){}},console,Float64Array,Math,indexedDB};
vm.createContext(context);
vm.runInContext(fs.readFileSync('docs/sp500-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('docs/market-data.js','utf8'),context);
vm.runInContext(fs.readFileSync('docs/history-import.js','utf8'),context);
vm.runInContext(fs.readFileSync('docs/app.js','utf8'),context);

// S&P 500 now uses the bundled monthly history and preserves the 1946 cut-off.
vm.runInContext("selectMarketHistory('sp500')",context);
assert.strictEqual(vm.runInContext('HISTORY_STATUS',context),'available');
assert.strictEqual(vm.runInContext('HISTORY_META.start',context),'1946-01');
assert.strictEqual(vm.runInContext('HISTORY_META.end',context),'2026-08');
assert.strictEqual(vm.runInContext('HIST_RETURNS.length',context),968);
const spBase=vm.runInContext("getBaseRate({baseMarket:'sp500'})",context);
assert(Number.isFinite(spBase)&&spBase>-1,'S&P 500 Base CAGR from local monthly history');
assert(Math.abs(spBase-0.11373172536844711)<1e-14,'S&P 500 numeric regression');
const spRegression={currentAge:45,lifeAge:100,monthlyExpense:280000,sp500Asset:18000000,annualSp500Contribution:1200000,annualPension:1100000,pensionStartAge:75,inflationRate:1.25,baseMarket:'sp500'};
const spRecent=vm.runInContext(`calculateRecentScenario(${JSON.stringify(spRegression)},${spBase})`,context);
assert.strictEqual(spRecent.fireAgeMonths,595,'S&P 500 Recent FIRE age regression');
assert(Math.abs(spRecent.scenarioRate-0.11311499848772799)<1e-14,'S&P 500 Recent rate regression');
const spConservative=vm.runInContext(`calculateConservativeScenario(${JSON.stringify(spRegression)},${spBase})`,context);
assert.strictEqual(spConservative.fireAgeMonths,638,'S&P 500 Conservative FIRE age regression');
assert.strictEqual(spConservative.worstStart,276,'S&P 500 Conservative path regression');
assert(Math.abs(spConservative.requiredTotalAtRetirement-53838897.260373004)<1e-6,'S&P 500 Conservative principal regression');

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

// app.js must consume only market.monthlyLevels; no legacy S&P global fallback.
const appSource=fs.readFileSync('docs/app.js','utf8');
assert(!appSource.includes('window.__lfcSpData'));

// CSV validation and daily-to-month-end conversion.
const parse=csv=>JSON.parse(vm.runInContext(`JSON.stringify(parseMarketHistoryCsv(${JSON.stringify(csv)}))`,context));
assert.deepStrictEqual(parse('date,value\n2020-01,100\n2020-02,105'),{start:'2020-01',end:'2020-02',nomTRP:[100,105]});
assert.deepStrictEqual(parse('date,value\n2020-01-02,99\n2020-01-31,100\n2020-02-03,101\n2020-02-28,102'),{start:'2020-01',end:'2020-02',nomTRP:[100,102]});
for(const [csv,message] of [
  ['date,value\n2020-01,100\n2020-01,101','重複'],
  ['date,value\n2020-01,100\n2020-03,101','抜け'],
  ['date,value\n2020-01,abc\n2020-02,101','有限値'],
  ['date,value\n2020-01,0\n2020-02,101','0より大きく'],
  ['date,value\n2020-01,-1\n2020-02,101','0より大きく'],
  ['date,value\n2020-02,101\n2020-01,100','昇順']
])assert.throws(()=>parse(csv),new RegExp(message));

// Imported histories override only their own runtime market objects and drive Base.
const imported={levels:{start:'2020-01',end:'2020-05',nomTRP:[100,101,103,102,106]},metadata:{marketKey:'acwi',indexName:'MSCI ACWI',returnType:'Total Return',currency:'USD'}};
context.imported=imported;
assert.strictEqual(vm.runInContext("createImportedMarketHistoryRecord('acwi',imported.levels,'Total Return',' USD ').metadata.marketKey",context),'acwi','CSV import records market identity');
vm.runInContext("USER_MARKET_HISTORIES.acwi=imported; selectMarketHistory('acwi')",context);
assert.strictEqual(vm.runInContext("getEffectiveMarket('acwi').userHistory",context),true);
assert.strictEqual(vm.runInContext("getEffectiveMarket('nasdaq100').monthlyLevels",context),null);
assert.strictEqual(vm.runInContext("window.__marketData.acwi.monthlyLevels",context),null,'static market data stays immutable');
assert(Math.abs(vm.runInContext("getBaseRate({baseMarket:'acwi'})",context)-fullCagr)<1e-12,'imported Base CAGR');
const tooShort=vm.runInContext(`calculateRecentScenario(${JSON.stringify(Object.assign({},v,{lifeAge:62}))},${fullCagr})`,context);
assert.strictEqual(tooShort.historyStatus,'history_too_short');
assert.strictEqual(tooShort.requiredMonths,12);
assert.strictEqual(tooShort.availableMonths,4);
assert.strictEqual(vm.runInContext('HIST_RETURNS.length',context),4,'5 levels produce 4 usable return months');

// Stored history requires consistent periods and trusted metadata.
context.corruptEnd={...imported,levels:{...imported.levels,end:'2020-06'}};
context.badType={...imported,metadata:{...imported.metadata,returnType:'Unknown Return'}};
context.badCurrency={...imported,metadata:{...imported.metadata,currency:''}};
context.renamed={...imported,metadata:{...imported.metadata,indexName:'Future ACWI Display Label'}};
context.crossIndex={...imported,metadata:{...imported.metadata,marketKey:'nasdaq100'}};
assert.strictEqual(vm.runInContext("isValidUserHistory(corruptEnd,'acwi')",context),false);
assert.strictEqual(vm.runInContext("isValidUserHistory(badType,'acwi')",context),false);
assert.strictEqual(vm.runInContext("isValidUserHistory(badCurrency,'acwi')",context),false);
assert.strictEqual(vm.runInContext("isValidUserHistory(imported,'acwi')",context),true);
assert.strictEqual(vm.runInContext("isValidUserHistory(renamed,'acwi')",context),true,'indexName is display-only');
assert.strictEqual(vm.runInContext("isValidUserHistory(crossIndex,'acwi')",context),false);

// Reopening the dialog always drops the prior file and refreshes index metadata.
const dialogElements={historyFile:{value:'acwi.csv'},importError:{textContent:'old error'},importIndexName:{value:''},importReturnType:{value:''},importCurrency:{value:''},returnTypeWarning:{textContent:''}};
context.document={getElementById:id=>dialogElements[id]};
vm.runInContext("resetHistoryImportDialog('acwi')",context);
assert.strictEqual(dialogElements.historyFile.value,'');
dialogElements.historyFile.value='acwi.csv';
vm.runInContext("resetHistoryImportDialog('nasdaq100')",context);
assert.strictEqual(dialogElements.historyFile.value,'','cross-index file is cleared');
assert.strictEqual(dialogElements.importIndexName.value,'NASDAQ-100');
assert.strictEqual(dialogElements.importReturnType.value,'Total Return');
assert.strictEqual(dialogElements.importCurrency.value,'USD');

// Exercise the production IndexedDB adapter: put/get/delete and independent keys.
const nasdaqImported={levels:{start:'2021-01',end:'2021-02',nomTRP:[200,210]},metadata:{marketKey:'nasdaq100',indexName:'NASDAQ-100',returnType:'Gross Return',currency:'USD'}};
context.nasdaqImported=nasdaqImported;
assert.strictEqual(vm.runInContext("isValidUserHistory(nasdaqImported,'nasdaq100')",context),true);
await vm.runInContext("saveMarketHistory('acwi',imported)",context);
await vm.runInContext("saveMarketHistory('nasdaq100',nasdaqImported)",context);
assert.strictEqual((await vm.runInContext("loadMarketHistory('acwi')",context)).levels.nomTRP.length,5);
assert.strictEqual((await vm.runInContext("loadMarketHistory('nasdaq100')",context)).levels.nomTRP.length,2);
assert(indexedDB.opens>=4,'database is reopened for adapter operations');
indexedDB.nextTransaction='abort';
await assert.rejects(vm.runInContext("saveMarketHistory('acwi',imported)",context),/中止/,'request success followed by transaction abort rejects');
indexedDB.nextTransaction='error';
await assert.rejects(vm.runInContext("loadMarketHistory('acwi')",context),/transactionに失敗/,'transaction error rejects');
indexedDB.blocked=true;
await assert.rejects(vm.runInContext('openMarketHistoryDb()',context),/他タブによりブロック/);
indexedDB.blocked=false;
vm.runInContext("delete USER_MARKET_HISTORIES.acwi; delete USER_MARKET_HISTORIES.nasdaq100",context);
await vm.runInContext('restoreUserHistories()',context);
assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.acwi.levels.nomTRP.length',context),5,'ACWI restoration');
assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.nasdaq100.levels.nomTRP.length',context),2,'NASDAQ restoration');

// Persisted records can never cross market storage identities.
await vm.runInContext("saveMarketHistory('acwi',nasdaqImported); delete USER_MARKET_HISTORIES.acwi",context);
await vm.runInContext('restoreUserHistories()',context);
assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.acwi',context),undefined,'cross-index restore is rejected');
assert.strictEqual(vm.runInContext("getEffectiveMarket('acwi').userHistory",context),undefined,'effective market ignores cross-index history');

// Only unkeyed records with a known label are migrated and rewritten.
context.legacyAcwi={...imported,metadata:{indexName:'MSCI ACWI',returnType:'Total Return',currency:'USD'}};
await vm.runInContext("saveMarketHistory('acwi',legacyAcwi); delete USER_MARKET_HISTORIES.acwi",context);
await vm.runInContext('restoreUserHistories()',context);
assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.acwi.metadata.marketKey',context),'acwi','safe legacy migration');
assert.strictEqual((await vm.runInContext("loadMarketHistory('acwi')",context)).metadata.marketKey,'acwi','migration is persisted');
context.ambiguousLegacy={...imported,metadata:{indexName:'Unknown Index',returnType:'Total Return',currency:'USD'}};
await vm.runInContext("saveMarketHistory('acwi',ambiguousLegacy); delete USER_MARKET_HISTORIES.acwi",context);
await vm.runInContext('restoreUserHistories()',context);
assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.acwi',context),undefined,'ambiguous legacy record is rejected');
await vm.runInContext("deleteMarketHistory('acwi')",context);
assert.strictEqual(await vm.runInContext("loadMarketHistory('acwi')",context),undefined,'delete imported history');

// Corrupted persisted data is rejected during restore.
await vm.runInContext("saveMarketHistory('acwi',corruptEnd); delete USER_MARKET_HISTORIES.acwi",context);
await vm.runInContext('restoreUserHistories()',context);
assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.acwi',context),undefined);

// Open, transaction abort, and transaction error failures all retain a session copy.
for(const failure of ['open','abort','error']){
  if(failure==='open')indexedDB.fail=true;else indexedDB.nextTransaction=failure;
  const fallback=await vm.runInContext("importMarketHistoryRecord('acwi',imported)",context);
  assert.strictEqual(fallback.persisted,false);
  assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.acwi.levels.nomTRP.length',context),5);
  assert.strictEqual(vm.runInContext('SESSION_ONLY_MARKETS.acwi',context),true);
  indexedDB.fail=false;
}

// A failed persistent delete still clears this tab and is surfaced by the UI handler.
indexedDB.nextTransaction='abort';
const removed=await vm.runInContext("removeImportedHistory('acwi')",context);
assert.strictEqual(removed.persistentDeleted,false);
assert.strictEqual(vm.runInContext('USER_MARKET_HISTORIES.acwi',context),undefined);
assert(appSource.includes('再読込後に復元される可能性があります。'));

// Price Return and session-only warnings are derived from restored metadata.
context.priceImported={...imported,metadata:{...imported.metadata,returnType:'Price Return'}};
await vm.runInContext("saveMarketHistory('acwi',priceImported); delete USER_MARKET_HISTORIES.acwi; delete SESSION_ONLY_MARKETS.acwi",context);
await vm.runInContext('restoreUserHistories()',context);
let summary=vm.runInContext("formatImportedHistorySummary('acwi',USER_MARKET_HISTORIES.acwi)",context);
assert(summary.includes('利用可能リターン履歴: 4ヶ月'));
assert(summary.includes('CSV観測値: 5点'));
assert(summary.includes('Price Return（配当なし）'));
vm.runInContext('SESSION_ONLY_MARKETS.acwi=true',context);
summary=vm.runInContext("formatImportedHistorySummary('acwi',USER_MARKET_HISTORIES.acwi)",context);
assert(summary.includes('このタブ内のみ有効'));

assert.throws(()=>parse('x'.repeat(10*1024*1024+1)),/10 MB/);
assert.throws(()=>parse('date,value\n'+'2020-01,1\n'.repeat(100001)),/100,000/);

console.log('market-data tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
