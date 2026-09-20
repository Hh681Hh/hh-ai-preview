const OPENAI_METALLIC_IMG = `<img class="product-metallic-img" src="chatgpt-metallic.jpg" alt="ChatGPT" width="72" height="72" loading="eager" />`;
const OPENAI_SVG = OPENAI_METALLIC_IMG;
const getLogo = () => OPENAI_METALLIC_IMG;

const ICONS = {
  // Plus (Image 2)
  model: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2z"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A4.5 4.5 0 005 6.5c0 .77.2 1.5.54 2.13A4.5 4.5 0 004 12.5c0 1.5.73 2.83 1.86 3.65A4.5 4.5 0 009.5 21H11V2H9.5zM14.5 2A4.5 4.5 0 0119 6.5c0 .77-.2 1.5-.54 2.13A4.5 4.5 0 0120 12.5c0 1.5-.73 2.83-1.86 3.65A4.5 4.5 0 0114.5 21H13V2h1.5z"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M2 13h20"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M11 8v6M8 11h6"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,

  // Pro 5x / 20x (Image 3)
  trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  pro_model: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2z"/></svg>`,
  codex_smile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  work_nodes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8.5" y1="6" x2="15.5" y2="6"/><line x1="6" y1="8.5" x2="6" y2="15.5"/><line x1="8.5" y1="18" x2="15.5" y2="18"/></svg>`,
  chat_infinite: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="12" cy="10" r="1.5"/></svg>`,
  fast_image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/><path d="M19 7l.8-1.8L21.5 4.5l-1.7-.7L19 2l-.8 1.8-1.7.7 1.7.7z"/></svg>`,
  memory_full: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A4.5 4.5 0 005 6.5c0 .77.2 1.5.54 2.13A4.5 4.5 0 004 12.5c0 1.5.73 2.83 1.86 3.65A4.5 4.5 0 009.5 21H11V2H9.5zM14.5 2A4.5 4.5 0 0119 6.5c0 .77-.2 1.5-.54 2.13A4.5 4.5 0 0120 12.5c0 1.5-.73 2.83-1.86 3.65A4.5 4.5 0 0114.5 21H13V2h1.5z"/></svg>`,
  flask_exp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.15 19.1A2 2 0 0 0 5.86 22h12.28a2 2 0 0 0 1.71-2.9L14 9.31V2"/><line x1="8.5" y1="2" x2="15.5" y2="2"/><line x1="7" y1="16" x2="17" y2="16"/></svg>`
};

