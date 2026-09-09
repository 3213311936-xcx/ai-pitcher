/* ============================================================
   AI Pitcher · 潜客策略顾问（B2B工程机械版）v3.0
   新增：悬浮按钮 / 编辑页智能建议 / 产品识别 / AI对话 / 工程机械知识库
   纯建议型，绝不自动操作广告
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
    version: '3.0.0',
    panel: { width: 480 },
    baseline: { benchmark_ctr: 0.025, benchmark_submit_rate: 0.038, benchmark_cpl: 200, benchmark_cpm: 45, source: '默认基线' },
    thresholds: { freq_warn: 3.0, cpl_anomaly_ratio: 1.5, cpm_spike_ratio: 1.1 },
    currency: '$',
    autoRefresh: 30000
  }, window.__AI_PITCHER_CONFIG__ || {});

  /* ============ 存储 ============ */
  let STORE_KEY = 'ai_pitcher_leadgen_v30';
  function loadStore() {
    try {
      let d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return Object.assign({ baseline: CFG.baseline, knowledge: [], history: {}, lead_quality: {}, lastAnalysis: null, chatHistory: [], settings: { attributionWindow: 1, offlineConversion: false } }, d);
    } catch (e) { return { baseline: CFG.baseline, knowledge: [], history: {}, lead_quality: {}, lastAnalysis: null, chatHistory: [], settings: { attributionWindow: 1, offlineConversion: false } }; }
  }
  function saveStore(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { } }
  let STORE = loadStore();

  /* ============ 工程机械知识库 ============ */
  const PRODUCT_DB = {
    '叉车': {
      keywords: ['叉车', 'forklift', '堆高', '搬运车'],
      audience: '仓储物流、制造业工厂、港口码头、电商仓库、第三方物流',
      interests: ['叉车', '仓储管理', '供应链管理', '物流', '制造业', '工厂', '仓库', '工业工程', '货物搬运', '物流运输'],
      ageAdvice: '25-55岁，核心决策人30-50岁',
      regions: ['墨西哥', '巴西', '智利', '秘鲁', '哥伦比亚', '阿根廷'],
      painPoints: ['载重能力', '升高高度', '电动/柴油', '售后服务', '配件供应'],
      cplTarget: 150
    },
    '大挖': {
      keywords: ['大挖', '挖掘机', '挖机', 'excavator', '大挖机'],
      audience: '矿山开采、大型基建、市政工程、房地产开发、水利工程',
      interests: ['挖掘机', '矿山', '建筑工程', '重型设备', '工程机械', '基础设施', '采矿', '土木工程', '建筑施工'],
      ageAdvice: '30-55岁，工程老板和采购负责人',
      regions: ['巴西', '智利', '秘鲁', '墨西哥', '哥伦比亚', '阿根廷'],
      painPoints: ['斗容', '挖掘深度', '发动机功率', '油耗', '耐用性'],
      cplTarget: 300
    },
    '两头忙': {
      keywords: ['两头忙', '挖掘装载机', 'backhoe', 'backhoe loader'],
      audience: '小型工程队、市政维护、农场、园林、电信施工',
      interests: ['挖掘装载机', '工程机械', '建筑施工', '市政工程', '农业机械', '园林', '小型工程', '道路维护'],
      ageAdvice: '28-55岁，个体工程老板和承包商',
      regions: ['墨西哥', '哥伦比亚', '秘鲁', '智利', '厄瓜多尔', '玻利维亚'],
      painPoints: ['一机多用', '灵活性', '维护成本', '配件通用性'],
      cplTarget: 200
    },
    '蜘蛛吊': {
      keywords: ['蜘蛛吊', '蜘蛛吊车', 'spider crane', '履带吊', '微型起重机'],
      audience: '玻璃幕墙安装、室内装修、设备搬运、狭窄空间施工、园林移栽',
      interests: ['起重机', '吊装', '幕墙', '玻璃安装', '室内装修', '设备搬运', '建筑施工', '重型设备'],
      ageAdvice: '30-55岁，吊装公司老板和工程承包商',
      regions: ['智利', '阿根廷', '巴西', '墨西哥', '秘鲁', '哥伦比亚'],
      painPoints: ['起重量', '工作半径', '通过性', '遥控操作', '安全性'],
      cplTarget: 250
    }
  };

  const B2B_KNOWLEDGE = [
    { id: 'k001', title: 'B2B表单字段不超过3个', rule: '表单字段≤3个（姓名+手机/WhatsApp+需求）', apply: 'submit_rate', weight: 1.0, source: 'B2B获客最佳实践' },
    { id: 'k002', title: '拉美地区WhatsApp转化率高于表单', rule: '拉美市场优先用WhatsApp联系按钮，表单作为辅助', apply: 'lead_quality', weight: 0.9, source: '拉美外贸经验' },
    { id: 'k003', title: '工程机械决策周期长，需7天归因', rule: '归因窗口设为7天点击，不要用1天', apply: 'attribution', weight: 1.0, source: 'B2B行业特性' },
    { id: 'k004', title: '受众规模500-1000万最佳', rule: '受众规模控制在500万-1000万，太宽浪费预算，太窄跑不出量', apply: 'audience_size', weight: 0.8, source: '投放经验' },
    { id: 'k005', title: '年龄25-55岁覆盖决策层', rule: 'B2B工程机械年龄设25-55岁，核心30-50', apply: 'age', weight: 0.7, source: '行业画像' },
    { id: 'k006', title: '西班牙语广告用西语素材', rule: '拉美西语国家必须用西班牙语素材和落地页', apply: 'creative', weight: 1.0, source: '本地化原则' },
    { id: 'k007', title: '离线转化必须回传', rule: '电话/WhatsApp成交的线索要手动回传Meta，否则算法会停推', apply: 'offline_conversion', weight: 1.0, source: '算法优化' },
    { id: 'k008', title: 'CPL超过300元需优化', rule: '单条线索成本超过300元，检查受众和素材', apply: 'cpl', weight: 0.8, source: '行业基准' }
  ];

  /* ============ 样式 ============ */
  let CSS = `
  #ai-pitcher-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none;box-shadow:0 4px 20px rgba(251,191,36,.5);cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#1a1a2e;transition:transform .2s}
  #ai-pitcher-fab:hover{transform:scale(1.1)}
  #ai-pitcher-fab .badge{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#ef4444;border-radius:50%;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:700}
  #ai-pitcher-panel{position:fixed;top:60px;right:14px;width:${CFG.panel.width}px;max-height:88vh;background:#141b2d;border:1px solid #2d3a52;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.7);z-index:2147483647;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#e8ecf4;overflow:hidden;display:flex;flex-direction:column}
  #ai-pitcher-panel.hidden{display:none}
  #ap-header{background:linear-gradient(180deg,#1a2340,#141b2d);padding:12px 16px;border-bottom:2px solid #fbbf24;display:flex;justify-content:space-between;align-items:center}
  #ap-header .title{font-weight:800;color:#fbbf24;font-size:15px}
  #ap-header .subtitle{font-size:10px;color:#8b95a8;margin-top:2px}
  #ap-header .ctrls{display:flex;gap:6px}
  #ap-header .ctrl-btn{background:#222d4a;border:none;color:#8b95a8;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center}
  #ap-header .ctrl-btn:hover{color:#fbbf24;background:#2d3a52}
  #ap-tabs{display:flex;background:#1a2340;border-bottom:1px solid #2d3a52}
  .ap-tab{flex:1;padding:10px 8px;text-align:center;cursor:pointer;font-size:12px;font-weight:600;color:#8b95a8;border-bottom:2px solid transparent;transition:all .2s}
  .ap-tab.active{color:#fbbf24;border-bottom-color:#fbbf24;background:rgba(251,191,36,.05)}
  .ap-tab:hover{color:#e8ecf4}
  #ap-body{padding:14px;overflow-y:auto;flex:1}
  #ap-body::-webkit-scrollbar{width:6px}
  #ap-body::-webkit-scrollbar-thumb{background:#2d3a52;border-radius:3px}
  .ap-section{margin-bottom:16px}
  .ap-section-title{font-size:13px;font-weight:700;color:#e8ecf4;margin-bottom:8px;display:flex;align-items:center;gap:6px}
  .ap-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .ap-card{background:#1a2340;border-radius:8px;padding:10px 12px;border:1px solid #2d3a52}
  .ap-card .label{font-size:10px;color:#8b95a8;margin-bottom:3px}
  .ap-card .value{font-size:20px;font-weight:800}
  .ap-card .delta{font-size:10px;margin-top:2px}
  .delta-up{color:#4ade80}.delta-down{color:#f87171}.delta-flat{color:#8b95a8}
  .ap-funnel{background:#1a2340;border-radius:8px;padding:14px;border:1px solid #2d3a52}
  .ap-funnel-steps{display:flex;align-items:center;justify-content:space-between}
  .ap-funnel-step{text-align:center;flex:1}
  .ap-funnel-step .num{font-size:18px;font-weight:800;color:#e8ecf4}
  .ap-funnel-step .label{font-size:10px;color:#8b95a8;margin-top:2px}
  .ap-funnel-step .rate{font-size:11px;font-weight:600;margin-top:3px;padding:2px 6px;border-radius:3px;display:inline-block}
  .rate-good{background:rgba(74,222,128,.15);color:#4ade80}
  .rate-warn{background:rgba(251,191,36,.15);color:#fbbf24}
  .rate-bad{background:rgba(248,113,113,.15);color:#f87171}
  .ap-funnel-arrow{color:#2d3a52;font-size:18px;font-weight:800;padding:0 4px}
  .ap-issue{background:#1a2340;border-radius:6px;padding:10px 12px;margin-bottom:6px;border-left:3px solid #fbbf24}
  .ap-issue.critical{border-left-color:#f87171}
  .ap-issue.good{border-left-color:#4ade80}
  .ap-issue .issue-title{font-weight:700;font-size:12px;margin-bottom:4px}
  .ap-issue .issue-desc{font-size:11px;color:#8b95a8;margin-bottom:4px}
  .ap-issue .issue-suggestion{font-size:11px;color:#4ade80;background:rgba(74,222,128,.08);padding:6px 8px;border-radius:4px;margin-top:4px}
  .ap-attribution{background:#1a2340;border-radius:8px;padding:12px;border:1px solid #2d3a52;margin-bottom:8px}
  .ap-attr-bar{height:8px;background:#2d3a52;border-radius:4px;overflow:hidden;margin:6px 0}
  .ap-attr-fill{height:100%;border-radius:4px;transition:width .5s}
  .ap-summary-box{background:#1a2340;border:1px solid #2d3a52;border-radius:8px;padding:12px;font-size:12px;line-height:1.7;white-space:pre-wrap}
  .ap-btn{background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none;color:#1a1a2e;padding:8px 16px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;transition:opacity .2s}
  .ap-btn:hover{opacity:.9}
  .ap-btn-secondary{background:#222d4a;color:#e8ecf4}
  .ap-input{width:100%;background:#0f1626;border:1px solid #2d3a52;border-radius:6px;padding:8px 10px;color:#e8ecf4;font-size:12px;box-sizing:border-box;outline:none}
  .ap-input:focus{border-color:#fbbf24}
  .ap-textarea{width:100%;background:#0f1626;border:1px solid #2d3a52;border-radius:6px;padding:8px 10px;color:#e8ecf4;font-size:12px;box-sizing:border-box;outline:none;resize:vertical;min-height:60px;font-family:inherit}
  .ap-textarea:focus{border-color:#fbbf24}
  .ap-knowledge-item{background:#1a2340;border-radius:6px;padding:8px 10px;margin-bottom:4px;font-size:11px;border-left:3px solid #4ade80}
  .ap-knowledge-item .k-title{font-weight:600;color:#e8ecf4}
  .ap-knowledge-item .k-rule{color:#4ade80;margin-top:2px}
  .ap-knowledge-item .k-source{color:#8b95a8;font-size:10px;margin-top:2px}
  .ap-chat-box{display:flex;flex-direction:column;height:100%}
  .ap-chat-messages{flex:1;overflow-y:auto;padding:8px 0}
  .ap-chat-msg{margin-bottom:10px;max-width:85%}
  .ap-chat-msg.user{align-self:flex-end;margin-left:auto}
  .ap-chat-msg .bubble{padding:8px 12px;border-radius:10px;font-size:12px;line-height:1.6}
  .ap-chat-msg.user .bubble{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1a1a2e;border-bottom-right-radius:2px}
  .ap-chat-msg.ai .bubble{background:#1a2340;color:#e8ecf4;border:1px solid #2d3a52;border-bottom-left-radius:2px}
  .ap-chat-input{display:flex;gap:6px;margin-top:8px}
  .ap-quick-q{display:inline-block;background:#222d4a;color:#8b95a8;border:1px solid #2d3a52;border-radius:12px;padding:4px 10px;font-size:10px;cursor:pointer;margin:2px 4px 2px 0;transition:all .2s}
  .ap-quick-q:hover{color:#fbbf24;border-color:#fbbf24}
  .ap-product-tag{display:inline-block;background:rgba(251,191,36,.15);color:#fbbf24;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin-right:4px}
  .ap-advice-card{background:#1a2340;border-radius:8px;padding:12px;border:1px solid #2d3a52;margin-bottom:8px}
  .ap-advice-card .adv-title{font-weight:700;color:#fbbf24;font-size:12px;margin-bottom:6px;display:flex;align-items:center;gap:6px}
  .ap-advice-card .adv-content{font-size:11px;color:#e8ecf4;line-height:1.7}
  .ap-advice-card .adv-content ul{margin:4px 0;padding-left:16px}
  .ap-advice-card .adv-content li{margin-bottom:2px}
  .ap-footer{padding:8px 14px;background:#0f1626;border-top:1px solid #2d3a52;display:flex;justify-content:space-between;font-size:10px;color:#8b95a8}
  .ap-loading{text-align:center;padding:40px 20px;color:#8b95a8}
  .ap-pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
  .pill-good{background:rgba(74,222,128,.15);color:#4ade80}
  .pill-warn{background:rgba(251,191,36,.15);color:#fbbf24}
  .pill-bad{background:rgba(248,113,113,.15);color:#f87171}
  `;
  let styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ============ 悬浮按钮 ============ */
  let fab = document.createElement('button');
  fab.id = 'ai-pitcher-fab';
  fab.innerHTML = '🎯<span class="badge" id="ap-fab-badge" style="display:none">1</span>';
  fab.title = 'AI投手 · 点击展开/收起';
  document.body.appendChild(fab);

  /* ============ 面板 ============ */
  let panel = document.createElement('div');
  panel.id = 'ai-pitcher-panel';
  panel.innerHTML = `
    <div id="ap-header">
      <div><div class="title">🎯 AI投手 · 潜客策略顾问</div><div class="subtitle" id="ap-last-time">v3.0 · 工程机械B2B版</div></div>
      <div class="ctrls">
        <button class="ctrl-btn" id="ap-refresh" title="重新分析">🔄</button>
        <button class="ctrl-btn" id="ap-minimize" title="最小化">➖</button>
      </div>
    </div>
    <div id="ap-tabs">
      <div class="ap-tab active" data-tab="analysis">📊 分析诊断</div>
      <div class="ap-tab" data-tab="advice">💡 智能建议</div>
      <div class="ap-tab" data-tab="chat">🤖 AI对话</div>
      <div class="ap-tab" data-tab="knowledge">📚 知识库</div>
    </div>
    <div id="ap-body"><div class="ap-loading">⏳ 正在扫描页面数据并诊断...</div></div>
    <div class="ap-footer"><span>数据来源: Meta Ads Manager</span><span style="color:#4ade80">⚠️ 仅分析建议，不执行修改</span></div>
  `;
  document.body.appendChild(panel);

  let currentTab = 'analysis';
  let panelVisible = true;

  function togglePanel() {
    panelVisible = !panelVisible;
    panel.classList.toggle('hidden', !panelVisible);
    fab.innerHTML = panelVisible ? '🎯' : '📊';
  }
  fab.onclick = togglePanel;
  document.getElementById('ap-minimize').onclick = (e) => { e.stopPropagation(); togglePanel(); };
  document.getElementById('ap-refresh').onclick = (e) => { e.stopPropagation(); runAll(); };

  document.querySelectorAll('.ap-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.ap-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      renderTab();
    };
  });

  /* ============ 产品识别 ============ */
  function detectProduct() {
    let text = (document.body?.innerText || '') + ' ' + location.href;
    let breadcrumb = '';
    document.querySelectorAll('[aria-label="面包屑"], nav, .x193iq5w').forEach(el => { breadcrumb += (el.innerText || '') + ' '; });
    text += ' ' + breadcrumb;
    for (let [name, data] of Object.entries(PRODUCT_DB)) {
      for (let kw of data.keywords) {
        if (text.toLowerCase().includes(kw.toLowerCase())) return { name, data };
      }
    }
    return null;
  }

  /* ============ 页面模式识别 ============ */
  function detectPageMode() {
    let url = location.href.toLowerCase();
    let bodyText = document.body?.innerText || '';
    if (/edit/i.test(url) || /编辑/i.test(bodyText.slice(0, 2000)) || /保存受众/i.test(bodyText) || /发布/i.test(bodyText.slice(0, 3000))) {
      if (/受众|年龄|性别|定位|audience|age|gender/i.test(bodyText)) return 'edit_audience';
      return 'edit';
    }
    if (/campaign/i.test(url) || /广告系列/i.test(bodyText.slice(0, 1000))) return 'list_campaign';
    return 'list';
  }

  /* ============ 数据抓取 ============ */
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
      if (cpm === 0 && impressions > 0) cpm = spend / impressions * 1000;
      ads.push({ name, leads, cpl, spend, budget, impressions, reach, freq, clicks, cpm });
    });
    return ads;
  }

  /* ============ 编辑页数据抓取 ============ */
  function fetchEditData() {
    let bodyText = document.body?.innerText || '';
    let data = { age: '', gender: '', regions: [], interests: [], audienceSize: '', exclusions: [], product: null };
    let ageMatch = bodyText.match(/(\d+)\s*[-–]\s*(\d+\+?)/);
    if (ageMatch) data.age = ageMatch[0];
    if (/所有性别|all genders/i.test(bodyText)) data.gender = '所有性别';
    else if (/男性|male/i.test(bodyText)) data.gender = '男性';
    else if (/女性|female/i.test(bodyText)) data.gender = '女性';
    let sizeMatch = bodyText.match(/([\d,]+)\s*[-–]\s*([\d,]+)\s*(?:人|用户)?/);
    if (sizeMatch) data.audienceSize = sizeMatch[0];
    let interestSection = bodyText.match(/细分定位[\s\S]{0,500}/);
    if (interestSection) {
      let interests = interestSection[0].match(/[\u4e00-\u9fa5A-Za-z]+(?:\s*[（(][^）)]*[）)])?/g);
      if (interests) data.interests = interests.filter(i => i.length > 1 && i.length < 30).slice(0, 20);
    }
    let excludeSection = bodyText.match(/排除[:：][\s\S]{0,300}/);
    if (excludeSection) {
      let countries = excludeSection[0].match(/[\u4e00-\u9fa5]{2,}(?=[,，、])/g);
      if (countries) data.exclusions = countries;
    }
    data.product = detectProduct();
    return data;
  }

  /* ============ 诊断 ============ */
  function diagnose(ads) {
    let issues = [];
    if (ads.length === 0) {
      issues.push({ level: 'info', title: '未检测到广告数据', desc: '请确保在广告组/广告系列列表页面，且数据已加载完成', suggestion: '刷新页面或切换到广告组标签页' });
      return issues;
    }
    let totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    let totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    let totalImpr = ads.reduce((s, a) => s + a.impressions, 0);
    let totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    let avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    let avgCtr = totalImpr > 0 ? totalClicks / totalImpr : 0;
    let avgSubmit = totalClicks > 0 ? totalLeads / totalClicks : 0;
    let avgCpm = totalImpr > 0 ? totalSpend / totalImpr * 1000 : 0;
    let BL = STORE.baseline;

    if (avgCtr < BL.benchmark_ctr * 0.8) {
      issues.push({ level: 'critical', title: '点击率严重偏低', desc: `CTR为${(avgCtr*100).toFixed(2)}%，低于行业基准${(BL.benchmark_ctr*100).toFixed(1)}%`, suggestion: '测试A(痛点型)/B(利益型)/C(案例型)三类标题，每类2版共6组素材，观察2天，CTR回升至2%以上达标' });
    } else if (avgCtr < BL.benchmark_ctr) {
      issues.push({ level: 'warning', title: '点击率偏低', desc: `CTR为${(avgCtr*100).toFixed(2)}%，略低于基准${(BL.benchmark_ctr*100).toFixed(1)}%`, suggestion: '优化主图和标题，突出产品核心卖点，测试2-3版素材' });
    } else {
      issues.push({ level: 'good', title: '点击率正常', desc: `CTR为${(avgCtr*100).toFixed(2)}%，高于基准${(BL.benchmark_ctr*100).toFixed(1)}%`, suggestion: '保持当前素材方向，持续监控疲劳度' });
    }

    if (avgSubmit < BL.benchmark_submit_rate * 0.8) {
      issues.push({ level: 'critical', title: '表单提交率严重偏低', desc: `提交率为${(avgSubmit*100).toFixed(2)}%，低于基准${(BL.benchmark_submit_rate*100).toFixed(1)}%`, suggestion: '表单字段减至3个(姓名+WhatsApp+需求)，按钮改红色+文案"立即获取报价"，落地页加载速度优化至3秒内，观察3天' });
    } else if (avgSubmit < BL.benchmark_submit_rate) {
      issues.push({ level: 'warning', title: '表单提交率偏低', desc: `提交率为${(avgSubmit*100).toFixed(2)}%，略低于基准${(BL.benchmark_submit_rate*100).toFixed(1)}%`, suggestion: '检查表单字段数量和落地页加载速度' });
    }

    if (avgCpl > BL.benchmark_cpl * 1.5) {
      issues.push({ level: 'critical', title: 'CPL严重超标', desc: `平均CPL为$${avgCpl.toFixed(2)}，超过基准$${BL.benchmark_cpl}的50%`, suggestion: '立即暂停CPL最高的2个广告组，将预算转移给CPL最低的高效组，预计2天内CPL回落' });
    } else if (avgCpl > BL.benchmark_cpl) {
      issues.push({ level: 'warning', title: 'CPL偏高', desc: `平均CPL为$${avgCpl.toFixed(2)}，高于基准$${BL.benchmark_cpl}`, suggestion: '优化低效广告组，逐步转移预算' });
    }

    ads.forEach(ad => {
      if (ad.leads >= 3 && ad.cpl > avgCpl * 1.5 && ad.cpl > 0) {
        issues.push({ level: 'warning', title: `广告组"${ad.name}"CPL超标`, desc: `CPL为$${ad.cpl.toFixed(2)}，是账户平均的${(ad.cpl/avgCpl).toFixed(1)}倍`, suggestion: `建议暂停该组，将$${ad.budget.toFixed(0)}预算转移给高效组` });
      }
      if (ad.freq > 3.0 && ad.impressions > 1000) {
        issues.push({ level: 'warning', title: `广告组"${ad.name}"频次过高`, desc: `频次达${ad.freq.toFixed(1)}，受众可能已疲劳`, suggestion: '准备新素材替换，或扩大受众范围降低频次' });
      }
      if (ad.spend > 50 && ad.leads === 0) {
        issues.push({ level: 'critical', title: `广告组"${ad.name}"只花钱无转化`, desc: `已花费$${ad.spend.toFixed(2)}，0条线索`, suggestion: '立即暂停检查，可能是落地页或定向有严重问题' });
      }
    });

    if (!STORE.settings.offlineConversion) {
      issues.push({ level: 'info', title: '⚠️ 未开启离线转化回传', desc: 'B2B工程机械很多线索通过电话/WhatsApp成交，不回传会导致算法误判无转化而停推', suggestion: '在Meta事件管理工具中设置离线转化，每周回传成交线索' });
    }
    if (STORE.settings.attributionWindow <= 1) {
      issues.push({ level: 'info', title: '⚠️ 归因窗口过短', desc: `当前为${STORE.settings.attributionWindow}天点击归因，工程机械决策周期长，会严重低估广告效果`, suggestion: '建议设置为7天点击归因' });
    }
    return issues;
  }

  /* ============ CPL归因分解 ============ */
  function cplAttribution(ads) {
    if (ads.length < 2) return null;
    let totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    let totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    let totalImpr = ads.reduce((s, a) => s + a.impressions, 0);
    let totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    if (totalImpr === 0 || totalClicks === 0 || totalLeads === 0) return null;
    let cpm = totalSpend / totalImpr * 1000;
    let ctr = totalClicks / totalImpr;
    let submit = totalLeads / totalClicks;
    let cpl = totalSpend / totalLeads;
    let BL = STORE.baseline;
    let cplRatio = cpl / BL.benchmark_cpl;
    let logCpm = Math.log(cpm / BL.benchmark_cpm);
    let logCtr = -Math.log(ctr / BL.benchmark_ctr);
    let logSubmit = -Math.log(submit / BL.benchmark_submit_rate);
    let totalLog = logCpm + logCtr + logSubmit;
    if (totalLog === 0) return null;
    return {
      cpl, cpm, ctr, submit, cplRatio,
      cpmContrib: (logCpm / totalLog * 100),
      ctrContrib: (logCtr / totalLog * 100),
      submitContrib: (logSubmit / totalLog * 100),
      mainFactor: logCpm > logCtr && logCpm > logSubmit ? 'CPM上涨' : (logCtr > logSubmit ? 'CTR下滑' : '提交率下滑')
    };
  }

  /* ============ 全天预测 ============ */
  function predictDay(ads) {
    let now = new Date();
    let hour = now.getHours();
    let dayProgress = Math.min(Math.max((hour - 6) / 18, 0.05), 1);
    let totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    let totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    let predSpend = totalSpend / dayProgress;
    let predLeads = totalLeads / dayProgress;
    let predCpl = predLeads > 0 ? predSpend / predLeads : 0;
    let BL = STORE.baseline;
    return { dayProgress, predSpend, predLeads, predCpl, willExceed: predCpl > BL.benchmark_cpl, exceedRatio: predCpl / BL.benchmark_cpl };
  }

  /* ============ 编辑页智能建议 ============ */
  function generateEditAdvice(editData) {
    let advice = [];
    let product = editData.product;

    if (product) {
      advice.push({
        title: `🎯 识别到产品：${product.name}`,
        content: `
          <p><b>目标客户：</b>${product.data.audience}</p>
          <p><b>建议年龄：</b>${product.data.ageAdvice}</p>
          <p><b>建议兴趣定位：</b></p>
          <ul>${product.data.interests.map(i => `<li>${i}</li>`).join('')}</ul>
          <p><b>重点投放国家：</b>${product.data.regions.join('、')}</p>
          <p><b>目标CPL：</b>$${product.data.cplTarget}</p>
        `
      });
    } else {
      advice.push({
        title: '📌 未识别到具体产品',
        content: '<p>建议在广告组名称中包含产品关键词（叉车/大挖/两头忙/蜘蛛吊），系统会给出更精准的建议。</p>'
      });
    }

    if (editData.age) {
      advice.push({
        title: '👤 年龄设置建议',
        content: `<p>当前：<b>${editData.age}</b></p>
          <p>B2B工程机械决策人集中在30-55岁：</p>
          <ul>
            <li>25岁以下多为操作人员，无采购决策权</li>
            <li>30-50岁是核心采购决策层</li>
            <li>55岁以上接近退休，决策周期长</li>
          </ul>
          <p><b>建议：</b>改为 <span class="ap-pill pill-good">30-55岁</span>，可提高有效询盘比例</p>`
      });
    }

    if (editData.gender) {
      advice.push({
        title: '⚧ 性别设置建议',
        content: `<p>当前：<b>${editData.gender}</b></p>
          <p>工程机械行业男性占比约85%，但女性采购经理也不少见：</p>
          <ul>
            <li>不建议直接排除女性，会损失约15%潜在客户</li>
            <li>可保持"所有性别"，让算法自动优化</li>
            <li>如果预算有限，可先投男性，积累数据后再扩展</li>
          </ul>`
      });
    }

    if (editData.audienceSize) {
      let sizeNum = parseInt(editData.audienceSize.replace(/,/g, ''));
      advice.push({
        title: '📊 受众规模分析',
        content: `<p>当前预估规模：<b>${editData.audienceSize}</b></p>
          ${sizeNum > 20000000 ? '<p><span class="ap-pill pill-bad">受众过宽</span> 超过2000万，预算会被大量浪费在非目标用户上</p><p><b>建议：</b>增加兴趣定位缩小到500-1000万</p>' : 
            sizeNum < 1000000 ? '<p><span class="ap-pill pill-warn">受众过窄</span> 低于100万，可能跑不出量</p><p><b>建议：</b>减少限制条件或开启类似受众</p>' :
            '<p><span class="ap-pill pill-good">规模合理</span> 在500-1000万最佳区间</p>'}`
      });
    }

    if (editData.interests && editData.interests.length > 0) {
      advice.push({
        title: '🎯 兴趣定位分析',
        content: `<p>当前已选兴趣（${editData.interests.length}个）：</p>
          <p>${editData.interests.map(i => `<span class="ap-product-tag">${i}</span>`).join('')}</p>
          <p style="margin-top:8px"><b>优化建议：</b></p>
          <ul>
            <li>兴趣数量控制在5-15个，太多会导致受众重叠</li>
            <li>优先选择行业相关度高的词，避免太泛的词</li>
            <li>建议开启"详细定位扩展"，让算法探索类似用户</li>
          </ul>`
      });
    }

    if (editData.exclusions && editData.exclusions.length > 0) {
      advice.push({
        title: '🌍 排除地区分析',
        content: `<p>已排除 ${editData.exclusions.length} 个国家/地区</p>
          <p>拉美工程机械重点市场：墨西哥、巴西、智利、秘鲁、哥伦比亚</p>
          <p><b>注意：</b>排除过多国家会缩小市场规模，建议保留主要经济体</p>`
      });
    }

    advice.push({
      title: '💡 B2B询盘专属优化建议',
      content: `<ul>
        <li><b>落地页：</b>必须有WhatsApp联系按钮，拉美用户习惯即时沟通</li>
        <li><b>表单：</b>不超过3个字段（姓名+WhatsApp+需求描述）</li>
        <li><b>语言：</b>西语国家必须用西班牙语素材和落地页</li>
        <li><b>归因：</b>设置7天点击归因，B2B决策周期长</li>
        <li><b>离线转化：</b>电话/WhatsApp成交的线索要回传Meta</li>
        <li><b>素材：</b>突出产品参数、施工案例、售后保障</li>
      </ul>`
    });

    return advice;
  }

  /* ============ AI对话 ============ */
  function aiChat(question) {
    let q = question.toLowerCase();
    let product = detectProduct();
    let productName = product ? product.name : '工程机械';
    let answers = [];

    if (/询盘|线索|lead|客户/i.test(q)) {
      answers.push(`【提高${productName}询盘量的5个方法】\n\n1. **优化落地页表单**：字段减至3个（姓名+WhatsApp+需求），按钮用红色+文案"立即获取报价"\n2. **加WhatsApp按钮**：拉美用户习惯即时沟通，表单+WhatsApp双渠道可提升40%询盘\n3. **精准受众**：年龄30-55岁，兴趣选行业相关词，规模控制在500-1000万\n4. **素材测试**：准备痛点型/利益型/案例型3类素材，每类2版，每周轮换\n5. **及时跟进**：询盘后5分钟内联系转化率最高，超过1小时下降80%`);
    } else if (/受众|定向|audience|年龄/i.test(q)) {
      answers.push(`【${productName}受众设置建议】\n\n**年龄**：30-55岁（核心决策层）\n**性别**：所有性别（不排除女性，约占15%）\n**地区**：拉美重点市场 - 墨西哥、巴西、智利、秘鲁、哥伦比亚\n**兴趣定位**：\n${product ? product.data.interests.map((i, idx) => `${idx+1}. ${i}`).join('\n') : '行业相关词5-15个'}\n**受众规模**：500-1000万最佳\n**建议开启**：详细定位扩展`);
    } else if (/预算|出价|budget|bid/i.test(q)) {
      answers.push(`【预算分配建议】\n\n1. **新广告组**：每日预算$20-50，用最低成本出价，让算法学习\n2. **学习期**：至少积累50条转化再调整，不要频繁改预算\n3. **成熟组**：CPL低于目标的组，每次加预算不超过20%\n4. **低效组**：CPL超过目标1.5倍，连续3天无改善就暂停\n5. **测试预算**：保留10-20%预算用于新素材测试`);
    } else if (/素材|创意|creative|图片|视频/i.test(q)) {
      answers.push(`【${productName}素材方向】\n\n**痛点型**："还在为搬运效率低发愁？" - 直击客户痛点\n**利益型**："3吨叉车，日省人工$200" - 突出ROI\n**案例型**："墨西哥某物流园采购10台使用反馈" - 建立信任\n**参数型**：清晰展示载重、升高、动力等核心参数\n**施工视频**：15-30秒实际作业视频，比图片点击率高30%\n\n注意：西语市场必须用西班牙语文案！`);
    } else if (/cpl|成本|花费|消耗/i.test(q)) {
      answers.push(`【CPL优化思路】\n\n当前基准CPL：$${STORE.baseline.benchmark_cpl}\n\n如果CPL偏高，按这个顺序排查：\n1. **CTR低？** → 素材问题，换主图和标题\n2. **CTR正常但提交率低？** → 落地页问题，优化表单和加载速度\n3. **都正常但CPM高？** → 竞争激烈，尝试新受众或错开高峰\n4. **频次>3？** → 受众疲劳，换新素材或扩大受众\n\n目标：${product ? '$' + product.data.cplTarget : '$200'}以内`);
    } else if (/归因|attribution|转化/i.test(q)) {
      answers.push(`【B2B归因设置要点】\n\n1. **归因窗口**：设为7天点击（不要用1天！工程机械决策周期长）\n2. **离线转化**：电话/WhatsApp成交的线索必须回传Meta，否则算法会认为没转化而停推\n3. **转化事件**：设置"表单提交"和"WhatsApp点击"两个事件\n4. **转化API**：如果有技术能力，接入Conversions API提高数据准确性`);
    } else if (/拉美|墨西哥|巴西|国家|地区/i.test(q)) {
      answers.push(`【拉美工程机械市场分析】\n\n**重点市场**：\n- 墨西哥：制造业和物流发达，叉车需求大\n- 巴西：南美最大经济体，基建和矿山需求旺盛\n- 智利：矿业发达，大挖和重型设备需求高\n- 秘鲁：矿业和基建增长快\n- 哥伦比亚：经济稳定，两头忙和小型设备需求大\n\n**注意**：巴西用葡萄牙语，其他国家用西班牙语！`);
    } else if (/whatsapp|电话|联系|跟进/i.test(q)) {
      answers.push(`【询盘跟进最佳实践】\n\n1. **响应速度**：5分钟内联系转化率最高，超过1小时下降80%\n2. **沟通方式**：拉美客户偏好WhatsApp，少用邮件\n3. **首次回复**：用西班牙语，热情专业，附上产品目录\n4. **跟进节奏**：第1天、第3天、第7天、第14天各跟进一次\n5. **记录回传**：成交的线索一定要回传Meta，优化算法`);
    } else {
      answers.push(`我是你的AI投手助手，专注B2B工程机械广告优化。你可以问我：\n\n• "怎么提高询盘量？"\n• "受众怎么设置？"\n• "预算怎么分配？"\n• "素材怎么做？"\n• "CPL太高怎么办？"\n• "归因怎么设？"\n• "拉美市场怎么投？"\n\n当前识别产品：${productName}`);
    }
    return answers[0];
  }

  /* ============ 渲染 ============ */
  function renderTab() {
    let body = document.getElementById('ap-body');
    if (currentTab === 'analysis') renderAnalysis(body);
    else if (currentTab === 'advice') renderAdvice(body);
    else if (currentTab === 'chat') renderChat(body);
    else if (currentTab === 'knowledge') renderKnowledge(body);
  }

  function renderAnalysis(body) {
    let pageMode = detectPageMode();
    if (pageMode.startsWith('edit')) {
      body.innerHTML = `<div class="ap-section"><div class="ap-section-title">📝 当前为编辑页面</div><div class="ap-advice-card"><div class="adv-title">💡 切换到"智能建议"标签页</div><div class="adv-content"><p>你正在编辑广告组，点击上方的 <b>"💡 智能建议"</b> 标签，查看受众、年龄、定位的具体优化建议。</p></div></div></div>`;
      return;
    }
    let ads = fetchAds();
    if (ads.length === 0) {
      body.innerHTML = `<div class="ap-loading">⏳ 未检测到广告数据<br><br>请确保在广告组/广告系列列表页面<br>数据已加载完成后点🔄刷新</div>`;
      return;
    }
    let totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    let totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    let totalImpr = ads.reduce((s, a) => s + a.impressions, 0);
    let totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    let avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    let avgCtr = totalImpr > 0 ? totalClicks / totalImpr : 0;
    let avgSubmit = totalClicks > 0 ? totalLeads / totalClicks : 0;
    let issues = diagnose(ads);
    let attr = cplAttribution(ads);
    let pred = predictDay(ads);
    let product = detectProduct();

    let html = `
      <div class="ap-section">
        ${product ? `<div style="margin-bottom:10px"><span class="ap-product-tag">识别产品: ${product.name}</span><span class="ap-pill pill-good">目标CPL: $${product.data.cplTarget}</span></div>` : ''}
        <div class="ap-section-title">📊 账户速览（${ads.length}个广告组）</div>
        <div class="ap-cards">
          <div class="ap-card"><div class="label">总花费</div><div class="value">$${totalSpend.toFixed(0)}</div></div>
          <div class="ap-card"><div class="label">询盘数</div><div class="value">${totalLeads}</div></div>
          <div class="ap-card"><div class="label">平均CPL</div><div class="value" style="color:${avgCpl > STORE.baseline.benchmark_cpl ? '#f87171' : '#4ade80'}">$${avgCpl.toFixed(1)}</div></div>
          <div class="ap-card"><div class="label">点击率</div><div class="value">${(avgCtr*100).toFixed(2)}%</div></div>
        </div>
      </div>
      <div class="ap-section">
        <div class="ap-section-title">🔍 漏斗诊断</div>
        <div class="ap-funnel">
          <div class="ap-funnel-steps">
            <div class="ap-funnel-step"><div class="num">${(totalImpr/1000).toFixed(0)}K</div><div class="label">展示</div></div>
            <div class="ap-funnel-arrow">→</div>
            <div class="ap-funnel-step"><div class="num">${totalClicks}</div><div class="label">点击</div><div class="rate ${avgCtr >= STORE.baseline.benchmark_ctr ? 'rate-good' : 'rate-bad'}">CTR ${(avgCtr*100).toFixed(1)}%</div></div>
            <div class="ap-funnel-arrow">→</div>
            <div class="ap-funnel-step"><div class="num">${totalLeads}</div><div class="label">询盘</div><div class="rate ${avgSubmit >= STORE.baseline.benchmark_submit_rate ? 'rate-good' : 'rate-warn'}">提交 ${(avgSubmit*100).toFixed(1)}%</div></div>
          </div>
        </div>
      </div>
    `;

    if (attr) {
      html += `
      <div class="ap-section">
        <div class="ap-section-title">🔬 CPL归因分解</div>
        <div class="ap-attribution">
          <div style="font-size:11px;margin-bottom:6px">CPL较基准 <b style="color:${attr.cplRatio > 1 ? '#f87171' : '#4ade80'}">${attr.cplRatio > 1 ? '上升' : '下降'} ${(Math.abs(attr.cplRatio-1)*100).toFixed(0)}%</b> · 主因：<b style="color:#fbbf24">${attr.mainFactor}</b></div>
          <div style="font-size:10px;color:#8b95a8;margin-top:8px">CPM上涨贡献 ${attr.cpmContrib.toFixed(0)}%</div>
          <div class="ap-attr-bar"><div class="ap-attr-fill" style="width:${Math.max(attr.cpmContrib,3)}%;background:#f87171"></div></div>
          <div style="font-size:10px;color:#8b95a8;margin-top:6px">CTR下滑贡献 ${attr.ctrContrib.toFixed(0)}%</div>
          <div class="ap-attr-bar"><div class="ap-attr-fill" style="width:${Math.max(attr.ctrContrib,3)}%;background:#fbbf24"></div></div>
          <div style="font-size:10px;color:#8b95a8;margin-top:6px">提交率下滑贡献 ${attr.submitContrib.toFixed(0)}%</div>
          <div class="ap-attr-bar"><div class="ap-attr-fill" style="width:${Math.max(attr.submitContrib,3)}%;background:#818cf8"></div></div>
        </div>
      </div>`;
    }

    if (pred) {
      html += `
      <div class="ap-section">
        <div class="ap-section-title">📈 全天预测</div>
        <div class="ap-attribution">
          <div style="font-size:11px">今日已过 <b>${(pred.dayProgress*100).toFixed(0)}%</b>，预计全天：</div>
          <div style="display:flex;gap:16px;margin-top:8px;font-size:12px">
            <div>花费：<b>$${pred.predSpend.toFixed(0)}</b></div>
            <div>询盘：<b>${pred.predLeads.toFixed(0)}</b>条</div>
            <div>CPL：<b style="color:${pred.willExceed ? '#f87171' : '#4ade80'}">$${pred.predCpl.toFixed(1)}</b></div>
          </div>
          <div style="margin-top:8px;font-size:11px">${pred.willExceed ? '<span class="ap-pill pill-bad">⚠️ 预计超标 ' + ((pred.exceedRatio-1)*100).toFixed(0) + '%，建议立即优化</span>' : '<span class="ap-pill pill-good">✅ 在基准范围内</span>'}</div>
        </div>
      </div>`;
    }

    html += `<div class="ap-section"><div class="ap-section-title">🚨 诊断清单（${issues.length}项）</div>`;
    issues.forEach(iss => {
      html += `<div class="ap-issue ${iss.level}">
        <div class="issue-title">${iss.level === 'critical' ? '🔴' : iss.level === 'warning' ? '🟡' : iss.level === 'good' ? '🟢' : '🔵'} ${iss.title}</div>
        <div class="issue-desc">${iss.desc}</div>
        ${iss.suggestion ? `<div class="issue-suggestion">💡 ${iss.suggestion}</div>` : ''}
      </div>`;
    });
    html += `</div>`;

    let summary = `【AI投手诊断报告】${new Date().toLocaleString('zh-CN')}
📊 账户概览：花费$${totalSpend.toFixed(0)}，询盘${totalLeads}条，CPL$${avgCpl.toFixed(1)}
🔍 漏斗：CTR ${(avgCtr*100).toFixed(2)}%，提交率 ${(avgSubmit*100).toFixed(2)}%
${attr ? `🔬 CPL主因：${attr.mainFactor}` : ''}
${pred.willExceed ? '⚠️ 全天预计CPL超标' + ((pred.exceedRatio-1)*100).toFixed(0) + '%' : '✅ 全天预计达标'}
📌 优先行动：
${issues.filter(i => i.level === 'critical').slice(0,3).map((i, idx) => `${idx+1}. ${i.title} - ${i.suggestion || i.desc}`).join('\n') || '暂无紧急问题'}`;

    html += `
    <div class="ap-section">
      <div class="ap-section-title">📋 诊断总结（一键复制）</div>
      <div class="ap-summary-box" id="ap-summary-text">${summary}</div>
      <button class="ap-btn" style="margin-top:8px;width:100%" onclick="navigator.clipboard.writeText(document.getElementById('ap-summary-text').innerText).then(()=>{this.textContent='✅ 已复制';setTimeout(()=>this.textContent='📋 复制总结',2000)})">📋 复制总结</button>
    </div>`;
    body.innerHTML = html;
  }

  function renderAdvice(body) {
    let pageMode = detectPageMode();
    let editData = fetchEditData();
    let advice = generateEditAdvice(editData);
    let html = `<div class="ap-section"><div class="ap-section-title">💡 智能建议</div>`;
    if (pageMode.startsWith('edit')) {
      html += `<div style="margin-bottom:10px"><span class="ap-pill pill-good">📝 编辑页面模式</span></div>`;
    } else {
      html += `<div style="margin-bottom:10px"><span class="ap-pill pill-warn">📋 列表页面</span> <span style="font-size:11px;color:#8b95a8">进入广告组编辑页可查看受众建议</span></div>`;
    }
    advice.forEach(adv => {
      html += `<div class="ap-advice-card"><div class="adv-title">${adv.title}</div><div class="adv-content">${adv.content}</div></div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
  }

  function renderChat(body) {
    let history = STORE.chatHistory || [];
    let html = `
    <div class="ap-chat-box" style="height:calc(88vh - 140px)">
      <div class="ap-chat-messages" id="ap-chat-msgs">
        ${history.length === 0 ? `<div class="ap-chat-msg ai"><div class="bubble">你好！我是你的AI投手助手🎯<br><br>我专注B2B工程机械广告优化，可以帮你：<br>• 分析广告数据<br>• 给受众设置建议<br>• 解答投放问题<br>• 提供最新获客方法<br><br>试试问我："怎么提高询盘量？"</div></div>` : ''}
        ${history.map(h => `<div class="ap-chat-msg ${h.role}"><div class="bubble">${h.content.replace(/\n/g,'<br>')}</div></div>`).join('')}
      </div>
      <div style="margin-bottom:6px">
        <span class="ap-quick-q" onclick="document.getElementById('ap-chat-input').value='怎么提高询盘量？';document.getElementById('ap-chat-send').click()">怎么提高询盘？</span>
        <span class="ap-quick-q" onclick="document.getElementById('ap-chat-input').value='受众怎么设置？';document.getElementById('ap-chat-send').click()">受众设置</span>
        <span class="ap-quick-q" onclick="document.getElementById('ap-chat-input').value='预算怎么分配？';document.getElementById('ap-chat-send').click()">预算分配</span>
        <span class="ap-quick-q" onclick="document.getElementById('ap-chat-input').value='CPL太高怎么办？';document.getElementById('ap-chat-send').click()">CPL太高</span>
      </div>
      <div class="ap-chat-input">
        <input class="ap-input" id="ap-chat-input" placeholder="输入你的问题..." style="flex:1">
        <button class="ap-btn" id="ap-chat-send">发送</button>
      </div>
    </div>`;
    body.innerHTML = html;
    let msgs = document.getElementById('ap-chat-msgs');
    msgs.scrollTop = msgs.scrollHeight;
    document.getElementById('ap-chat-send').onclick = () => {
      let input = document.getElementById('ap-chat-input');
      let q = input.value.trim();
      if (!q) return;
      STORE.chatHistory = STORE.chatHistory || [];
      STORE.chatHistory.push({ role: 'user', content: q });
      let answer = aiChat(q);
      STORE.chatHistory.push({ role: 'ai', content: answer });
      if (STORE.chatHistory.length > 20) STORE.chatHistory = STORE.chatHistory.slice(-20);
      saveStore(STORE);
      renderChat(body);
    };
    document.getElementById('ap-chat-input').onkeypress = (e) => { if (e.key === 'Enter') document.getElementById('ap-chat-send').click(); };
  }

  function renderKnowledge(body) {
    let allKnowledge = [...B2B_KNOWLEDGE, ...(STORE.knowledge || [])];
    let html = `
    <div class="ap-section">
      <div class="ap-section-title">📚 知识库（${allKnowledge.length}条）</div>
      <div style="margin-bottom:12px">
        <textarea class="ap-textarea" id="ap-feed-input" placeholder="粘贴行业文章/策略文本，系统自动提取规则..."></textarea>
        <button class="ap-btn" style="margin-top:6px;width:100%" id="ap-feed-btn">📤 投喂知识</button>
      </div>
      <div id="ap-knowledge-list">
        ${allKnowledge.map(k => `<div class="ap-knowledge-item">
          <div class="k-title">${k.title}</div>
          <div class="k-rule">📌 ${k.rule}</div>
          <div class="k-source">来源：${k.source || '未知'} · 权重：${k.weight || 0.5}</div>
        </div>`).join('')}
      </div>
    </div>`;
    body.innerHTML = html;
    document.getElementById('ap-feed-btn').onclick = () => {
      let text = document.getElementById('ap-feed-input').value.trim();
      if (!text) return;
      let rules = [];
      if (/(\d+)\s*[-–~]\s*(\d+)\s*元/.test(text)) { let m = text.match(/(\d+)\s*[-–~]\s*(\d+)\s*元/); rules.push({ title: 'CPL参考值', rule: `CPL控制在¥${m[1]}-¥${m[2]}`, apply: 'cpl', weight: 0.8, source: '用户投喂' }); }
      if (/CTR.*?(\d+\.?\d*)%/.test(text)) { let m = text.match(/CTR.*?(\d+\.?\d*)%/); rules.push({ title: 'CTR基准', rule: `CTR>${m[1]}%`, apply: 'ctr', weight: 0.7, source: '用户投喂' }); }
      if (/表单.*?(\d+)\s*个/.test(text) || /字段.*?(\d+)/.test(text)) { let m = text.match(/(?:表单|字段).*?(\d+)/); rules.push({ title: '表单字段数', rule: `表单字段≤${m[1]}个`, apply: 'submit_rate', weight: 0.9, source: '用户投喂' }); }
      if (rules.length === 0) rules.push({ title: text.slice(0, 30) + '...', rule: text.slice(0, 100), apply: 'general', weight: 0.5, source: '用户投喂' });
      STORE.knowledge = [...(STORE.knowledge || []), ...rules];
      saveStore(STORE);
      document.getElementById('ap-feed-input').value = '';
      renderKnowledge(body);
    };
  }

  /* ============ 主流程 ============ */
  function runAll() {
    document.getElementById('ap-last-time').textContent = '上次分析: ' + new Date().toLocaleTimeString('zh-CN');
    renderTab();
    let badge = document.getElementById('ap-fab-badge');
    if (badge) { badge.style.display = 'none'; }
  }

  window.__AI_PITCHER__ = { refresh: runAll, version: CFG.version };
  setTimeout(runAll, 1500);
  if (CFG.autoRefresh > 0) setInterval(() => { if (panelVisible) runAll(); }, CFG.autoRefresh);
})();
