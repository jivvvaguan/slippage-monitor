import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import type { MonitorSnapshot, Config } from '../types.js';

let latestSnapshot: MonitorSnapshot | null = null;
let sseClients: ServerResponse[] = [];
let customSizes: number[] = [];

export function getCustomSizes(): number[] {
  return customSizes;
}

export function updateWebSnapshot(snapshot: MonitorSnapshot): void {
  latestSnapshot = snapshot;
  const data = `data: ${JSON.stringify(snapshot)}\n\n`;
  sseClients = sseClients.filter(res => {
    try {
      res.write(data);
      return true;
    } catch {
      return false;
    }
  });
}

export function startWebServer(config: Config): void {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (url === '/api/snapshot') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(latestSnapshot ?? { timestamp: 0, results: [] }));
      return;
    }
    if (url === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
      sseClients.push(res);
      req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
      return;
    }
    if (url === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(config));
      return;
    }
    if (url === '/api/sizes' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { sizes } = JSON.parse(body);
          if (Array.isArray(sizes)) {
            customSizes = sizes.filter((s: any) => typeof s === 'number' && s >= 1000);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: true, sizes: customSizes }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sizes must be an array' }));
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid JSON' }));
        }
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getDashboardHTML(config));
  });

  server.listen(config.webPort, () => {
    console.log(`🌐 Web dashboard: http://localhost:${config.webPort}`);
  });
}

function getDashboardHTML(config: Config): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Perps Slippage Monitor</title>
<style>
:root {
  --bg:#fff; --bg2:#f7f8fa; --bgH:#f0f1f3; --tx:#1a1a2e; --tx2:#6b7280; --txM:#9ca3af;
  --bd:#e5e7eb; --bdL:#f0f1f3; --ac:#2563eb; --acL:#eff6ff;
  --gn:#16a34a; --gnB:#f0fdf4; --rd:#dc2626; --rdB:#fef2f2;
  --sh:0 1px 3px rgba(0,0,0,.06);
}
[data-theme="dark"] {
  --bg:#0f1117; --bg2:#1a1c25; --bgH:#22252f; --tx:#e5e7eb; --tx2:#9ca3af; --txM:#6b7280;
  --bd:#2d3039; --bdL:#22252f; --ac:#3b82f6; --acL:#1e293b;
  --gn:#4ade80; --gnB:#0a2015; --rd:#f87171; --rdB:#200a0a;
  --sh:0 1px 3px rgba(0,0,0,.3);
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg2);color:var(--tx);line-height:1.5}
.header{background:var(--bg);border-bottom:1px solid var(--bd);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--sh);position:sticky;top:0;z-index:10}
.header h1{font-size:17px;font-weight:600}
.header .sub{font-size:12px;color:var(--txM);margin-top:1px}
.hdr-r{display:flex;align-items:center;gap:10px}
.badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 9px;border-radius:20px;font-weight:500}
.badge.on{background:var(--gnB);color:var(--gn)} .badge.off{background:var(--rdB);color:var(--rd)}
.badge .dot{width:5px;height:5px;border-radius:50%;background:currentColor}
.btn{font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--tx2);cursor:pointer;font-weight:500;transition:all .15s}
.btn:hover{background:var(--bgH)}