const products = [
  {
    id: 'gpt-plus',
    name: 'ChatGPT Plus',
    brand: 'ChatGPT',
    symbol: '◎',
    tier: 'POPULAR',
    tags: [
      { text: '官方Visa卡充', type: 'primary' },
      { text: '菲区正规订阅', type: 'accent' },
      { text: '自动秒发', type: 'success' }
    ],
    descLine1: '官方 Visa 实卡直充 · 菲律宾合规区域',
    descLine2: '支持自有账号 · 30天全周期质保包赔',
    desc: '官方 Visa 实卡直充 · 菲律宾合规区域 · 支持自有账号 · 30天全周期质保包赔',
    benefits: [
      { icon: 'model', text: '高级模型' },
      { icon: 'image', text: '使用 Thinking 进行高级图像创建' },
      { icon: 'brain', text: '扩展容量的跨聊天记忆' },
      { icon: 'briefcase', text: '用于多步骤任务的 Work 智能体' },
      { icon: 'code', text: 'Codex 编程智能体' }
    ],
    features: [
      '官方渠道充值，正规海外真实 Visa 实体卡代充',
      '开通区域为菲律宾合规低价区（菲区正规会员）',
      '支持自有官方账号直接卡充，保留全部对话记录与个人配置',
      '30天全周期掉单包赔质保，安全稳定不封号',
      '优先访问 OpenAI o1 深度思考模型与 GPT-4o 旗舰模型',
      '使用 Thinking 深度思考机制进行高质量画图生成',
      '跨会话长期记忆扩展，根据你的习惯持续进化',
      '提供更高限额的联网搜索与 Deep Research 额度'
    ],
    type: '自有账号代充',
    price: 135,
    period: '月',
    badge: '🔥 人气之选'
  },
  {
    id: 'gpt-pro-5x',
    name: 'ChatGPT Pro 5x',
    brand: 'ChatGPT',
    symbol: '◎',
    tier: 'PROFESSIONAL',
    tags: [
      { text: '官方Visa卡充', type: 'primary' },
      { text: '菲区100美刀', type: 'accent' },
      { text: '5倍o1算力', type: 'success' }
    ],
    descLine1: '官方 Visa 实卡直充 · 菲区 100 美刀官方订阅',
    descLine2: '5倍高频科研算力 · 独享专线全质保',
    desc: '官方 Visa 实卡直充 · 菲区 100 美刀官方订阅 · 5倍高频科研算力 · 独享专线全质保',
    includedNote: 'Plus 中的所有内容，以及：',
    benefits: [
      { icon: 'trend', text: '相比 Plus 多 5 倍使用额度' },
      { icon: 'pro_model', text: 'Pro 前沿模型' },
      { icon: 'codex_smile', text: 'Codex 智能体最高访问权限' },
      { icon: 'work_nodes', text: '工作智能体最高访问权限' },
      { icon: 'chat_infinite', text: '无限制核心聊天' }
    ],
    features: [
      'Plus 中的所有内容，以及：',
      '官方 Visa 实卡充值，菲区 100 美刀正规订阅',
      '相比 Plus 多 5 倍使用额度，缩短排队时间',
      '优先调度 OpenAI Pro 前沿模型',
      'Codex 智能体最高访问权限',
      '工作智能体最高访问权限',
      '无限制核心聊天与高并发',
      '无限制且较快速的图片生成',
      '专属 7×24H 独立专线与 30 天质保包赔'
    ],
    type: '自有账号代充',
    price: 688,
    period: '月',
    badge: '⚡ 满血算力'
  },
  {
    id: 'gpt-pro-20x',
    name: 'ChatGPT Pro 20x',
    brand: 'ChatGPT',
    symbol: '◎',
    tier: 'FLAGSHIP',
    tags: [
      { text: '官方Visa卡充', type: 'primary' },
      { text: '菲区200美刀', type: 'accent' },
      { text: '20倍顶配矩阵', type: 'success' }
    ],
    descLine1: '官方 Visa 实卡直充 · 菲区 200 美刀官方订阅',
    descLine2: '20倍顶级算力矩阵 · 最高集群优先级',
    desc: '官方 Visa 实卡直充 · 菲区 200 美刀官方订阅 · 20倍顶级算力矩阵 · 最高集群优先级',
    includedNote: 'Pro 5x 中的所有内容，以及：',
    benefits: [
      { icon: 'trend', text: '相比 Plus 多 20 倍使用额度' },
      { icon: 'pro_model', text: 'Pro 前沿模型最高集群调度' },
      { icon: 'codex_smile', text: 'Codex 智能体极限并发访问权限' },
      { icon: 'work_nodes', text: '工作智能体多任务并发集群' },
      { icon: 'chat_infinite', text: '无限制核心聊天与海量上下文' }
    ],
    features: [
      'Pro 5x 中的所有内容，以及：',
      '官方 Visa 实卡充值，菲区 200 美刀正规订阅',
      '相比 Plus 多 20 倍顶级使用额度',
      'OpenAI 最高优先级集群专线满血保障',
      'Codex 智能体极限并发访问权限',
      '工作智能体多任务并发集群',
      '无限制核心聊天与海量上下文',
      'VIP 专属架构师一对一技术顾问与全周期质保'
    ],
    type: '自有账号代充',
    price: 1288,
    period: '月',
    badge: '🚀 顶配旗舰'
  }
];

const categories = [['ChatGPT', '◎']];
let category = 'ChatGPT', type = '全部';
const $ = s => document.querySelector(s);

function render() {
  const searchEl = $('#search');
  const term = searchEl ? searchEl.value.trim().toLowerCase() : '';
  let list = products.filter(p => (p.brand === category) && (type === '全部' || p.type === type) && `${p.name} ${p.desc} ${p.type}`.toLowerCase().includes(term));
  const sortEl = $('#sort');
  const order = sortEl ? sortEl.value : 'default';
  if (order !== 'default') {
    list.sort((a, b) => a.price === null ? 1 : b.price === null ? -1 : order === 'low' ? a.price - b.price : b.price - a.price);
  }

  // Categories (hidden, but kept for JS compat)
  const catEl = $('#categories');
  if (catEl) {
    catEl.innerHTML = categories.map(([name, symbol]) => `
      <button class="category ${category === name ? 'selected' : ''}" data-category="${name}" aria-pressed="${category === name}">
        <span class="cat-symbol" aria-hidden="true">${symbol === '◎' ? OPENAI_SVG : symbol}</span>
        <span class="cat-name">${name}</span>
        <span class="count">${products.filter(p => p.brand === name).length.toString().padStart(2, '0')}</span>
      </button>
    `).join('');
  }

  const titleEl = $('#category-title');
  if (titleEl) titleEl.innerHTML = `${category} 方案精选 <span>${list.length.toString().padStart(2, '0')}</span>`;

  // Apple Showcase Cards with Official-style benefits list & Spec Tags
  $('#products').innerHTML = list.length ? list.map(p => `
    <article class="showcase-card">
      <div class="card-tier">${p.tier}</div>
      <div class="card-logo">${getLogo(p)}</div>
      <h3>${p.name}</h3>
      <div class="card-spec-tags">
        ${(p.tags || []).map(t => typeof t === 'string' ? `<span class="spec-tag">${t}</span>` : `<span class="spec-tag tag-${t.type || 'accent'}">${t.text}</span>`).join('')}
      </div>
      ${p.includedNote ? `<div class="benefits-included-note">${p.includedNote}</div>` : ''}
      <ul class="card-benefits">
        ${(p.benefits || []).map(b => `
          <li>
            <span class="benefit-icon" aria-hidden="true">${ICONS[b.icon] || ICONS.model}</span>
            <span class="benefit-text">${b.text}</span>
          </li>
        `).join('')}
      </ul>
      <div class="card-bottom">
        <div class="card-price">
          ${p.price === null ? '<span class="price-tbd">价格待定</span>' : `<span class="price-num"><small>¥</small>${p.price}</span><span class="price-period">/ ${p.period}</span>`}
        </div>
        <button class="apple-btn" data-product="${p.id}" aria-label="立即开通 ${p.name}">购买</button>
      </div>
    </article>
  `).join('') : '<div class="empty"><p>没有找到符合条件的方案</p><button data-action="reset">重置筛选</button></div>';

  const countEl = $('#result-count');
  if (countEl) countEl.textContent = `${list.length} 项方案`;

  document.querySelectorAll('[data-type]').forEach(b => {
    b.classList.toggle('selected', b.dataset.type === type);
    b.setAttribute('aria-pressed', String(b.dataset.type === type));
  });
}

