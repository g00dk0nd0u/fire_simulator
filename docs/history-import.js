'use strict';

const MARKET_HISTORY_DB='fire-simulator-market-history';
const MARKET_HISTORY_STORE='histories';
const MARKET_HISTORY_KEYS={acwi:'market-history-acwi',nasdaq100:'market-history-nasdaq100'};

function parseMarketHistoryCsv(text){
  const rows=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim()!=='');
  if(rows.length<3)throw new Error('CSVにはヘッダーと2件以上のデータが必要です。');
  const header=rows[0].split(',').map(x=>x.trim().toLowerCase());
  const dateIndex=header.indexOf('date'),valueIndex=header.indexOf('value');
  if(dateIndex<0||valueIndex<0)throw new Error('CSVヘッダーには date,value が必要です。');
  const parsed=[],seenDates=new Set();
  for(let i=1;i<rows.length;i++){
    const cells=rows[i].split(',').map(x=>x.trim());
    const rawDate=cells[dateIndex]||'',rawValue=cells[valueIndex]||'';
    if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(rawDate))throw new Error(`${i+1}行目の日付が不正です（YYYY-MM または YYYY-MM-DD）。`);
    const daily=rawDate.length===10,date=daily?rawDate:`${rawDate}-01`,d=new Date(`${date}T00:00:00Z`);
    if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==date)throw new Error(`${i+1}行目の日付が存在しません。`);
    const value=Number(rawValue);
    if(rawValue===''||!Number.isFinite(value))throw new Error(`${i+1}行目のvalueが有限値ではありません。`);
    if(value<=0)throw new Error(`${i+1}行目のvalueは0より大きくしてください。`);
    if(parsed.length&&date<parsed[parsed.length-1].date)throw new Error(`${i+1}行目の日付が昇順ではありません。`);
    if(seenDates.has(date))throw new Error(`${i+1}行目の日付が重複しています。`);
    seenDates.add(date);parsed.push({date,month:date.slice(0,7),value,daily});
  }
  const months=[];
  for(const row of parsed){
    const last=months[months.length-1];
    if(last&&last.month===row.month){
      if(!last.daily||!row.daily)throw new Error(`${row.month}の月次レコードが重複しています。`);
      last.value=row.value;last.date=row.date;
    }else months.push({...row});
  }
  if(months.length<2)throw new Error('月次系列は最低2ヶ月以上必要です。');
  for(let i=1;i<months.length;i++){
    const expected=ymLabel(monthAtOffset(months[i-1].month,1));
    if(months[i].month!==expected)throw new Error(`${expected}の月次データが抜けています。`);
  }
  return{start:months[0].month,end:months[months.length-1].month,nomTRP:months.map(x=>x.value)};
}

function openMarketHistoryDb(){return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined')return reject(new Error('このブラウザではIndexedDBを利用できません。'));const req=indexedDB.open(MARKET_HISTORY_DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(MARKET_HISTORY_STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('IndexedDBを開けませんでした。'))})}
async function marketHistoryStorage(action,key,value){const db=await openMarketHistoryDb();return new Promise((resolve,reject)=>{const tx=db.transaction(MARKET_HISTORY_STORE,action==='get'?'readonly':'readwrite'),store=tx.objectStore(MARKET_HISTORY_STORE),req=action==='get'?store.get(key):action==='delete'?store.delete(key):store.put(value,key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('月次履歴をブラウザに保存できませんでした。'));tx.oncomplete=()=>db.close()})}
function loadMarketHistory(key){return marketHistoryStorage('get',MARKET_HISTORY_KEYS[key])}
function saveMarketHistory(key,value){return marketHistoryStorage('put',MARKET_HISTORY_KEYS[key],value)}
function deleteMarketHistory(key){return marketHistoryStorage('delete',MARKET_HISTORY_KEYS[key])}
