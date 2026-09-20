/**
 * Hh AI - Online Interactive Preview Interceptor
 * Powers static deployments (e.g., chatgpt.site) by simulating the backend API in the browser.
 * Enables full end-to-end testing: registration with graphic captcha, forgot password,
 * 1:1 Cashier page, auto-redirect, and card key redemption.
 */
(() => {
  const nativeFetch = window.fetch.bind(window);

  const PRODUCTS = [
    { id: 'gpt-plus', name: 'ChatGPT Plus', amountCents: 13500, period: '月', available: true, remoteProductId: 1, remoteSkuId: 1 },
    { id: 'gpt-pro-5x', name: 'ChatGPT Pro 5x', amountCents: 68800, period: '月', available: true, remoteProductId: 2, remoteSkuId: 2 },
    { id: 'gpt-pro-20x', name: 'ChatGPT Pro 20x', amountCents: 128800, period: '月', available: true, remoteProductId: 3, remoteSkuId: 3 }
  ];

  const CHANNELS = [
    { id: 1, name: 'USDT - TRC20 (TRX网络)', provider_type: 'bepusdt', interaction_mode: 'redirect' },
    { id: 2, name: 'USDT - BEP20 (BSC网络)', provider_type: 'bepusdt', interaction_mode: 'redirect' }
  ];

  // In-memory / localStorage storage
  const storage = {
    getUser() {
      try { return JSON.parse(localStorage.getItem('hh_demo_user')); } catch { return null; }
    },
    setUser(u) {
      if (u) localStorage.setItem('hh_demo_user', JSON.stringify(u));
      else localStorage.removeItem('hh_demo_user');
    },
    getOrders() {
      try { return JSON.parse(localStorage.getItem('hh_demo_orders') || '[]'); } catch { return []; }
    },
    saveOrder(order) {
      const orders = storage.getOrders();
      const idx = orders.findIndex(o => o.id === order.id);
      if (idx >= 0) orders[idx] = order;
      else orders.unshift(order);
      localStorage.setItem('hh_demo_orders', JSON.stringify(orders));
    }
  };

  let currentCaptcha = { token: 'cap-' + Date.now(), text: '8A3K' };
  let lastVerifyCode = '888888';

  function generateCaptchaSvg(text) {
    const chars = text.split('');
    const colors = ['#2563eb', '#7c3aed', '#db2777', '#059669', '#d97706'];
    const textElements = chars.map((c, i) => {
      const x = 16 + i * 22;
      const y = 24 + (Math.random() * 6 - 3);
      const rot = Math.random() * 20 - 10;
      const color = colors[i % colors.length];
      return `<text x="${x}" y="${y}" fill="${color}" font-size="20" font-weight="bold" font-family="monospace" transform="rotate(${rot} ${x} ${y})">${c}</text>`;
    }).join('');

    const lines = [
      `<line x1="5" y1="${10 + Math.random()*15}" x2="95" y2="${10 + Math.random()*15}" stroke="#94a3b8" stroke-width="1.2" opacity="0.6"/>`,
      `<line x1="5" y1="${15 + Math.random()*15}" x2="95" y2="${15 + Math.random()*15}" stroke="#cbd5e1" stroke-width="1.2" opacity="0.6"/>`
    ].join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="36" viewBox="0 0 100 36" style="background:#f8fafc;border-radius:6px;user-select:none;cursor:pointer;">${lines}${textElements}</svg>`;
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  window.fetch = async (input, options = {}) => {
    const urlStr = typeof input === 'string' ? input : input.url;
    const url = new URL(urlStr, location.href);

    // Only intercept /api/ endpoints
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) {
      return nativeFetch(input, options);
    }

    const method = (options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let body = {};
    if (options.body && typeof options.body === 'string') {
      try { body = JSON.parse(options.body); } catch {}
    }

    const path = url.pathname;

    // 1. Payment Config
    if (path === '/api/payment-config' && method === 'GET') {
      return jsonResponse({
        mode: 'dujiao',
        ready: true,
        paymentReady: true,
        label: '模拟订单 · 不收取资金',
        channels: CHANNELS,
        contact: {
          online_support: '在线人工客服',
          service_hours: '周一至周日 09:00 - 24:00',
          wechat: '',
          telegram: '',
          email: '',
          tips: '咨询提示：咨询时请直接提供您的订单号或下单邮箱；切勿向任何人透露账号密码。'
        },
        redeemPortal: {
          url: '待填入',
          name: '兑换入口尚未配置',
          slotNotice: '演示卡密不可兑换；真实收款及交付服务尚未上线。'
        },
        captchaRequired: false,
        products: PRODUCTS
      });
    }

    // 2. Account Config
    if (path === '/api/account/config' && method === 'GET') {
      return jsonResponse({ registration: true, verifyEmail: false, captchaRequired: true });
    }

    // 3. Captcha
    if (path === '/api/account/captcha' && method === 'GET') {
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
      currentCaptcha = { token: 'cap-' + Date.now(), text: code };
      return jsonResponse({
        captcha_id: currentCaptcha.token,
        captcha_svg: generateCaptchaSvg(code)
      });
    }

    // 4. Send Code (Forgot Password)
    if (path === '/api/account/send-code' && method === 'POST') {
      lastVerifyCode = String(Math.floor(100000 + Math.random() * 900000));
      setTimeout(() => {
        alert(`【Hh·AI 演示提示】验证码已模拟发送至您的邮箱：\n\n验证码：${lastVerifyCode}\n（输入此验证码即可重设密码）`);
      }, 300);
      return jsonResponse({ status: 0, msg: `验证码已发送至 ${body.email || '邮箱'}` });
    }

    // 5. Forgot Password
    if (path === '/api/account/forgot-password' && method === 'POST') {
      const { email, code, new_password, confirm } = body;
      if (!email || !code || !new_password) {
        return jsonResponse({ error: '请填写完整信息' }, 400);
      }
      if (code !== lastVerifyCode && code !== '888888') {
        return jsonResponse({ error: '邮箱验证码不正确或已过期' }, 400);
      }
      if (new_password !== confirm) {
        return jsonResponse({ error: '两次输入的密码不一致' }, 400);
      }
      const user = {
        id: 'usr_' + Date.now(),
        email: email.trim(),
        display_name: email.trim().split('@')[0],
        total_recharged: 10000,
        total_spent: 0
      };
      storage.setUser(user);
      return jsonResponse({
        status: 0,
        msg: '密码重置成功，已为您自动登录',
        autoLogin: true,
        user
      });
    }

    // 6. Register
    if (path === '/api/account/register' && method === 'POST') {
      const { email, password, confirm, captcha_code } = body;
      if (!email || !password || !confirm) {
        return jsonResponse({ error: '请填写完整注册信息' }, 400);
      }
      if (password !== confirm) {
        return jsonResponse({ error: '两次输入的密码不一致' }, 400);
      }
      if (captcha_code && captcha_code.toUpperCase() !== currentCaptcha.text.toUpperCase()) {
        return jsonResponse({ error: '图形验证码不正确，请点击图片刷新重试' }, 400);
      }
      const user = {
        id: 'usr_' + Date.now(),
        email: email.trim(),
        display_name: email.trim().split('@')[0],
        total_recharged: 0,
        total_spent: 0
      };
      storage.setUser(user);
      return jsonResponse({ status: 0, msg: '注册成功', user });
    }

    // 7. Login
    if (path === '/api/account/login' && method === 'POST') {
      const { email, password } = body;
      if (!email || !password) {
        return jsonResponse({ error: '请输入邮箱和密码' }, 400);
      }
      const user = {
        id: 'usr_' + Date.now(),
        email: email.trim(),
        display_name: email.trim().split('@')[0],
        total_recharged: 0,
        total_spent: 0
      };
      storage.setUser(user);
      return jsonResponse({ status: 0, msg: '登录成功', user });
    }

    // 8. Logout
    if (path === '/api/account/logout' && method === 'POST') {
      storage.setUser(null);
      return jsonResponse({ status: 0, msg: '已退出登录' });
    }

    // 9. Current User (Me)
    if (path === '/api/account/me' && method === 'GET') {
      const user = storage.getUser();
      return jsonResponse({ user });
    }

    // 10. Orders List
    if (path === '/api/commerce/orders' && method === 'GET') {
      const orders = storage.getOrders();
      const authHeader = options.headers?.Authorization || (input instanceof Request ? input.headers.get('Authorization') : '');
      let resultOrders = orders;
      if (authHeader && authHeader.startsWith('Guest ')) {
        try {
          const decoded = atob(authHeader.slice(6).replace(/-/g, '+').replace(/_/g, '/'));
          const [guestEmail, guestToken] = decoded.split('\n');
          if (guestEmail) {
            resultOrders = orders.filter(o => o.email?.toLowerCase() === guestEmail.toLowerCase());
          }
        } catch {}
      }
      return jsonResponse({ status_code: 0, data: { orders: resultOrders }, orders: resultOrders });
    }

    // 11. Create Order (supports guest & member)
    if (path === '/api/commerce/orders' && method === 'POST') {
      const { productId, quantity = 1, email, token } = body;
      const product = PRODUCTS.find(p => p.id === productId) || PRODUCTS[0];
      const orderId = 'HH' + Date.now().toString().slice(-8);
      const totalAmountCents = product.amountCents * quantity;

      const order = {
        id: orderId,
        order_no: orderId,
        title: `${product.name} × ${quantity}`,
        product_id: product.id,
        product_name: product.name,
        quantity,
        total_amount_cents: totalAmountCents,
        total_amount: (totalAmountCents / 100).toFixed(2),
        currency: 'CNY',
        status: 'pending_payment',
        created_at: Date.now(),
        expires_at: new Date(Date.now() + 1200000).toISOString(),
        email: email || 'guest@hh.ai',
        token: token || '',
        fulfillment: null
      };
      storage.saveOrder(order);
      return jsonResponse({ status_code: 0, data: { order }, order });
    }

    // 12. Checkout (supports guest & member)
    if (path.match(/\/api\/commerce\/orders\/[^\/]+\/checkout/) && method === 'POST') {
      const orderId = path.split('/')[4];
      const order = storage.getOrders().find(o => o.id === orderId || o.order_no === orderId) || {
        id: orderId,
        order_no: orderId,
        total_amount_cents: 13500,
        product_id: 'gpt-plus',
        product_name: 'ChatGPT Plus',
        quantity: 1
      };
      order.channel_id = Number(body.channelId || body.channel_id || 1);
      storage.saveOrder(order);
      const usdtAmt = (order.total_amount_cents / 720).toFixed(2);
      const paymentData = {
        order_id: order.id,
        channel_id: order.channel_id,
        channel_name: order.channel_id === 2 ? 'USDT - BEP20 (BSC网络)' : 'USDT - TRC20 (TRX网络)',
        amount_cny: (order.total_amount_cents / 100).toFixed(2),
        amount_usdt: usdtAmt,
        currency: 'USDT',
        crypto_address: 'DEMO-NO-TRANSFER-ADDRESS',
        network: order.channel_id === 2 ? 'BEP20' : 'TRC20',
        pay_url: `${location.origin}/?order=${order.id}`,
        expires_at: Date.parse(order.expires_at)
      };
      return jsonResponse({
        status_code: 0,
        data: { payment: paymentData },
        payment: paymentData
      });
    }

    // 13. Query Order Single (supports guest & member)
    if (path.match(/\/api\/commerce\/orders\/[^\/]+$/) && method === 'GET') {
      const orderId = path.split('/')[4];
      const orders = storage.getOrders();
      let order = orders.find(o => o.id === orderId || o.order_no === orderId);
      if (!order) return jsonResponse({ error: '未找到此浏览器中的演示订单' }, 404);
      if (order.status === 'pending_payment' && Date.parse(order.expires_at) <= Date.now()) {
        order.status = 'canceled';
        storage.saveOrder(order);
      }
      return jsonResponse({ status_code: 0, data: { order }, order });
    }

    // Fallback default
    return jsonResponse({ error: '在线演示暂不支持此操作，未发送真实请求' }, 403);
  };

  // Add top banner informing user that this is an interactive live preview
  window.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.className = 'live-preview-banner';
    banner.style.cssText = 'padding:10px 18px;background:#0d1117;border-bottom:1px solid #30363d;color:#e6edf3;font-size:13px;text-align:center;position:relative;z-index:9999;display:flex;align-items:center;justify-content:center;gap:12px;';
    banner.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>
        <strong>Hh · AI 模拟演示 · 不收款</strong>
      </span>
      <span style="color:#8b949e;">｜</span>
      <span style="color:#c9d1d9;">请使用测试邮箱和测试密码。订单仅保存在此浏览器；付款和卡密均为模拟，不可转账或兑换。</span>
    `;
    document.body.prepend(banner);
    const orderId = new URLSearchParams(location.search).get('order');
    if (!orderId) return;
    const order = storage.getOrders().find(o => o.id === orderId);
    if (!order) return;
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'border:1px solid #ddd;border-radius:24px;padding:32px;max-width:460px;width:calc(100% - 40px);color:#171717;background:white';
    dialog.innerHTML = `<h2>Hh AI · 模拟收银台</h2><p>演示金额 <strong>${(order.total_amount_cents / 720).toFixed(2)} USDT</strong></p><p>网络：${order.channel_id === 2 ? 'BSC / BEP20' : 'TRON / TRC20'}</p><p>剩余时间 <strong id="demo-expiry"></strong></p><div style="padding:32px;background:#f4f4f4;border-radius:16px;text-align:center">收款码待配置<br>暂无真实收款地址，请勿转账</div><p>点击下方按钮仅模拟到账，不涉及真实资金。示例卡密不可兑换。</p><button id="demo-confirm" style="padding:14px;width:100%;margin-bottom:12px">模拟付款成功</button><button id="demo-close" style="padding:12px;width:100%">返回商城</button>`;
    document.body.append(dialog);
    dialog.showModal();
    const confirm = dialog.querySelector('#demo-confirm');
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(order.expires_at) - Date.now()) / 1000));
      dialog.querySelector('#demo-expiry').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      confirm.disabled = !seconds || order.status !== 'pending_payment';
    };
    tick();
    const countdown = setInterval(tick, 1000);
    confirm.onclick = () => {
      if (Date.parse(order.expires_at) <= Date.now()) return;
      order.status = 'paid';
      order.fulfillment = { payload: 'DEMO-NOT-REDEEMABLE', card_keys: ['DEMO-NOT-REDEEMABLE'] };
      order.card_key = 'DEMO-NOT-REDEEMABLE';
      storage.saveOrder(order);
      clearInterval(countdown);
      location.href = '/?view=orders&order_no=' + encodeURIComponent(order.id) + '&payment_return=1';
    };
    dialog.querySelector('#demo-close').onclick = () => { location.href = '/'; };
  });
})();
