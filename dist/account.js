/* Hh AI Account & Wallet Management System */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => Number(v || 0).toFixed(2);

  async function api(path, { method, data } = {}) {
    const opts = {
      method: method || (data ? 'POST' : 'GET'),
      headers: data ? { 'Content-Type': 'application/json' } : {},
      ...(data ? { body: JSON.stringify(data) } : {})
    };
    const r = await fetch(path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(j.error || j.msg || '请求失败，请稍后重试');
    return j;
  }

  const state = {
    user: null,
    settings: null,
    ready: null
  };

  const accountArea = document.getElementById('user-header-area');
  const authDialog = document.getElementById('auth-dialog');
  const walletDialog = document.getElementById('wallet-dialog');
  const centerDialog = document.getElementById('user-center-dialog');

  function updateHeader() {
    if (!accountArea) return;
    if (state.user) {
      const email = state.user.email || '用户';
      const shortEmail = email.length > 18 ? email.slice(0, 8) + '…' + email.slice(email.indexOf('@')) : email;
      const bal = state.user.wallet?.balance ?? '0.00';
      accountArea.innerHTML = `
        <div class="user-session-bar">
          <button class="user-profile-btn" id="hdr-user-btn" title="${esc(email)}">
            <span class="user-avatar-badge">${esc(email[0].toUpperCase())}</span>
            <span class="user-email-text">${esc(shortEmail)}</span>
          </button>
          <div class="wallet-balance-badge" id="hdr-wallet-btn" title="点击管理钱包">
            <span class="wallet-icon">💎</span>
            <span class="wallet-lbl">余额:</span>
            <span class="wallet-val">¥${money(bal)}</span>
          </div>
          <button class="btn-quick-recharge" id="hdr-recharge-btn">+ 充值</button>
          <button class="btn-user-logout" id="hdr-logout-btn" title="退出当前账号">退出</button>
        </div>
      `;
      document.getElementById('hdr-user-btn')?.addEventListener('click', () => openCenter());
      document.getElementById('hdr-wallet-btn')?.addEventListener('click', () => openWallet());
      document.getElementById('hdr-recharge-btn')?.addEventListener('click', () => openWallet());
      document.getElementById('hdr-logout-btn')?.addEventListener('click', () => logout());
    } else {
      accountArea.innerHTML = `
        <button class="btn-auth-entry" id="hdr-login-btn">
          <span class="auth-entry-icon">👤</span>
          <span>登录 / 注册</span>
        </button>
      `;
      document.getElementById('hdr-login-btn')?.addEventListener('click', () => openAuth('login'));
    }
  }

  function openAuth(initialTab = 'login') {
    if (!authDialog) return;
    renderAuthModal(initialTab);
    authDialog.showModal();
  }

  function renderAuthModal(activeTab) {
    const isReg = activeTab === 'register';
    authDialog.innerHTML = `
      <button class="close close-dialog-btn" aria-label="关闭">×</button>
      <div class="auth-dialog-wrap">
        <div class="auth-modal-header">
          <div class="auth-brandmark">Hh<span>AI</span></div>
          <h2>${isReg ? '创建客户账号' : '登录客户账号'}</h2>
          <p>${isReg ? '注册成为会员，尊享账号余额秒付与订单云端同步' : '登录后可查看历史订单、使用钱包余额极速结算'}</p>
        </div>
        <div class="auth-modal-tabs">
          <button class="auth-tab-btn ${!isReg ? 'active' : ''}" data-tab="login">账号登录</button>
          <button class="auth-tab-btn ${isReg ? 'active' : ''}" data-tab="register">新用户注册</button>
        </div>
        <form class="auth-form" id="auth-form">
          <label class="form-field-lbl">
            <span>邮箱地址</span>
            <input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="name@example.com">
          </label>
          <label class="form-field-lbl">
            <span>登录密码</span>
            <input name="password" type="password" required minlength="6" maxlength="128" autocomplete="${isReg ? 'new-password' : 'current-password'}" placeholder="${isReg ? '至少 6 位密码' : '请输入你的密码'}">
          </label>
          ${isReg ? `
            <label class="form-field-lbl">
              <span>确认密码</span>
              <input name="confirm" type="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="请再次输入确认密码">
            </label>
            <div class="auth-agreement-row">
              <label class="custom-checkbox-lbl">
                <input type="checkbox" name="agree" checked required>
                <span>我已阅读并同意《用户服务条款与交易说明》</span>
              </label>
            </div>
          ` : `
            <div class="auth-options-row">
              <label class="custom-checkbox-lbl">
                <input type="checkbox" name="remember" checked>
                <span>保持登录状态（7天免登录）</span>
              </label>
            </div>
          `}
          <div class="auth-form-error" id="auth-error" role="status"></div>
          <button type="submit" class="primary wide auth-submit-btn" id="auth-submit">
            ${isReg ? '立即完成注册并登录 →' : '登录账号 →'}
          </button>
        </form>
        <div class="auth-modal-footer">
          <span>🛡️ 256-Bit SSL 企业级加密保护 · 资金安全有保障</span>
        </div>
      </div>
    `;

    authDialog.querySelector('.close-dialog-btn')?.addEventListener('click', () => authDialog.close());
    authDialog.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => renderAuthModal(btn.dataset.tab));
    });

    const form = authDialog.querySelector('#auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = authDialog.querySelector('#auth-error');
      const submitBtn = authDialog.querySelector('#auth-submit');
      errBox.textContent = '';
      const formData = new FormData(form);
      const email = String(formData.get('email') || '').trim();
      const password = String(formData.get('password') || '');
      const confirm = String(formData.get('confirm') || '');

      if (isReg && password !== confirm) {
        errBox.textContent = '两次输入的密码不一致，请核对后重试';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = isReg ? '正在创建账号…' : '正在验证登录…';

      try {
        const res = await api('/api/account/' + (isReg ? 'register' : 'login'), {
          data: {
            email,
            password,
            remember: formData.get('remember') === 'on'
          }
        });
        state.user = res.user;
        updateHeader();
        authDialog.close();
        notifyStateChange();
      } catch (err) {
        errBox.textContent = err.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isReg ? '立即完成注册并登录 →' : '登录账号 →';
      }
    });
  }

  function openWallet() {
    if (!state.user) {
      openAuth('login');
      return;
    }
    if (!walletDialog) return;
    renderWalletModal();
    walletDialog.showModal();
  }

  function renderWalletModal() {
    const bal = state.user?.wallet?.balance ?? '0.00';
    walletDialog.innerHTML = `
      <button class="close close-dialog-btn" aria-label="关闭">×</button>
      <div class="wallet-modal-wrap">
        <div class="wallet-modal-header">
          <div class="wallet-title-tag">Hh AI / WALLET</div>
          <h2>我的个人钱包</h2>
          <p>充值账户余额，随时购买 ChatGPT Plus / Pro 订阅，享受免跳转秒级交付</p>
        </div>

        <div class="wallet-balance-card">
          <div class="balance-card-left">
            <span class="balance-sub">当前可用账户余额</span>
            <div class="balance-num-row">
              <span class="currency-symbol">¥</span>
              <span class="balance-amount" id="modal-bal-display">${money(bal)}</span>
            </div>
          </div>
          <div class="balance-card-right">
            <span class="status-pill">实时有效</span>
          </div>
        </div>

        <div class="recharge-section">
          <h3>选择充值金额</h3>
          <div class="recharge-chips-grid">
            <button class="chip-btn active" data-amount="50">¥50</button>
            <button class="chip-btn" data-amount="100">¥100</button>
            <button class="chip-btn" data-amount="135">¥135 <small>(Plus 1月)</small></button>
            <button class="chip-btn" data-amount="200">¥200</button>
            <button class="chip-btn" data-amount="500">¥500</button>
            <button class="chip-btn" data-amount="custom">自定义</button>
          </div>
          <div class="custom-amount-wrap" id="custom-amount-wrap" style="display:none;">
            <label class="form-field-lbl">
              <span>输入自定义充值金额 (元)</span>
              <input type="number" id="custom-amount-input" min="1" max="10000" step="1" placeholder="请输入 1–10000 之间的整数">
            </label>
          </div>
        </div>

        <div class="recharge-mode-section">
          <h3>选择支付/充值方式</h3>
          <div class="recharge-channel-list">
            <label class="channel-choice-item">
              <input type="radio" name="recharge-method" value="test-topup" checked>
              <div class="channel-choice-info">
                <span class="channel-choice-title">⚡ 快速模拟秒充 <span class="test-tag">本地测试免付款</span></span>
                <span class="channel-choice-desc">本地联调模式，点击即时充值入账，适合快速测试消费流程</span>
              </div>
              <span class="channel-radio-mark">✓</span>
            </label>
            <label class="channel-choice-item">
              <input type="radio" name="recharge-method" value="gateway">
              <div class="channel-choice-info">
                <span class="channel-choice-title">💳 在线收银台支付 (USDT / 支付宝)</span>
                <span class="channel-choice-desc">唤起正规支付网关收银台，付款成功后自动回调上分</span>
              </div>
              <span class="channel-radio-mark">✓</span>
            </label>
          </div>
        </div>

        <div class="wallet-dialog-status" id="wallet-status" role="status"></div>

        <div class="wallet-dialog-actions">
          <button class="primary wide" id="do-recharge-btn">确认充值 ¥<span id="recharge-btn-amount">50.00</span> →</button>
        </div>

        <div class="wallet-modal-foot">
          <button class="btn-view-logs" id="view-wallet-txns-btn">📜 查看资金收支流水记录</button>
        </div>
      </div>
    `;

    walletDialog.querySelector('.close-dialog-btn')?.addEventListener('click', () => walletDialog.close());

    let selectedAmount = 50;
    const amountSpan = walletDialog.querySelector('#recharge-btn-amount');
    const customWrap = walletDialog.querySelector('#custom-amount-wrap');
    const customInput = walletDialog.querySelector('#custom-amount-input');

    walletDialog.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        walletDialog.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.amount;
        if (val === 'custom') {
          customWrap.style.display = 'block';
          selectedAmount = Number(customInput.value) || 0;
          amountSpan.textContent = money(selectedAmount);
          customInput.focus();
        } else {
          customWrap.style.display = 'none';
          selectedAmount = Number(val);
          amountSpan.textContent = money(selectedAmount);
        }
      });
    });

    customInput?.addEventListener('input', () => {
      selectedAmount = Math.max(1, Number(customInput.value) || 1);
      amountSpan.textContent = money(selectedAmount);
    });

    const statusBox = walletDialog.querySelector('#wallet-status');
    const rechargeBtn = walletDialog.querySelector('#do-recharge-btn');

    rechargeBtn.addEventListener('click', async () => {
      statusBox.textContent = '';
      if (!selectedAmount || selectedAmount <= 0) {
        statusBox.textContent = '请选择或输入有效的充值金额';
        return;
      }

      const method = walletDialog.querySelector('input[name="recharge-method"]:checked')?.value;
      rechargeBtn.disabled = true;
      rechargeBtn.textContent = '正在处理充值…';

      try {
        if (method === 'test-topup') {
          const res = await api('/api/account/wallet/test-topup', {
            data: { amount: selectedAmount }
          });
          if (!state.user.wallet) state.user.wallet = {};
          state.user.wallet.balance = res.balance;
          walletDialog.querySelector('#modal-bal-display').textContent = money(res.balance);
          statusBox.className = 'wallet-dialog-status success';
          statusBox.textContent = `🎉 充值成功！已到账 ¥${money(selectedAmount)}，当前余额为 ¥${money(res.balance)}`;
          updateHeader();
          notifyStateChange();
        } else {
          // Gateway recharge
          const res = await api('/api/account/wallet/recharge', {
            data: { amount: selectedAmount, channelId: 1 }
          });
          if (res.pay_url) {
            statusBox.className = 'wallet-dialog-status success';
            statusBox.innerHTML = `充值单已生成！<a href="${esc(res.pay_url)}" target="_blank" class="recharge-gateway-link">点击前往收银台完成付款 ↗</a>`;
            window.open(res.pay_url, '_blank');
          } else {
            statusBox.textContent = '充值单已创建，等待支付处理中…';
          }
        }
      } catch (err) {
        statusBox.className = 'wallet-dialog-status error';
        statusBox.textContent = err.message;
      } finally {
        rechargeBtn.disabled = false;
        rechargeBtn.textContent = `确认充值 ¥${money(selectedAmount)} →`;
      }
    });

    walletDialog.querySelector('#view-wallet-txns-btn')?.addEventListener('click', () => {
      walletDialog.close();
      openCenter('wallet');
    });
  }

  function openCenter(defaultSection = 'orders') {
    if (!state.user) {
      openAuth('login');
      return;
    }
    if (!centerDialog) return;
    renderCenterModal(defaultSection);
    centerDialog.showModal();
  }

  async function renderCenterModal(section = 'orders') {
    const email = state.user?.email || '';
    const bal = state.user?.wallet?.balance ?? '0.00';

    centerDialog.innerHTML = `
      <button class="close close-dialog-btn" aria-label="关闭">×</button>
      <div class="center-modal-wrap">
        <div class="center-modal-header">
          <div class="center-user-card">
            <div class="center-avatar">${esc(email[0]?.toUpperCase() || 'U')}</div>
            <div class="center-user-info">
              <h3>${esc(email)}</h3>
              <div class="center-user-badges">
                <span class="user-badge-tag">尊贵会员</span>
                <span class="user-badge-balance">钱包余额: ¥${money(bal)}</span>
              </div>
            </div>
            <button class="secondary center-recharge-btn" id="center-go-recharge">+ 立即充值</button>
          </div>
        </div>

        <div class="center-nav-tabs">
          <button class="center-tab-btn ${section === 'orders' ? 'active' : ''}" data-target="orders">📦 我的订单</button>
          <button class="center-tab-btn ${section === 'wallet' ? 'active' : ''}" data-target="wallet">💳 钱包资金流水</button>
          <button class="center-tab-btn ${section === 'security' ? 'active' : ''}" data-target="security">🔒 账号安全</button>
        </div>

        <div class="center-tab-content" id="center-tab-body">
          <div class="center-loading">正在读取数据…</div>
        </div>
      </div>
    `;

    centerDialog.querySelector('.close-dialog-btn')?.addEventListener('click', () => centerDialog.close());
    centerDialog.querySelector('#center-go-recharge')?.addEventListener('click', () => {
      centerDialog.close();
      openWallet();
    });

    centerDialog.querySelectorAll('.center-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        centerDialog.querySelectorAll('.center-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        switchSection(btn.dataset.target);
      });
    });

    switchSection(section);
  }

  async function switchSection(sec) {
    const container = centerDialog.querySelector('#center-tab-body');
    if (!container) return;

    if (sec === 'orders') {
      container.innerHTML = '<div class="center-loading">正在读取你的订单…</div>';
      try {
        const { orders } = await api('/api/commerce/orders?page=1');
        if (!orders || !orders.length) {
          container.innerHTML = `
            <div class="center-empty-state">
              <span class="empty-icon">📂</span>
              <p>暂无购买记录。选购你的第一份 AI 旗舰订阅方案吧！</p>
              <button class="primary close-center-to-shop">去订阅商店逛逛 →</button>
            </div>
          `;
          container.querySelector('.close-center-to-shop')?.addEventListener('click', () => centerDialog.close());
          return;
        }

        const statusMap = {
          pending_payment: '待付款',
          paid: '已付款 · 正在处理',
          fulfilling: '正在自动化开通',
          completed: '已完成交付',
          delivered: '已交付',
          canceled: '已取消',
          refunded: '已退款'
        };

        container.innerHTML = `
          <div class="center-order-list">
            ${orders.map(o => `
              <div class="center-order-row">
                <div class="order-row-main">
                  <div class="order-row-title">${esc(o.items?.[0]?.title || o.items?.[0]?.product_name || 'ChatGPT 旗舰订阅')}</div>
                  <div class="order-row-meta">
                    <span>订单号: <code>${esc(o.order_no)}</code></span>
                    <span>状态: <b class="order-status-badge ${esc(o.status)}">${esc(statusMap[o.status] || o.status)}</b></span>
                  </div>
                </div>
                <div class="order-row-right">
                  <span class="order-row-price">¥${money(o.total_amount)}</span>
                  ${o.status === 'pending_payment' ? `
                    <button class="primary btn-pay-now" data-order="${esc(o.order_no)}">立即支付</button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<div class="center-error">${esc(err.message)}</div>`;
      }
    } else if (sec === 'wallet') {
      container.innerHTML = '<div class="center-loading">正在读取资金流水…</div>';
      try {
        const { transactions } = await api('/api/account/wallet/transactions');
        const list = transactions?.list || (Array.isArray(transactions) ? transactions : []);
        if (!list.length) {
          container.innerHTML = `
            <div class="center-empty-state">
              <span class="empty-icon">🪙</span>
              <p>暂无资金变动记录</p>
            </div>
          `;
          return;
        }
        container.innerHTML = `
          <div class="center-txn-list">
            ${list.map(t => {
              const isIn = t.direction === 'in' || Number(t.amount) > 0;
              return `
                <div class="center-txn-row">
                  <div class="txn-left">
                    <strong>${esc(t.remark || t.type || '账户变动')}</strong>
                    <small>${esc(t.created_at ? new Date(t.created_at).toLocaleString() : '')}</small>
                  </div>
                  <div class="txn-right">
                    <span class="txn-val ${isIn ? 'plus' : 'minus'}">${isIn ? '+' : '-'}¥${money(Math.abs(t.amount))}</span>
                    <small>变动后余额: ¥${money(t.balance_after)}</small>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } catch (err) {
        container.innerHTML = `<div class="center-error">${esc(err.message)}</div>`;
      }
    } else if (sec === 'security') {
      container.innerHTML = `
        <div class="center-security-box">
          <h4>修改登录密码</h4>
          <form class="security-form" id="pwd-change-form">
            <label class="form-field-lbl">
              <span>当前密码</span>
              <input type="password" name="old_password" required placeholder="请输入当前旧密码">
            </label>
            <label class="form-field-lbl">
              <span>设置新密码</span>
              <input type="password" name="new_password" required minlength="6" placeholder="至少 6 位新密码">
            </label>
            <div class="security-error" id="pwd-error" role="status"></div>
            <button type="submit" class="secondary" id="pwd-submit-btn">保存新密码</button>
          </form>
          <div class="security-danger-zone">
            <h4>退出登录</h4>
            <p>退出后将清除本设备的登录凭证，下次需要重新输入密码。</p>
            <button class="danger-btn" id="danger-logout-btn">退出当前账号</button>
          </div>
        </div>
      `;

      centerDialog.querySelector('#danger-logout-btn')?.addEventListener('click', () => {
        centerDialog.close();
        logout();
      });

      const form = centerDialog.querySelector('#pwd-change-form');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const errBox = centerDialog.querySelector('#pwd-error');
        const submitBtn = centerDialog.querySelector('#pwd-submit-btn');
        errBox.textContent = '';
        const fd = new FormData(form);
        submitBtn.disabled = true;
        try {
          await api('/api/account/password', {
            data: {
              old_password: fd.get('old_password'),
              new_password: fd.get('new_password')
            }
          });
          alert('密码修改成功，请使用新密码重新登录');
          location.reload();
        } catch (err) {
          errBox.textContent = err.message;
        } finally {
          submitBtn.disabled = false;
        }
      });
    }
  }

  async function logout() {
    try {
      await api('/api/account/logout', { method: 'POST' });
    } catch {}
    state.user = null;
    updateHeader();
    notifyStateChange();
  }

  async function refreshUser() {
    try {
      const res = await api('/api/account/me');
      state.user = res.user;
    } catch {
      state.user = null;
    }
    updateHeader();
    notifyStateChange();
    return state.user;
  }

  function notifyStateChange() {
    document.dispatchEvent(new CustomEvent('hh-account-changed', {
      detail: { user: state.user }
    }));
  }

  // Initialize
  state.ready = Promise.all([
    api('/api/account/me').catch(() => ({ user: null })),
    api('/api/account/config').catch(() => ({}))
  ]).then(([me, cfg]) => {
    state.user = me.user;
    state.settings = cfg;
    updateHeader();
    notifyStateChange();
    return state.user;
  });

  // Public exports for global consumption
  window.hhAccount = {
    get user() { return state.user; },
    get ready() { return state.ready; },
    openAuth,
    openWallet,
    openCenter,
    refreshUser,
    logout,
    api
  };
})();