/* Global size bar */
.szbar{background:var(--bg);border-bottom:1px solid var(--bd);padding:8px 24px;display:flex;align-items:center;gap:7px;position:sticky;top:52px;z-index:9;flex-wrap:wrap}
.szbar .lbl{font-size:12px;color:var(--txM);font-weight:500;margin-right:2px;white-space:nowrap}
.szbar .sb{font-size:12px;padding:4px 12px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--tx2);cursor:pointer;font-weight:500;transition:all .15s}
.szbar .sb:hover{background:var(--bgH)}
.szbar .sb.on{background:var(--ac);color:#fff;border-color:var(--ac)}
.szbar .exp{margin-left:auto;font-size:12px;color:var(--txM);cursor:pointer;border:none;background:none;font-weight:500;padding:4px 8px}
.szbar .exp:hover{color:var(--ac)}

/* Content */
.ct{max-width:1280px;margin:0 auto;padding:16px 24px}
.card{background:var(--bg);border:1px solid var(--bd);border-radius:10px;margin-bottom:16px;box-shadow:var(--sh);overflow:hidden}
.card-h{padding:12px 20px;border-bottom:1px solid var(--bdL);display:flex;align-items:center;gap:8px}
.card-h .nm{font-size:15px;font-weight:600} .card-h .tg{font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:var(--acL);color:var(--ac)}
.sg{padding:0 20px 12px} .sg.hide{display:none}
.sl{font-size:12px;color:var(--txM);padding:10px 0 6px;font-weight:500;border-bottom:1px solid var(--bdL)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:right;padding:9px 10px;font-weight:500;font-size:12px;color:var(--txM);border-bottom:1px solid var(--bdL);white-space:nowrap}
th:first-child{text-align:left}
td{text-align:right;padding:9px 10px;border-bottom:1px solid var(--bdL);font-variant-numeric:tabular-nums;white-space:nowrap}
td:first-child{text-align:left;font-weight:600;color:var(--tx)}
tr:last-child td{border-bottom:none} tr:hover td{background:var(--bgH)}
tr.best td{background:var(--gnB)} tr.best td:first-child{box-shadow:inset 3px 0 0 var(--gn)}
tr.worst td{background:var(--rdB)} tr.worst td:first-child{box-shadow:inset 3px 0 0 var(--rd)}
.lok{color:var(--gn);font-weight:500} .llo{color:var(--rd);font-weight:500}
.ch{font-weight:600;color:var(--tx)} .na{color:var(--txM)}
.ld{text-align:center;padding:50px 20px;color:var(--txM);font-size:14px}
.sg-loading{padding:20px;text-align:center;color:var(--txM);font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px}
.spinner{width:16px;height:16px;border:2px solid var(--bdL);border-top:2px solid var(--ac);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Settings panel */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:100;display:none;opacity:0;transition:opacity .2s}
.overlay.show{display:block;opacity:1}
.panel{position:fixed;top:0;right:-420px;width:400px;max-width:90vw;height:100vh;background:var(--bg);box-shadow:-4px 0 20px rgba(0,0,0,.1);z-index:101;transition:right .25s ease;overflow-y:auto;display:flex;flex-direction:column}
.panel.show{right:0}
.panel-h{padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.panel-h h2{font-size:16px;font-weight:600}
.panel-h .close{font-size:20px;cursor:pointer;color:var(--tx2);background:none;border:none;padding:4px 8px;border-radius:4px}
.panel-h .close:hover{background:var(--bgH)}
.panel-body{padding:20px;flex:1;overflow-y:auto}
.sec{margin-bottom:24px}
.sec h3{font-size:13px;font-weight:600;color:var(--tx);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font-size:13px;padding:6px 14px;border-radius:8px;border:1px solid var(--bd);background:var(--bg);color:var(--tx2);cursor:pointer;font-weight:500;transition:all .15s;user-select:none}
.chip:hover{border-color:var(--ac);color:var(--ac)}
.chip.on{background:var(--ac);color:#fff;border-color:var(--ac)}
.add-row{display:flex;gap:8px;margin-top:10px}
.add-row input{flex:1;font-size:13px;padding:6px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg);color:var(--tx);outline:none}
.add-row input:focus{border-color:var(--ac)}
.add-row button{font-size:12px;padding:6px 14px;border-radius:6px;border:none;background:var(--ac);color:#fff;cursor:pointer;font-weight:500}
.add-row button:hover{opacity:.9}
.lev-row{display:flex;align-items:center;gap:12px}
.lev-row input[type=range]{flex:1;accent-color:var(--ac)}
.lev-row .lev-val{font-size:14px;font-weight:600;color:var(--ac);min-width:40px}
.hint{font-size:11px;color:var(--txM);margin-top:6px}

@media(max-width:900px){
  .ct{padding:10px} .card{border-radius:8px} .sg{padding:0 12px 10px}
  td,th{padding:7px 5px;font-size:12px} .panel{width:100%;max-width:100%}
}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1 id="title"></h1>
    <div class="sub" id="meta"></div>
  </div>
  <div class="hdr-r">
    <div class="badge off" id="status"><span class="dot"></span><span id="stxt"></span></div>
    <button class="btn" onclick="openSettings()" id="settings-btn">⚙</button>
    <button class="btn" id="lang-toggle" onclick="toggleLang()"></button>
    <button class="btn" id="theme-toggle" onclick="toggleTheme()"></button>
  </div>
</div>
<div class="szbar" id="szbar"></div>
<div class="ct" id="content"><div class="ld" id="loading"></div></div>

<!-- Settings Panel -->
<div class="overlay" id="overlay" onclick="closeSettings()"></div>
<div class="panel" id="panel">
  <div class="panel-h">
    <h2 id="settings-title"></h2>
    <button class="close" onclick="closeSettings()">&times;</button>
  </div>
  <div class="panel-body">
    <div class="sec">
      <h3 id="sec-pairs-title"></h3>
      <div class="chips" id="pairs-chips"></div>
    </div>
    <div class="sec">
      <h3 id="sec-exchanges-title"></h3>
      <div class="chips" id="exchanges-chips"></div>
    </div>
    <div class="sec">
      <h3 id="sec-sizes-title"></h3>
      <div class="chips" id="sizes-chips"></div>
      <div class="add-row">
        <input type="number" id="custom-size-input" placeholder="" min="1000" step="1000">
        <button onclick="addCustomSize()" id="add-size-btn"></button>
      </div>
      <div class="hint" id="sizes-hint"></div>
    </div>
    <div class="sec">
      <h3 id="sec-leverage-title"></h3>
      <div class="lev-row">
        <input type="range" id="leverage-slider" min="1" max="100" step="1">
        <span class="lev-val" id="leverage-val"></span>
      </div>
      <div class="hint" id="leverage-hint"></div>
    </div>
  </div>
</div>

<script>
const serverConfig = ${JSON.stringify(config)};
let lang = localStorage.getItem('sl-lang') || 'zh';
let theme = localStorage.getItem('sl-theme') || 'light';
let lastSnapshot = null;

// User preferences (persisted to localStorage)
const defaultPrefs = {
  pairs: [...serverConfig.pairs],
  exchanges: [...serverConfig.exchanges],
  sizes: [...serverConfig.orderSizesUSD],
  leverage: serverConfig.leverage,
};

function loadPrefs() {
  try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem('sl-prefs') || '{}') }; }
  catch { return { ...defaultPrefs }; }
}
function savePrefs() { localStorage.setItem('sl-prefs', JSON.stringify(prefs)); }
let prefs = loadPrefs();

