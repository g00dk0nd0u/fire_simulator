'use strict';

const STORAGE_KEY='fire_simulator_v5';
const PENSION_BASE_AGE=65,
  NATIONAL_PENSION_PREMIUM_END_AGE=60,
  NATIONAL_PENSION_MONTHLY_PREMIUM=17920,
  PENSION_EARLY_ADJUST_PER_MONTH=.004,
  PENSION_DEFER_ADJUST_PER_MONTH=.007;
const LABELS={recent:'Recent-based 直近ベース',base:'Base 標準',conservative:'Conservative 保守'};
const COLORS={recent:'#5aad8f',base:'#4a90b8',conservative:'#c47e6a'};
const CLS={recent:'opt',base:'nrm',conservative:'con'};
const NUMBER_IDS=['currentAge','lifeAge','monthlyExpense','sp500Asset','annualSp500Contribution','annualPension','pensionStartAge','inflationRate'];
const HISTORY_START_YEAR=1946;
let chartInst=null,HIST_RETURNS=[],HISTORY_META=null,BASE_RATE=null;
let ACTIVE_MARKET=null;

function getBaseMarketData(){return window.__marketData||{}}
function getBaseMarket(key){const data=getBaseMarketData();return data[key]||data.sp500||null}
function getDefaultValues(){return{currentAge:45,lifeAge:100,monthlyExpense:280000,sp500Asset:18000000,annualSp500Contribution:1200000,annualPension:1100000,pensionStartAge:75,inflationRate:1.25,baseMarket:'sp500'}}
function loadState(){try{return Object.assign({},getDefaultValues(),JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'))}catch{return getDefaultValues()}}
function saveState(v){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}catch{}}
function getFormValues(){
  const v={};
  for(const id of NUMBER_IDS){v[id]=parseFloat(document.getElementById(id).value);if(Number.isNaN(v[id]))v[id]=0}
  const baseMarket=document.getElementById('baseMarket');
  v.baseMarket=baseMarket?baseMarket.value:'sp500';
  return v
}
function setFormValues(v){
  for(const id of NUMBER_IDS)document.getElementById(id).value=v[id];
  const baseMarket=document.getElementById('baseMarket');
  if(baseMarket)baseMarket.value=getBaseMarket(v.baseMarket)?v.baseMarket:'sp500';
  updateSliderDisplays(v)
}
function formatOkuMan(value){const neg=value<0,prefix=neg?'▲':'';const man=Math.round(Math.abs(value)/10000);if(man>=10000){const oku=Math.floor(man/10000),rem=man%10000;return prefix+(rem===0?`${oku}億円`:`${oku}億${rem.toLocaleString('ja-JP')}万円`)}return prefix+`${man.toLocaleString('ja-JP')}万円`}
function formatYen(v){return Math.round(v).toLocaleString('ja-JP')+' 円'}
function formatPercentCompact(v){return `${parseFloat(v.toFixed(2))}%`}
function formatManOneDecimal(v){return `${(v/10000).toLocaleString('ja-JP',{minimumFractionDigits:0,maximumFractionDigits:1})}万円`}
function updateSliderDisplays(v){
  for(const id of NUMBER_IDS){
    const el=document.getElementById(id),d=document.getElementById(id+'Display');
    if(!el||!d)continue;
    const x=v[id];
    if(['currentAge','lifeAge','pensionStartAge'].includes(id))d.textContent=`${x} 歳`;
    else if(id==='inflationRate')d.textContent=formatPercentCompact(x);
    else if(id==='monthlyExpense')d.textContent=formatOkuMan(x).replace('円','')+' / 月';
    else if(['annualSp500Contribution','annualPension'].includes(id))d.textContent=formatOkuMan(x).replace('円','')+' / 年';
    else d.textContent=formatOkuMan(x);
    const min=+el.min,max=+el.max;
    el.style.setProperty('--pct',`${((x-min)/(max-min))*100}%`)
  }
  const pd=document.getElementById('pensionPlanDisplay');
  if(pd){
    const p=getPensionPlan(v),d=(p.adjustRate-1)*100,adj=d>0?`+${d.toFixed(1)}%`:d<0?`${d.toFixed(1)}%`:'±0%';
    const be=p.breakEvenAgeMonths==null?'':` / 65歳開始との累計損益分岐 ${formatAgeWithMonths(p.breakEvenAgeMonths)}`;
    pd.textContent=`${p.startAge}歳開始: ${formatManOneDecimal(p.annualAmount)}/年（${adj}、開始前0円）${be}`
  }
  const bm=getBaseMarket(v.baseMarket);
  const bd=document.getElementById('baseMarketDisplay');
  if(bm&&bd)bd.textContent=`${formatPercentCompact(bm.nominalCagr*100)} / 年`;
}
function validateInputs(v){const e=[];if(v.lifeAge<=v.currentAge)e.push('想定寿命は現在年齢より大きくしてください。');if(v.monthlyExpense<0||v.sp500Asset<0||v.annualSp500Contribution<0||v.annualPension<0)e.push('金額は0以上にしてください。');if(v.pensionStartAge<60||v.pensionStartAge>75)e.push('年金受給開始年齢は60〜75歳です。');if(v.inflationRate<0||v.inflationRate>4.5)e.push('インフレ率は0〜4.5%です。');if(!getBaseMarket(v.baseMarket))e.push('運用指数を選択してください。');return e}
function showError(a){const e=document.getElementById('error-msg');e.textContent=a.join('\n');e.style.display='block'}
function hideError(){document.getElementById('error-msg').style.display='none'}
function showInfo(s){const e=document.getElementById('info-msg');e.textContent=s;e.style.display='block'}
function hideInfo(){document.getElementById('info-msg').style.display='none'}
function toMonthAge(y){return Math.round(y*12)}
function formatAgeWithMonths(m){const y=Math.floor(m/12),mo=m%12;return mo?`${y} 歳 ${mo} ヶ月`:`${y} 歳`}
function formatDurationMonths(m){const y=Math.floor(m/12),mo=m%12;if(m<=0)return'0ヶ月後に成立';if(!mo)return`${y}年後に成立`;if(!y)return`${mo}ヶ月後に成立`;return`${y}年${mo}ヶ月後に成立`}
function getPensionPlan(v){const startAge=Math.min(75,Math.max(60,v.pensionStartAge)),deltaMonths=Math.round((startAge-PENSION_BASE_AGE)*12),adjustRate=deltaMonths>=0?1+deltaMonths*PENSION_DEFER_ADJUST_PER_MONTH:1-Math.abs(deltaMonths)*PENSION_EARLY_ADJUST_PER_MONTH,annualAmount=Math.max(0,v.annualPension*adjustRate);let breakEvenAgeMonths=null;if(startAge!==PENSION_BASE_AGE&&v.annualPension>0&&adjustRate!==1){const breakEvenAge=adjustRate>1?(adjustRate*startAge-PENSION_BASE_AGE)/(adjustRate-1):(PENSION_BASE_AGE-adjustRate*startAge)/(1-adjustRate);breakEvenAgeMonths=Math.round(breakEvenAge*12)}const lifetimeMonths=Math.max(0,toMonthAge(v.lifeAge)-toMonthAge(startAge)),lifetimeTotal=annualAmount*lifetimeMonths/12;return{startAge,startAgeMonths:toMonthAge(startAge),adjustRate,annualAmount,breakEvenAgeMonths,lifetimeTotal}}
function getAdjustedAnnualPension(v){const p=getPensionPlan(v);return{pensionAdjustRate:p.adjustRate,adjustedAnnualPension:p.annualAmount,pensionStartAge:p.startAge,pensionBreakEvenAgeMonths:p.breakEvenAgeMonths,pensionLifetimeTotal:p.lifetimeTotal}}
function formatPensionAdjustmentNote(r,startAge){const d=(r-1)*100,adj=d>0?`+${d.toFixed(1)}%`:d<0?`${d.toFixed(1)}%`:'±0%';return`${startAge}歳開始 / ${adj} / 開始前0円`}
function monthlyNetExpense(ageMonth,v,adjustedAnnualPension){const pension=ageMonth>=toMonthAge(v.pensionStartAge)?adjustedAnnualPension/12:0;const premium=ageMonth<toMonthAge(NATIONAL_PENSION_PREMIUM_END_AGE)?NATIONAL_PENSION_MONTHLY_PREMIUM:0;return v.monthlyExpense+premium-pension}
function getMonthlyRate(rate){return Math.pow(1+rate,1/12)-1}
function getRealAnnualRate(rate,inflPct){return(1+rate)/(1+inflPct/100)-1}
function getScenarioMonthlyRate(rate,v){return getMonthlyRate(getRealAnnualRate(rate,v.inflationRate))}
function projectAssetsToAge(targetAgeMonth,rate,v){const months=targetAgeMonth-toMonthAge(v.currentAge),mr=getScenarioMonthlyRate(rate,v);let a=v.sp500Asset*Math.pow(1+mr,months);if(months>0&&v.annualSp500Contribution>0){const c=v.annualSp500Contribution/12;a+=mr===0?c*months:c*(Math.pow(1+mr,months)-1)/mr}return a}
function findRequiredFixedAsset(startAgeMonth,rate,v){const mr=getScenarioMonthlyRate(rate,v),{adjustedAnnualPension}=getAdjustedAnnualPension(v);let req=0;for(let age=toMonthAge(v.lifeAge)-1;age>=startAgeMonth;age--){req=Math.max(0,(req+monthlyNetExpense(age,v,adjustedAnnualPension))/(1+mr))}return req}
function generateFixedSeries(startAgeMonth,asset,rate,v){const mr=getScenarioMonthlyRate(rate,v),{adjustedAnnualPension}=getAdjustedAnnualPension(v),ages=[startAgeMonth/12],bals=[asset];let b=asset;for(let age=startAgeMonth;age<toMonthAge(v.lifeAge);age++){b=b*(1+mr)-monthlyNetExpense(age,v,adjustedAnnualPension);ages.push((age+1)/12);bals.push(b)}return{ages,bals}}
function calculateFixedScenario(rate,v){const cur=toMonthAge(v.currentAge),life=toMonthAge(v.lifeAge),p=getAdjustedAnnualPension(v);let fallback=null;for(let age=cur;age<life;age++){const required=findRequiredFixedAsset(age,rate,v),projected=projectAssetsToAge(age,rate,v),coverage=required>0?projected/required*100:Infinity;const row={currentAgeMonths:cur,fireAgeMonths:age,requiredTotalAtRetirement:required,projectedAssetsAtRetirement:projected,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge,retirementSurplus:projected-required,coverageRate:coverage,isAchievable:projected>=required,scenarioRate:rate,baseMarket:v.baseMarket};if(!fallback||coverage>fallback.coverageRate)fallback=row;if(row.isAchievable)return row}return Object.assign(fallback||{scenarioRate:rate,baseMarket:v.baseMarket},{isAchievable:false,fireAgeMonths:null})}
function monthAtOffset(start,offset){let [y,m]=start.split('-').map(Number);const n=(m-1)+offset;return{year:y+Math.floor(n/12),month:n%12+1}}
function ymLabel(x){return`${x.year}-${String(x.month).padStart(2,'0')}`}
function buildHistoricalReturns(market){
  const d=market&&market.monthlyLevels?market.monthlyLevels:(market&&market.id==='sp500'?window.__lfcSpData:null);
  if(!d||!Array.isArray(d.nomTRP)||d.nomTRP.length<2){HISTORY_META=null;return[]}
  const out=[];
  for(let i=1;i<d.nomTRP.length;i++){
    const ym=monthAtOffset(d.start,i),prev=d.nomTRP[i-1],cur=d.nomTRP[i];
    if(Number.isFinite(prev)&&Number.isFinite(cur)&&prev>0)out.push({year:ym.year,month:ym.month,nominalReturn:cur/prev-1})
  }
  if(out.length)HISTORY_META={start:ymLabel(out[0]),end:ymLabel(out[out.length-1]),count:out.length};
  return out
}
function selectMarketHistory(key){ACTIVE_MARKET=getBaseMarket(key);HIST_RETURNS=buildHistoricalReturns(ACTIVE_MARKET);return ACTIVE_MARKET}
function buildConservativeRequirements(v){if(!HIST_RETURNS.length)return new Map();const N=HIST_RETURNS.length,curAge=toMonthAge(v.currentAge),life=toMonthAge(v.lifeAge),{adjustedAnnualPension}=getAdjustedAnnualPension(v),monthlyInfl=Math.pow(1+v.inflationRate/100,1/12)-1,real=HIST_RETURNS.map(x=>(1+x.nominalReturn)/(1+monthlyInfl)-1),plans=new Map();let next=new Float64Array(N+1);const firstValidAge=Math.max(curAge,life-N);for(let age=life-1;age>=firstValidAge;age--){const duration=life-age,maxStart=N-duration,current=new Float64Array(N+1),expense=monthlyNetExpense(age,v,adjustedAnnualPension);let worst=-1,worstStart=-1;for(let s=0;s<=maxStart;s++){const denom=1+real[s];const req=Math.max(0,(next[s+1]+expense)/denom);current[s]=req;if(req>worst){worst=req;worstStart=s}}plans.set(age,{requiredTotalAtRetirement:worst,worstStart,duration});next=current}return plans}
function historicalWindowStats(start,duration){let factor=1;for(let i=0;i<duration;i++)factor*=1+HIST_RETURNS[start+i].nominalReturn;const cagr=Math.pow(factor,12/duration)-1;const a=HIST_RETURNS[start],b=HIST_RETURNS[start+duration-1];return{historyStart:`${a.year}-${String(a.month).padStart(2,'0')}`,historyEnd:`${b.year}-${String(b.month).padStart(2,'0')}`,historyCagr:cagr}}
function getBaseRate(v){const bm=getBaseMarket(v.baseMarket);return bm?bm.nominalCagr:null}
function getRecentWindow(duration,baseRate){if(duration===0)return{scenarioRate:baseRate,lookbackMonths:0,recentStart:null,recentEnd:HISTORY_META?HISTORY_META.end:null,usesBase:true};if(duration<0||duration>HIST_RETURNS.length)return null;const start=HIST_RETURNS.length-duration,stats=historicalWindowStats(start,duration);return{scenarioRate:stats.historyCagr,lookbackMonths:duration,recentStart:stats.historyStart,recentEnd:stats.historyEnd,usesBase:false}}
function calculateRecentScenario(v,baseRate){const cur=toMonthAge(v.currentAge),life=toMonthAge(v.lifeAge),p=getAdjustedAnnualPension(v),lookbackMonths=life-cur,basis=getRecentWindow(lookbackMonths,baseRate);if(!basis)return{currentAgeMonths:cur,isAchievable:false,unavailable:true,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge,retirementRate:baseRate,scenarioRate:null,lookbackMonths};const rate=basis.scenarioRate;let fallback=null;for(let age=cur;age<life;age++){const required=findRequiredFixedAsset(age,baseRate,v),projected=projectAssetsToAge(age,rate,v),coverage=required>0?projected/required*100:Infinity;const row={currentAgeMonths:cur,fireAgeMonths:age,requiredTotalAtRetirement:required,projectedAssetsAtRetirement:projected,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge,retirementSurplus:projected-required,coverageRate:coverage,isAchievable:projected>=required,retirementRate:baseRate,...basis};if(!fallback||coverage>fallback.coverageRate)fallback=row;if(row.isAchievable)return row}return Object.assign(fallback||{currentAgeMonths:cur,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge,retirementRate:baseRate,...basis},{isAchievable:false,fireAgeMonths:null})}
function generateHistoricalSeries(startAgeMonth,asset,startIndex,duration,v){const {adjustedAnnualPension}=getAdjustedAnnualPension(v),monthlyInfl=Math.pow(1+v.inflationRate/100,1/12)-1,ages=[startAgeMonth/12],bals=[asset];let b=asset;for(let i=0;i<duration;i++){const r=(1+HIST_RETURNS[startIndex+i].nominalReturn)/(1+monthlyInfl)-1,age=startAgeMonth+i;b=b*(1+r)-monthlyNetExpense(age,v,adjustedAnnualPension);ages.push((age+1)/12);bals.push(b)}return{ages,bals}}
function calculateConservativeScenario(v,baseRate){const cur=toMonthAge(v.currentAge),life=toMonthAge(v.lifeAge),p=getAdjustedAnnualPension(v);if(!HIST_RETURNS.length||baseRate==null)return{currentAgeMonths:cur,isAchievable:false,unavailable:true,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge};const plans=buildConservativeRequirements(v);let fallback=null;for(let age=cur;age<life;age++){const plan=plans.get(age);if(!plan)continue;const projected=projectAssetsToAge(age,baseRate,v),coverage=plan.requiredTotalAtRetirement>0?projected/plan.requiredTotalAtRetirement*100:Infinity,stats=historicalWindowStats(plan.worstStart,plan.duration);const row={currentAgeMonths:cur,fireAgeMonths:age,isAchievable:projected>=plan.requiredTotalAtRetirement,requiredTotalAtRetirement:plan.requiredTotalAtRetirement,projectedAssetsAtRetirement:projected,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge,retirementSurplus:projected-plan.requiredTotalAtRetirement,coverageRate:coverage,worstStart:plan.worstStart,duration:plan.duration,scenarioRate:baseRate,...stats};if(!fallback||coverage>fallback.coverageRate)fallback=row;if(row.isAchievable)return row}return Object.assign(fallback||{currentAgeMonths:cur,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge,scenarioRate:baseRate},{isAchievable:false,fireAgeMonths:null})}
function formatLookbackMonths(m){const y=Math.floor(m/12),mo=m%12;if(m===0)return'直近0ヶ月';if(!mo)return`直近${y}年`;if(!y)return`直近${mo}ヶ月`;return`直近${y}年${mo}ヶ月`}
function renderCards(results){
  const grid=document.getElementById('cards-grid');grid.innerHTML='';
  for(const [key,r] of Object.entries(results)){
    const card=document.createElement('div');card.className=`rcard ${CLS[key]}`;
    let badge='';
    if(key==='conservative')badge=`${ACTIVE_MARKET?ACTIVE_MARKET.label:'運用指数'} · Worst Path`;
    else if(r.unavailable||r.scenarioRate==null)badge=key==='recent'?`${formatLookbackMonths(r.lookbackMonths||0)} · 履歴不足`:'履歴データ未取得';
    else if(key==='recent')badge=`${ACTIVE_MARKET?ACTIVE_MARKET.label:'運用指数'} · ${formatLookbackMonths(r.lookbackMonths||0)} · 年率 ${formatPercentCompact(r.scenarioRate*100)}`;
    else {const bm=getBaseMarket(r.baseMarket);badge=`${bm?bm.label:'Base'} · 最長期間 · 年率 ${formatPercentCompact(r.scenarioRate*100)}`}
    const fireSub=r.unavailable?'履歴データを読み込めません':r.isAchievable?formatDurationMonths(r.fireAgeMonths-r.currentAgeMonths):'想定寿命までに未達';
    let extra='';
    if(key==='conservative'&&!r.unavailable&&r.worstStart!=null){extra=`<div class="nb"><div class="nb-lbl">Historical Stress 最悪期間</div><div class="nb-val small">${r.historyStart} → ${r.historyEnd}</div><div class="nb-sub">${ACTIVE_MARKET?ACTIVE_MARKET.label:'運用指数'} / ${Math.floor(r.duration/12)}年${r.duration%12?`${r.duration%12}ヶ月`:''} / 同期間CAGR ${formatPercentCompact(r.historyCagr*100)} / ${HISTORY_META.start}以降を全走査</div></div>`}
    else if(key==='recent'&&!r.unavailable&&r.scenarioRate!=null){extra=`<div class="nb"><div class="nb-lbl">Recent Basis 残り人生と同期間の直近実績</div><div class="nb-val small">${r.recentStart} → ${r.recentEnd}</div><div class="nb-sub">${ACTIVE_MARKET?ACTIVE_MARKET.label:'運用指数'} / ${formatLookbackMonths(r.lookbackMonths)}のTotal Return CAGR（現在年齢→想定寿命と同じ期間）</div></div>`}
    else if(key==='base'&&!r.unavailable&&r.scenarioRate!=null){const bm=getBaseMarket(r.baseMarket);if(bm)extra=`<div class="nb"><div class="nb-lbl">Long-term Basis 長期実績</div><div class="nb-val small">${bm.label}: ${bm.start} → ${bm.end}</div><div class="nb-sub">${bm.basis} / ローカル固定データ</div></div>`}
    card.innerHTML=`<div class="rcard-head"><div><div class="rcard-name">${LABELS[key]}</div><div class="rcard-rate">${badge}</div></div></div><div class="nb"><div class="nb-lbl">FIRE Age FIRE年齢</div><div class="nb-val gold">${r.isAchievable?formatAgeWithMonths(r.fireAgeMonths):'未達'}</div><div class="nb-sub">${fireSub}</div></div><div class="csep"></div><div class="nb"><div class="nb-lbl">Required Principal 必要元本</div><div class="nb-val">${r.requiredTotalAtRetirement!=null?formatOkuMan(r.requiredTotalAtRetirement):'—'}</div><div class="nb-sub">${r.requiredTotalAtRetirement!=null?formatYen(r.requiredTotalAtRetirement):''}</div></div>${extra}<div class="nb"><div class="nb-lbl">Pension Income 年金受給額</div><div class="nb-val">${formatOkuMan(r.adjustedAnnualPension||0)}</div><div class="nb-sub">${formatPensionAdjustmentNote(r.pensionAdjustRate||1,r.pensionStartAge??PENSION_BASE_AGE)}</div></div>`;
    grid.appendChild(card)
  }
}
function renderChart(data){const fb=document.getElementById('chart-fallback');fb.style.display='none';if(chartInst){chartInst.destroy();chartInst=null}if(!Object.keys(data).length){fb.textContent='表示できる成立シナリオがありません。';fb.style.display='block';return}if(typeof Chart==='undefined'){fb.textContent='Chart.jsを読み込めませんでした。';fb.style.display='block';return}const ctx=document.getElementById('myChart').getContext('2d');chartInst=new Chart(ctx,{type:'line',data:{datasets:Object.entries(data).map(([key,s])=>({label:LABELS[key],data:s.ages.map((x,i)=>({x,y:s.bals[i]})),borderColor:COLORS[key],backgroundColor:COLORS[key]+'12',borderWidth:4,pointRadius:0,pointHoverRadius:6,tension:.25,fill:false}))},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{type:'linear',title:{display:true,text:'年齢（歳）'},ticks:{stepSize:5}},y:{title:{display:true,text:'万円'},ticks:{callback:v=>Math.round(v/10000).toLocaleString('ja-JP')}}},plugins:{legend:{position:'top',align:window.innerWidth<=640?'center':'end'},tooltip:{callbacks:{title:items=>formatAgeWithMonths(Math.round(items[0].parsed.x*12)),label:item=>` ${item.dataset.label}: ${formatOkuMan(item.parsed.y)}`}}}}})}
function makeUnavailableScenario(v){const cur=toMonthAge(v.currentAge),p=getAdjustedAnnualPension(v);return{currentAgeMonths:cur,isAchievable:false,unavailable:true,adjustedAnnualPension:p.adjustedAnnualPension,pensionAdjustRate:p.pensionAdjustRate,pensionStartAge:p.pensionStartAge}}
function updateSimulation(){
  hideError();hideInfo();
  const v=getFormValues();updateSliderDisplays(v);saveState(v);
  const errors=validateInputs(v);if(errors.length){showError(errors);return}
  ACTIVE_MARKET=selectMarketHistory(v.baseMarket);
  BASE_RATE=getBaseRate(v);
  const historyBaseRate=HIST_RETURNS.length?historicalWindowStats(0,HIST_RETURNS.length).historyCagr:null;
  const results={
    recent:historyBaseRate==null?makeUnavailableScenario(v):calculateRecentScenario(v,historyBaseRate),
    base:BASE_RATE==null?makeUnavailableScenario(v):calculateFixedScenario(BASE_RATE,v),
    conservative:historyBaseRate==null?makeUnavailableScenario(v):calculateConservativeScenario(v,historyBaseRate)
  },chartData={};
  if(results.recent.isAchievable)chartData.recent=generateFixedSeries(results.recent.fireAgeMonths,results.recent.requiredTotalAtRetirement,results.recent.retirementRate,v);
  if(results.base.isAchievable)chartData.base=generateFixedSeries(results.base.fireAgeMonths,results.base.requiredTotalAtRetirement,results.base.scenarioRate,v);
  if(results.conservative.isAchievable)chartData.conservative=generateHistoricalSeries(results.conservative.fireAgeMonths,results.conservative.requiredTotalAtRetirement,results.conservative.worstStart,results.conservative.duration,v);
  renderCards(results);renderChart(chartData);
  if(!HIST_RETURNS.length)showInfo(`${ACTIVE_MARKET.label}の検証済み月次Total Return系列を収録できていないため、Recent / Conservative は「履歴不足」です。別指数へフォールバックしません。`);
  else if(toMonthAge(v.lifeAge)-toMonthAge(v.currentAge)>HIST_RETURNS.length)showInfo(`${ACTIVE_MARKET.label}の履歴は${HISTORY_META.start}〜${HISTORY_META.end}（${HIST_RETURNS.length}ヶ月）です。設定した「想定寿命−現在年齢」の期間が履歴より長いため、直近ベースは計算できません。保守は計算可能なFIRE候補のみ評価します。`)
}
function init(){
  const v=loadState();
  selectMarketHistory(v.baseMarket);
  BASE_RATE=getBaseRate(v);
  setFormValues(v);
  for(const id of NUMBER_IDS)document.getElementById(id).addEventListener('input',updateSimulation);
  const baseMarket=document.getElementById('baseMarket');
  if(baseMarket)baseMarket.addEventListener('change',updateSimulation);
  updateSimulation()
}
document.addEventListener('DOMContentLoaded',init);
