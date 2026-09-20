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
    if (!url.pathname.startsWith('/api/')) {
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
        label: '商城订单',
        channels: CHANNELS,
        contact: {
          online_support: '在线人工客服',
          service_hours: '周一至周日 09:00 - 24:00',
          wechat: 'HhAI-Support',
          telegram: 'https://t.me/HhAI_Support',
          email: 'support@hh.ai',
          tips: '咨询提示：咨询时请直接提供您的订单号或下单邮箱；切勿向任何人透露账号密码。'
        },
        redeemPortal: {
          url: 'https://chatgpt.com/',
          name: 'ChatGPT 官方全自动对卡直接充值中心',
          slotNotice: '（官方直充：在上方专属卡密复制后，点击直接前往官方兑换网站直接卡密使用）'
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
    if (path.startsWith('/api/commerce/orders') && method === 'GET') {
      const parts = path.split('/');
      if (parts.length > 4) {
        const orderId = decodeURIComponent(parts[4]);
        const order = storage.getOrders().find(o => o.id === orderId || o.order_no === orderId);
        if (order) return jsonResponse({ status_code: 0, data: { order } });
        return jsonResponse({ error: '订单未找到' }, 404);
      }
      return jsonResponse({ status_code: 0, data: { orders: storage.getOrders() } });
    }

    // 11. Create Order
    if (path === '/api/commerce/orders' && method === 'POST') {
      const { productId, quantity = 1, email } = body;
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
        status: 'pending',
        created_at: Date.now(),
        expires_at: Date.now() + 1800000,
        email: email || 'customer@hh.ai',
        fulfillment: null
      };
      storage.saveOrder(order);
      return jsonResponse({ status_code: 0, data: { order } });
    }

    // 12. Checkout
    if (path.match(/\/api\/commerce\/orders\/[^\/]+\/checkout/) && method === 'POST') {
      const orderId = path.split('/')[4];
      const order = storage.getOrders().find(o => o.id === orderId) || {
        id: orderId,
        total_amount_cents: 13500,
        product_name: 'ChatGPT Plus',
        quantity: 1
      };
      const usdtAmt = (order.total_amount_cents / 720).toFixed(2);
      return jsonResponse({
        status_code: 0,
        data: {
          payment: {
            order_id: order.id,
            channel_id: body.channel_id || 1,
            channel_name: body.channel_id === 2 ? 'USDT - BEP20 (BSC网络)' : 'USDT - TRC20 (TRX网络)',
            amount_cny: (order.total_amount_cents / 100).toFixed(2),
            amount_usdt: usdtAmt,
            currency: 'USDT',
            crypto_address: 'TQn9Y2khEsLJW1ChVWFMSMeSTow5KaxUJJ',
            network: body.channel_id === 2 ? 'BEP20' : 'TRC20',
            expires_at: Date.now() + 900000
          }
        }
      });
    }

    // 13. Query Order Single
    if (path.match(/\/api\/commerce\/orders\/[^\/]+$/) && method === 'GET') {
      const orderId = path.split('/')[4];
      const orders = storage.getOrders();
      let order = orders.find(o => o.id === orderId || o.order_no === orderId);
      if (!order) {
        order = {
          id: orderId,
          order_no: orderId,
          title: 'ChatGPT Plus × 1',
          total_amount_cents: 13500,
          status: 'paid',
          fulfillment: {
            card_keys: ['Hh-PLUS-88F2-A901-2026'],
            redeem_url: 'https://chatgpt.com/'
          }
        };
      }
      return jsonResponse({ status_code: 0, data: { order } });
    }

    // Fallback default
    return jsonResponse({ status: 0, data: {} });
  };

  // Add top banner informing user that this is an interactive live preview
  window.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.className = 'live-preview-banner';
    banner.style.cssText = 'padding:10px 18px;background:#0d1117;border-bottom:1px solid #30363d;color:#e6edf3;font-size:13px;text-align:center;position:relative;z-index:9999;display:flex;align-items:center;justify-content:center;gap:12px;';
    banner.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;"></span>
        <strong>Hh · AI 最新版本在线演示</strong>
      </span>
      <span style="color:#8b949e;">｜</span>
      <span style="color:#c9d1d9;">支持全流程交互：图形码注册、忘记密码（含倒计时）、1:1 独立黑金收银台、支付成功自动跳转及卡密展示</span>
    `;
    document.body.prepend(banner);
  });
})();
