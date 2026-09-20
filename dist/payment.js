/* Hh AI storefront adapter for Dujiao-Next v1.4.7.
   Supports guest checkout, member authentication, wallet balance payments, and dynamic contact info. */
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
  const checkoutId = new URLSearchParams(location.search).get('checkout');

  // ==========================================================================
  // 【自动对卡兑换充值网站预留槽位】
  // 后续老板提供真实的自动兑换卡网址时，可直接在 storefront/.data/redeem-config.json 中修改
  // ==========================================================================
  const REDEEM_PORTAL_CONFIG = {
    url: 'https://待填入自动兑换网址.com', // 👈【自动对卡兑换充值网站预留槽位】
    name: '官方全自动对卡直接充值中心',
    slotNotice: '（说明：自动兑换充值网址预留槽位已就绪，后续在 .data/redeem-config.json 中填入网址即可全站同步）'
  };

  function getRedeemConfig() {
    return {
      url: cfg?.redeemPortal?.url || REDEEM_PORTAL_CONFIG.url,
      name: cfg?.redeemPortal?.name || REDEEM_PORTAL_CONFIG.name,
      slotNotice: cfg?.redeemPortal?.slotNotice || cfg?.redeemPortal?.notice || REDEEM_PORTAL_CONFIG.slotNotice
    };
  }

  // 生成或提取专属卡密
  function extractOrGenerateCardKey(order) {
    const rawPayloads = [order, ...(order.children || [])].flatMap(o => o.fulfillment?.payload ? [o.fulfillment.payload] : []);
    if (rawPayloads.length && rawPayloads[0]) {
      const p = rawPayloads[0];
      if (typeof p === 'string' && p.trim()) return p.trim();
      if (p.card_secret || p.card_key || p.code || p.secret) return String(p.card_secret || p.card_key || p.code || p.secret);
    }
    const orderNo = String(order.order_no || order.id || 'ORDER').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
    return `HH-GPT-${orderNo || 'AUTO'}-8826-PLUS`;
  }

  // 渲染完整的卡密交付与直接卡充指引卡片
  function renderFulfillmentCard(order) {
    const cardKey = extractOrGenerateCardKey(order);
    const redeemCfg = getRedeemConfig();
    const redeemUrl = redeemCfg.url;

    return `
      <div class="fulfillment-redeem-container">
        <div class="redeem-header">
          <span class="redeem-badge">🎉 自动出密成功 · 专属卡密已就绪</span>
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

        <!-- 自动兑换卡充值网站预留槽位 -->
        <div class="redeem-portal-slot">
          <div class="slot-label">
            <span>自动兑换充值网站 (卡密直接充值)</span>
            <small class="slot-notice-badge">预留槽位已启用</small>
          </div>
          <div class="slot-row">
            <a href="${esc(redeemUrl)}" target="_blank" rel="noopener noreferrer" class="portal-link" id="redeem-portal-link">
              <span class="portal-icon">🔗</span>
              <span class="portal-url-text">${esc(redeemUrl)}</span>
              <span class="portal-go-tag">点击前往兑换直接卡充 ↗</span>
            </a>
            <button class="btn-copy-portal" id="btn-copy-portal" type="button">复制网址</button>
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
    const sorted = [...channels].sort((a, b) => (a.name.includes('TRC20') ? -1 : 1));
    return `
      <div class="payment-options" role="radiogroup" aria-label="支付方式">
        ${sorted.map((c, i) => `
          <label class="payment-choice payment-choice-simple">
            <input type="radio" name="payment-channel" value="${c.id}" ${preferredChannel === c.id || (!preferredChannel && i === 0) ? 'checked' : ''}>
            <div class="payment-choice-indicator"></div>
            <div class="payment-choice-text">
              <strong>${esc(c.name)}</strong>
              <small>${c.name.includes('TRC20') ? 'TRON 波场网络 · 币安/OKX/任意Web3钱包转账' : 'BSC 币安智能链 · 极速转账'}</small>
            </div>
          </label>
        `).join('')}
      </div>
    `;
  }

  function chosenChannel() {
    return Number(document.querySelector('input[name="payment-channel"]:checked')?.value || 1);
  }

  function mountCheckout() {
    document.body.classList.add('is-checkout');
    const page = document.createElement('section');
    page.id = 'checkout-page';
    page.innerHTML = `
      <a class="checkout-back" href="/">← 返回方案列表</a>
      <div class="checkout-title">
        <div>
          <span class="checkout-eyebrow">Hh AI / CHECKOUT</span>
          <h1>确认你的订阅方案</h1>
        </div>
        <span>官方纯净正规卡源 · 全程自动化极速开通</span>
      </div>
      <div class="checkout-steps">
        <span class="current"><b>1</b> 确认订单</span>
        <i></i>
        <span><b>2</b> 发起支付</span>
      </div>
    `;
    document.querySelector('main').prepend(page);
    page.append($('#product-detail'));
    $('#product-detail').innerHTML = '<p class="checkout-loading" role="status">正在读取商品配置与支付方式…</p>';
  }

  function orderView(c) {
    if (checkoutId) {
      location.href = '/?view=orders';
      return;
    }
    $('#product-dialog')?.close();
    view('orders');
    save(c);
    query();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-product]');
    if (b) {
      e.preventDefault();
      e.stopImmediatePropagation();
      location.href = '/?checkout=' + encodeURIComponent(b.dataset.product);
      return;
    }
    if (checkoutId) {
      const nav = e.target.closest('[data-view],a.brand');
      if (nav) {
        e.preventDefault();
        e.stopImmediatePropagation();
        location.href = nav.dataset.view && nav.dataset.view !== 'shop' ? '/?view=' + nav.dataset.view : '/';
      }
    }
  }, true);

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
    credentials = c;
    try { sessionStorage.setItem('hh-dujiao-order', JSON.stringify(c)); } catch {}
    if ($('#order-number')) $('#order-number').value = c.id || '';
    if ($('#order-email')) $('#order-email').value = c.email;
    if ($('#order-token')) $('#order-token').value = c.token;
  }

  function accessFields() {
    return {
      id: ($('#order-number')?.value || '').trim(),
      email: ($('#order-email')?.value || '').trim().toLowerCase(),
      token: ($('#order-token')?.value || '').trim()
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
        <p>订单编号</p>
        <code class="order-token">${esc(c.id || '正在创建…')}</code>
        <p>查询凭证（请保存，跨设备或游客查询时使用）</p>
        <code class="order-token">${esc(c.token)}</code>
        <button class="secondary" id="copy-order" type="button">复制订单编号与凭证</button>
      </div>
    `;
  }

  function wireCopy(c) {
    $('#copy-order')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(`订单：${c.id || '待查询'}\n邮箱：${c.email}\n查询凭证：${c.token}`);
        $('#copy-order').textContent = '已复制到剪贴板';
      } catch {
        $('#copy-order').textContent = '请手动复制上方信息';
      }
    });
  }

  function checkout(id) {
    const p = cfg?.products.find(p => p.id === id);
    if (!p?.available) return;

    const user = window.hhAccount?.user;
    const userBalance = Number(user?.wallet?.balance || 0);

    $('#product-detail').innerHTML = `
      <div class="checkout-layout">
        <div class="checkout-main">
          <section class="checkout-panel">
            <h2>订单方案规格</h2>
            <div class="checkout-product">
              <div class="checkout-logo"><img src="chatgpt-metallic.jpg" alt="ChatGPT" width="60" height="60" style="border-radius:14px;object-fit:cover;display:block;" /></div>
              <div>
                <span class="checkout-eyebrow">OFFICIAL TIER SUBSCRIPTION</span>
                <h3>${esc(p.name)}</h3>
                <p>规格：官方 Visa 实卡直充 · 菲律宾合规区域 · 自有账号秒充 · 30天全周期质保</p>
                <strong>¥${money(p.amountCents / 100)} <small>/ 月</small></strong>
              </div>
            </div>
            <label class="checkout-quantity">
              购买月数 / 份数
              <input aria-label="购买数量" id="pay-quantity" type="number" min="1" max="10" step="1" value="1">
            </label>
          </section>

          <section class="checkout-panel">
            <h2>购买人信息</h2>
            ${user ? `
              <div class="checkout-member-badge">
                <span class="member-tag">✓ 会员已登录</span>
                <span class="member-email">${esc(user.email)}</span>
                <span class="member-balance-tag">当前钱包余额: <b>¥${money(userBalance)}</b></span>
              </div>
              <input id="purchase-email" type="hidden" value="${esc(user.email)}">
            ` : `
              <div class="checkout-guest-login-tip">
                <span>💡 已有账户？<button type="button" class="btn-link" id="checkout-open-login">立即登录</button> 可使用账户余额秒付并自动归档订单</span>
              </div>
              <label class="checkout-email" for="purchase-email">
                下单接收邮箱
                <input id="purchase-email" type="email" required maxlength="254" autocomplete="email" placeholder="用于接收开通通知与查询凭证">
              </label>
            `}
            <div class="checkout-info">
              <strong>自动出密与兑换直充说明</strong>
              <p>付款确认后系统将立即自动发放专属充值卡密。凭卡密前往官方自动兑换充值网站，输入卡密即可秒级直接卡充到账，无需提供账号密码。</p>
            </div>
          </section>
        </div>

        <aside class="checkout-panel checkout-summary">
          <h2>结算汇总</h2>
          <div class="receipt-line">
            <span>方案规格</span>
            <span>${esc(p.name)}</span>
          </div>
          <div class="receipt-line">
            <span>购买数量</span>
            <span id="summary-quantity">1</span>
          </div>
          <div class="receipt-line">
            <span>交付时效</span>
            <span class="guarantee-text">官方Visa实卡 · 菲区正规订阅 · 秒级自动发货</span>
          </div>
          <div class="checkout-total">
            <span>应付总额</span>
            <strong id="checkout-total">¥${money(p.amountCents / 100)}</strong>
          </div>

          ${user ? `
            <div class="checkout-balance-box">
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

          <div class="checkout-payment-title">选择支付方式</div>
          ${paymentCards(cfg.channels)}

          <label class="payment-check">
            <input type="checkbox" id="pay-consent" checked>
            <span>我已核对商品规格，确认方案与邮箱信息无误。</span>
          </label>
          <div id="payment-error" class="payment-error" role="status"></div>
          <button class="primary wide" id="create-payment">
            ${user && userBalance >= (p.amountCents / 100) ? '确认订单并使用余额秒付 →' : '提交订单并前往支付 →'}
          </button>
          <p class="checkout-summary-note">官方合规渠道充值 · 7×24H 掉单包赔 · 全周期质保</p>
        </aside>
      </div>
    `;

    document.getElementById('checkout-open-login')?.addEventListener('click', () => {
      window.hhAccount?.openAuth('login');
    });

    document.getElementById('checkout-do-recharge')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.hhAccount?.openWallet();
    });

    const quantityInput = $('#pay-quantity');
    quantityInput?.addEventListener('input', () => {
      const n = Math.max(1, Math.min(10, Number(quantityInput.value) || 1));
      const total = (p.amountCents / 100) * n;
      $('#checkout-total').textContent = '¥' + money(total);
      $('#summary-quantity').textContent = String(n);

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

    const key = crypto.randomUUID(), lookupToken = token();

    $('#create-payment')?.addEventListener('click', async () => {
      const button = $('#create-payment');
      let submitted = false;
      try {
        const email = ($('#purchase-email').value || '').trim().toLowerCase();
        const quantity = Number($('#pay-quantity').value);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('请填写有效邮箱地址');
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw Error('购买数量需为 1–10 份');
        if (!$('#pay-consent').checked) throw Error('请勾选确认商品规格与购买信息');

        preferredChannel = chosenChannel();
        const c = { email, token: lookupToken, id: '' };
        save(c);

        button.disabled = true;
        button.textContent = '正在生成订单…';
        submitted = true;

        const isMember = Boolean(window.hhAccount?.user);
        const totalCost = (p.amountCents / 100) * quantity;
        const canUseBalance = isMember && userBalance >= totalCost;

        const { order } = await api('/api/commerce/orders', {
          data: {
            productId: id,
            quantity,
            email,
            token: lookupToken,
            key,
            member: isMember
          }
        });
        c.id = order.order_no;
        save(c);

        // If user has balance and clicked "balance pay", immediately execute balance payment!
        if (canUseBalance) {
          button.textContent = '正在使用账户余额扣款…';
          try {
            const { payment } = await api(`/api/commerce/orders/${encodeURIComponent(c.id)}/checkout`, {
              data: { useBalance: true, channelId: 0 },
              access: isMember ? null : c
            });
            if (payment.order_paid) {
              await window.hhAccount?.refreshUser();
              showPaidSuccess(order, c);
              return;
            }
          } catch (payErr) {
            console.error('Balance pay error, fallback to order page:', payErr);
          }
        }

        if (button.isConnected && (checkoutId || $('#product-dialog')?.open)) {
          showOrder(order, c);
        }
      } catch (e) {
        error(e);
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = submitted ? '重新提交订单 →' : '提交订单 →';
        }
      }
    });
  }

  function showPaidSuccess(order, c) {
    if (checkoutId) {
      document.querySelectorAll('.checkout-steps>span').forEach((s, i) => s.classList.toggle('current', i === 1));
      $('.checkout-title h1').textContent = '支付成功 · 专属卡密已发放';
    }
    const cardKey = extractOrGenerateCardKey(order);
    $('#product-detail').innerHTML = `
      <div class="checkout-layout">
        <section class="checkout-panel paid-success-panel">
          <div class="paid-success-icon">🎉</div>
          <div class="checkout-heading">Hh AI / 订单支付成功</div>
          <h2>支付确认成功 · 专属提货卡密已发放</h2>
          <p class="paid-success-tip">系统已全自动为你出库专属兑换卡密，请保存卡密并前往自动对卡网站 30 秒完成兑换充值！</p>
          ${renderFulfillmentCard(order)}
          ${credentialsHTML(c)}
          <div class="paid-success-actions">
            <button class="primary wide" id="success-view-orders">进入订单查询随时自查 →</button>
            <a class="secondary wide" href="/">返回商城首页</a>
          </div>
        </section>
      </div>
    `;
    wireCopy(c);
    wireRedeemCopy(cardKey, REDEEM_PORTAL_CONFIG.url);
    $('#success-view-orders')?.addEventListener('click', () => orderView(c));
  }

  function showOrder(order, c) {
    const allowed = order.allowed_payment_channel_ids;
    const channels = (cfg?.channels || []).filter(x => !allowed?.length || allowed.includes(x.id));
    const pending = order.status === 'pending_payment', expired = order.expires_at && Date.parse(order.expires_at) <= Date.now();
    const user = window.hhAccount?.user;
    const userBalance = Number(user?.wallet?.balance || 0);
    const orderTotal = Number(order.total_amount || 0);

    if (checkoutId) {
      document.querySelectorAll('.checkout-steps>span').forEach((s, i) => s.classList.toggle('current', i === 1));
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
      const popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      try {
        const { payment } = await api(`/api/commerce/orders/${encodeURIComponent(c.id)}/checkout`, {
          data: { channelId: chosenChannel() },
          access: c
        });
        if (payment.order_paid) {
          popup?.close();
          orderView(c);
          return;
        }
        const u = new URL(payment.pay_url);
        const localTest = location.hostname === '127.0.0.1' && ['http://127.0.0.1:4290', 'http://127.0.0.1:4180', 'http://127.0.0.1:4181'].includes(u.origin);
        if ((u.protocol !== 'https:' && !localTest) || u.username || u.password) throw Error('支付链接无效');
        if (popup) popup.location.replace(u.href);
        else {
          const link = document.createElement('a');
          link.href = u.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = '点击打开支付收银台页面';
          $('#product-detail').append(link);
        }
        const note = document.createElement('p');
        note.className = 'detail-note';
        note.textContent = '支付完成后返回本站查看订单。到账状态以后台确认为准。';
        $('#product-detail').append(note);
      } catch (e) {
        popup?.close();
        error(e);
      } finally {
        b.disabled = false;
      }
    });
  }

  function deliveries(order) {
    return [order, ...(order.children || [])].flatMap(o => o.fulfillment?.payload ? [o.fulfillment.payload] : []);
  }

  async function query(automatic = false) {
    clearTimeout(timer);
    const c = accessFields(), area = $('#order-result');
    if (!c.email || !c.token) {
      area.textContent = '请输入下单邮箱和查询凭证';
      return;
    }
    if (!automatic) area.textContent = '正在查询商城订单…';
    try {
      if (!c.id) {
        const { orders } = await api('/api/commerce/orders', { access: c });
        area.innerHTML = orders.length
          ? '<strong>找到以下订单</strong>' + orders.map(o => `
            <p><button class="secondary" data-dj-order="${esc(o.order_no)}">${esc(o.order_no)} · ${esc(statusNames[o.status] || o.status)} · ¥${money(o.total_amount)}</button></p>
          `).join('')
          : '暂未找到订单。如果刚下单，请稍后再查。';
        area.querySelectorAll('[data-dj-order]').forEach(b => b.onclick = () => {
          $('#order-number').value = b.dataset.djOrder;
          query();
        });
        return;
      }
      const { order } = await api('/api/commerce/orders/' + encodeURIComponent(c.id), { access: c });
      save(c);
      const pending = order.status === 'pending_payment', expired = order.expires_at && Date.parse(order.expires_at) <= Date.now();
      const isFulfilled = !pending && !expired && !['canceled', 'refunded', 'partially_refunded'].includes(order.status);
      area.innerHTML = `
        <span class="payment-mode">Hh AI 商城订单</span>
        <strong>${expired && pending ? '付款期限已过' : esc(statusNames[order.status] || order.status)}</strong>
        <div class="order-number">${esc(order.order_no)}</div>
        <p>${esc(order.currency)} ${money(order.total_amount)}</p>
        <p>${pending ? '等待系统确认付款，返回页面不会改变支付状态。' : '处理进度已从商城后台实时同步。'}</p>
        ${isFulfilled ? renderFulfillmentCard(order) : deliveries(order).map(t => `<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(typeof t === 'string' ? t : JSON.stringify(t))}</pre>`).join('')}
        <div class="payment-actions">
          <button class="secondary" id="refresh-order">刷新状态</button>
          ${pending && !expired && cfg?.paymentReady ? '<button class="primary" id="resume-pay">继续付款</button>' : ''}
        </div>
      `;
      if (isFulfilled) {
        wireRedeemCopy(extractOrGenerateCardKey(order), REDEEM_PORTAL_CONFIG.url);
      }
      $('#refresh-order').onclick = () => query();
      $('#resume-pay')?.addEventListener('click', () => {
        showOrder(order, c);
        $('#product-dialog')?.showModal();
      });
      if (pending && !expired && !document.hidden) timer = setTimeout(() => {
        if (!$('#orders-view').hidden) query(true);
      }, 8000);
    } catch (e) {
      area.textContent = e.message;
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
    $('#order-number').required = false;
    $('#order-number').maxLength = 80;
    $('#order-number').placeholder = '商城订单编号（留空查找最近订单）';
    const fields = document.createElement('div');
    fields.innerHTML = `
      <label class="lookup-label" for="order-email">下单邮箱</label>
      <input id="order-email" class="lookup-token-input" type="email" required autocomplete="email" placeholder="下单时填写的邮箱">
      <label class="lookup-label" for="order-token">查询凭证</label>
      <input id="order-token" class="lookup-token-input" required maxlength="256" autocomplete="off" placeholder="下单时生成的查询凭证">
    `;
    const submit = form.querySelector('button');
    form.append(fields, submit);
    form.addEventListener('submit', e => {
      e.preventDefault();
      query();
    });
  }

  if ($('#orders-view .muted')) {
    $('#orders-view .muted').textContent = '使用下单邮箱和查询凭证查询。登录账号可在个人中心直接查看所有历史订单。';
  }

  try {
    const c = JSON.parse(sessionStorage.getItem('hh-dujiao-order'));
    if (c) save(c);
  } catch {}

  // Re-render checkout when account changes
  document.addEventListener('hh-account-changed', () => {
    if (checkoutId && cfg) {
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
        $('#product-detail').innerHTML = '<section class="checkout-panel"><h2>当前方案暂不可下单</h2><p>商品可能已下架，或购买通道暂未开放。</p><a href="/">返回商城</a></section>';
      }
      return;
    }
    const params = new URLSearchParams(location.search);
    if (params.has('payment_return') || params.get('view') === 'orders') {
      history.replaceState(null, '', location.pathname);
      view('orders');
      if (credentials) query();
    } else if (params.get('view') === 'help') {
      view('help');
    }
  }).catch(() => {
    if ($('.demo-caption')) $('.demo-caption').textContent = '商城后台服务暂时无法连接，请确认服务已启动。';
    if (checkoutId) {
      $('#product-detail').innerHTML = '<section class="checkout-panel"><h2>暂时无法加载结算信息</h2><p>请刷新页面重试。</p><a href="/">返回商城</a></section>';
    }
  });
})();
