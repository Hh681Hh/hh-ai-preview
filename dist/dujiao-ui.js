/* Hh AI storefront adapter for Dujiao-Next v1.4.7.
   Requires a customer account before checkout and keeps orders, payments, and fulfillment together. */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => Number(v || 0).toFixed(2);
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
  const statusNames = {
    pending_payment: '等待付款',
    paid: '付款已确认，自动开通中',
    fulfilling: '正在自动化开通',
    partially_delivered: '部分已交付',
    delivered: '已完成交付',
    completed: '已完成',
    canceled: '已取消',
    refunded: '已退款',
    partially_refunded: '部分已退款'
  };

  let cfg = null, credentials = null, timer = null, preferredChannel = null;
  let checkoutId = new URLSearchParams(location.search).get('checkout');

  const siteUrl = (q = '') => {
    let p = location.pathname;
    if (!p.endsWith('/') && !p.endsWith('.html')) p += '/';
    return p + (q ? (q.startsWith('?') ? q : '?' + q) : '');
  };

  // ==========================================================================
  // 【自动对卡兑换充值网站预留槽位】
  // 后续老板提供真实的自动兑换卡网址时，可直接在 storefront/.data/redeem-config.json 中修改
  // ==========================================================================
  const REDEEM_PORTAL_CONFIG = {
    url: 'https://666666.homes/', // 👈【官方自动兑换充值网站】
    name: '自动兑换充值网站',
    slotNotice: '复制上方专属卡密，前往自动兑换充值网站（https://666666.homes/）直接卡充，30秒全自动到账。'
  };

  function getRedeemConfig() {
    return {
      url: cfg?.redeemPortal?.url || REDEEM_PORTAL_CONFIG.url,
      name: cfg?.redeemPortal?.name || REDEEM_PORTAL_CONFIG.name,
      slotNotice: cfg?.redeemPortal?.slotNotice || cfg?.redeemPortal?.notice || REDEEM_PORTAL_CONFIG.slotNotice
    };
  }

  function extractCardKey(order) {
    if (order?.fulfillment?.card_keys?.length) return order.fulfillment.card_keys[0];
    if (order?.fulfillment?.card_key) return order.fulfillment.card_key;
    const rawPayloads = [order, ...(order.children || [])].flatMap(o => o.fulfillment?.payload ? [o.fulfillment.payload] : []);
    if (rawPayloads.length && rawPayloads[0]) {
      const p = rawPayloads[0];
      if (typeof p === 'string' && p.trim()) return p.trim();
      if (p.card_secret || p.card_key || p.code || p.secret) return String(p.card_secret || p.card_key || p.code || p.secret);
    }
    if (order?.card_key) return order.card_key;
    return null;
  }

  // 渲染完整的卡密交付与直接卡充指引卡片
  function renderFulfillmentCard(order) {
    const cardKey = extractCardKey(order);
    const redeemCfg = getRedeemConfig();
    const redeemUrl = redeemCfg.url;
    const redeemReady = /^https:\/\//i.test(redeemUrl) && !redeemUrl.includes('待填入');

    if (!cardKey) return `
      <div class="fulfillment-redeem-container">
        <div class="fulfillment-order-bar">
          <div class="order-bar-main">
            <span class="order-bar-badge" style="background:#eef2ff;color:#3730a3;border-color:#c7d2fe;">付款已确认</span>
            <span class="order-bar-id">订单编号: <b>${esc(order.order_no)}</b></span>
          </div>
          <button class="btn-refresh-pill" id="refresh-order" type="button">↻ 刷新</button>
        </div>
        <div class="redeem-header">
          <h3>正在准备兑换卡密</h3>
          <p>付款已经到账。后台交付真实卡密后，会自动显示在这里，请稍后刷新订单。</p>
        </div>
      </div>`;

    return `
      <div class="fulfillment-redeem-container">
        <!-- 订单概览与刷新条 (首屏紧凑置顶) -->
        <div class="fulfillment-order-bar">
          <div class="order-bar-main">
            <span class="order-bar-badge">✓ 自动出密成功</span>
            <span class="order-bar-id">订单编号: <b>${esc(order.order_no)}</b></span>
            <span class="order-bar-price">实付金额: <b>¥${money(order.total_amount)}</b></span>
          </div>
          <button class="btn-refresh-pill" id="refresh-order" type="button" title="刷新订单状态">↻ 刷新</button>
        </div>

        <div class="redeem-header">
          <h3>ChatGPT 专属充值卡密与直接卡充指引</h3>
          <p>系统已全自动完成卡密出库。请复制下方专属卡密，前往自动兑换网站直接卡充（30秒极速到账）。</p>
        </div>

        <!-- 卡密展示与一键复制 -->
        <div class="card-secret-box">
          <div class="secret-label">
            <span>您的提货卡密 (Card Key)</span>
            <span class="secret-status-tag">✓ 官方正规企业卡源</span>
          </div>
          <div class="secret-val-row">
            <code class="secret-code" id="order-card-code">${esc(cardKey)}</code>
            <button class="btn-copy-secret" id="btn-copy-secret" type="button">一键复制卡密</button>
          </div>
        </div>

        <!-- 自动兑换卡充值网站 -->
        <div class="redeem-portal-slot ${redeemReady ? 'ready' : ''}">
          <div class="slot-label">
            <span>自动兑换充值网站 (卡密直接充值)</span>
            <small class="slot-notice-badge ${redeemReady ? 'ready' : ''}">${redeemReady ? '✓ 官方兑换入口已就绪' : '兑换入口待配置'}</small>
          </div>
          <div class="slot-row">
            ${redeemReady ? `<a href="${esc(redeemUrl)}" target="_blank" rel="noopener noreferrer" class="portal-link" id="redeem-portal-link">
              <span class="portal-icon">🔗</span>
              <span class="portal-url-text">${esc(redeemUrl)}</span>
              <span class="portal-go-tag">点击前往兑换直接卡充 ↗</span>
            </a>
            <button class="btn-copy-portal" id="btn-copy-portal" type="button">复制网址</button>` : '<span class="portal-link">兑换入口正在配置，请保存卡密并联系在线客服。</span>'}
          </div>
          <div class="slot-tip">${esc(redeemCfg.slotNotice)}</div>
        </div>

        <!-- 3步极速兑换与直接卡充说明 -->
        <div class="redeem-guide-box">
          <div class="guide-title">
            <span>⚡ 3 步极速直接卡充流程</span>
          </div>
          <div class="guide-steps">
            <div class="guide-step-item">
              <div class="step-badge">步骤 1</div>
              <div class="step-content">
                <strong>复制上方专属卡密</strong>
                <p>点击上方 <b>「一键复制卡密」</b> 按钮，保存您的专属提货凭证。</p>
              </div>
            </div>

            <div class="guide-step-item">
              <div class="step-badge">步骤 2</div>
              <div class="step-content">
                <strong>前往自动兑换充值网站</strong>
                <p>点击上方预留的 <b>【自动兑换充值网站】</b> 链接，进入官方直接卡充平台。</p>
              </div>
            </div>

            <div class="guide-step-item">
              <div class="step-badge">步骤 3</div>
              <div class="step-content">
                <strong>粘贴卡密直接秒充到账</strong>
                <p>在兑换网站粘贴您的 <b>「卡密」</b> 并输入您的 ChatGPT 账号信息，点击 <b>「立即兑换充值」</b>，系统将在 30 秒内全自动完成直接卡充！</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 质保与售后兜底保障 -->
        <div class="redeem-warranty-footer">
          <div class="warranty-badge-row">
            <span class="badge-item">🛡️ 官方正规企业卡源</span>
            <span class="badge-item">⚡ 30天全周期稳定质保</span>
            <span class="badge-item">💎 掉单全额包赔承诺</span>
          </div>
          <p>如在兑换过程中遇到网络或账号风控问题，请保留订单编号随时联系在线客服，专员一对一为你处理。</p>
        </div>
      </div>
    `;
  }

  function wireRedeemCopy(cardKey, redeemUrl) {
    document.getElementById('btn-copy-secret')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(cardKey);
        const b = document.getElementById('btn-copy-secret');
        if (b) b.textContent = '卡密已复制 ✓';
        setTimeout(() => { if (b) b.textContent = '一键复制卡密'; }, 2500);
      } catch {
        alert('卡密为: ' + cardKey);
      }
    });

    document.getElementById('btn-copy-portal')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(redeemUrl);
        const b = document.getElementById('btn-copy-portal');
        if (b) b.textContent = '网址已复制 ✓';
        setTimeout(() => { if (b) b.textContent = '复制网址'; }, 2500);
      } catch {
        alert('网址为: ' + redeemUrl);
      }
    });
  }

  function paymentCards(channels) {
    if (!channels || !channels.length) {
      return '<div class="detail-note">在线收银通道配置中，可使用账户余额直接秒付。</div>';
    }
    const sorted = [...channels].sort((a, b) => {
      const aIsBinance = /bep20|bsc|币安/i.test(a.name);
      const bIsBinance = /bep20|bsc|币安/i.test(b.name);
      if (aIsBinance && !bIsBinance) return -1;
      if (!aIsBinance && bIsBinance) return 1;
      return 0;
    });

    if (!preferredChannel && sorted.length) {
      preferredChannel = sorted[0].id;
    }

    return `
      <div class="payment-options" role="radiogroup" aria-label="支付方式">
        ${sorted.map(c => {
          const isBinance = /bep20|bsc|币安/i.test(c.name);
          const checked = preferredChannel === c.id;
          return `
            <label class="payment-choice payment-choice-simple ${isBinance ? 'is-recommended' : ''}">
              ${isBinance ? '<span class="payment-badge-rec">推荐 · 手续费低</span>' : ''}
              <input type="radio" name="payment-channel" value="${c.id}" ${checked ? 'checked' : ''}>
              <div class="payment-choice-indicator"></div>
              <div class="payment-choice-text">
                <strong>${isBinance ? '币安智能链 (BEP20)' : '波场网络 (TRC20)'}</strong>
                <small>${isBinance ? '手续费极低 · 秒到账' : 'TRON · 交易所通用'}</small>
              </div>
            </label>
          `;
        }).join('')}
      </div>
    `;
  }

  function chosenChannel() {
    return Number(document.querySelector('input[name="payment-channel"]:checked')?.value || 2);
  }

  const lastCheckoutState = {
    productId: null,
    email: '',
    password: '',
    quantity: 1,
    channelId: 2
  };
  let currentCheckoutStep = 'product'; // 'product' | 'cashier' | 'success'

  function setCheckoutStep(step) {
    currentCheckoutStep = step;
    const label = document.getElementById('checkout-back-label');
    const btn = document.getElementById('checkout-back-btn');
    if (!label) return;
    if (step === 'cashier') {
      label.textContent = '返回上一级 (修改邮箱与密码)';
      if (btn) btn.title = '返回输入邮箱和设置订单密码页面';
    } else if (step === 'success') {
      label.textContent = '返回商城首页';
      if (btn) btn.title = '返回商城方案列表';
    } else {
      label.textContent = '返回方案列表';
      if (btn) btn.title = '返回商城方案列表';
    }
  }

  function handleCheckoutBack() {
    if (currentCheckoutStep === 'cashier') {
      // 停止轮询与倒计时
      if (window.__hhOrderPollTimer) {
        clearInterval(window.__hhOrderPollTimer);
        window.__hhOrderPollTimer = null;
      }
      if (window.__hhCountdownTimer) {
        clearInterval(window.__hhCountdownTimer);
        window.__hhCountdownTimer = null;
      }
      // 返回上一级：输入邮箱和设置订单密码页面
      checkout(lastCheckoutState.productId || checkoutId || 'gpt-plus');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // 处于第一级（输入邮箱与商品选择）或已完成状态，返回方案列表/首页
    unmountCheckout();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mountCheckout() {
    document.body.classList.add('is-checkout');
    let page = document.getElementById('checkout-page');
    if (!page) {
      page = document.createElement('section');
      page.id = 'checkout-page';
      page.innerHTML = `
        <button class="checkout-back" id="checkout-back-btn" type="button" aria-label="返回上一级">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          <span id="checkout-back-label">返回方案列表</span>
        </button>
        <div class="checkout-title">
          <div>
            <span class="checkout-eyebrow">Hh AI / CHECKOUT</span>
            <h1>确认你的订阅方案</h1>
          </div>
          <span>官方纯净正规卡源 · 全程自动化极速开通</span>
        </div>
        <div class="checkout-steps">
          <span><b>1</b> 登录 / 注册</span>
          <i></i>
          <span class="current"><b>2</b> 选择商品</span>
          <i></i>
          <span><b>3</b> 结算付款</span>
          <i></i>
          <span><b>4</b> 卡密兑换</span>
        </div>
      `;
      document.querySelector('main').prepend(page);
    }
    setCheckoutStep(currentCheckoutStep);
    const prodDetail = $('#product-detail');
    if (prodDetail && !page.contains(prodDetail)) {
      page.append(prodDetail);
    }
    $('#product-detail').innerHTML = '<p class="checkout-loading" role="status">正在读取商品配置与支付方式…</p>';
  }

  function unmountCheckout() {
    document.body.classList.remove('is-checkout');
    const prodDetail = document.getElementById('product-detail');
    const prodDialog = document.getElementById('product-dialog');
    if (prodDetail && prodDialog && !prodDialog.contains(prodDetail)) {
      prodDialog.append(prodDetail);
    }
    document.getElementById('checkout-page')?.remove();
    checkoutId = null;
    history.pushState(null, '', siteUrl());
    view('shop');
  }

  function orderView(c) {
    if (checkoutId) {
      location.href = siteUrl('?view=orders');
      return;
    }
    $('#product-dialog')?.close();
    view('orders');
    save(c);
    query();
  }

  $('#product-dialog')?.addEventListener('close', () => {
    if (window.__hhOrderPollTimer) {
      clearInterval(window.__hhOrderPollTimer);
      window.__hhOrderPollTimer = null;
    }
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-product]');
    if (b) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const productId = b.dataset.product;
      checkoutId = productId;
      history.pushState(null, '', siteUrl('?checkout=' + encodeURIComponent(productId)));
      mountCheckout();
      if (cfg) {
        checkout(productId);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const back = e.target.closest('.checkout-back');
    if (back) {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleCheckoutBack();
      return;
    }
    if (checkoutId) {
      const nav = e.target.closest('[data-view],a.brand');
      if (nav) {
        e.preventDefault();
        e.stopImmediatePropagation();
        unmountCheckout();
        if (nav.dataset.view && nav.dataset.view !== 'shop') {
          view(nav.dataset.view);
        }
      }
    }
  }, true);

  window.addEventListener('popstate', () => {
    const currentCheckoutId = new URLSearchParams(location.search).get('checkout');
    if (currentCheckoutId) {
      checkoutId = currentCheckoutId;
      mountCheckout();
      if (cfg) checkout(currentCheckoutId);
    } else if (document.getElementById('checkout-page')) {
      unmountCheckout();
    }
  });

  if (checkoutId) mountCheckout();

  function auth(c) {
    return 'Guest ' + btoa(String.fromCharCode(...new TextEncoder().encode(c.email + '\n' + c.token))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  }

  async function api(path, { data, access, method } = {}) {
    const r = await fetch(path, {
      method: method || (data ? 'POST' : 'GET'),
      headers: {
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(access ? { Authorization: auth(access) } : {})
      },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || j.msg || '订单请求失败');
    return j;
  }

  function save(c) {
    if (!c) return;
    credentials = c;
    try {
      sessionStorage.setItem('hh-dujiao-order', JSON.stringify(c));
      localStorage.setItem('hh-dujiao-order', JSON.stringify(c));
    } catch {}
    if ($('#order-number') && c.id) $('#order-number').value = c.id;
    if ($('#order-email') && c.email) $('#order-email').value = c.email;
    if ($('#order-token') && c.token) $('#order-token').value = c.token;
  }

  function load() {
    if (credentials) return credentials;
    try {
      const raw = sessionStorage.getItem('hh-dujiao-order') || localStorage.getItem('hh-dujiao-order');
      if (raw) {
        credentials = JSON.parse(raw);
        return credentials;
      }
    } catch {}
    return null;
  }

  function accessFields() {
    const rawDomId = ($('#order-number')?.value || '').trim();
    const rawDomEmail = ($('#order-email')?.value || '').trim().toLowerCase();
    const rawDomToken = ($('#order-token')?.value || '').trim();
    return {
      id: rawDomId || credentials?.id || '',
      email: rawDomEmail || credentials?.email || '',
      token: rawDomToken || credentials?.token || ''
    };
  }

  function error(e) {
    const a = $('#payment-error');
    if (a) a.textContent = e.message;
  }

  function credentialsHTML(c) {
    return `
      <div class="order-credentials">
        <p>下单邮箱</p>
        <code>${esc(c.email)}</code>
        <p>订单密码（用于在“查单”中心自查卡密）</p>
        <code class="order-token" style="color:#0071e3;font-weight:700;">${esc(c.token)}</code>
        <p>订单编号</p>
        <code class="order-token">${esc(c.id || '正在创建…')}</code>
        <button class="secondary" id="copy-order" type="button">复制订单编号、邮箱与密码</button>
      </div>
    `;
  }

  function wireCopy(c) {
    $('#copy-order')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(`订单编号：${c.id || '待查询'}\n下单邮箱：${c.email}\n订单密码：${c.token}`);
        const btn = $('#copy-order');
        if (btn) btn.textContent = '已复制到剪贴板 ✓';
        setTimeout(() => {
          const b = $('#copy-order');
          if (b) b.textContent = '复制订单编号、邮箱与密码';
        }, 2000);
      } catch {
        const btn = $('#copy-order');
        if (btn) btn.textContent = '请手动复制上方信息';
      }
    });
  }

  function checkout(id) {
    const p = cfg?.products.find(p => p.id === id);
    if (!p?.available) return;

    lastCheckoutState.productId = id;
    setCheckoutStep('product');
    if (checkoutId) {
      document.querySelectorAll('.checkout-steps>span').forEach((s, i) => s.classList.toggle('current', i === 1));
      const titleH1 = document.querySelector('.checkout-title h1');
      if (titleH1) titleH1.textContent = '确认你的订阅方案';
    }

    const user = window.hhAccount?.user;
    const userBalance = Number(user?.wallet?.balance || 0);

    const savedCreds = load();
    const initialEmail = lastCheckoutState.email || (savedCreds?.email && !savedCreds.email.endsWith('@guest.hh.ai') ? savedCreds.email : '');
    const initialPassword = lastCheckoutState.password || savedCreds?.token || '';
    const initialQty = lastCheckoutState.quantity || 1;

    $('#product-detail').innerHTML = `
      <div class="checkout-layout">
        <div class="checkout-main">
          <!-- 1. 商品规格卡片 (参考图顶部) -->
          <section class="checkout-panel">
            <div class="checkout-product">
              <div class="checkout-logo"><img src="chatgpt-metallic.jpg" alt="ChatGPT" width="60" height="60" style="border-radius:14px;object-fit:cover;display:block;" /></div>
              <div style="flex:1;">
                <h3 style="font-size:17px;font-weight:700;margin:0 0 6px;">${esc(p.name)} 月卡 | 菲区 官方正规充值【质保30天】【秒冲】</h3>
                <div style="font-size:13px;color:var(--apple-text-secondary);display:flex;gap:14px;margin-bottom:6px;">
                  <span>数量: <b id="display-quantity">${initialQty}</b></span>
                  <span>规格: 默认规格</span>
                </div>
                <strong style="color:var(--apple-text-primary);font-size:18px;">${money(p.amountCents / 100)} <small style="font-size:12px;font-weight:normal;">CNY</small></strong>
              </div>
            </div>
            <label class="checkout-quantity" style="margin-top:16px;">
              <span>购买月数 / 份数</span>
              <input aria-label="购买数量" id="pay-quantity" type="number" min="1" max="10" step="1" value="${initialQty}">
            </label>
          </section>

          <!-- 2. 优惠券卡片 (参考图第二块) -->
          <section class="checkout-panel checkout-coupon-card">
            <h2 style="font-size:16px;margin-bottom:12px;">优惠券</h2>
            <div class="coupon-input-wrap">
              <input id="coupon-code-input" class="checkout-field-input" type="text" placeholder="输入优惠券代码（可选）">
            </div>
          </section>

          <!-- 3. 购买方式与邮箱密码 (参考图核心第三块) -->
          <section class="checkout-panel">
            <h2 style="font-size:16px;margin-bottom:6px;">购买方式</h2>
            <div class="purchase-pills-row" style="display:flex;gap:10px;margin:12px 0 16px;flex-wrap:wrap;">
              <button type="button" class="purchase-pill-btn ${!user ? 'active' : ''}" id="pill-guest-mode">⚡ 游客直接购买（免登录）</button>
              <button type="button" class="purchase-pill-btn ${user ? 'active' : ''}" id="pill-member-mode">${user ? '✓ 会员已登录' : '👤 会员登录购买（可享余额秒付）'}</button>
            </div>

            ${user ? `
              <div class="checkout-member-badge">
                <span class="member-tag">✓ 会员账号已登录</span>
                <span class="member-email">${esc(user.email)}</span>
                <span class="member-balance-tag">当前钱包余额: <b>¥${money(userBalance)}</b></span>
              </div>
              <input id="purchase-email" type="hidden" value="${esc(user.email)}">
              <input id="purchase-password" type="hidden" value="member-authenticated">
            ` : `
              <div class="checkout-dual-inputs">
                <div class="checkout-field-col">
                  <label class="checkout-field-label" for="purchase-email">接收邮箱（用于接收卡密与查单）</label>
                  <input id="purchase-email" class="checkout-field-input" type="email" maxlength="254" autocomplete="email" placeholder="输入可接收卡密的邮箱" value="${esc(initialEmail)}">
                </div>
                <div class="checkout-field-col">
                  <label class="checkout-field-label" for="purchase-password">订单查询密码</label>
                  <input id="purchase-password" class="checkout-field-input" type="text" maxlength="64" autocomplete="off" placeholder="设置4位以上查询密码" value="${esc(initialPassword)}">
                </div>
              </div>

              <!-- 填写说明 (复刻参考图的绿色说明卡片) -->
              <div class="checkout-guide-note">
                <strong>填写说明:</strong>
                <ul>
                  <li><b>接收邮箱：</b>请填写常用邮箱，支付成功后系统将向该邮箱发放专属 ChatGPT 兑换卡密及官方兑换链接。</li>
                  <li><b>订单密码：</b>请自行设置一个 4 位以上查询密码，该密码用于您在购买之后，通过顶部“查单”随时提取卡密。</li>
                </ul>
              </div>
            `}
          </section>
        </div>

        <!-- 右侧结算面板 (参考图右侧面板) -->
        <aside class="checkout-panel checkout-summary">
          <h2 style="font-size:18px;margin-bottom:12px;">提交订单</h2>
          <div class="summary-disclaimer">订单金额以服务端计算为准 (活动价/优惠券在服务端处理)</div>

          <div class="receipt-line">
            <span>商品数量</span>
            <span id="summary-quantity">1</span>
          </div>
          <div class="receipt-line">
            <span>原始金额</span>
            <span id="summary-orig-amt">${money(p.amountCents / 100)} CNY</span>
          </div>
          <div class="receipt-line">
            <span>优惠券</span>
            <span>0.00 CNY</span>
          </div>
          <div class="receipt-line">
            <span>活动价</span>
            <span>0.00 CNY</span>
          </div>
          <div class="receipt-line">
            <span>批发价</span>
            <span>0.00 CNY</span>
          </div>

          <div class="checkout-total" style="padding-top:16px;margin-top:16px;">
            <span>应付金额 (预估)</span>
            <strong id="checkout-total">${money(p.amountCents / 100)} CNY</strong>
          </div>

          ${user ? `
            <div class="checkout-balance-box" style="margin-top:16px;">
              <div class="balance-box-head">
                <span>💎 账户余额抵扣</span>
                <strong class="balance-curr-val">¥${money(userBalance)}</strong>
              </div>
              <div id="balance-pay-status-text" class="balance-status-text">
                ${userBalance >= (p.amountCents / 100)
                  ? '<span class="text-success">✓ 余额充足，下单后可直接一键秒付，免跳转收银台！</span>'
                  : `<span class="text-warn">⚠️ 余额不足（还缺 ¥${money((p.amountCents / 100) - userBalance)}），可先 <a href="#" id="checkout-do-recharge" class="btn-link">点击充值余额</a> 或使用在线收银台支付</span>`}
              </div>
            </div>
          ` : ''}

          <div class="checkout-payment-title" style="margin-top:20px;">支付方式</div>
          ${paymentCards(cfg.channels)}

          <label class="payment-check" style="margin-top:16px;">
            <input type="checkbox" id="pay-consent" checked>
            <span>我已核对商品规格，确认方案与邮箱信息无误。</span>
          </label>
          <div id="payment-error" class="payment-error" role="status"></div>
          <button class="primary wide" id="create-payment" style="background:#0071e3;box-shadow:0 4px 14px rgba(0,113,227,0.3);">
            ${user && userBalance >= (p.amountCents / 100) ? '确认订单并使用余额秒付 →' : '提交订单并支付'}
          </button>
          <p class="checkout-summary-note">官方合规渠道充值 · 7×24H 掉单包赔 · 全周期质保</p>
        </aside>
      </div>
    `;

    document.getElementById('pill-member-mode')?.addEventListener('click', () => {
      if (!window.hhAccount?.user) {
        window.hhAccount?.openAuth('login');
      }
    });

    document.getElementById('checkout-do-recharge')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.hhAccount?.openWallet();
    });

    const emailInput = $('#purchase-email');
    emailInput?.addEventListener('input', () => {
      lastCheckoutState.email = emailInput.value.trim();
    });
    const pwdInput = $('#purchase-password');
    pwdInput?.addEventListener('input', () => {
      lastCheckoutState.password = pwdInput.value.trim();
    });

    const quantityInput = $('#pay-quantity');
    quantityInput?.addEventListener('input', () => {
      const n = Math.max(1, Math.min(10, Number(quantityInput.value) || 1));
      lastCheckoutState.quantity = n;
      const total = (p.amountCents / 100) * n;
      $('#checkout-total').textContent = money(total) + ' CNY';
      $('#summary-orig-amt').textContent = money(total) + ' CNY';
      $('#summary-quantity').textContent = String(n);
      const dispQty = document.getElementById('display-quantity');
      if (dispQty) dispQty.textContent = String(n);

      if (user) {
        const textElem = $('#balance-pay-status-text');
        const submitBtn = $('#create-payment');
        if (textElem) {
          if (userBalance >= total) {
            textElem.innerHTML = '<span class="text-success">✓ 余额充足，下单后可直接一键秒付，免跳转收银台！</span>';
            if (submitBtn) submitBtn.textContent = '确认订单并使用余额秒付 →';
          } else {
            textElem.innerHTML = `<span class="text-warn">⚠️ 余额不足（还缺 ¥${money(total - userBalance)}），可先 <a href="#" id="checkout-do-recharge-2" class="btn-link">点击充值余额</a> 或使用在线收银台支付</span>`;
            if (submitBtn) submitBtn.textContent = '提交订单并前往支付 →';
            document.getElementById('checkout-do-recharge-2')?.addEventListener('click', (e) => {
              e.preventDefault();
              window.hhAccount?.openWallet();
            });
          }
        }
      }
    });

    const key = crypto.randomUUID();

    $('#create-payment')?.addEventListener('click', async () => {
      const button = $('#create-payment');
      let submitted = false;
      let popup = null;
      try {
        const isMember = Boolean(window.hhAccount?.user);
        let email = ($('#purchase-email')?.value || '').trim().toLowerCase();
        let orderPassword = ($('#purchase-password')?.value || '').trim();
        const quantity = Number($('#pay-quantity')?.value || 1);
        lastCheckoutState.email = email;
        lastCheckoutState.password = orderPassword;
        lastCheckoutState.quantity = quantity;

        if (!isMember) {
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw Error('请填写正确的邮箱地址（用于接收卡密与后续查单）');
          }
          if (!orderPassword || orderPassword.length < 4) {
            throw Error('请设置订单查询密码（至少 4 位，用于后续通过“查单”功能提取卡密）');
          }
        } else {
          email = window.hhAccount?.user?.email || email;
          orderPassword = orderPassword || 'member-authenticated';
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw Error('购买数量需为 1–10 份');
        if (!$('#pay-consent')?.checked) throw Error('请勾选确认商品规格与购买信息');

        preferredChannel = chosenChannel();
        const c = { email, token: orderPassword, id: '' };
        save(c);

        const totalCost = (p.amountCents / 100) * quantity;
        const canUseBalance = isMember && userBalance >= totalCost;

        button.disabled = true;
        button.textContent = '正在生成订单…';
        submitted = true;

        const res = await api('/api/commerce/orders', {
          data: {
            productId: id,
            quantity,
            email,
            token: orderPassword,
            key,
            member: isMember
          }
        });
        const order = res.order || res.data?.order;
        c.id = order.order_no || order.id;
        save(c);

        // If user has balance and clicked "balance pay", immediately execute balance payment!
        if (canUseBalance) {
          button.textContent = '正在使用账户余额扣款…';
          try {
            const payRes = await api(`/api/commerce/orders/${encodeURIComponent(c.id)}/checkout`, {
              data: { useBalance: true, channelId: 0 },
              access: null
            });
            const payment = payRes.payment || payRes.data?.payment;
            if (payment?.order_paid) {
              await window.hhAccount?.refreshUser();
              showPaidSuccess(order, c);
              return;
            }
          } catch (payErr) {
            console.error('Balance pay error, fallback to cashier:', payErr);
          }
        }

        // Online cashier payment
        button.textContent = '正在拉起在线收银台…';
        const checkRes = await api(`/api/commerce/orders/${encodeURIComponent(c.id)}/checkout`, {
          data: { channelId: preferredChannel },
          access: isMember ? null : c
        });
        const payment = checkRes.payment || checkRes.data?.payment || {};

        if (payment.order_paid) {
          showPaidSuccess(order, c);
          return;
        }

        let payUrlStr = payment.pay_url || '';
        if (!payUrlStr.startsWith('http://') && !payUrlStr.startsWith('https://')) {
          payUrlStr = new URL(payUrlStr || ('/?order=' + encodeURIComponent(c.id)), location.origin).href;
        }

        showWaitingForPayment(order, c, payUrlStr, payment);
      } catch (e) {
        error(e);
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = submitted ? '重新提交并付款 →' : '直接付款，前往收银台 →';
        }
      }
    });
  }

  function showPaidSuccess(order, c) {
    setCheckoutStep('success');
    if (window.__hhOrderPollTimer) {
      clearInterval(window.__hhOrderPollTimer);
      window.__hhOrderPollTimer = null;
    }
    if (window.__hhCountdownTimer) {
      clearInterval(window.__hhCountdownTimer);
      window.__hhCountdownTimer = null;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    const cardKey = extractCardKey(order);
    if (checkoutId) {
      document.querySelectorAll('.checkout-steps>span').forEach((s, i) => s.classList.toggle('current', i === 3));
      $('.checkout-title h1').textContent = cardKey ? '支付成功 · 专属卡密已发放' : '支付成功 · 正在准备卡密';
    }
    $('#product-detail').innerHTML = `
      <div class="checkout-layout">
        <section class="checkout-panel paid-success-panel">
          <div class="paid-success-icon">🎉</div>
          <div class="checkout-heading">Hh AI / 订单支付成功</div>
          <h2>${cardKey ? '支付确认成功 · 专属提货卡密已发放' : '支付确认成功 · 正在准备兑换卡密'}</h2>
          <p class="paid-success-tip">${cardKey ? '请保存真实卡密并前往已配置的兑换入口。' : '到账状态已经更新，真实卡密交付后会显示在订单中心。'}</p>
          ${renderFulfillmentCard(order)}
          ${credentialsHTML(c)}
          <div class="paid-success-actions">
            <button class="primary wide" id="success-view-orders">进入订单查询随时自查 →</button>
            <a class="secondary wide" href="${siteUrl()}">返回商城首页</a>
          </div>
        </section>
      </div>
    `;
    wireCopy(c);
    if (cardKey) wireRedeemCopy(cardKey, getRedeemConfig().url);
    $('#success-view-orders')?.addEventListener('click', () => orderView(c));
  }

  function showWaitingForPayment(order, c, payUrl, payment) {
    setCheckoutStep('cashier');
    if (window.__hhOrderPollTimer) {
      clearInterval(window.__hhOrderPollTimer);
      window.__hhOrderPollTimer = null;
    }
    if (window.__hhCountdownTimer) {
      clearInterval(window.__hhCountdownTimer);
      window.__hhCountdownTimer = null;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (checkoutId) {
      document.querySelectorAll('.checkout-steps>span').forEach((s, i) => s.classList.toggle('current', i === 2));
      $('.checkout-title h1').textContent = '收银台 · 请扫码或转账付款';
    }

    const orderAmountCents = Number(order.total_amount_cents || (order.total_amount ? Math.round(Number(order.total_amount) * 100) : 13500));
    const amountUsdt = payment?.amount_usdt || (orderAmountCents / 720).toFixed(2);
    const amountCny = payment?.amount_cny || money(order.total_amount || (orderAmountCents / 100));
    const bscAddress = '0xfd230ae698aa051ed7ee982ac19d0ff87a163c69';
    const trc20Address = 'TJosRGMTxnM7uR7h5KFgU1YXwwGXY6XqV9';

    let currentNetwork = (payment?.network === 'TRC20' || payment?.channel_id === 1 || preferredChannel === 1) ? 'TRC20' : 'BEP20';
    let currentAddress = currentNetwork === 'BEP20' ? bscAddress : trc20Address;
    const isBep20 = currentNetwork === 'BEP20';
    const networkShort = currentNetwork;
    const networkFullName = isBep20 ? 'BNB Smart Chain (BSC / BEP20)' : 'TRON (TRC20)';
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(currentAddress);

    $('#product-detail').innerHTML = `
      <div class="checkout-layout">
        <section class="checkout-panel cashier-main-panel">
          <div class="cashier-header">
            <div class="cashier-brand-row">
              <div class="cashier-brand-badge">
                <span class="cashier-lock-icon">🔒</span>
                <span>Hh AI 独立在线收银台 · 金融级加密直连</span>
              </div>
              <div class="cashier-countdown-pill" id="cashier-timer-pill">
                <span>⏳ 支付剩余时间</span>
                <strong id="cashier-countdown-display">14:59</strong>
              </div>
            </div>
            <h2>请使用 Web3 钱包扫码或转账付款</h2>
            <p class="cashier-subtitle">
              系统已锁定专属支付通道。到账后公链节点将在 15~30 秒内完成确认，并在当前页面自动发放 <b>ChatGPT 专属提货卡密</b> 与 <b>自动兑换入口</b>。
            </p>
          </div>

          <!-- 付款公链网络选择器 (双链并排，币安智能链置顶推荐) -->
          <div class="cashier-network-selector-box">
            <div class="selector-header-title">
              <span>选择支付公链网络</span>
              <small style="color:var(--apple-text-secondary);font-size:12px;font-weight:normal;">（支持币安、OKX 或任意 Web3 钱包扫码或提现转账）</small>
            </div>
            <div class="cashier-chains-grid">
              <!-- 币安智能链 (BEP20) - 推荐置顶 -->
              <button type="button" class="cashier-chain-tab ${isBep20 ? 'active' : ''}" id="cashier-tab-bep20" data-chain="bep20">
                <div class="tab-badge-row">
                  <span class="badge-rec-pill">🔥 推荐 · 手续费低</span>
                  <span class="chain-check-icon">${isBep20 ? '✓' : ''}</span>
                </div>
                <div class="tab-main-row">
                  <span class="tab-chain-tag tag-bnb">BNB</span>
                  <div class="tab-text-wrap">
                    <strong>币安智能链 (BSC / BEP20)</strong>
                    <small>转账 Gas 极低 (仅约 ¥0.5) · 极速秒级确认</small>
                  </div>
                </div>
              </button>

              <!-- 波场网络 (TRC20) -->
              <button type="button" class="cashier-chain-tab ${!isBep20 ? 'active' : ''}" id="cashier-tab-trc20" data-chain="trc20">
                <div class="tab-badge-row">
                  <span class="badge-normal-pill">通用通道</span>
                  <span class="chain-check-icon">${!isBep20 ? '✓' : ''}</span>
                </div>
                <div class="tab-main-row">
                  <span class="tab-chain-tag tag-trx">TRX</span>
                  <div class="tab-text-wrap">
                    <strong>波场网络 (TRON / TRC20)</strong>
                    <small>主流交易所通用 · 节点智能同步</small>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- 核心支付金额凭据卡片 -->
          <div class="cashier-bill-card">
            <div class="cashier-bill-amount-row">
              <div class="cashier-crypto-amount">
                <span class="crypto-currency-tag">实际应付代币</span>
                <div class="crypto-val-wrap">
                  <span class="crypto-number" id="cashier-crypto-num">${esc(amountUsdt)}</span>
                  <span class="crypto-unit">USDT</span>
                  <button class="btn-copy-mini" id="btn-copy-usdt-amount" type="button" title="复制应付金额">复制金额</button>
                </div>
              </div>
              <div class="cashier-fiat-amount">
                <span class="fiat-label">参考计价</span>
                <span class="fiat-value">¥${esc(amountCny)} CNY</span>
              </div>
            </div>

            <div class="cashier-network-row">
              <span class="network-badge-pill">
                <span class="network-dot"></span>
                <span>付款公链：<strong>${esc(networkFullName)}</strong></span>
              </span>
              <span class="network-warn-pill">⚠️ 必须使用此网络转账</span>
            </div>
          </div>

          <!-- 核心扫码与地址并排布局 -->
          <div class="cashier-qr-address-card">
            <div class="cashier-qr-col">
              <div class="cashier-qr-frame">
                <img id="cashier-qr-img" src="${esc(qrUrl)}" alt="USDT 收款二维码" />
                <div class="qr-usdt-overlay">₮</div>
              </div>
              <div class="cashier-qr-caption">支持 OKX / 币安 / 链上钱包 扫一扫</div>
            </div>

            <div class="cashier-address-col">
              <div class="address-label-row">
                <span>USDT 收款钱包地址 (${esc(networkShort)})</span>
                <span class="address-safe-tag">✓ 专属有效地址</span>
              </div>
              <div class="address-box-display" id="cashier-wallet-address-display">
                ${esc(currentAddress)}
              </div>
              <button class="primary wide btn-copy-address-prominent" id="btn-copy-cashier-address" type="button">
                📋 一键复制收款钱包地址
              </button>
              <div class="copy-success-tip" id="copy-address-feedback" style="display:none;">
                ✓ 钱包地址已成功复制到剪贴板！
              </div>
            </div>
          </div>

          <!-- 转账必读提示 -->
          <div class="cashier-notice-card">
            <div class="notice-title">💡 转账注意事项：</div>
            <ul>
              <li><b>实付金额一致：</b>收款地址必须实际收到 <b>${esc(amountUsdt)} USDT</b>。若交易所提现扣手续费，请确保“实际到账”与上方金额完全一致。</li>
              <li><b>必须使用指定网络：</b>请选择 <b id="cashier-notice-net-name">${esc(networkShort)}</b> 链上提现/转账，切勿错选其他公链网络。</li>
              <li><b>秒级自动交付：</b>区块链网络确认后（约 15~30 秒），系统将在此页面自动出密，无需人工审核。</li>
            </ul>
          </div>

          <!-- 状态条与模拟测试操作 -->
          <div class="cashier-status-bar">
            <div class="polling-indicator-wrap">
              <span class="status-pulse-dot-green"></span>
              <span id="cashier-listener-text">正在实时监听公链入账信号 (每 2.5 秒自动同步)…</span>
            </div>

            <div class="cashier-action-buttons">
              <button class="primary wide btn-simulate-success" id="btn-simulate-cashier-paid" type="button">
                ⚡ 模拟扫码支付成功（立即出密验证） →
              </button>
              <div class="cashier-sub-actions">
                <button class="secondary btn-refresh-check" id="btn-manual-poll-now" type="button">
                  🔄 已完成转账，立即核验
                </button>
                <button class="btn-cashier-cancel" id="btn-cashier-back-checkout" type="button">
                  ← 返回修改订单
                </button>
              </div>
            </div>
          </div>

          ${credentialsHTML(c)}
        </section>

        <aside class="checkout-panel checkout-summary">
          <h2>订单信息</h2>
          <div class="receipt-line">
            <span>订单编号</span>
            <code style="font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(order.order_no || c.id)}</code>
          </div>
          <div class="receipt-line">
            <span>下单邮箱</span>
            <span>${esc(c.email)}</span>
          </div>
          <div class="receipt-line">
            <span>订单密码</span>
            <span style="font-weight:600;color:#0071e3;">${esc(c.token)}</span>
          </div>
          <div class="receipt-line">
            <span>交付保障</span>
            <span class="guarantee-text">官方Visa实卡 · 秒级自动发货</span>
          </div>
          <div class="checkout-total">
            <span>应付金额</span>
            <strong>¥${esc(amountCny)} CNY</strong>
          </div>
          <p class="checkout-summary-note" style="margin-top:20px;text-align:left;line-height:1.6;">
            💡 <b>温馨提示：</b>本收银台页面请保持开启，支付成功后无需刷新，页面将自动跳转显示兑换卡密。您也可随时使用上方邮箱和订单密码在顶部“查单”中心自查。
          </p>
        </aside>
      </div>
    `;

    wireCopy(c);

    // 15-minute countdown
    let remainingSecs = 15 * 60;
    const timerDisplay = $('#cashier-countdown-display');
    window.__hhCountdownTimer = setInterval(() => {
      remainingSecs--;
      if (remainingSecs <= 0) {
        clearInterval(window.__hhCountdownTimer);
        window.__hhCountdownTimer = null;
        if (timerDisplay) timerDisplay.textContent = '已超时';
        return;
      }
      const m = String(Math.floor(remainingSecs / 60)).padStart(2, '0');
      const s = String(remainingSecs % 60).padStart(2, '0');
      if (timerDisplay) timerDisplay.textContent = `${m}:${s}`;
    }, 1000);

    // Network switcher handlers (BSC BEP20 <-> TRON TRC20)
    const updateCashierNetwork = (chain) => {
      const bep = chain === 'bep20';
      currentNetwork = bep ? 'BEP20' : 'TRC20';
      currentAddress = bep ? bscAddress : trc20Address;
      preferredChannel = bep ? 2 : 1;

      // Update tabs
      const tabBep = document.getElementById('cashier-tab-bep20');
      const tabTrc = document.getElementById('cashier-tab-trc20');
      if (tabBep && tabTrc) {
        tabBep.classList.toggle('active', bep);
        tabTrc.classList.toggle('active', !bep);
        const checkBep = tabBep.querySelector('.chain-check-icon');
        const checkTrc = tabTrc.querySelector('.chain-check-icon');
        if (checkBep) checkBep.textContent = bep ? '✓' : '';
        if (checkTrc) checkTrc.textContent = !bep ? '✓' : '';
      }

      // Update network row badge
      const netFullName = bep ? 'BNB Smart Chain (BSC / BEP20)' : 'TRON (TRC20)';
      const netShort = bep ? 'BEP20' : 'TRC20';
      const netPill = document.querySelector('.cashier-network-row strong');
      if (netPill) netPill.textContent = netFullName;

      // Update QR code
      const qrImg = document.getElementById('cashier-qr-img');
      if (qrImg) {
        qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + encodeURIComponent(currentAddress);
      }

      // Update Address Display
      const addrDisplay = document.getElementById('cashier-wallet-address-display');
      if (addrDisplay) {
        addrDisplay.textContent = currentAddress;
      }

      // Update Address Label
      const addrLabel = document.querySelector('.address-label-row span:first-child');
      if (addrLabel) {
        addrLabel.textContent = `USDT 收款钱包地址 (${netShort})`;
      }

      // Update Notice
      const noticeItem = document.getElementById('cashier-notice-net-name');
      if (noticeItem) {
        noticeItem.textContent = netShort;
      }
    };

    document.getElementById('cashier-tab-bep20')?.addEventListener('click', () => updateCashierNetwork('bep20'));
    document.getElementById('cashier-tab-trc20')?.addEventListener('click', () => updateCashierNetwork('trc20'));

    // Copy wallet address (copies the currently selected network address)
    $('#btn-copy-cashier-address')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentAddress);
        const tip = $('#copy-address-feedback');
        if (tip) {
          tip.style.display = 'block';
          setTimeout(() => { tip.style.display = 'none'; }, 3000);
        }
      } catch {
        const ta = document.createElement('textarea');
        ta.value = currentAddress;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        const tip = $('#copy-address-feedback');
        if (tip) {
          tip.style.display = 'block';
          setTimeout(() => { tip.style.display = 'none'; }, 3000);
        }
      }
    });

    // Copy USDT amount
    $('#btn-copy-usdt-amount')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(amountUsdt);
        const btn = $('#btn-copy-usdt-amount');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = '已复制';
          setTimeout(() => { btn.textContent = orig; }, 2000);
        }
      } catch {}
    });

    // Back to checkout
    $('#btn-cashier-back-checkout')?.addEventListener('click', () => {
      handleCheckoutBack();
    });

    const isMember = Boolean(window.hhAccount?.user);

    const checkStatus = async (manual = false) => {
      try {
        if (manual) {
          const btn = $('#btn-manual-poll-now');
          if (btn) btn.textContent = '正在核验支付结果…';
        }
        const { order: latest } = await api('/api/commerce/orders/' + encodeURIComponent(c.id), {
          access: isMember ? null : c
        });
        if (latest && ['paid', 'fulfilling', 'partially_delivered', 'delivered', 'completed'].includes(latest.status)) {
          if (window.__hhOrderPollTimer) {
            clearInterval(window.__hhOrderPollTimer);
            window.__hhOrderPollTimer = null;
          }
          if (window.__hhCountdownTimer) {
            clearInterval(window.__hhCountdownTimer);
            window.__hhCountdownTimer = null;
          }
          showPaidSuccess(latest, c);
          if (isMember) {
            window.hhAccount?.refreshUser();
          }
          return true;
        }
        if (latest && ['canceled', 'refunded', 'partially_refunded'].includes(latest.status)) {
          clearInterval(window.__hhOrderPollTimer);
          window.__hhOrderPollTimer = null;
          if (window.__hhCountdownTimer) {
            clearInterval(window.__hhCountdownTimer);
            window.__hhCountdownTimer = null;
          }
          orderView(c);
          return false;
        }
        if (manual) {
          const btn = $('#btn-manual-poll-now');
          if (btn) btn.textContent = '未检测到到账，点此再次刷新 →';
        }
      } catch (e) {
        console.error('Polling check status error:', e);
        if (manual) {
          const btn = $('#btn-manual-poll-now');
          if (btn) btn.textContent = '查询出错，点击重试 →';
        }
      }
      return false;
    };

    // Simulate payment success button
    $('#btn-simulate-cashier-paid')?.addEventListener('click', async () => {
      const b = $('#btn-simulate-cashier-paid');
      b.disabled = true;
      b.textContent = '⏳ 正在向公链广播入账确认 (1/3)…';
      try {
        await api('/api/commerce/orders/' + encodeURIComponent(c.id) + '/simulate', {
          method: 'POST',
          data: { status: 'paid' },
          access: isMember ? null : c
        });
      } catch {}
      setTimeout(async () => {
        b.textContent = '✓ 区块链确认成功 (3/3)，正在出密…';
        await checkStatus(true);
      }, 600);
    });

    $('#btn-manual-poll-now')?.addEventListener('click', async () => {
      if (location.hostname.includes('github.io') || window.__isInteractivePreview) {
        try {
          await api('/api/commerce/orders/' + encodeURIComponent(c.id) + '/simulate', {
            method: 'POST',
            data: { status: 'paid' },
            access: isMember ? null : c
          });
        } catch {}
      }
      await checkStatus(true);
    });

    window.__hhOrderPollTimer = setInterval(async () => {
      if (!document.hidden && document.getElementById('btn-manual-poll-now')) {
        await checkStatus(false);
      }
    }, 2500);
  }

  function showOrder(order, c) {
    const allowed = order.allowed_payment_channel_ids;
    const channels = (cfg?.channels || []).filter(x => !allowed?.length || allowed.includes(x.id));
    const pending = order.status === 'pending_payment', expired = order.expires_at && Date.parse(order.expires_at) <= Date.now();
    const user = window.hhAccount?.user;
    const userBalance = Number(user?.wallet?.balance || 0);
    const orderTotal = Number(order.total_amount || 0);

    if (checkoutId) {
      document.querySelectorAll('.checkout-steps>span').forEach((s, i) => s.classList.toggle('current', i === 2));
      $('.checkout-title h1').textContent = '订单已创建，请选择付款方式';
    }
    if (preferredChannel && !channels.some(x => x.id === preferredChannel)) preferredChannel = null;

    $('#product-detail').innerHTML = `
      <div class="checkout-layout">
        <section class="checkout-panel">
          <div class="checkout-heading">Hh AI / 订单信息</div>
          <h2>${esc(statusNames[order.status] || order.status)}</h2>
          ${credentialsHTML(c)}
          <p class="checkout-description">请保存查询凭证，以便随时跨设备查询订单处理与交付进度。</p>
          <button class="secondary wide" id="view-order-status">查看实时订单状态</button>
        </section>

        <aside class="checkout-panel checkout-summary">
          <h2>发起支付</h2>
          <div class="checkout-total">
            <span>订单金额</span>
            <strong>${esc(order.currency)} ${money(order.total_amount)}</strong>
          </div>

          ${pending && !expired ? `
            ${user ? `
              <div class="checkout-balance-box">
                <div class="balance-box-head">
                  <span>💎 账户可用余额</span>
                  <strong class="balance-curr-val">¥${money(userBalance)}</strong>
                </div>
                ${userBalance >= orderTotal ? `
                  <button class="primary wide btn-balance-instant" id="btn-balance-pay-direct">
                    ⚡ 使用账户余额秒付 (¥${money(orderTotal)}) →
                  </button>
                  <div class="balance-instant-note">点击直接扣减账户余额，无需跳转外部收银台</div>
                ` : `
                  <div class="balance-status-text">
                    <span class="text-warn">账户余额不足以支付当前订单 (差额 ¥${money(orderTotal - userBalance)})</span>
                    <button class="secondary wide" id="order-quick-topup" style="margin-top:8px;">+ 充值钱包余额</button>
                  </div>
                `}
              </div>
            ` : ''}

            <div class="checkout-payment-title" style="margin-top:20px;">在线收银台支付</div>
            ${channels.length ? `
              ${paymentCards(channels)}
              <button class="primary wide" id="go-pay">前往在线收银台支付 →</button>
            ` : '<div class="detail-note">在线收银通道配置中。</div>'}
          ` : ''}

          <div id="payment-error" class="payment-error" role="status"></div>
        </aside>
      </div>
    `;

    wireCopy(c);
    $('#view-order-status')?.addEventListener('click', () => orderView(c));

    $('#order-quick-topup')?.addEventListener('click', () => {
      window.hhAccount?.openWallet();
    });

    $('#btn-balance-pay-direct')?.addEventListener('click', async () => {
      const b = $('#btn-balance-pay-direct');
      b.disabled = true;
      b.textContent = '正在从账户余额扣款…';
      try {
        const { payment } = await api(`/api/commerce/orders/${encodeURIComponent(c.id)}/checkout`, {
          data: { useBalance: true, channelId: 0 }
        });
        if (payment.order_paid) {
          await window.hhAccount?.refreshUser();
          showPaidSuccess(order, c);
        } else {
          throw Error('余额扣款未完成，请重试');
        }
      } catch (err) {
        error(err);
        b.disabled = false;
        b.textContent = `⚡ 使用账户余额秒付 (¥${money(orderTotal)}) →`;
      }
    });

    $('#go-pay')?.addEventListener('click', async () => {
      const b = $('#go-pay');
      b.disabled = true;
      b.textContent = '正在拉起在线收银台…';
      try {
        const { payment } = await api(`/api/commerce/orders/${encodeURIComponent(c.id)}/checkout`, {
          data: { channelId: chosenChannel() },
          access: user ? null : c
        });
        if (payment.order_paid) {
          orderView(c);
          return;
        }
        let payUrlStr = payment.pay_url || '';
        if (!payUrlStr.startsWith('http://') && !payUrlStr.startsWith('https://')) {
          payUrlStr = new URL(payUrlStr || ('/?order=' + encodeURIComponent(c.id)), location.origin).href;
        }
        showWaitingForPayment(order, c, payUrlStr, payment);
      } catch (e) {
        error(e);
      } finally {
        b.disabled = false;
        b.textContent = '前往在线收银台支付 →';
      }
    });
  }

  function deliveries(order) {
    return [order, ...(order.children || [])].flatMap(o => o.fulfillment?.payload ? [o.fulfillment.payload] : []);
  }

  async function query(automatic = false, targetOrderId = null) {
    clearTimeout(timer);
    await window.hhAccount?.ready;
    const c = accessFields(), area = $('#order-result');
    const orderNoToQuery = targetOrderId || c.id;
    const isUser = Boolean(window.hhAccount?.user);
    if (!isUser && (!c.email || !c.token) && !orderNoToQuery) {
      area.innerHTML = '<div style="padding:16px;text-align:center;color:#666;">请输入下单邮箱和订单密码以查询卡密</div>';
      return;
    }
    if (!automatic) area.innerHTML = '<div style="padding:20px;text-align:center;color:#86868b;">正在查询订单与卡密信息…</div>';
    try {
      if (!orderNoToQuery) {
        const { orders } = await api('/api/commerce/orders', { access: isUser ? null : c });
        if (!orders || !orders.length) {
          area.innerHTML = '<div style="padding:20px;text-align:center;color:#666;background:#f8f9fa;border-radius:12px;margin-bottom:20px;">未查询到相关订单，请确认邮箱和订单密码是否正确。</div>';
          return;
        }
        if (orders.length === 1) {
          return query(false, orders[0].order_no);
        }
        area.innerHTML = `
          <div style="background:#fff;border:1px solid #e5e5e7;border-radius:16px;padding:20px;margin-bottom:20px;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
            <h3 style="font-size:16px;margin:0 0 14px 0;font-weight:600;">找到以下 ${orders.length} 笔订单：</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${orders.map(o => `
                <div data-dj-order="${esc(o.order_no)}" style="background:#f8f9fa;border:1px solid #e5e5e7;border-radius:12px;padding:14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;">
                  <div>
                    <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:#1d1d1f;">${esc(o.order_no)}</div>
                    <div style="color:#666;font-size:12px;">金额: ¥${money(o.total_amount)} · 状态: ${esc(statusNames[o.status] || o.status)}</div>
                  </div>
                  <button type="button" class="apple-btn secondary" style="padding:6px 14px;font-size:13px;">查看卡密 →</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        area.querySelectorAll('[data-dj-order]').forEach(item => {
          item.onclick = () => query(false, item.dataset.djOrder);
        });
        return;
      }
      const { order } = await api('/api/commerce/orders/' + encodeURIComponent(orderNoToQuery), { access: window.hhAccount?.user ? null : c });
      save({ ...c, id: orderNoToQuery });
      const pending = order.status === 'pending_payment', expired = pending && order.expires_at && Date.parse(order.expires_at) <= Date.now();
      const isFulfilled = ['paid', 'fulfilling', 'partially_delivered', 'delivered', 'completed'].includes(order.status);
      if (isFulfilled) {
        area.innerHTML = renderFulfillmentCard(order);
        const deliveredCard = extractCardKey(order);
        if (deliveredCard) wireRedeemCopy(deliveredCard, getRedeemConfig().url);
        $('#refresh-order')?.addEventListener('click', () => query(false, orderNoToQuery));
        const trigger = document.getElementById('query-toggle-trigger');
        const body = document.getElementById('query-card-body');
        if (trigger && body) {
          trigger.style.display = 'block';
          body.style.display = 'none';
        }
      } else {
        area.innerHTML = `
          <div class="fulfillment-redeem-container">
            <div class="fulfillment-order-bar">
              <div class="order-bar-main">
                <span class="order-bar-badge" style="background:#fef3c7;color:#b45309;border-color:#fde68a;">${expired && pending ? '付款期限已过' : esc(statusNames[order.status] || order.status)}</span>
                <span class="order-bar-id">订单编号: <b>${esc(order.order_no)}</b></span>
                <span class="order-bar-price">应付金额: <b>¥${money(order.total_amount)}</b></span>
              </div>
              <button class="btn-refresh-pill" id="refresh-order" type="button">↻ 刷新状态</button>
            </div>
            <p style="font-size:14px;color:var(--apple-text-secondary);margin:14px 0;">${pending ? '等待系统确认付款，到账后将自动在此出密。' : '处理进度已从商城后台实时同步。'}</p>
            ${deliveries(order).map(t => `<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(typeof t === 'string' ? t : JSON.stringify(t))}</pre>`).join('')}
            <div class="payment-actions" style="margin-top:16px;">
              ${pending && !expired && cfg?.paymentReady ? '<button class="apple-btn primary" id="resume-pay">继续前往付款 →</button>' : ''}
            </div>
          </div>
        `;
        $('#refresh-order')?.addEventListener('click', () => query(false, orderNoToQuery));
        $('#resume-pay')?.addEventListener('click', () => {
          showOrder(order, c);
          $('#product-dialog')?.showModal();
        });
      }
      if (((pending && !expired) || ['paid', 'fulfilling', 'partially_delivered'].includes(order.status)) && !document.hidden) timer = setTimeout(() => {
        if (!$('#orders-view').hidden) query(true, orderNoToQuery);
      }, 8000);
    } catch (e) {
      area.innerHTML = `<div style="padding:16px;color:#d70015;background:#fff2f4;border-radius:10px;margin-bottom:16px;">${esc(e.message || '查询失败，请稍后重试')}</div>`;
    }
  }

  // Update contact dialog dynamically
  function updateContactDialog(contact) {
    const dialog = document.getElementById('contact-dialog');
    if (!dialog || !contact) return;
    const box = dialog.querySelector('.contact-card-box');
    if (box) {
      box.innerHTML = `
        <div class="contact-channel">
          <span class="contact-channel-icon">💬</span>
          <div>
            <strong>${esc(contact.online_support || '在线人工支持')}</strong>
            <small>服务时间：${esc(contact.service_hours || '周一至周日 09:00 - 24:00')}</small>
          </div>
        </div>
        ${contact.wechat ? `
          <div class="contact-channel">
            <span class="contact-channel-icon">📱</span>
            <div>
              <strong>官方微信客服：${esc(contact.wechat)}</strong>
              <small>添加微信专员，享受一对一快速开通咨询</small>
            </div>
          </div>
        ` : ''}
        ${contact.telegram ? `
          <div class="contact-channel">
            <span class="contact-channel-icon">✈️</span>
            <div>
              <strong>Telegram 客服：<a href="${esc(contact.telegram)}" target="_blank" style="color:var(--accent-blue);">${esc(contact.telegram)}</a></strong>
              <small>7×24H 极速在线客服支持</small>
            </div>
          </div>
        ` : ''}
        ${contact.email ? `
          <div class="contact-channel">
            <span class="contact-channel-icon">✉️</span>
            <div>
              <strong>客服邮箱：${esc(contact.email)}</strong>
              <small>售后或商务合作专用支持邮箱</small>
            </div>
          </div>
        ` : ''}
        <div class="detail-note">
          💡 ${esc(contact.tips || '咨询建议：如需咨询订单，请直接提供你的订单编号；请勿向任何人透露账号密码或验证码。')}
        </div>
      `;
    }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-product]');
    if (!b) return;
    const p = cfg?.products.find(p => p.id === b.dataset.product);
    const note = $('#product-detail .detail-note');
    if (note) note.textContent = cfg ? '商品价格、库存和订单由商城后台管理。' + (cfg.paymentReady ? '' : '在线收银通道尚未启用，支持账户余额秒付。') : '商城后台暂时不可用，请稍后重试。';
    const button = document.createElement('button');
    button.className = 'primary wide';
    button.style.marginTop = '12px';
    button.disabled = !p?.available || cfg?.captchaRequired;
    button.textContent = !p?.available ? '暂不可下单' : cfg?.captchaRequired ? '下单验证暂未适配' : '确认方案并结算 →';
    button.onclick = () => checkout(b.dataset.product);
    $('#product-detail').append(button);
  });

  const form = $('#query-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      query();
    });
  }

  document.getElementById('btn-toggle-lookup')?.addEventListener('click', () => {
    const trigger = document.getElementById('query-toggle-trigger');
    const body = document.getElementById('query-card-body');
    if (body) {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      const textSpan = trigger?.querySelector('.toggle-action-text');
      if (textSpan) textSpan.textContent = isHidden ? '收起自查表单 ▲' : '点击展开自查表单 ▼';
    }
  });

  try {
    const raw = sessionStorage.getItem('hh-dujiao-order') || localStorage.getItem('hh-dujiao-order');
    if (raw) {
      const c = JSON.parse(raw);
      if (c) save(c);
    }
  } catch {}

  // Re-render checkout when account changes
  document.addEventListener('hh-account-changed', () => {
    const pendingProduct = sessionStorage.getItem('hh-pending-product');
    if (window.hhAccount?.user && pendingProduct && !checkoutId) {
      sessionStorage.removeItem('hh-pending-product');
      location.href = siteUrl('?checkout=' + encodeURIComponent(pendingProduct));
      return;
    }
    const isWaitingOrSuccess = document.querySelector('.paid-success-panel') || document.querySelector('#btn-goto-cashier') || document.querySelector('.fulfillment-redeem-container');
    if (checkoutId && cfg && !isWaitingOrSuccess) {
      checkout(checkoutId);
    }
  });

  api('/api/payment-config').then(data => {
    cfg = data;
    if (cfg.contact) updateContactDialog(cfg.contact);
    for (const p of products) {
      const remote = cfg.products.find(x => x.id === p.id);
      if (remote) p.price = remote.amountCents === null ? null : remote.amountCents / 100;
    }
    render();
    if ($('.demo-caption')) {
      $('.demo-caption').textContent = '已连接 Dujiao-Next 企业级高可用服务 · 支持账户余额秒付';
    }
    if (checkoutId) {
      if (cfg.products.some(p => p.id === checkoutId && p.available) && !cfg.captchaRequired) {
        checkout(checkoutId);
      } else {
        $('#product-detail').innerHTML = '<section class="checkout-panel"><h2>当前方案暂不可下单</h2><p>商品可能已下架，或购买通道暂未开放。</p><a href="${siteUrl()}">返回商城</a></section>';
      }
      return;
    }
    const params = new URLSearchParams(location.search);
    const hasPaymentReturn = params.has('payment_return');
    const orderNoParam = params.get('order_no');
    if (hasPaymentReturn || params.get('view') === 'orders') {
      view('orders');
      if (orderNoParam) {
        if (!credentials) {
          try {
            const raw = sessionStorage.getItem('hh-dujiao-order') || localStorage.getItem('hh-dujiao-order');
            credentials = (raw ? JSON.parse(raw) : null) || {};
          } catch {
            credentials = {};
          }
        }
        credentials.id = orderNoParam;
        save(credentials);
      }
      query(false, orderNoParam || credentials?.id);
    } else if (params.get('view') === 'help') {
      view('help');
    }
  }).catch(() => {
    if ($('.demo-caption')) $('.demo-caption').textContent = '商城后台服务暂时无法连接，请确认服务已启动。';
    if (checkoutId) {
      $('#product-detail').innerHTML = '<section class="checkout-panel"><h2>暂时无法加载结算信息</h2><p>请刷新页面重试。</p><a href="${siteUrl()}">返回商城</a></section>';
    }
  });
})();