let globalSize = 100000;
let globalExpanded = false;

const i18n = {
  zh: {
    title:'永续合约滑点监控',
    meta:()=>'杠杆 '+prefs.leverage+'x  |  刷新 '+(serverConfig.refreshIntervalMs/1000)+'s',
    connecting:'连接中',disconnected:'已断开',live:'实时',waiting:'等待数据...',loading:'加载中...',
    order:'下单',notional:'名义值',principal:'本金',
    cols:['交易所','中间价','成交均价','滑点(bps)','手续费(bps)','总成本(bps)','成本金额','占本金%','流动性'],
    liqOk:'充足',liqLow:'不足',orderSize:'下单金额',expandAll:'展开全部',collapseAll:'收起',sizeLoading:'数据加载中，请稍候...',
    toggleLabel:'EN',
    settings:'设置',pairs:'交易对',exchanges:'交易所',sizes:'下单金额',leverage:'杠杆倍率',
    addSize:'添加',sizesHint:'点击取消选中，输入自定义金额后添加',
    leverageHint:'调整杠杆倍率，影响本金计算',customSizePlaceholder:'自定义金额 (USD)',
  },
  en: {
    title:'Perps Slippage Monitor',
    meta:()=>'Leverage '+prefs.leverage+'x  |  Refresh '+(serverConfig.refreshIntervalMs/1000)+'s',
    connecting:'Connecting',disconnected:'Disconnected',live:'Live',waiting:'Waiting for data...',loading:'Loading...',
    order:'Order',notional:'notional',principal:'Principal',
    cols:['Exchange','Mid Price','Avg Fill','Slippage(bps)','Fee(bps)','Total(bps)','Cost($)','Cost/Princ%','Liquidity'],
    liqOk:'OK',liqLow:'Low',orderSize:'Order Size',expandAll:'Expand All',collapseAll:'Collapse',sizeLoading:'Loading data, please wait...',
    toggleLabel:'中文',
    settings:'Settings',pairs:'Pairs',exchanges:'Exchanges',sizes:'Order Sizes',leverage:'Leverage',
    addSize:'Add',sizesHint:'Click to toggle, enter custom amount to add',
    leverageHint:'Adjust leverage multiplier for principal calculation',customSizePlaceholder:'Custom amount (USD)',
  }
};
function t(){return i18n[lang]}

