/* ============================================================
   AI Pitcher · 潜客策略顾问（B2B表单获客版）v2.1
   云端核心脚本 — 纯建议型，绝不自动操作广告
   新增：CPL归因分解 / 可执行建议 / 全天预测 / 知识引用来源
   ============================================================ */
(function () {
  'use strict';

  if (window.__AI_PITCHER_CORE_LOADED__) {
    if (window.__AI_PITCHER__) window.__AI_PITCHER__.refresh();
    return;
  }
  window.__AI_PITCHER_CORE_LOADED__ = true;

  /* ============ 配置 ============ */
  let CFG = Object.assign({
    version: '2.1.0',
    panel: { width: 460 },
    baseline: {
      benchmark_ctr: 0.025,
      benchmark_submit_rate: 0.038,
      benchmark_cpl: 200,
      benchmark_cpm: 45,
      source: '默认基线'
    },
    thresholds: { freq_warn: 3.0, cpl_anomaly_ratio: 1.5, cpm_spike_ratio: 1.1 },
    currency: '¥',
    autoRefresh: 30000
  }, window.__AI_PITCHER_CONFIG__ || {});

  /* ============ 存储 ============ */
  let STORE_KEY = 'ai_pitcher_leadgen_v21';
  function loadStore() {
    try {
      let d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return Object.assign({
        baseline: CFG.baseline, knowledge: [], history: {},
        lead_quality: {}, lastAnalysis: null,
        settings: { attributionWindow: 1, offlineConversion: false }
      }, d);
    } catch (e) {
      return { baseline: CFG.baseline, knowledge: [], history: {}, lead_quality: {}, lastAnalysis: null, settings: { attributionWindow: 1, offlineConversion: false } };
    }
  }
  function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { } }
  let STORE = loadStore();

  /* ============ 样式 ============ */
  let CSS = `
  #ai-pitcher-panel{position:fixed;top:70px;right:14px;width:${CFG.panel.width}px;max-height:85vh;background:#141b2d;border:1px solid #2d3a52;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.6);z-index:2147483647;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#e8ecf4;overflow:hidden;display:flex;flex-direction:column}
  #ai-pitcher-panel.collapsed{transform:translateX(calc(100% - 44px))}
  #ap-header{background:linear-gradient(180deg,#1a2340,#141b2d);padding:12px 16px;border-bottom:2px solid #fbbf24;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none}
  #ap-header .title{font-weight:800;color:#fbbf24;font-size:15px}
  #ap-header .subtitle{font-size:10px;color:#8b95a8;margin-top:2px}
  #ap-header .ctrls{display:flex;gap:6px}
  #ap-header .ctrl-btn{background:#222d4a;border:none;color:#8b95a8;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center}
  #ap-header .ctrl-btn:hover{color:#fbbf24;background:#2d3a52}
  #ap-body{padding:14px;overflow-y:auto;flex:1}
  #ap-body::-webkit-scrollbar{width:6px}
  #ap-body::-webkit-scrollbar-thumb{background:#2d3a52;border-radius:3px}
  .ap-section{margin-bottom:14px}
  .ap-section-title{font-size:13px;font-weight:700;color:#e8ecf4;margin-bottom:8px;display:flex;align-items:center;gap:6px}
  .ap-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .ap-card{background:#1a2340;border-radius:8px;padding:10px 12px;border:1px solid #2d3a52}
  .ap-card .label{font-size:10px;color:#8b95a8;margin-bottom:3px}
  .ap-card .value{font-size:20px;font-weight:800}
  .ap-card .delta{font-size:10px;margin-top:2px}
  .delta-up{color:#4ade80}.delta-down{color:#f87171}.delta-flat{color:#8b95a8}
  .ap-funnel{background:#1a2340;border-radius:8px;padding:14px;border:1px solid #2d3a52}
  .ap-funnel-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
  .ap-funnel-step{text-align:center;flex:1}
  .ap-funnel-step .num{font-size:18px;font-weight:800;color:#e8ecf4}
  .ap-funnel-step .label{font-size:10px;color:#8b95a8;margin-top:2px}
  .ap-funnel-step .rate{font-size:11px;font-weight:600;margin-top:3px;padding:2px 6px;border-radius:3px;display:inline-block}
  .rate-good{background:rgba(74,222,128,.15);color:#4ade80}
  .rate-warn{background:rgba(251,191,36,.15);color:#fbbf24}
  .rate-bad{background:rgba(248,113,113,.15);color:#f87171}
  .ap-funnel-arrow{color:#2d3a52;font-size:18px;font-weight:800}
  .ap-issue{background:#1a2340;border-radius:6px;padding:10px 12px;margin-bottom:6px;border-left:3px solid #fbbf24}
  .ap-issue.critical{border-left-color:#f87171}
  .ap-issue.info{border-left-color:#22d3ee}
  .ap-issue.good{border-left-color:#4ade80}
  .ap-issue .head{font-weight:700;font-size:12px;margin-bottom:3px}
  .ap-issue.critical .head{color:#f87171}
  .ap-issue .desc{font-size:11px;color:#8b95a8;line-height:1.5}
  .ap-issue .sug{font-size:11px;color:#22d3ee;margin-top:4px;line-height:1.6}
  .ap-issue .src{font-size:9px;color:#a78bfa;margin-top:3px;font-style:italic}
  .ap-attr{background:#0a0e1a;border-radius:6px;padding:10px;margin:8px 0;font-size:11px}
  .ap-attr-title{font-weight:700;color:#fbbf24;margin-bottom:6px}
  .ap-attr-row{display:flex;justify-content:space-between;margin-bottom:3px}
  .ap-attr-bar{height:4px;background:#222d4a;border-radius:2px;overflow:hidden;margin:2px 0 6px}
  .ap-attr-bar i{display:block;height:100%;border-radius:2px}
  .ap-predict{background:linear-gradient(135deg,#1a2340,#141b2d);border:1px solid #a78bfa;border-radius:8px;padding:12px;margin-bottom:10px}
  .ap-predict .title{font-weight:700;color:#a78bfa;font-size:12px;margin-bottom:6px}
  .ap-predict .body{font-size:11px;line-height:1.7;color:#e8ecf4}
  .ap-predict .warn{color:#f87171;font-weight:700}
  .ap-predict .ok{color:#4ade80;font-weight:700}
  .ap-summary{background:#1a2340;border:1px solid #fbbf24;border-radius:8px;padding:12px;position:relative}
  .ap-summary textarea{width:100%;background:#0a0e1a;border:1px solid #2d3a52;color:#e8ecf4;padding:8px;border-radius:4px;font-size:11px;line-height:1.7;resize:vertical;min-height:100px;font-family:'Consolas',monospace}
  .ap-summary .copy-btn{position:absolute;top:10px;right:10px;padding:4px 10px;background:#fbbf24;color:#1a1a2e;border:none;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer}
  .ap-knowledge{background:#1a2340;border-radius:8px;padding:12px;border:1px solid #2d3a52}
  .ap-knowledge textarea{width:100%;background:#0a0e1a;border:1px solid #2d3a52;color:#e8ecf4;padding:8px;border-radius:4px;font-size:11px;resize:vertical;min-height:50px;margin-bottom:6px;font-family:inherit}
  .ap-kb-row{display:flex;gap:6px;margin-bottom:6px}
  .ap-kb-row input{flex:1;background:#0a0e1a;border:1px solid #2d3a52;color:#e8ecf4;padding:6px 8px;border-radius:4px;font-size:11px}
  .ap-btn{padding:6px 12px;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:700;background:linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1a2e}
  .ap-btn.sec{background:#222d4a;color:#e8ecf4}
  .ap-btn.small{padding:4px 8px;font-size:10px}
  .ap-btn-row{display:flex;gap:6px;flex-wrap:wrap}
  .ap-kb-item{background:#0a0e1a;border-radius:4px;padding:6px 8px;margin-bottom:4px;font-size:10px}
  .ap-kb-item .k-title{color:#fbbf24;font-weight:600}
  .ap-kb-item .k-rule{color:#22d3ee;margin-top:2px}
  .ap-kb-item .k-meta{color:#8b95a8;margin-top:2px;font-size:9px}
  .ap-footer{background:#0a0e1a;padding:6px 14px;font-size:10px;color:#8b95a8;display:flex;justify-content:space-between;border-top:1px solid #2d3a52}
  .ap-badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;margin-left:4px}
  .badge-new{background:rgba(34,211,238,.15);color:#22d3ee}
  .ap-quality-row{display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px}
  .ap-quality-row select{background:#0a0e1a;border:1px solid #2d3a52;color:#e8ecf4;padding:3px 6px;border-radius:3px;font-size:10px}
  .ap-empty{text-align:center;padding:20px;color:#8b95a8;font-size:12px}
  .ap-loading{text-align:center;padding:30px;color:#fbbf24}
  `;
  let styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ============ 面板 ============ */
  let panel = document.createElement('div');
  panel.id = 'ai-pitcher-panel';
  panel.innerHTML = `
    <div id="ap-header">
      <div><div class="title">🎯 AI投手 · 潜客策略顾问</div><div class="subtitle" id="ap-last-time">上次分析: --</div></div>
      <div class="ctrls">
        <button class="ctrl-btn" id="ap-refresh" title="重新分析">🔄</button>
        <button class="ctrl-btn" id="ap-collapse" title="折叠">➖</button>
        <button class="ctrl-btn" id="ap-close" title="关闭">✕</button>
      </div>
    </div>
    <div id="ap-body"><div class="ap-loading">⏳ 正在扫描页面数据并诊断...</div></div>
    <div class="ap-footer"><span>数据来源: Meta Ads Manager</span><span style="color:#4ade80">⚠️ 仅分析建议，不执行任何修改</span></div>
  `;
  document.body.appendChild(panel);
  let collapsed = false;
  document.getElementById('ap-collapse').onclick = (e) => { e.stopPropagation(); collapsed = !collapsed; panel.classList.toggle('collapsed', collapsed); document.getElementById('ap-collapse').textContent = collapsed ? '➕' : '➖'; };
  document.getElementById('ap-close').onclick = (e) => { e.stopPropagation(); panel.remove(); window.__AI_PITCHER_CORE_LOADED__ = false; };
  document.getElementById('ap-refresh').onclick = (e) => { e.stopPropagation(); runAnalysis(); };

  /* ============ 数据抓取 ============ */
  function detectLevel() {
    let url = location.href.toLowerCase();
    let bt = (document.body?.innerText || '').slice(0, 3000);
    if (/campaign/i.test(url) || /广告系列/.test(bt)) return 'campaign';
    return 'adset';
  }
  function fetchAds() {
    let candidates = [];
    let rows = document.querySelectorAll('[role="row"]');
    rows.forEach(r => { let cells = r.querySelectorAll('[role="gridcell"]'); if (cells.length >= 3) candidates.push({ el: r, cells, text: r.innerText || r.textContent }); });
    if (candidates.length === 0) {
      document.querySelectorAll('table tr').forEach(tr => { let tds = tr.querySelectorAll('td'); if (tds.length >= 3) candidates.push({ el: tr, cells: tds, text: tr.innerText || tr.textContent }); });
    }
    if (candidates.length === 0) {
      let seen = new Set();
      document.querySelectorAll('div').forEach(d => {
        let txt = d.innerText || '';
        if (txt.length > 10 && txt.length < 500 && /\d/.test(txt) && /(花费|预算|展示|线索|成效|spend|budget|impression)/i.test(txt)) {
          if (d.parentElement && d.parentElement.innerText && d.parentElement.innerText.length > txt.length * 3) return;
          if (seen.has(txt)) return; seen.add(txt);
          candidates.push({ el: d, cells: [], text: txt });
        }
      });
    }
    let ads = []; let seenNames = new Set();
    candidates.forEach(c => {
      let text = c.text || '';
      if (!text || text.length < 5) return;
      if (/^(广告系列|广告组|广告|名称|campaign|ad set)\s*$/i.test(text.trim())) return;
      if (/总计|合计|total/i.test(text) && text.length < 40) return;
      let name = '';
      let nameEl = c.el.querySelector('a,span[dir="auto"],[data-testid*="name"],[role="gridcell"]:first-child');
      if (nameEl) name = (nameEl.innerText || nameEl.textContent || '').trim();
      if (!name && c.cells.length > 0) name = (c.cells[0].innerText || c.cells[0].textContent || '').trim();
      if (!name) { let fl = text.split('\n').filter(l => l.trim().length > 0)[0]; name = fl ? fl.trim() : ''; }
      if (!name || name.length < 1 || name.length > 120) return;
      if (seenNames.has(name)) return; seenNames.add(name);
      function findNum(patterns) { for (let p of patterns) { let m = text.match(p); if (m) return parseFloat(m[1].replace(/,/g, '')) || 0; } return 0; }
      let leads = findNum([/(\d+)\s*(?:潜在客户(?:信息)?|线索|表单提交|leads?|results?|转化)/i, /(?:成效|结果|result)[^\d]*(\d+)/i]);
      let cpl = findNum([/(?:单次(?:成效|结果|转化)|每条潜在客户|per (?:result|lead)|cpl)[^\d]*[\$￥]?\s*(\d+\.?\d*)/i, /[\$￥]\s*(\d+\.?\d*)\s*(?:每次|per|\/)/i]);
      let spend = findNum([/(?:已?花费|金额花费|spend|amount spent)[^\d]*[\$￥]?\s*(\d+\.?\d*)/i]);
      let budget = findNum([/(?:每日预算|日预算|预算|budget)[^\d]*[\$￥]?\s*(\d+\.?\d*)/i]);
      let impressions = findNum([/(\d[\d,]*)\s*(?:展示次数|展示|impressions?)/i]);
      let reach = findNum([/(\d[\d,]*)\s*(?:覆盖人数|触达人数|覆盖|reach)/i]);
      let freq = findNum([/(\d+\.?\d*)\s*(?:频次|频率|frequency)/i]);
      let clicks = findNum([/(\d[\d,]*)\s*(?:链接点击次数|链接点击|点击次数|clicks?|link clicks?)/i]);
      let cpm = findNum([/(?:千次展示费用|cpm)[^\d]*[\$￥]?\s*(\d+\.?\d*)/i]);
      let moneyVals = (text.match(/[\$￥]\s*\d+\.?\d*/g) || []).map(m => parseFloat(m.replace(/[\$￥,\s]/g, '')));
      let plainNums = (text.match(/\d[\d,]*/g) || []).map(n => parseInt(n.replace(/,/g, '')));
      if (spend === 0 && moneyVals.length >= 1) spend = moneyVals[0];
      if (budget === 0 && moneyVals.length >= 2) budget = moneyVals[moneyVals.length - 1];
      if (cpl === 0 && leads > 0 && spend > 0) cpl = spend / leads;
      if (impressions === 0 && plainNums.length >= 1) impressions = plainNums[0];
      if (reach === 0 && plainNums.length >= 2) reach = plainNums[1];
      if (clicks === 0 && plainNums.length >= 3) clicks = plainNums[2];
      if (freq === 0 && reach > 0) freq = impressions / reach;
      let status = '投放中';
      if (/学习中|learning/i.test(text)) status = '学习中';
      else if (/暂停|paused|off/i.test(text)) status = '已暂停';
      if (leads > 0 || spend > 0 || impressions > 0 || budget > 0 || clicks > 0) {
        ads.push({ id: 'ad_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), name, status, leads, cpl, spend, budget, impressions, reach, freq, clicks, cpm });
      }
    });
    return ads;
  }

  /* ============ CPL归因分解 ============ */
  // CPL = CPM / (CTR * submitRate) * 1000
  // 与基准/历史对比，分解各因素贡献
  function cplAttribution(current, baseline) {
    let curCpl = current.cpl;
    let baseCpl = baseline.cpl > 0 ? baseline.cpl : (baseline.cpm / (baseline.ctr * baseline.submitRate) * 1000);
    if (baseCpl <= 0 || curCpl <= 0) return null;
    let cplChange = (curCpl - baseCpl) / baseCpl;
    // 各因素变化率
    let cpmChange = baseline.cpm > 0 ? (current.cpm - baseline.cpm) / baseline.cpm : 0;
    let ctrChange = baseline.ctr > 0 ? (current.ctr - baseline.ctr) / baseline.ctr : 0;
    let submitChange = baseline.submitRate > 0 ? (current.submitRate - baseline.submitRate) / baseline.submitRate : 0;
    // 贡献分解（对数分解近似）
    let total = Math.abs(cpmChange) + Math.abs(ctrChange) + Math.abs(submitChange);
    return {
      cplChange, curCpl, baseCpl,
      cpm: { change: cpmChange, contribution: total > 0 ? Math.abs(cpmChange) / total : 0 },
      ctr: { change: ctrChange, contribution: total > 0 ? Math.abs(ctrChange) / total : 0 },
      submitRate: { change: submitChange, contribution: total > 0 ? Math.abs(submitChange) / total : 0 },
      dominant: Math.abs(cpmChange) >= Math.abs(ctrChange) && Math.abs(cpmChange) >= Math.abs(submitChange) ? 'cpm' :
                Math.abs(ctrChange) >= Math.abs(submitChange) ? 'ctr' : 'submitRate'
    };
  }

  /* ============ 可执行建议生成器 ============ */
  function actionableSuggestion(type, data) {
    let BL = STORE.baseline;
    switch (type) {
      case 'ctr_low':
        return `CTR为${(data.ctr * 100).toFixed(1)}%，低于基准${(BL.benchmark_ctr * 100).toFixed(1)}%。建议：①测试A(痛点型)/B(利益型)/C(案例型)三类标题，每类2版素材共6组 ②首帧画面3秒内突出核心卖点 ③收窄受众兴趣词至5个以内。观察2天，CTR回升至${(BL.benchmark_ctr * 100).toFixed(1)}%以上为达标。`;
      case 'submit_low':
        return `提交率为${(data.submitRate * 100).toFixed(1)}%，低于基准${(BL.benchmark_submit_rate * 100).toFixed(1)}%。建议：①表单字段从当前数量减至3个（姓名+手机+需求） ②提交按钮改为高对比色+文案"立即获取方案" ③移动端测试加载速度，目标3秒内打开。观察3天，提交率提升至${(BL.benchmark_submit_rate * 100).toFixed(1)}%以上。`;
      case 'cpl_high':
        return `${data.name} CPL为${CFG.currency}${data.cpl.toFixed(0)}，高于账户平均${((data.cpl / data.avgCpl - 1) * 100).toFixed(0)}%。建议：①暂停该组 ②将其日预算${CFG.currency}${(data.budget * 0.4).toFixed(0)}转移给CPL最低的高效组 ③检查该组素材是否疲劳（频次${data.freq.toFixed(1)}）。预计2天内整体CPL回落${CFG.currency}${(data.avgCpl * 0.9).toFixed(0)}。`;
      case 'freq_high':
        return `${data.name} 频次达${data.freq.toFixed(1)}，CTR下滑至${(data.ctr * 100).toFixed(1)}%。建议：①准备2-3版新素材（不同场景/不同角度） ②扩大受众范围20% ③该组出价降低10%。新素材上线后观察3天，频次降至2.5以下。`;
      case 'cpm_rise':
        return `CPM近期上涨${((data.cpm / data.prevCpm - 1) * 100).toFixed(0)}%，大盘竞争加剧。建议：①开启类似受众(Lookalike)，基于已转化用户创建1%相似受众 ②测试2个新兴趣词避开红海 ③出价提高5-10%维持展现量。观察1周CPM变化。`;
      case 'zero_leads':
        return `${data.name} 消耗${CFG.currency}${data.spend.toFixed(0)}但零表单。建议：①立即暂停 ②检查落地页表单是否可正常提交（用手机实测一遍） ③检查像素/转化事件是否正确触发 ④确认受众定向是否过窄（覆盖<10万）。排查后重启，观察24小时。`;
      case 'budget_transfer':
        return `高效组(${data.goodNames})CPL远低于低效组(${data.badNames})。建议：将低效组预算的30%（约${CFG.currency}${data.transferAmt.toFixed(0)}）转移给高效组，预计整体CPL降低${data.improvePct}%，月均多获${data.extraLeads}条线索。`;
      default:
        return data.sug || '持续观察';
    }
  }

  /* ============ 全天预测 ============ */
  function predictDay(totals) {
    let now = new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let dayProgress = (hour * 60 + minute) / (24 * 60); // 今天已过百分比
    if (dayProgress <= 0.02 || totals.totalSpend <= 0) return null;
    // 按当前速度推算全天
    let projectedSpend = totals.totalSpend / dayProgress;
    let projectedLeads = totals.totalLeads / dayProgress;
    let projectedCpl = projectedLeads > 0 ? projectedSpend / projectedLeads : 0;
    let BL = STORE.baseline;
    let willExceed = BL.benchmark_cpl > 0 && projectedCpl > BL.benchmark_cpl;
    let exceedPct = BL.benchmark_cpl > 0 ? ((projectedCpl / BL.benchmark_cpl - 1) * 100) : 0;
    return {
      dayProgress, projectedSpend, projectedLeads, projectedCpl,
      willExceed, exceedPct,
      hoursLeft: 24 - hour,
      currentSpend: totals.totalSpend, currentLeads: totals.totalLeads, currentCpl: totals.avgCpl
    };
  }

  /* ============ 诊断引擎 ============ */
  function diagnose(ads) {
    let issues = [];
    let totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    let totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    let totalImpr = ads.reduce((s, a) => s + a.impressions, 0);
    let totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    let avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    let ctr = totalImpr > 0 ? totalClicks / totalImpr : 0;
    let submitRate = totalClicks > 0 ? totalLeads / totalClicks : 0;
    let avgCpm = totalImpr > 0 ? (totalSpend / totalImpr) * 1000 : 0;
    let BL = STORE.baseline;

    // === CPL归因分解（核心新增）===
    let attr = cplAttribution(
      { cpl: avgCpl, cpm: avgCpm, ctr, submitRate },
      { cpl: BL.benchmark_cpl, cpm: BL.benchmark_cpm, ctr: BL.benchmark_ctr, submitRate: BL.benchmark_submit_rate }
    );

    // 1. 漏斗诊断 + 可执行建议
    if (ctr < BL.benchmark_ctr * 0.8) {
      issues.push({ level: 'critical', layer: '点击率', desc: `CTR为${(ctr * 100).toFixed(1)}%，低于基准${(BL.benchmark_ctr * 100).toFixed(1)}%`, sug: actionableSuggestion('ctr_low', { ctr }), src: findKnowledgeSource('ctr') });
    } else if (ctr < BL.benchmark_ctr) {
      issues.push({ level: 'warning', layer: '点击率', desc: `CTR为${(ctr * 100).toFixed(1)}%，略低于基准${(BL.benchmark_ctr * 100).toFixed(1)}%`, sug: actionableSuggestion('ctr_low', { ctr }), src: findKnowledgeSource('ctr') });
    }
    if (submitRate < BL.benchmark_submit_rate * 0.8) {
      issues.push({ level: 'critical', layer: '表单提交率', desc: `提交率为${(submitRate * 100).toFixed(1)}%，低于基准${(BL.benchmark_submit_rate * 100).toFixed(1)}%`, sug: actionableSuggestion('submit_low', { submitRate }), src: findKnowledgeSource('submit_rate') });
    } else if (submitRate < BL.benchmark_submit_rate) {
      issues.push({ level: 'warning', layer: '表单提交率', desc: `提交率为${(submitRate * 100).toFixed(1)}%，略低于基准${(BL.benchmark_submit_rate * 100).toFixed(1)}%`, sug: actionableSuggestion('submit_low', { submitRate }), src: findKnowledgeSource('submit_rate') });
    }

    // 2. CPL异常
    ads.forEach(a => {
      if (a.leads >= 3 && avgCpl > 0) {
        let cpl = a.cpl > 0 ? a.cpl : (a.spend / a.leads);
        if (cpl > avgCpl * CFG.thresholds.cpl_anomaly_ratio) {
          issues.push({ level: 'critical', target: a.name, desc: `${a.name} CPL ${CFG.currency}${cpl.toFixed(0)}，高于平均${((cpl / avgCpl - 1) * 100).toFixed(0)}%`, sug: actionableSuggestion('cpl_high', { name: a.name, cpl, avgCpl, budget: a.budget, freq: a.freq }), src: findKnowledgeSource('cpl') });
        }
      }
      if (a.leads === 0 && a.spend > a.budget * 3 && a.budget > 0) {
        issues.push({ level: 'critical', target: a.name, desc: `${a.name} 消耗${CFG.currency}${a.spend.toFixed(0)}但零表单`, sug: actionableSuggestion('zero_leads', { name: a.name, spend: a.spend }) });
      }
    });

    // 3. 素材疲劳
    ads.forEach(a => {
      if (a.freq >= CFG.thresholds.freq_warn) {
        let adCtr = a.impressions > 0 ? a.clicks / a.impressions : 0;
        if (adCtr < BL.benchmark_ctr * 0.7 || a.leads === 0) {
          issues.push({ level: 'warning', target: a.name, desc: `${a.name} 频次${a.freq.toFixed(1)}，CTR ${(adCtr * 100).toFixed(1)}%`, sug: actionableSuggestion('freq_high', { name: a.name, freq: a.freq, ctr: adCtr }) });
        }
      }
    });

    // 4. CPM趋势
    let histCpm = Object.values(STORE.history).filter(h => h.cpm).map(h => h.cpm);
    if (avgCpm > 0 && histCpm.length >= 3) {
      let prevAvg = histCpm.slice(-3).reduce((s, v) => s + v, 0) / 3;
      if (avgCpm > prevAvg * CFG.thresholds.cpm_spike_ratio) {
        issues.push({ level: 'info', layer: 'CPM趋势', desc: `CPM上涨，今日${CFG.currency}${avgCpm.toFixed(1)} vs 近期${CFG.currency}${prevAvg.toFixed(1)}（+${((avgCpm / prevAvg - 1) * 100).toFixed(0)}%）`, sug: actionableSuggestion('cpm_rise', { cpm: avgCpm, prevCpm: prevAvg }) });
      }
    }

    // 5. 预算转移
    let goodAds = ads.filter(a => a.leads >= 3 && (a.cpl || (a.spend / a.leads)) < avgCpl * 0.8);
    let badAds = ads.filter(a => a.leads >= 3 && (a.cpl || (a.spend / a.leads)) > avgCpl * 1.3);
    if (goodAds.length > 0 && badAds.length > 0) {
      let transferAmt = badAds.reduce((s, a) => s + a.budget, 0) * 0.3;
      let extraLeads = Math.round(transferAmt / (avgCpl * 0.7));
      issues.push({ level: 'info', layer: '预算分配', desc: `高效组(${goodAds.map(a => a.name).join('、')}) vs 低效组(${badAds.map(a => a.name).join('、')})`, sug: actionableSuggestion('budget_transfer', { goodNames: goodAds.map(a => a.name).join('、'), badNames: badAds.map(a => a.name).join('、'), transferAmt, improvePct: 15, extraLeads }) });
    }

    // 6. 隐藏功能
    if (STORE.settings.attributionWindow <= 1) {
      issues.push({ level: 'info', layer: '归因设置', desc: 'B2B决策周期长，当前归因窗口可能仅1天点击', sug: '建议将归因窗口设为7天点击归因，更准确衡量线索成本，避免低估广告效果。' });
    }
    if (!STORE.settings.offlineConversion && totalLeads > 0) {
      issues.push({ level: 'info', layer: '转化回传', desc: `今日${totalLeads}条表单，未确认离线转化回传`, sug: 'B2B常电话沟通后才确认意向。请检查是否已通过API/手动上传离线转化至Meta，避免算法误判"没转化"停推。' });
    }

    // 记录历史
    let today = new Date().toISOString().slice(0, 10);
    STORE.history[today] = { spend: totalSpend, leads: totalLeads, cpl: avgCpl, cpm: avgCpm, ctr, submitRate };
    saveStore(STORE);

    return { issues, attr, totals: { totalSpend, totalLeads, totalImpr, totalClicks, avgCpl, ctr, submitRate, avgCpm } };
  }

  /* ============ 知识库引用 ============ */
  function findKnowledgeSource(field) {
    for (let k of STORE.knowledge) {
      if (k.extracted_rules && k.extracted_rules.some(r => r.field === field)) {
        return `依据：《${k.title}》`;
      }
    }
    return null;
  }

  /* ============ 知识投喂 ============ */
  function feedKnowledge(text, sourceTitle) {
    if (!text || text.trim().length < 10) return { ok: false, msg: '内容太短' };
    let rules = [];
    let numPatterns = [
      { re: /CPL[^0-9]{0,10}(\d+)[^0-9]{0,5}(元|块|美金|美元)?/i, field: 'cpl', label: 'CPL阈值' },
      { re: /(?:点击率|CTR)[^0-9]{0,10}(\d+\.?\d*)%?/i, field: 'ctr', label: 'CTR阈值' },
      { re: /(?:提交率|转化率)[^0-9]{0,10}(\d+\.?\d*)%?/i, field: 'submit_rate', label: '提交率阈值' },
      { re: /(?:频次|频率)[^0-9]{0,5}(\d+\.?\d*)/i, field: 'freq', label: '频次阈值' },
      { re: /(?:表单|字段)[^0-9]{0,5}(\d+)/i, field: 'form_fields', label: '表单字段数' },
      { re: /归因[^0-9]{0,5}(\d+)/i, field: 'attribution', label: '归因窗口' },
      { re: /CPM[^0-9]{0,10}(\d+\.?\d*)/i, field: 'cpm', label: 'CPM阈值' },
    ];
    numPatterns.forEach(p => {
      let m = text.match(p.re);
      if (m) {
        let val = parseFloat(m[1]);
        rules.push({ field: p.field, label: p.label, value: val });
        if (p.field === 'cpl' && val > 0) STORE.baseline.benchmark_cpl = val;
        if (p.field === 'ctr' && val > 0) STORE.baseline.benchmark_ctr = val / 100;
        if (p.field === 'submit_rate' && val > 0) STORE.baseline.benchmark_submit_rate = val / 100;
        if (p.field === 'cpm' && val > 0) STORE.baseline.benchmark_cpm = val;
      }
    });
    let strategies = [];
    let sentPattern = /[^。！？\n]{0,40}(建议|应该|需要|可以|最佳|最好|关键|核心|重要|避免|不要|禁止|必须)[^。！？\n]{0,80}/g;
    (text.match(sentPattern) || []).slice(0, 5).forEach(m => { if (m.trim().length > 8) strategies.push(m.trim()); });
    let title = sourceTitle || text.slice(0, 30).replace(/[\n\r]/g, '') + (text.length > 30 ? '...' : '');
    let entry = { id: 'k_' + Date.now(), title, source: '手动投喂', fed_at: new Date().toISOString(), extracted_rules: rules, strategies, raw_text: text.slice(0, 500) };
    STORE.knowledge.unshift(entry);
    STORE.baseline.updated_at = new Date().toISOString();
    STORE.baseline.source = '投喂：' + title;
    saveStore(STORE);
    return { ok: true, msg: `成功学习！提取${rules.length}条阈值规则和${strategies.length}条策略`, rules, strategies, entry };
  }

  /* ============ 诊断总结 ============ */
  function generateSummary(totals, issues, attr, prediction) {
    let critical = issues.filter(i => i.level === 'critical');
    let warnings = issues.filter(i => i.level === 'warning');
    let infos = issues.filter(i => i.level === 'info');
    let now = new Date();
    let ts = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    let s = `【AI投手诊断报告 · B2B潜客版】${ts}\n━━━━━━━━━━━━━━━━━━━━━━\n📊 账户概览：\n  消耗：${CFG.currency}${totals.totalSpend.toFixed(0)} | 表单：${totals.totalLeads}条 | CPL：${CFG.currency}${totals.avgCpl.toFixed(1)}\n  CTR：${(totals.ctr * 100).toFixed(1)}% | 提交率：${(totals.submitRate * 100).toFixed(1)}% | CPM：${CFG.currency}${totals.avgCpm.toFixed(1)}\n\n`;
    if (attr) {
      let dominantName = { cpm: 'CPM上涨', ctr: 'CTR下滑', submitRate: '提交率下滑' }[attr.dominant];
      s += `🔬 CPL归因分析：\n  CPL较基准${attr.cplChange >= 0 ? '上升' : '下降'}${Math.abs(attr.cplChange * 100).toFixed(0)}%\n  主要因素：${dominantName}（贡献${(attr[attr.dominant].contribution * 100).toFixed(0)}%）\n  CPM贡献${(attr.cpm.contribution * 100).toFixed(0)}% | CTR贡献${(attr.ctr.contribution * 100).toFixed(0)}% | 提交率贡献${(attr.submitRate.contribution * 100).toFixed(0)}%\n\n`;
    }
    if (prediction) {
      s += `📈 全天预测：\n  按当前速度，预计全天消耗${CFG.currency}${prediction.projectedSpend.toFixed(0)}，表单${prediction.projectedLeads.toFixed(0)}条\n  预计全天CPL ${CFG.currency}${prediction.projectedCpl.toFixed(1)}${prediction.willExceed ? `，将超标${prediction.exceedPct.toFixed(0)}%！` : '，在基准内'}\n\n`;
    }
    if (critical.length > 0) { s += `🔴 核心问题（${critical.length}项）：\n`; critical.forEach((i, idx) => { s += `  ${idx + 1}. ${i.desc}\n     → ${i.sug}\n`; }); s += '\n'; }
    if (warnings.length > 0) { s += `🟡 优化建议（${warnings.length}项）：\n`; warnings.forEach((i, idx) => { s += `  ${idx + 1}. ${i.desc}\n     → ${i.sug}\n`; }); s += '\n'; }
    if (infos.length > 0) { s += `🔵 进阶提示（${infos.length}项）：\n`; infos.forEach((i, idx) => { s += `  ${idx + 1}. ${i.desc}\n     → ${i.sug}\n`; }); s += '\n'; }
    s += `📌 优先行动：\n`;
    critical.concat(warnings).slice(0, 3).forEach((i, idx) => { s += `  ${idx + 1}. ${i.sug.split('。')[0]}\n`; });
    s += `\n⚠️ 本报告仅为策略建议，所有优化动作需手动确认后执行。`;
    return s;
  }

  /* ============ 渲染 ============ */
  let currentAds = [], currentResult = null;
  function render() {
    let body = document.getElementById('ap-body');
    if (!currentResult) { body.innerHTML = '<div class="ap-empty">暂无数据，点🔄重新分析</div>'; return; }
    let { totals, issues, attr } = currentResult;
    let BL = STORE.baseline;
    let hist = Object.values(STORE.history);
    let prev = hist.length >= 2 ? hist[hist.length - 2] : null;
    function delta(cur, old) { if (!old || old === 0) return { cls: 'delta-flat', txt: '--' }; let p = ((cur - old) / old) * 100; return { cls: p > 0 ? 'delta-up' : p < 0 ? 'delta-down' : 'delta-flat', txt: (p > 0 ? '↑' : p < 0 ? '↓' : '') + Math.abs(p).toFixed(0) + '%' }; }
    let dSpend = delta(totals.totalSpend, prev?.spend), dLeads = delta(totals.totalLeads, prev?.leads), dCpl = delta(totals.avgCpl, prev?.cpl), dSubmit = delta(totals.submitRate, prev?.submitRate);
    let ctrState = totals.ctr >= BL.benchmark_ctr ? 'good' : totals.ctr >= BL.benchmark_ctr * 0.8 ? 'warn' : 'bad';
    let submitState = totals.submitRate >= BL.benchmark_submit_rate ? 'good' : totals.submitRate >= BL.benchmark_submit_rate * 0.8 ? 'warn' : 'bad';

    let html = '';
    // 账户速览
    html += `<div class="ap-section"><div class="ap-section-title">📊 账户速览</div><div class="ap-cards">
      <div class="ap-card"><div class="label">总消耗</div><div class="value" style="color:#fbbf24">${CFG.currency}${totals.totalSpend.toFixed(0)}</div><div class="delta ${dSpend.cls}">${dSpend.txt}</div></div>
      <div class="ap-card"><div class="label">表单数</div><div class="value" style="color:#4ade80">${totals.totalLeads}</div><div class="delta ${dLeads.cls}">${dLeads.txt}</div></div>
      <div class="ap-card"><div class="label">CPL</div><div class="value" style="color:#22d3ee">${CFG.currency}${totals.avgCpl.toFixed(1)}</div><div class="delta ${dCpl.cls}">${dCpl.txt}</div></div>
      <div class="ap-card"><div class="label">提交率</div><div class="value" style="color:#a78bfa">${(totals.submitRate * 100).toFixed(1)}%</div><div class="delta ${dSubmit.cls}">${dSubmit.txt}</div></div>
    </div></div>`;

    // 全天预测（新增）
    let prediction = predictDay(totals);
    if (prediction) {
      html += `<div class="ap-section"><div class="ap-predict">
        <div class="title">📈 全天预测（已过今日${(prediction.dayProgress * 100).toFixed(0)}%，还剩${prediction.hoursLeft}小时）</div>
        <div class="body">
          按当前速度：预计全天消耗 <b>${CFG.currency}${prediction.projectedSpend.toFixed(0)}</b>，表单 <b>${prediction.projectedLeads.toFixed(0)}</b> 条<br>
          预计全天CPL：<b class="${prediction.willExceed ? 'warn' : 'ok'}">${CFG.currency}${prediction.projectedCpl.toFixed(1)}</b>
          ${prediction.willExceed ? `<span class="warn">⚠️ 将超标${prediction.exceedPct.toFixed(0)}%（基准${CFG.currency}${BL.benchmark_cpl}）</span>` : `<span class="ok">✅ 在基准内</span>`}
          <br><span style="color:#8b95a8;font-size:10px">当前：消耗${CFG.currency}${prediction.currentSpend.toFixed(0)} / 表单${prediction.currentLeads}条 / CPL ${CFG.currency}${prediction.currentCpl.toFixed(1)}</span>
        </div>
      </div></div>`;
    }

    // 漏斗
    html += `<div class="ap-section"><div class="ap-section-title">🔍 漏斗断层诊断 <span class="ap-badge badge-new">核心</span></div>
      <div class="ap-funnel"><div class="ap-funnel-row">
        <div class="ap-funnel-step"><div class="num">${totals.totalImpr.toLocaleString()}</div><div class="label">展示</div></div>
        <div class="ap-funnel-arrow">──▶</div>
        <div class="ap-funnel-step"><div class="num">${totals.totalClicks.toLocaleString()}</div><div class="label">点击</div><div class="rate rate-${ctrState}">CTR ${(totals.ctr * 100).toFixed(1)}%</div></div>
        <div class="ap-funnel-arrow">──▶</div>
        <div class="ap-funnel-step"><div class="num">${totals.totalLeads}</div><div class="label">表单</div><div class="rate rate-${submitState}">提交率 ${(totals.submitRate * 100).toFixed(1)}%</div></div>
      </div>
      <div style="font-size:10px;color:#8b95a8;text-align:center;margin-top:6px">基线：CTR ${(BL.benchmark_ctr * 100).toFixed(1)}% · 提交率 ${(BL.benchmark_submit_rate * 100).toFixed(1)}% · CPL ${CFG.currency}${BL.benchmark_cpl} · 来源：${BL.source || '默认'}</div>
      </div></div>`;

    // CPL归因分解（新增核心）
    if (attr) {
      let domName = { cpm: 'CPM（千次展示成本）', ctr: 'CTR（点击率）', submitRate: '提交率' }[attr.dominant];
      html += `<div class="ap-section"><div class="ap-section-title">🔬 CPL归因分解 <span class="ap-badge badge-new">新增</span></div>
        <div class="ap-attr">
          <div class="ap-attr-title">CPL较基准${attr.cplChange >= 0 ? '上升' : '下降'} ${Math.abs(attr.cplChange * 100).toFixed(0)}% · 主因：${domName}</div>
          <div class="ap-attr-row"><span>CPM变化 ${attr.cpm.change >= 0 ? '+' : ''}${(attr.cpm.change * 100).toFixed(0)}%</span><span>贡献 ${(attr.cpm.contribution * 100).toFixed(0)}%</span></div>
          <div class="ap-attr-bar"><i style="width:${attr.cpm.contribution * 100}%;background:${attr.cpm.change > 0 ? '#f87171' : '#4ade80'}"></i></div>
          <div class="ap-attr-row"><span>CTR变化 ${attr.ctr.change >= 0 ? '+' : ''}${(attr.ctr.change * 100).toFixed(0)}%</span><span>贡献 ${(attr.ctr.contribution * 100).toFixed(0)}%</span></div>
          <div class="ap-attr-bar"><i style="width:${attr.ctr.contribution * 100}%;background:${attr.ctr.change < 0 ? '#f87171' : '#4ade80'}"></i></div>
          <div class="ap-attr-row"><span>提交率变化 ${attr.submitRate.change >= 0 ? '+' : ''}${(attr.submitRate.change * 100).toFixed(0)}%</span><span>贡献 ${(attr.submitRate.contribution * 100).toFixed(0)}%</span></div>
          <div class="ap-attr-bar"><i style="width:${attr.submitRate.contribution * 100}%;background:${attr.submitRate.change < 0 ? '#f87171' : '#4ade80'}"></i></div>
          <div style="font-size:10px;color:#8b95a8;margin-top:6px">公式：CPL = CPM ÷ (CTR × 提交率) × 1000</div>
        </div></div>`;
    }

    // 诊断清单
    let critical = issues.filter(i => i.level === 'critical'), warnings = issues.filter(i => i.level === 'warning'), infos = issues.filter(i => i.level === 'info');
    html += `<div class="ap-section"><div class="ap-section-title">📋 深度诊断清单 <span style="font-size:10px;color:#8b95a8;font-weight:400">${critical.length}严重 · ${warnings.length}警告 · ${infos.length}提示</span></div>`;
    if (issues.length === 0) { html += '<div style="padding:14px;text-align:center;color:#4ade80">✅ 未发现明显问题</div>'; }
    else {
      issues.forEach(i => {
        html += `<div class="ap-issue ${i.level}">
          <div class="head">${i.level === 'critical' ? '🚨' : i.level === 'warning' ? '⚠️' : '💡'} ${i.target || i.layer || '诊断'}</div>
          <div class="desc">${i.desc}</div>
          <div class="sug">→ ${i.sug}</div>
          ${i.src ? `<div class="src">📚 ${i.src}</div>` : ''}
        </div>`;
      });
    }
    html += '</div>';

    // 诊断总结
    let summary = generateSummary(totals, issues, attr, prediction);
    html += `<div class="ap-section"><div class="ap-section-title">📝 诊断总结 <span style="font-size:10px;color:#8b95a8;font-weight:400">含归因+预测</span></div>
      <div class="ap-summary">
        <button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(()=>{this.textContent='✅已复制';setTimeout(()=>this.textContent='📋复制',1500)})">📋 复制</button>
        <textarea readonly id="ap-summary-text">${summary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      </div></div>`;

    // 广告组明细+质量打标
    if (currentAds.length > 0) {
      html += `<div class="ap-section"><div class="ap-section-title">🏷️ 广告组 & 线索质量打标</div><div style="max-height:180px;overflow-y:auto">`;
      currentAds.slice(0, 10).forEach(a => {
        let q = STORE.lead_quality[a.id] || { total: 0, high_quality: 0, low_quality: 0 };
        let hq = q.total > 0 ? (q.high_quality / q.total * 100).toFixed(0) : '--';
        html += `<div style="background:#1a2340;border-radius:5px;padding:7px 10px;margin-bottom:5px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.name}</span>
            <span style="font-size:10px;color:#8b95a8">CPL ${CFG.currency}${(a.cpl || 0).toFixed(0)} · 线索${a.leads} · 优质率 ${hq}%</span>
          </div>
          <div class="ap-quality-row" style="margin-top:4px">
            <span style="font-size:10px;color:#8b95a8">这批线索：</span>
            <button class="ap-btn small" onclick="window.__AI_PITCHER__.markQuality('${a.id}','high')">✅高质量</button>
            <button class="ap-btn small sec" onclick="window.__AI_PITCHER__.markQuality('${a.id}','low')">❌低质量</button>
          </div>
        </div>`;
      });
      html += '</div></div>';
    }

    // 知识投喂
    html += `<div class="ap-section"><div class="ap-section-title">📚 知识投喂区 <span style="font-size:10px;color:#8b95a8;font-weight:400">已学${STORE.knowledge.length}条</span></div>
      <div class="ap-knowledge">
        <input type="text" id="ap-feed-source" placeholder="文章标题/来源（可选）" style="width:100%;background:#0a0e1a;border:1px solid #2d3a52;color:#e8ecf4;padding:6px 8px;border-radius:4px;font-size:11px;margin-bottom:6px">
        <textarea id="ap-feed-input" placeholder="粘贴行业文章/投流策略/豆包建议... 自动提取阈值规则并引用来源"></textarea>
        <div class="ap-btn-row">
          <button class="ap-btn" onclick="window.__AI_PITCHER__.feed()">📤 投喂学习</button>
          <button class="ap-btn sec" onclick="window.__AI_PITCHER__.toggleKB()">📖 已学知识(${STORE.knowledge.length})</button>
        </div>
        <div id="ap-kb-list" style="margin-top:8px;display:none;max-height:150px;overflow-y:auto"></div>
        <div id="ap-feed-result" style="margin-top:8px;font-size:11px"></div>
      </div></div>`;

    // 设置
    html += `<div class="ap-section"><div class="ap-section-title">⚙️ 基线与设置</div>
      <div style="font-size:11px;color:#8b95a8;margin-bottom:6px">当前基线：CTR ${(BL.benchmark_ctr * 100).toFixed(1)}% · 提交率 ${(BL.benchmark_submit_rate * 100).toFixed(1)}% · CPL ${CFG.currency}${BL.benchmark_cpl} · CPM ${CFG.currency}${BL.benchmark_cpm}</div>
      <div class="ap-kb-row">
        <input type="number" id="set-cpl" placeholder="CPL" value="${BL.benchmark_cpl}" style="width:70px">
        <input type="number" id="set-ctr" placeholder="CTR%" value="${(BL.benchmark_ctr * 100).toFixed(1)}" style="width:60px">
        <input type="number" id="set-submit" placeholder="提交率%" value="${(BL.benchmark_submit_rate * 100).toFixed(1)}" style="width:70px">
        <input type="number" id="set-cpm" placeholder="CPM" value="${BL.benchmark_cpm}" style="width:60px">
        <button class="ap-btn small" onclick="window.__AI_PITCHER__.saveBaseline()">保存</button>
      </div>
      <div class="ap-kb-row" style="margin-top:6px">
        <label style="font-size:10px;color:#8b95a8;display:flex;align-items:center;gap:4px"><input type="checkbox" id="set-attribution" ${STORE.settings.attributionWindow > 1 ? 'checked' : ''}> 已设7天归因</label>
        <label style="font-size:10px;color:#8b95a8;display:flex;align-items:center;gap:4px"><input type="checkbox" id="set-offline" ${STORE.settings.offlineConversion ? 'checked' : ''}> 已配离线转化回传</label>
        <button class="ap-btn small sec" onclick="window.__AI_PITCHER__.saveSettings()">保存</button>
      </div></div>`;

    body.innerHTML = html;
    document.getElementById('ap-last-time').textContent = '上次分析: ' + new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    STORE.lastAnalysis = new Date().toISOString(); saveStore(STORE);
  }

  /* ============ 主流程 ============ */
  function runAnalysis() {
    let body = document.getElementById('ap-body');
    body.innerHTML = '<div class="ap-loading">⏳ 正在扫描页面数据并诊断...</div>';
    setTimeout(() => {
      try {
        currentAds = fetchAds();
        if (currentAds.length === 0) {
          body.innerHTML = `<div class="ap-empty"><div style="font-size:32px;margin-bottom:8px">📊</div><div>未检测到广告数据</div><div style="font-size:10px;margin-top:6px;color:#8b95a8;line-height:1.6">请确保：<br>1. 在广告系列/广告组列表页<br>2. 数据表格已加载完成<br>3. 滚动页面后再点🔄</div><div style="margin-top:10px"><button class="ap-btn" onclick="window.__AI_PITCHER__.refresh()">🔄 重新扫描</button></div></div>`;
          return;
        }
        currentResult = diagnose(currentAds);
        render();
      } catch (e) {
        console.error('[AI Pitcher]', e);
        body.innerHTML = '<div class="ap-empty" style="color:#f87171">分析出错：' + e.message + '<br><button class="ap-btn" style="margin-top:10px" onclick="window.__AI_PITCHER__.refresh()">重试</button></div>';
      }
    }, 800);
  }

  /* ============ 全局API ============ */
  window.__AI_PITCHER__ = {
    refresh: runAnalysis,
    feed: function () {
      let text = document.getElementById('ap-feed-input').value;
      let source = document.getElementById('ap-feed-source').value;
      let result = feedKnowledge(text, source);
      let el = document.getElementById('ap-feed-result');
      if (result.ok) {
        el.innerHTML = `<div style="color:#4ade80">✅ ${result.msg}</div>` +
          (result.rules.length > 0 ? '<div style="color:#22d3ee;margin-top:4px">提取阈值：' + result.rules.map(r => r.label + '=' + r.value).join('、') + '</div>' : '') +
          (result.strategies.length > 0 ? '<div style="color:#fbbf24;margin-top:4px">策略：' + result.strategies.slice(0, 2).join('；') + '</div>' : '');
        document.getElementById('ap-feed-input').value = '';
        document.getElementById('ap-feed-source').value = '';
        setTimeout(runAnalysis, 1000);
      } else { el.innerHTML = '<div style="color:#f87171">❌ ' + result.msg + '</div>'; }
    },
    toggleKB: function () {
      let el = document.getElementById('ap-kb-list');
      if (el.style.display === 'none') {
        let html = '';
        STORE.knowledge.slice(0, 10).forEach(k => {
          html += `<div class="ap-kb-item"><div class="k-title">${k.title}</div>${k.extracted_rules && k.extracted_rules.length > 0 ? '<div class="k-rule">规则：' + k.extracted_rules.map(r => r.label + '=' + r.value).join('、') + '</div>' : ''}<div class="k-meta">${k.source} · ${new Date(k.fed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div></div>`;
        });
        if (STORE.knowledge.length === 0) html = '<div style="color:#8b95a8;font-size:11px;padding:8px">还没有学习任何知识</div>';
        el.innerHTML = html; el.style.display = 'block';
      } else { el.style.display = 'none'; }
    },
    markQuality: function (adId, q) {
      if (!STORE.lead_quality[adId]) STORE.lead_quality[adId] = { total: 0, high_quality: 0, low_quality: 0 };
      STORE.lead_quality[adId].total++;
      if (q === 'high') STORE.lead_quality[adId].high_quality++; else STORE.lead_quality[adId].low_quality++;
      saveStore(STORE); render();
    },
    saveBaseline: function () {
      let cpl = parseFloat(document.getElementById('set-cpl').value) || 0;
      let ctr = parseFloat(document.getElementById('set-ctr').value) || 0;
      let submit = parseFloat(document.getElementById('set-submit').value) || 0;
      let cpm = parseFloat(document.getElementById('set-cpm').value) || 0;
      if (cpl > 0) STORE.baseline.benchmark_cpl = cpl;
      if (ctr > 0) STORE.baseline.benchmark_ctr = ctr / 100;
      if (submit > 0) STORE.baseline.benchmark_submit_rate = submit / 100;
      if (cpm > 0) STORE.baseline.benchmark_cpm = cpm;
      STORE.baseline.updated_at = new Date().toISOString(); STORE.baseline.source = '手动设置';
      saveStore(STORE); alert('基线已保存！'); runAnalysis();
    },
    saveSettings: function () {
      STORE.settings.attributionWindow = document.getElementById('set-attribution').checked ? 7 : 1;
      STORE.settings.offlineConversion = document.getElementById('set-offline').checked;
      saveStore(STORE); alert('设置已保存！'); runAnalysis();
    }
  };

  runAnalysis();
  if (CFG.autoRefresh > 0) setInterval(() => { if (!collapsed) runAnalysis(); }, CFG.autoRefresh);
})();
