// DetectIQ Browser Extension - In-Page Content Script & Ambient Threat Guard

(function () {
  if (window.__detectiq_injected) return;
  window.__detectiq_injected = true;

  let shadowHost = null;
  let shadowRoot = null;
  let overlayCard = null;
  let hoverTooltip = null;
  let formWarningBanner = null;

  // Listen for background service worker messages
  chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
    if (request.action === 'SHOW_LOADING_OVERLAY') {
      createOrShowOverlay();
      renderLoadingState(request.target);
    } else if (request.action === 'SHOW_RESULT_OVERLAY') {
      createOrShowOverlay();
      renderResultState(request.target, request.result);
    }
  });

  // -------------------------------------------------------------
  // 1. PRE-CLICK LINK INSPECTOR (Hover Shield)
  // -------------------------------------------------------------
  document.addEventListener('mouseover', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.href) {
      if (hoverTooltip) removeHoverTooltip();
      return;
    }

    const href = link.href;
    if (href.startsWith('javascript:') || href.startsWith('#')) return;

    const isSuspiciousShortener = /bit\.ly|tinyurl\.com|t\.co|is\.gd|buff\.ly|ow\.ly|rebrand\.ly/i.test(href);
    const isTyposquat = /rnicrosof|g00gl|paypa1|bankofamenca|login-verify-account/i.test(href);
    const isIpHost = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i.test(href);
    const isNonHttpsCred = href.startsWith('http://') && /login|password|auth|verify|bank|account/i.test(href);

    if (isSuspiciousShortener || isTyposquat || isIpHost || isNonHttpsCred) {
      let msg = '⚠️ DetectIQ Guard: ';
      if (isTyposquat) msg += 'Deceptive typosquatting domain!';
      else if (isSuspiciousShortener) msg += 'Shortened URL hides true destination.';
      else if (isIpHost) msg += 'Direct IP host link (High Risk).';
      else msg += 'Unencrypted credential link!';

      showHoverTooltip(link, msg);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const link = e.target.closest('a');
    if (link && hoverTooltip) {
      removeHoverTooltip();
    }
  });

  function showHoverTooltip(targetEl, text) {
    removeHoverTooltip();
    hoverTooltip = document.createElement('div');
    hoverTooltip.id = 'detectiq-hover-tooltip';
    hoverTooltip.style.cssText = `
      position: absolute;
      z-index: 2147483647;
      background: #0F172A;
      color: #F87171;
      border: 1px solid #EF4444;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      box-shadow: 0 8px 16px rgba(0,0,0,0.3);
      pointer-events: none;
      font-family: -apple-system, sans-serif;
    `;
    hoverTooltip.textContent = text;
    document.body.appendChild(hoverTooltip);

    const rect = targetEl.getBoundingClientRect();
    const tooltipWidth = 280;
    let leftPos = rect.left + window.scrollX;
    if (leftPos + tooltipWidth > window.innerWidth) {
      leftPos = Math.max(10, window.innerWidth - tooltipWidth - 20);
    }
    hoverTooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
    hoverTooltip.style.left = `${Math.max(10, leftPos)}px`;
  }

  function removeHoverTooltip() {
    if (hoverTooltip && hoverTooltip.parentNode) {
      hoverTooltip.parentNode.removeChild(hoverTooltip);
      hoverTooltip = null;
    }
  }

  // -------------------------------------------------------------
  // 2. CREDENTIAL PHISHING INTERCEPTOR
  // -------------------------------------------------------------
  document.addEventListener('focusin', (e) => {
    const input = e.target;
    if (!input || input.tagName !== 'INPUT') return;

    const isSensitive = input.type === 'password' || /otp|pass|card|ssn|secret/i.test(input.name || '') || /otp|pass|card|ssn|secret/i.test(input.id || '');
    if (!isSensitive) return;

    const currentUrl = window.location.href;
    const isHttps = currentUrl.startsWith('https://');
    const isUntrustedDomain = !isHttps || /rnicrosof|g00gl|paypa1|bankofamenca|login-verify/i.test(currentUrl);

    if (isUntrustedDomain) {
      showFormWarningBanner();
    }
  });

  function showFormWarningBanner() {
    if (formWarningBanner) return;
    formWarningBanner = document.createElement('div');
    formWarningBanner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: #DC2626; color: #FFFFFF; font-family: -apple-system, sans-serif;
      font-size: 12px; font-weight: 700; text-align: center; padding: 8px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; gap: 8px;
    `;
    formWarningBanner.innerHTML = `
      <span>🛑 DetectIQ Credential Guard: Caution! You are entering sensitive credentials on an untrusted or non-HTTPS site.</span>
      <button style="background: rgba(255,255,255,0.2); border: none; color: #FFF; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;" id="btnDismissFormWarn">Dismiss</button>
    `;
    document.body.appendChild(formWarningBanner);
    document.getElementById('btnDismissFormWarn').onclick = () => {
      if (formWarningBanner) {
        formWarningBanner.remove();
        formWarningBanner = null;
      }
    };
  }

  // -------------------------------------------------------------
  // 3. WEBMAIL SAFETY SHIELD (Gmail & Outlook)
  // -------------------------------------------------------------
  if (window.location.hostname.includes('mail.google.com') || window.location.hostname.includes('outlook')) {
    setInterval(injectWebmailShield, 2500);
  }

  function injectWebmailShield() {
    const gmailContainers = document.querySelectorAll('.a3s.aiL:not([data-detectiq-shielded])');
    gmailContainers.forEach(container => {
      container.setAttribute('data-detectiq-shielded', 'true');
      const emailText = container.innerText || '';
      if (emailText.length < 20) return;

      const headerPill = document.createElement('div');
      headerPill.style.cssText = `
        background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px;
        padding: 8px 12px; margin-bottom: 12px; font-family: -apple-system, sans-serif;
        font-size: 12px; color: #0369A1; display: flex; align-items: center; justify-content: space-between;
      `;
      headerPill.innerHTML = `
        <div style="display:flex; align-items:center; gap: 6px;">
          <strong style="color: #0284C7;">🛡 DetectIQ Email Shield:</strong>
          <span>Automatic Threat Guard Active</span>
        </div>
        <button style="background: #0284C7; color: #FFF; border: none; padding: 4px 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;" class="btn-analyze-email">
          Analyze Email with DetectIQ Engine
        </button>
      `;

      container.insertBefore(headerPill, container.firstChild);
      headerPill.querySelector('.btn-analyze-email').onclick = () => {
        createOrShowOverlay();
        renderLoadingState('Active Email');
        chrome.runtime.sendMessage({
          action: 'PERFORM_SCAN',
          scanType: 'email',
          content: emailText.slice(0, 1000)
        }, (res) => {
          if (res && res.result) {
            renderResultState('Active Email', res.result);
          }
        });
      };
    });
  }

  // -------------------------------------------------------------
  // 4. FLOATING OVERLAY SHADOW DOM
  // -------------------------------------------------------------
  function createOrShowOverlay() {
    if (!shadowHost) {
      shadowHost = document.createElement('div');
      shadowHost.id = 'detectiq-shadow-host';
      shadowRoot = shadowHost.attachShadow({ mode: 'open' });

      // Embed Content CSS into Shadow DOM
      const styleEl = document.createElement('style');
      styleEl.textContent = `
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          z-index: 2147483647;
          position: fixed;
          bottom: 24px;
          right: 24px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .detectiq-card {
          width: 310px;
          background-color: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.15), 0 4px 10px -2px rgba(15, 23, 42, 0.08);
          overflow: hidden;
          color: #0F172A;
          font-size: 13px;
          line-height: 1.4;
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .detectiq-card.hiding {
          animation: slideOutDown 0.2s cubic-bezier(0.7, 0, 0.84, 0) forwards;
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideOutDown {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(20px) scale(0.96); }
        }
        .card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0;
          cursor: move; user-select: none;
        }
        .brand-row { display: flex; align-items: center; gap: 7px; }
        .logo-badge {
          width: 22px; height: 22px; border-radius: 6px; background: #2563EB;
          color: #FFF; display: flex; align-items: center; justify-content: center;
        }
        .brand-title { font-weight: 700; font-size: 13px; color: #0F172A; }
        .brand-title span { color: #2563EB; }
        .btn-close {
          background: transparent; border: none; color: #64748B; cursor: pointer;
          width: 22px; height: 22px; border-radius: 4px; display: flex;
          align-items: center; justify-content: center; font-size: 16px;
        }
        .btn-close:hover { background: #E2E8F0; color: #0F172A; }
        .card-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
        .target-row {
          font-size: 11px; color: #64748B; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; background: #F8FAFC; padding: 4px 8px;
          border-radius: 6px; border: 1px solid #E2E8F0;
        }
        .risk-summary-row { display: flex; align-items: center; justify-content: space-between; }
        .risk-badge {
          display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px;
          border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase;
        }
        .risk-badge.safe { background: #ECFDF5; color: #10B981; border: 1px solid #A7F3D0; }
        .risk-badge.low { background: #F0F9FF; color: #0EA5E9; border: 1px solid #BAE6FD; }
        .risk-badge.suspicious { background: #FFFBEB; color: #F59E0B; border: 1px solid #FDE68A; }
        .risk-badge.high { background: #FEF2F2; color: #EF4444; border: 1px solid #FECACA; }
        .risk-badge.critical { background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; }
        .risk-score-display { font-size: 13px; font-weight: 700; color: #0F172A; }
        .signals-list { display: flex; flex-direction: column; gap: 4px; }
        .signal-item { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; color: #334155; }
        .signal-bullet.pass { color: #10B981; font-weight: 700; }
        .signal-bullet.fail { color: #EF4444; font-weight: 700; }
        .recommendation-box {
          font-size: 11px; color: #475569; background: #F8FAFC; padding: 8px 10px;
          border-radius: 8px; border-left: 3px solid #2563EB;
        }
        .loading-box { display: flex; align-items: center; gap: 8px; padding: 10px 0; color: #2563EB; font-weight: 600; }
        .spinner {
          width: 16px; height: 16px; border: 2px solid #E2E8F0; border-top-color: #2563EB;
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `;

      shadowRoot.appendChild(styleEl);

      overlayCard = document.createElement('div');
      overlayCard.className = 'detectiq-card';
      shadowRoot.appendChild(overlayCard);

      document.body.appendChild(shadowHost);
      makeDraggable(overlayCard, shadowHost);
    }
  }

  function renderLoadingState(targetStr) {
    overlayCard.innerHTML = `
      <div class="card-header">
        <div class="brand-row">
          <div class="logo-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span class="brand-title">Detect<span>IQ</span></span>
        </div>
        <button class="btn-close" id="btnCloseOverlay">&times;</button>
      </div>
      <div class="card-body">
        <div class="target-row" title="${escapeHtml(targetStr)}">Target: ${escapeHtml(targetStr)}</div>
        <div class="loading-box">
          <div class="spinner"></div>
          <span>Analyzing security parameters...</span>
        </div>
      </div>
    `;

    bindCloseButton();
  }

  function renderResultState(targetStr, result) {
    const score = typeof result.score === 'number' ? result.score : 10;
    const level = result.level || 'safe';
    const signals = result.signals || ['Clean target'];
    const recommendation = result.recommendation || 'No threat detected.';

    overlayCard.innerHTML = `
      <div class="card-header">
        <div class="brand-row">
          <div class="logo-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span class="brand-title">Detect<span>IQ</span> Security Guard</span>
        </div>
        <button class="btn-close" id="btnCloseOverlay">&times;</button>
      </div>
      <div class="card-body">
        <div class="target-row" title="${escapeHtml(targetStr)}">${escapeHtml(targetStr)}</div>
        
        <div class="risk-summary-row">
          <span class="risk-badge ${level}">
            <span class="risk-badge-dot"></span>
            ${level.toUpperCase()} RISK
          </span>
          <span class="risk-score-display">Risk Score: ${score}/100</span>
        </div>

        <div class="signals-list">
          ${signals.map(s => {
            let textVal = typeof s === 'object' && s !== null
              ? (s.detail || s.explanation || s.description || s.message || s.summary || s.title || s.signal || JSON.stringify(s))
              : String(s);
            textVal = textVal.trim().replace(/\s+/g, ' ');
            if (textVal.length > 95) {
              textVal = textVal.slice(0, 92) + '...';
            }
            return `
              <div class="signal-item">
                <span class="signal-bullet ${level === 'safe' ? 'pass' : 'fail'}">${level === 'safe' ? '✓' : '!'}</span>
                <span>${escapeHtml(textVal)}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="recommendation-box">
          ${escapeHtml(recommendation)}
        </div>
      </div>
    `;

    bindCloseButton();
  }

  function bindCloseButton() {
    const closeBtn = shadowRoot.querySelector('#btnCloseOverlay');
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (overlayCard) {
          overlayCard.classList.add('hiding');
          setTimeout(() => {
            if (shadowHost && shadowHost.parentNode) {
              shadowHost.parentNode.removeChild(shadowHost);
              shadowHost = null;
              overlayCard = null;
            }
          }, 200);
        }
      };
    }
  }

  function makeDraggable(card, host) {
    let isDragging = false;
    let startX, startY, initialRight, initialBottom;

    card.addEventListener('mousedown', (e) => {
      const header = shadowRoot.querySelector('.card-header');
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const computed = window.getComputedStyle(host);
        initialRight = parseInt(computed.right, 10) || 24;
        initialBottom = parseInt(computed.bottom, 10) || 24;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      host.style.right = `${initialRight + dx}px`;
      host.style.bottom = `${initialBottom + dy}px`;
    }

    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  function formatTextValue(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      return val.detail || val.explanation || val.description || val.message || val.summary || val.title || val.signal || val.indicator || val.name || JSON.stringify(val);
    }
    return String(val);
  }

  function escapeHtml(str) {
    const text = typeof str === 'object' ? formatTextValue(str) : String(str || '');
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
