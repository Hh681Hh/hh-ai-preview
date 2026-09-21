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

  let cachedEmail = '';
  let sendCodeInterval = null;

  function openAuth(initialTab = 'login') {
    if (!authDialog) return;
    renderAuthModal(initialTab);
    authDialog.showModal();
  }

  function renderAuthModal(activeTab = 'login') {
    const isReg = activeTab === 'register';
    const isForgot = activeTab === 'forgot';
    const isLogin = !isReg && !isForgot;

    if (sendCodeInterval) {
      clearInterval(sendCodeInterval);
      sendCodeInterval = null;
    }

    let headerTitle = '用户登录';
    let headerDesc = '使用邮箱和密码登录您的账号。';
    if (isReg) {
      headerTitle = '用户注册';
      headerDesc = '使用邮箱完成账号注册，即享会员权益';
    } else if (isForgot) {
      headerTitle = '重置登录密码';
      headerDesc = '输入注册邮箱，通过验证码重设新密码';
    }

    authDialog.innerHTML = `
      <button class="close close-dialog-btn" aria-label="关闭">×</button>
      <div class="auth-dialog-wrap">
        <div class="auth-modal-header">
          <div class="auth-badge-tag">Hh · AI</div>
          <h2>${headerTitle}</h2>
          <p>${headerDesc}</p>
        </div>

        ${isForgot ? `
          <div class="auth-modal-tabs auth-modal-tabs-3">
            <button class="auth-tab-btn" data-tab="login">账号登录</button>
            <button class="auth-tab-btn active" data-tab="forgot">重置密码</button>
            <button class="auth-tab-btn" data-tab="register">新用户注册</button>
          </div>
        ` : `
          <div class="auth-modal-tabs">
            <button class="auth-tab-btn ${isLogin ? 'active' : ''}" data-tab="login">账号登录</button>
            <button class="auth-tab-btn ${isReg ? 'active' : ''}" data-tab="register">新用户注册</button>
          </div>
        `}

        <form class="auth-form" id="auth-form" novalidate>
          <!-- 邮箱 -->
          <div class="form-field-block">
            <div class="field-head-label">
              <svg class="field-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span>${isForgot ? '注册邮箱' : '邮箱'}</span>
            </div>
            <input name="email" id="auth-email" type="email" required maxlength="254" autocomplete="email" placeholder="${isForgot ? '请输入注册时使用的邮箱' : '请输入邮箱'}" value="${esc(cachedEmail)}">
            <div class="field-error-tip" id="email-error-tip" style="display:none;">此字段为必填项</div>
          </div>

          ${isForgot ? `
            <!-- 邮箱验证码 (通过邮箱验证码重置密码) -->
            <div class="form-field-block">
              <div class="field-head-label">
                <svg class="field-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>邮箱验证码</span>
              </div>
              <div class="send-code-row">
                <input name="code" id="auth-code" type="text" required maxlength="6" inputmode="numeric" placeholder="请输入6位验证码" autocomplete="off">
                <button type="button" class="send-code-btn" id="btn-send-code">获取验证码</button>
              </div>
              <div class="field-dev-tip" id="code-dev-tip" style="display:none;"></div>
              <div class="field-error-tip" id="code-error-tip" style="display:none;"></div>
            </div>

            <!-- 设置新密码 -->
            <div class="form-field-block">
              <div class="field-head-label">
                <svg class="field-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>设置新密码</span>
              </div>
              <div class="input-with-eye-wrap">
                <input name="password" id="auth-password" type="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="设置新密码（6位以上，含字母和数字）">
                <button type="button" class="eye-toggle-btn" id="toggle-pwd-btn" aria-label="切换显示明文密码" tabindex="-1">
                  <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- 确认新密码 -->
            <div class="form-field-block">
              <div class="field-head-label">
                <svg class="field-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>确认新密码</span>
              </div>
              <div class="input-with-eye-wrap">
                <input name="confirm" id="auth-confirm" type="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="请再次输入新密码以确认">
                <button type="button" class="eye-toggle-btn" id="toggle-confirm-btn" aria-label="切换显示明文密码" tabindex="-1">
                  <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>
          ` : `
            <!-- 登录密码 -->
            <div class="form-field-block">
              <div class="field-head-label">
                <svg class="field-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>${isReg ? '设置登录密码' : '登录密码'}</span>
              </div>
              <div class="input-with-eye-wrap">
                <input name="password" id="auth-password" type="password" required minlength="6" maxlength="128" autocomplete="${isReg ? 'new-password' : 'current-password'}" placeholder="${isReg ? '设置登录密码（6位以上，含字母和数字）' : '请输入登录密码'}">
                <button type="button" class="eye-toggle-btn" id="toggle-pwd-btn" aria-label="切换显示明文密码" tabindex="-1">
                  <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            ${isReg ? `
              <!-- 确认密码 (重复两次密码) -->
              <div class="form-field-block">
                <div class="field-head-label">
                  <svg class="field-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>确认密码</span>
                </div>
                <div class="input-with-eye-wrap">
                  <input name="confirm" id="auth-confirm" type="password" required minlength="6" maxlength="128" autocomplete="new-password" placeholder="请再次输入登录密码以确认">
                  <button type="button" class="eye-toggle-btn" id="toggle-confirm-btn" aria-label="切换显示明文密码" tabindex="-1">
                    <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 图形验证码 (图形码) -->
              <div class="form-field-block">
                <div class="field-head-label">
                  <svg class="field-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>图形验证码</span>
                </div>
                <div class="captcha-input-row">
                  <input name="captcha_code" id="auth-captcha-input" type="text" required maxlength="6" placeholder="请输入图形验证码" autocomplete="off" spellcheck="false">
                  <input type="hidden" name="captcha_id" id="auth-captcha-id">
                  <div class="captcha-img-box" id="captcha-img-box" title="点击图片更换验证码">
                    <span style="font-size:12px;color:#94a3b8;padding:0 10px;">加载中…</span>
                  </div>
                </div>
                <div class="captcha-refresh-hint" id="captcha-refresh-link">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                  <span>看不清？点击图片更换验证码</span>
                </div>
                <div class="field-error-tip" id="captcha-error-tip" style="display:none;"></div>
              </div>

              <!-- 协议卡片 -->
              <div class="terms-card-box">
                <label class="terms-checkbox-lbl">
                  <input type="checkbox" name="agree" id="auth-agree" checked required>
                  <span>我已阅读并同意 <a href="#privacy" class="terms-hl-link" onclick="event.preventDefault()">隐私政策</a> 和 <a href="#terms" class="terms-hl-link" onclick="event.preventDefault()">服务条款</a></span>
                </label>
              </div>
            ` : `
              <div class="auth-options-row">
                <label class="custom-checkbox-lbl">
                  <input type="checkbox" name="remember" checked>
                  <span>保持登录状态（7天免登录）</span>
                </label>
                <button type="button" class="auth-forgot-link" id="auth-to-forgot-btn">忘记密码？</button>
              </div>
            `}
          `}

          <div class="auth-form-error" id="auth-error" role="status"></div>
          <button type="submit" class="auth-blue-submit-btn" id="auth-submit">
            ${isForgot ? `
              重置密码并直接登录 →
            ` : isReg ? `
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;display:inline-block;vertical-align:-3px;">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              创建账号
            ` : `
              登录账号 →
            `}
          </button>
        </form>

        ${isForgot ? `
          <div class="auth-bottom-switch-row">
            <span>记起密码？</span>
            <button type="button" class="auth-switch-link" id="auth-back-login-btn">返回账号登录 →</button>
          </div>
        ` : `
          <div class="auth-guest-tip-row">
            <span>💡 <b>订单与账户绑定：</b>注册或登录后可购买、查看付款进度并领取兑换卡密。</span>
          </div>
        `}

        <div class="auth-modal-footer">
          <span>🛡️ 256-Bit SSL 企业级加密保护 · 资金安全有保障</span>
        </div>
      </div>
    `;

    authDialog.querySelector('.close-dialog-btn')?.addEventListener('click', () => {
      authDialog.close();
    });

    authDialog.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emailInput = authDialog.querySelector('#auth-email');
        if (emailInput?.value) cachedEmail = emailInput.value.trim();
        renderAuthModal(btn.dataset.tab);
      });
    });

    authDialog.querySelector('#auth-to-forgot-btn')?.addEventListener('click', () => {
      const emailInput = authDialog.querySelector('#auth-email');
      if (emailInput?.value) cachedEmail = emailInput.value.trim();
      renderAuthModal('forgot');
    });

    authDialog.querySelector('#auth-back-login-btn')?.addEventListener('click', () => {
      const emailInput = authDialog.querySelector('#auth-email');
      if (emailInput?.value) cachedEmail = emailInput.value.trim();
      renderAuthModal('login');
    });

    // 绑定密码可见性切换
    const bindEyeToggle = (btnId, inputId) => {
      const btn = authDialog.querySelector(btnId);
      const input = authDialog.querySelector(inputId);
      btn?.addEventListener('click', () => {
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        btn.innerHTML = isPwd ? `
          <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>
        ` : `
          <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        `;
      });
    };
    bindEyeToggle('#toggle-pwd-btn', '#auth-password');
    if (isReg || isForgot) bindEyeToggle('#toggle-confirm-btn', '#auth-confirm');

    // 绑定邮箱验证码发送 (忘记密码模式)
    if (isForgot) {
      const sendCodeBtn = authDialog.querySelector('#btn-send-code');
      const codeDevTip = authDialog.querySelector('#code-dev-tip');
      const codeErrTip = authDialog.querySelector('#code-error-tip');

      sendCodeBtn?.addEventListener('click', async () => {
        const emailInput = authDialog.querySelector('#auth-email');
        const email = emailInput?.value?.trim() || '';
        if (codeErrTip) codeErrTip.style.display = 'none';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          if (emailErrTip) {
            emailErrTip.textContent = '请输入有效的注册邮箱地址';
            emailErrTip.style.display = 'block';
          }
          emailInput?.focus();
          return;
        }

        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = '发送中…';
        try {
          const res = await api('/api/account/send-code', {
            data: { email, scene: 'reset' }
          });
          if (res.dev_code) {
            if (codeDevTip) {
              codeDevTip.textContent = `[测试模式] 验证码: ${res.dev_code}`;
              codeDevTip.style.display = 'block';
            }
            const codeInput = authDialog.querySelector('#auth-code');
            if (codeInput) codeInput.value = res.dev_code;
          }
          let countdown = 60;
          sendCodeBtn.textContent = `${countdown}s 后重发`;
          sendCodeInterval = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
              clearInterval(sendCodeInterval);
              sendCodeInterval = null;
              sendCodeBtn.disabled = false;
              sendCodeBtn.textContent = '重新获取';
            } else {
              sendCodeBtn.textContent = `${countdown}s 后重发`;
            }
          }, 1000);
        } catch (err) {
          sendCodeBtn.disabled = false;
          sendCodeBtn.textContent = '获取验证码';
          if (codeErrTip) {
            codeErrTip.textContent = err.message;
            codeErrTip.style.display = 'block';
          }
        }
      });
    }

    // 刷新图形验证码
    async function loadCaptcha() {
      const box = authDialog.querySelector('#captcha-img-box');
      const idInput = authDialog.querySelector('#auth-captcha-id');
      if (!box || !idInput) return;
      try {
        const res = await api('/api/account/captcha');
        idInput.value = res.captcha_id;
        box.innerHTML = res.captcha_svg;
      } catch (err) {
        box.innerHTML = '<span style="font-size:12px;color:#ef4444;padding:0 8px;">加载失败</span>';
      }
    }

    if (isReg) {
      if (state.settings?.captchaRequired) {
        loadCaptcha();
        authDialog.querySelector('#captcha-img-box')?.addEventListener('click', loadCaptcha);
        authDialog.querySelector('#captcha-refresh-link')?.addEventListener('click', loadCaptcha);
      } else {
        const captchaInput = authDialog.querySelector('#auth-captcha-input');
        captchaInput?.closest('.form-field-block')?.remove();
      }
    }

    const emailInput = authDialog.querySelector('#auth-email');
    const emailErrTip = authDialog.querySelector('#email-error-tip');
    emailInput?.addEventListener('input', () => {
      if (emailErrTip) emailErrTip.style.display = 'none';
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
      const code = String(formData.get('code') || '').trim();
      const captchaCode = String(formData.get('captcha_code') || '').trim();
      const captchaId = String(formData.get('captcha_id') || '').trim();
      cachedEmail = email;

      if (!email) {
        if (emailErrTip) {
          emailErrTip.textContent = '此字段为必填项';
          emailErrTip.style.display = 'block';
        }
        emailInput?.focus();
        return;
      }

      if (isForgot) {
        if (!code || code.length !== 6) {
          errBox.textContent = '请输入6位邮箱验证码';
          authDialog.querySelector('#auth-code')?.focus();
          return;
        }
        if (password.length < 6) {
          errBox.textContent = '新密码长度需为 6–128 个字符';
          return;
        }
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasDigit = /[0-9]/.test(password);
        if (!hasLetter || !hasDigit) {
          errBox.textContent = '新密码需包含字母和数字（大写或小写均可）';
          return;
        }
        if (password !== confirm) {
          errBox.textContent = '两次输入的密码不一致，请核对后重试';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '正在重置密码…';
        try {
          const res = await api('/api/account/forgot-password', {
            data: { email, code, new_password: password, confirm }
          });
          if (res.autoLogin && res.user) {
            state.user = res.user;
            updateHeader();
            authDialog.close();
            notifyStateChange();
          } else {
            alert(res.message || '密码重置成功，请使用新密码登录');
            renderAuthModal('login');
          }
        } catch (err) {
          errBox.textContent = err.message;
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = '重置密码并直接登录 →';
        }
        return;
      }

      if (isReg) {
        if (password.length < 6) {
          errBox.textContent = '密码长度需为 6–128 个字符';
          return;
        }
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasDigit = /[0-9]/.test(password);
        if (!hasLetter || !hasDigit) {
          errBox.textContent = '密码需包含字母和数字（大写或小写均可）';
          return;
        }
        if (password !== confirm) {
          errBox.textContent = '两次输入的密码不一致，请核对后重试';
          return;
        }
        if (state.settings?.captchaRequired && !captchaCode) {
          errBox.textContent = '请输入图形验证码';
          authDialog.querySelector('#auth-captcha-input')?.focus();
          return;
        }
        const agreeCheck = authDialog.querySelector('#auth-agree');
        if (agreeCheck && !agreeCheck.checked) {
          errBox.textContent = '请阅读并同意《隐私政策》和《服务条款》';
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.textContent = isReg ? '正在创建账号…' : '正在验证登录…';

      try {
        const res = await api('/api/account/' + (isReg ? 'register' : 'login'), {
          data: {
            email,
            password,
            confirm: isReg ? confirm : undefined,
            captcha_id: isReg ? captchaId : undefined,
            captcha_code: isReg ? captchaCode : undefined,
            remember: formData.get('remember') === 'on'
          }
        });
        state.user = res.user;
        updateHeader();
        authDialog.close();
        notifyStateChange();
      } catch (err) {
        errBox.textContent = err.message;
        if (isReg && err.message?.includes('图形验证码')) {
          loadCaptcha();
          const capInput = authDialog.querySelector('#auth-captcha-input');
          if (capInput) capInput.value = '';
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = isReg ? `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;display:inline-block;vertical-align:-3px;">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          创建账号
        ` : '登录账号 →';
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
          <h3>选择充值公链网络</h3>
          <div class="recharge-channel-list">
            <label class="channel-choice-item">
              <input type="radio" name="recharge-channel" value="2" checked>
              <div class="channel-choice-info">
                <span class="channel-choice-title">🔥 币安智能链 (BEP20) <span class="test-tag" style="background:#fef3c7;color:#b45309;">推荐 · 手续费极低</span></span>
                <span class="channel-choice-desc">转账 Gas 极低 (仅约 ¥0.5) · 极速秒级确认 · 推荐首选</span>
              </div>
              <span class="channel-radio-mark">✓</span>
            </label>
            <label class="channel-choice-item">
              <input type="radio" name="recharge-channel" value="1">
              <div class="channel-choice-info">
                <span class="channel-choice-title">波场网络 (TRC20)</span>
                <span class="channel-choice-desc">TRON 网络 · 各大交易所通用 · 适合大额转账</span>
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
        statusBox.className = 'wallet-dialog-status error';
        statusBox.textContent = '请选择或输入有效的充值金额';
        return;
      }

      const channelId = Number(walletDialog.querySelector('input[name="recharge-channel"]:checked')?.value || 2);
      rechargeBtn.disabled = true;
      rechargeBtn.textContent = '正在拉起支付页面…';

      try {
        const res = await api('/api/account/wallet/recharge', {
          data: { amount: selectedAmount, channelId }
        });
        const payUrl = res.pay_url || res.data?.pay_url;
        if (payUrl) {
          statusBox.className = 'wallet-dialog-status success';
          statusBox.textContent = '已创建充值单，正在直接跳转收银台…';
          location.href = payUrl;
          return;
        } else {
          statusBox.className = 'wallet-dialog-status error';
          statusBox.textContent = res.error || '无法拉起支付页面，请重试';
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
              <h3 title="${esc(email)}">${esc(email)}</h3>
              <div class="center-user-badges">
                <span class="user-badge-tag">
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  尊贵会员
                </span>
                <span class="user-badge-balance">钱包余额: <b>¥${money(bal)}</b></span>
              </div>
            </div>
            <button class="center-recharge-btn" id="center-go-recharge">+ 立即充值</button>
          </div>
        </div>

        <div class="center-nav-tabs">
          <button class="center-tab-btn ${section === 'orders' ? 'active' : ''}" data-target="orders">
            <span>📦</span> 我的订单
          </button>
          <button class="center-tab-btn ${section === 'wallet' ? 'active' : ''}" data-target="wallet">
            <span>💳</span> 钱包流水
          </button>
          <button class="center-tab-btn ${section === 'security' ? 'active' : ''}" data-target="security">
            <span>🔒</span> 账号安全
          </button>
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
              <button class="close-center-to-shop">去订阅商店逛逛 →</button>
            </div>
          `;
          container.querySelector('.close-center-to-shop')?.addEventListener('click', () => centerDialog.close());
          return;
        }

        const statusMap = {
          pending_payment: '待付款',
          paid: '已付款 · 正在处理',
          fulfilling: '自动化开通中',
          completed: '已完成交付',
          delivered: '已交付',
          canceled: '已取消',
          refunded: '已退款'
        };

        container.innerHTML = `
          <div class="center-order-list">
            ${orders.map(o => {
              const it = o.items?.[0];
              const rawTitle = it?.title || it?.product_name || it?.product_title || it?.name;
              const displayTitle = typeof rawTitle === 'string' ? rawTitle : (typeof rawTitle === 'object' && rawTitle ? (rawTitle.zh_CN || rawTitle.zh || Object.values(rawTitle)[0] || 'ChatGPT 订阅方案') : 'ChatGPT 订阅方案');
              return `
              <div class="center-order-row">
                <div class="order-row-main">
                  <div class="order-row-title">${esc(displayTitle)}</div>
                  <div class="order-row-meta">
                    <span>订单号: <code>${esc(o.order_no)}</code></span>
                    <span>状态: <b class="order-status-badge ${esc(o.status)}">${esc(statusMap[o.status] || o.status)}</b></span>
                  </div>
                </div>
                <div class="order-row-right">
                  <span class="order-row-price">¥${money(o.total_amount)}</span>
                  <button class="btn-pay-now" data-order="${esc(o.order_no)}">${o.status === 'pending_payment' ? '继续付款' : '查看订单 / 卡密'}</button>
                </div>
              </div>
            `;}).join('')}
          </div>
        `;
        container.querySelectorAll('[data-order]').forEach(button => {
          button.addEventListener('click', () => {
            const p = (location.pathname.endsWith('/') || location.pathname.endsWith('.html')) ? location.pathname : location.pathname + '/'; location.href = p + '?view=orders&order_no=' + encodeURIComponent(button.dataset.order);
          });
        });
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
          <div class="security-card">
            <div class="security-card-header">
              <span class="security-card-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                修改登录密码
              </span>
              <span class="security-card-desc">建议定期更换密码，新密码需至少 6 位并包含字母和数字</span>
            </div>
            <form class="security-form" id="pwd-change-form">
              <div class="security-form-group">
                <label for="sec-old-pwd">当前旧密码</label>
                <div class="security-input-wrap">
                  <span class="input-icon">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input type="password" id="sec-old-pwd" name="old_password" required placeholder="请输入当前使用的旧密码" autocomplete="current-password">
                  <button type="button" class="toggle-pwd-btn" id="sec-toggle-old" aria-label="显示/隐藏密码">
                    <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="security-form-group">
                <label for="sec-new-pwd">设置新密码</label>
                <div class="security-input-wrap">
                  <span class="input-icon">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m21 2-2 2m-6 6 2-2M9 13l-4 4a2.828 2.828 0 1 0 4 4l4-4m-4-4 4 4"/>
                      <circle cx="16.5" cy="7.5" r="4.5"/>
                    </svg>
                  </span>
                  <input type="password" id="sec-new-pwd" name="new_password" required minlength="6" placeholder="输入至少 6 位新密码（含字母和数字）" autocomplete="new-password">
                  <button type="button" class="toggle-pwd-btn" id="sec-toggle-new" aria-label="显示/隐藏密码">
                    <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="security-error" id="pwd-error" role="status"></div>
              <button type="submit" class="security-submit-btn" id="pwd-submit-btn">保存新密码</button>
            </form>
          </div>

          <div class="security-card danger-card">
            <div class="security-logout-row">
              <div class="security-card-header">
                <span class="security-card-title">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  退出登录
                </span>
                <span class="security-card-desc">退出后将清除本设备登录凭据，下次需重新输入密码</span>
              </div>
              <button class="security-danger-btn" id="danger-logout-btn">
                退出当前账号
              </button>
            </div>
          </div>
        </div>
      `;

      // 绑定密码眼睛切换
      const bindEyeToggle = (btnId, inputId) => {
        const btn = centerDialog.querySelector(btnId);
        const input = centerDialog.querySelector(inputId);
        btn?.addEventListener('click', () => {
          const isPwd = input.type === 'password';
          input.type = isPwd ? 'text' : 'password';
          btn.innerHTML = isPwd ? `
            <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
          ` : `
            <svg class="eye-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          `;
        });
      };
      bindEyeToggle('#sec-toggle-old', '#sec-old-pwd');
      bindEyeToggle('#sec-toggle-new', '#sec-new-pwd');

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
        const oldPwd = fd.get('old_password');
        const newPwd = fd.get('new_password');

        if (newPwd.length < 6 || !/[a-zA-Z]/.test(newPwd) || !/\d/.test(newPwd)) {
          errBox.textContent = '新密码必须至少包含 6 个字符，且必须同时包含字母和数字';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '正在保存…';
        try {
          await api('/api/account/password', {
            data: {
              old_password: oldPwd,
              new_password: newPwd
            }
          });
          alert('密码修改成功，请使用新密码重新登录');
          centerDialog.close();
          logout();
        } catch (err) {
          errBox.textContent = err.message || '修改密码失败，请检查旧密码是否正确';
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = '保存新密码';
        }
      });
    }
  }

  async function logout() {
    try {
      await api('/api/account/logout', { method: 'POST' });
    } catch {}
    state.user = null;
    sessionStorage.removeItem('hh-dujiao-order');
    localStorage.removeItem('hh-dujiao-order');
    sessionStorage.removeItem('hh-auth-welcome-seen');
    updateHeader();
    notifyStateChange();
    location.replace('/');
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

  function showAccountToast(msg) {
    let t = document.getElementById('hh-global-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'hh-global-toast';
      t.style.cssText = 'position:fixed;top:28px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#fff;padding:14px 28px;border-radius:14px;font-size:14px;font-weight:600;box-shadow:0 12px 36px rgba(0,0,0,0.3);z-index:99999;backdrop-filter:blur(10px);transition:all 0.35s cubic-bezier(0.16,1,0.3,1);opacity:0;pointer-events:none;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.15);';
      document.body.appendChild(t);
    }
    t.innerHTML = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(-12px)';
    }, 5000);
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

    // Check if returning from payment/recharge
    const params = new URLSearchParams(location.search);
    if (params.get('wallet_recharge') === '1' || (params.get('payment_return') === '1' && !params.get('order_no'))) {
      const amt = params.get('amount');
      history.replaceState(null, '', location.pathname);
      refreshUser().then(u => {
        const bal = u?.wallet?.balance || '0.00';
        showAccountToast(amt ? `🎉 充值已成功到账！已入账 ¥${amt}，当前钱包可用余额为 ¥${bal}` : `🎉 钱包充值已到账！当前最新可用余额为 ¥${bal}`);
      });
    }

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
    api,
    showToast: showAccountToast
  };
})();