function view(name) {
  ['shop', 'orders', 'help'].forEach(v => {
    const el = $(`#${v}-view`);
    if (el) el.hidden = v !== name;
  });
  // Show/hide hero only on shop view
  const hero = $('#hero');
  if (hero) hero.style.display = name === 'shop' ? '' : 'none';
  const trustRibbon = document.querySelector('.trust-ribbon');
  if (trustRibbon) trustRibbon.style.display = name === 'shop' ? '' : 'none';

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
    if (b.dataset.view === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function detail(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;
  $('#product-detail').innerHTML = `
    <div class="detail-header">
      <div class="detail-logo">${getLogo(p)}</div>
      <div>
        <h2>${p.name}</h2>
        <span class="detail-tier">${p.tier}</span>
      </div>
    </div>
    <div class="card-spec-tags" style="justify-content:flex-start;margin:12px 0;">
      ${(p.tags || []).map(t => typeof t === 'string' ? `<span class="spec-tag">${t}</span>` : `<span class="spec-tag tag-${t.type || 'accent'}">${t.text}</span>`).join('')}
    </div>
    ${p.includedNote ? `<div class="benefits-included-note">${p.includedNote}</div>` : ''}
    <div class="detail-features">
      <h4>方案特色与权益</h4>
      ${p.features ? p.features.map(f => `<div class="detail-feature-row"><span class="check-mark">✓</span><span>${f}</span></div>`) : ''}
    </div>
    <dl class="detail-rows">
      <dt>支付渠道</dt><dd>官方 Visa 实卡结算</dd>
      <dt>充值区域</dt><dd>菲律宾合规正规区 (菲区)</dd>
      <dt>交付方式</dt><dd>${p.type}</dd>
      <dt>质保条款</dt><dd>30天全周期掉单包赔</dd>
    </dl>
    <button class="apple-btn primary wide" data-action="contact">联系客服</button>
  `;
  $('#product-dialog').showModal();
}

document.addEventListener('click', e => {
  const b = e.target.closest('button,a');
  if (!b) return;
  if (b.dataset.category) { category = b.dataset.category; render(); }
  if (b.dataset.type) { type = b.dataset.type; render(); }
  if (b.dataset.view) view(b.dataset.view);
  if (b.dataset.product) detail(b.dataset.product);
  if (b.classList.contains('close')) b.closest('dialog')?.close();
  if (b.classList.contains('close-contact')) $('#contact-dialog')?.close();
  if (b.dataset.action === 'contact') { $('#product-dialog')?.close(); $('#contact-dialog')?.showModal(); }
  if (b.dataset.action === 'reset') { category = 'ChatGPT'; type = '全部'; const s = $('#search'); if(s) s.value = ''; const so = $('#sort'); if(so) so.value = 'default'; render(); }
  if (b.classList.contains('brand')) { e.preventDefault(); view('shop'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

const searchEl = $('#search');
if (searchEl) searchEl.addEventListener('input', render);
const sortEl = $('#sort');
if (sortEl) sortEl.addEventListener('change', render);

document.addEventListener('keydown', e => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    view('shop');
    const s = $('#search');
    if (s) s.focus();
  }
});

render();
const initialView = new URLSearchParams(location.search).get('view') || 'shop';
view(initialView);

if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'filter_subscriptions',
      description: 'Search the example subscription catalog and update the visible results.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input.query !== 'string') throw new Error('query must be a string');
        category = 'ChatGPT'; type = '全部';
        const s = $('#search');
        if (s) s.value = input.query;
        view('shop');
        render();
        return { count: document.querySelectorAll('.showcase-card').length, query: input.query };
      }
    })).catch(() => {});
  } catch {}
}