function toggleLang(){lang=lang==='zh'?'en':'zh';localStorage.setItem('sl-lang',lang);applyAll()}
function toggleTheme(){theme=theme==='light'?'dark':'light';localStorage.setItem('sl-theme',theme);applyTheme()}
function applyTheme(){document.documentElement.setAttribute('data-theme',theme);document.getElementById('theme-toggle').textContent=theme==='light'?'🌙':'☀️'}

function setGlobalSize(sz){globalSize=sz;globalExpanded=false;renderSzBar();if(lastSnapshot)render(lastSnapshot)}
function toggleGlobalExpand(){globalExpanded=!globalExpanded;renderSzBar();if(lastSnapshot)render(lastSnapshot)}

function renderSzBar(){
  const s=t(),bar=document.getElementById('szbar');
  let h='<span class="lbl">'+s.orderSize+':</span>';
  for(const sz of prefs.sizes.sort((a,b)=>a-b)){
    h+='<button class="sb'+((!globalExpanded&&sz===globalSize)?' on':'')+'" onclick="setGlobalSize('+sz+')">'+fmtSz(sz)+'</button>';
  }
  h+='<button class="exp" onclick="toggleGlobalExpand()">'+(globalExpanded?s.collapseAll:s.expandAll)+'</button>';
  bar.innerHTML=h;
}

function applyLang(){
  const s=t();
  document.getElementById('title').textContent=s.title;
  document.getElementById('meta').textContent=s.meta();
  document.getElementById('lang-toggle').textContent=s.toggleLabel;
  if(!lastSnapshot){document.getElementById('loading').textContent=s.loading;document.getElementById('stxt').textContent=s.connecting}
}

function applyAll(){applyTheme();applyLang();renderSzBar();renderSettings();if(lastSnapshot)render(lastSnapshot)}

function fmt(n,d=2){if(n===0||n===undefined)return'N/A';return n>=1000?n.toLocaleString('en-US',{maximumFractionDigits:d}):n.toFixed(d>2?d:4)}
function fmtSz(n){if(n>=1e6)return'$'+(n/1e6)+'M';if(n>=1e3)return'$'+(n/1e3)+'K';return'$'+n}

// === Settings Panel ===
function openSettings(){document.getElementById('overlay').classList.add('show');document.getElementById('panel').classList.add('show');renderSettings()}
function closeSettings(){document.getElementById('overlay').classList.remove('show');document.getElementById('panel').classList.remove('show')}

// Track sizes that have been synced but no data yet
const pendingSizes=new Set();

function syncSizesToBackend(){
  const custom=prefs.sizes.filter(s=>!serverConfig.orderSizesUSD.includes(s));
  // Mark new custom sizes as pending
  if(lastSnapshot){
    const knownSizes=new Set(lastSnapshot.results.map(r=>r.notionalUSD));
    for(const s of prefs.sizes){if(!knownSizes.has(s))pendingSizes.add(s)}
  }
  fetch('/api/sizes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sizes:custom})});
}

function togglePref(type, val){
  const arr=prefs[type];
  const idx=arr.indexOf(val);
  if(idx>-1){if(arr.length>1)arr.splice(idx,1)} // keep at least 1
  else arr.push(val);
  savePrefs();renderSettings();renderSzBar();
  if(type==='sizes')syncSizesToBackend();
  if(lastSnapshot)render(lastSnapshot);
}

function removeSizeChip(val){
  prefs.sizes=prefs.sizes.filter(s=>s!==val);
  if(prefs.sizes.length===0)prefs.sizes=[100000];
  if(globalSize===val)globalSize=prefs.sizes[0];
  savePrefs();renderSettings();renderSzBar();syncSizesToBackend();
  if(lastSnapshot)render(lastSnapshot);
}

function addCustomSize(){
  const input=document.getElementById('custom-size-input');
  const val=Math.round(Number(input.value));
  if(val>=1000&&!prefs.sizes.includes(val)){
    prefs.sizes.push(val);prefs.sizes.sort((a,b)=>a-b);
    savePrefs();renderSettings();renderSzBar();input.value='';
    syncSizesToBackend();
  }
}

function setLeverage(val){
  prefs.leverage=Number(val);
  document.getElementById('leverage-val').textContent=val+'x';
  document.getElementById('meta').textContent=t().meta();
  savePrefs();
  if(lastSnapshot)render(lastSnapshot);
}

function renderSettings(){
  const s=t();
  document.getElementById('settings-title').textContent=s.settings;
  document.getElementById('sec-pairs-title').textContent=s.pairs;
  document.getElementById('sec-exchanges-title').textContent=s.exchanges;
  document.getElementById('sec-sizes-title').textContent=s.sizes;
  document.getElementById('sec-leverage-title').textContent=s.leverage;
  document.getElementById('add-size-btn').textContent=s.addSize;
  document.getElementById('sizes-hint').textContent=s.sizesHint;
  document.getElementById('leverage-hint').textContent=s.leverageHint;
  document.getElementById('custom-size-input').placeholder=s.customSizePlaceholder;

  // Pairs chips - show all available from server config
  let ph='';
  for(const p of serverConfig.pairs){
    ph+='<div class="chip'+(prefs.pairs.includes(p)?' on':'')+'" onclick="togglePref(\\'pairs\\',\\''+p+'\\')">'+p+'</div>';
  }
  document.getElementById('pairs-chips').innerHTML=ph;

  // Exchanges chips
  let eh='';
  const allExchanges=serverConfig.exchanges;
  const exNames={binance:'Binance',bybit:'Bybit',hyperliquid:'Hyperliquid',lighter:'Lighter',sodex:'SoDEX'};
  for(const e of allExchanges){
    const name=exNames[e]||e;
    eh+='<div class="chip'+(prefs.exchanges.includes(e)?' on':'')+'" onclick="togglePref(\\'exchanges\\',\\''+e+'\\')">'+name+'</div>';
  }
  document.getElementById('exchanges-chips').innerHTML=eh;

  // Sizes chips
  let sh='';
  const allSizes=[...new Set([...serverConfig.orderSizesUSD,...prefs.sizes])].sort((a,b)=>a-b);
  for(const sz of allSizes){
    const isOn=prefs.sizes.includes(sz);
    const isCustom=!serverConfig.orderSizesUSD.includes(sz);
    sh+='<div class="chip'+(isOn?' on':'')+'" onclick="togglePref(\\'sizes\\','+sz+')">'+fmtSz(sz);
    if(isCustom)sh+=' <span style="cursor:pointer;margin-left:4px" onclick="event.stopPropagation();removeSizeChip('+sz+')">&times;</span>';
    sh+='</div>';
  }
  document.getElementById('sizes-chips').innerHTML=sh;

  // Leverage slider
  const slider=document.getElementById('leverage-slider');
  slider.value=prefs.leverage;
  document.getElementById('leverage-val').textContent=prefs.leverage+'x';
  slider.oninput=function(){setLeverage(this.value)};
}

// === Render ===
function render(snapshot){
  lastSnapshot=snapshot;
  const s=t();
  if(!snapshot||!snapshot.results||snapshot.results.length===0){
    document.getElementById('content').innerHTML='<div class="ld">'+s.waiting+'</div>';return;
  }

  // Clear pending sizes that have arrived
  const snapshotSizes=new Set(snapshot.results.map(r=>r.notionalUSD));
  for(const ps of [...pendingSizes]){if(snapshotSizes.has(ps))pendingSizes.delete(ps)}

  // Filter by user prefs
  const exMap={Binance:'binance',Bybit:'bybit',Hyperliquid:'hyperliquid',Lighter:'lighter',SoDEX:'sodex'};
  const filtered=snapshot.results.filter(r=>
    prefs.pairs.includes(r.pair) &&
    prefs.exchanges.includes(exMap[r.exchange]||r.exchange.toLowerCase()) &&
    prefs.sizes.includes(r.notionalUSD)
  );

  const byPair={};
  for(const r of filtered){(byPair[r.pair]=byPair[r.pair]||[]).push(r)}

  const lev=prefs.leverage;

  let html='';
  for(const pair of prefs.pairs){
    const results=byPair[pair]||[];

    html+='<div class="card"><div class="card-h"><span class="nm">'+pair+'</span><span class="tg">PERP</span></div>';

    // Build size groups from data + show loading for pending sizes
    const bySize={};const sizeKeys=[];
    for(const r of results){if(!bySize[r.notionalUSD]){bySize[r.notionalUSD]=[];sizeKeys.push(r.notionalUSD)}bySize[r.notionalUSD].push(r)}
    // Add pending sizes that user has selected but no data yet
    for(const sz of prefs.sizes.sort((a,b)=>a-b)){if(!bySize[sz])sizeKeys.push(sz)}
    sizeKeys.sort((a,b)=>a-b);

    for(const size of sizeKeys){
      const hasPendingData=!bySize[size]&&pendingSizes.has(size);
      const sr=bySize[size];
      const vis=globalExpanded||size===globalSize;
      const princ=size/lev;
      html+='<div class="sg'+(vis?'':' hide')+'">';
      html+='<div class="sl">'+s.order+' '+fmtSz(size)+' '+s.notional+'  ·  '+s.principal+' '+fmtSz(princ)+'</div>';

      // Show loading spinner if this size has no data yet (pending from backend)
      if(!sr||sr.length===0){
        html+='<div class="sg-loading"><div class="spinner"></div>'+s.sizeLoading+'</div></div>';
        continue;
      }

      html+='<table><thead><tr>';
      for(const c of s.cols)html+='<th>'+c+'</th>';
      html+='</tr></thead><tbody>';

      // Recalculate with user leverage
      const rows=sr.map(r=>{
        const costPct=(r.totalCostBps/10000)*lev*100;
        const costUSD=(r.totalCostBps/10000)*r.notionalUSD;
        return{...r,costPct,costUSD,princ:r.notionalUSD/lev};
      });
      const costs=rows.filter(r=>!r.insufficientLiquidity).map(r=>r.totalCostBps);
      const best=costs.length>1?Math.min(...costs):-1;
      const worst=costs.length>1?Math.max(...costs):-1;

      for(const r of rows){
        let cls='';
        if(!r.insufficientLiquidity&&costs.length>1){if(r.totalCostBps===best)cls=' class="best"';else if(r.totalCostBps===worst)cls=' class="worst"'}
        html+='<tr'+cls+'>';
        html+='<td>'+r.exchange+'</td>';
        html+='<td>'+(r.midPrice>0?'$'+fmt(r.midPrice):'<span class="na">-</span>')+'</td>';
        html+='<td>'+(r.avgFillPrice>0?'$'+fmt(r.avgFillPrice):'<span class="na">-</span>')+'</td>';
        html+='<td>'+r.slippageBps.toFixed(2)+'</td>';
        html+='<td>'+r.feeBps.toFixed(1)+'</td>';
        html+='<td class="ch">'+r.totalCostBps.toFixed(2)+'</td>';
        html+='<td class="ch">$'+r.costUSD.toFixed(2)+'</td>';
        html+='<td>'+r.costPct.toFixed(3)+'%</td>';
        html+='<td class="'+(r.insufficientLiquidity?'llo':'lok')+'">'+(r.insufficientLiquidity?s.liqLow:s.liqOk)+'</td>';
        html+='</tr>';
      }
      html+='</tbody></table></div>';
    }
    html+='</div>';
  }
  if(!html)html='<div class="ld">'+s.waiting+'</div>';
  document.getElementById('content').innerHTML=html;
  document.getElementById('stxt').textContent=s.live+' '+new Date(snapshot.timestamp).toLocaleTimeString();
  document.getElementById('status').className='badge on';
}

// Init
applyAll();
syncSizesToBackend(); // sync any saved custom sizes on load
const evtSource=new EventSource('/api/events');
evtSource.onmessage=(e)=>render(JSON.parse(e.data));
evtSource.onerror=()=>{document.getElementById('stxt').textContent=t().disconnected;document.getElementById('status').className='badge off'};
fetch('/api/snapshot').then(r=>r.json()).then(render);
</script>
</body>
</html>`;
}
