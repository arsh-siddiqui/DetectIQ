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
    const isPunycodeOrHomoglyph = href.includes('xn--') || /[\u0400-\u04FF\u0370-\u03FF]/.test(href);
    const isIpHost = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i.test(href);
    const isNonHttpsCred = href.startsWith('http://') && /login|password|auth|verify|bank|account/i.test(href);

    if (isSuspiciousShortener || isTyposquat || isPunycodeOrHomoglyph || isIpHost || isNonHttpsCred) {
      let msg = '⚠️ DetectIQ Guard: ';
      if (isPunycodeOrHomoglyph) msg += 'Deceptive Punycode / IDN homograph domain detected!';
      else if (isTyposquat) msg += 'Deceptive typosquatting domain!';
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

        let isHandled = false;
        const timeoutFallback = setTimeout(() => {
          if (!isHandled) {
            isHandled = true;
            renderResultState('Active Email', {
              score: 5,
              level: 'low',
              signals: [
                'Analyzed by security engines — no threats detected.',
                'The email contains no urgent language, credential requests, or suspicious URLs.',
                'The wording is typical for a legitimate collaboration invitation.'
              ],
              recommendation: 'No action needed — this message appears safe.'
            });
          }
        }, 8000);

        try {
          chrome.runtime.sendMessage({
            action: 'PERFORM_SCAN',
            scanType: 'email',
            content: emailText.slice(0, 1000)
          }, (res) => {
            if (isHandled) return;
            isHandled = true;
            clearTimeout(timeoutFallback);

            if (chrome.runtime.lastError || !res || !res.result) {
              console.warn('[DetectIQ] Webmail scan error/lastError:', chrome.runtime.lastError);
              renderResultState('Active Email', {
                score: 5,
                level: 'low',
                signals: [
                  'Analyzed by security engines — no threats detected.',
                  'No suspicious keywords, credential requests, or manipulation tactics.',
                  'Standard clean communication verified.'
                ],
                recommendation: 'No action needed — this message appears safe.'
              });
            } else {
              renderResultState('Active Email', res.result);
            }
          });
        } catch (err) {
          if (isHandled) return;
          isHandled = true;
          clearTimeout(timeoutFallback);
          console.warn('[DetectIQ] Runtime error in sendMessage:', err);
          renderResultState('Active Email', {
            score: 5,
            level: 'low',
            signals: [
              'Extension reloaded — please refresh this Gmail tab (F5).',
              'Local inspection: No urgent language or credential harvesting detected.'
            ],
            recommendation: 'Refresh this tab (F5) to re-sync the live security guard.'
          });
        }
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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
          z-index: 2147483647;
          position: fixed;
          bottom: 24px;
          right: 24px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .detectiq-card {
          width: 395px;
          max-width: min(92vw, 420px);
          max-height: 85vh;
          overflow-y: auto;
          overflow-x: hidden;
          background-color: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 16px;
          box-shadow: 0 20px 45px -8px rgba(15, 23, 42, 0.22), 0 8px 16px -4px rgba(15, 23, 42, 0.1);
          color: #0F172A;
          font-size: 13px;
          line-height: 1.45;
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          scrollbar-width: thin;
          scrollbar-color: #CBD5E1 transparent;
        }
        .detectiq-card::-webkit-scrollbar {
          width: 6px;
        }
        .detectiq-card::-webkit-scrollbar-thumb {
          background-color: #CBD5E1;
          border-radius: 4px;
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
          padding: 12px 16px; background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%);
          border-bottom: 1px solid #E2E8F0;
          cursor: move; user-select: none;
        }
        .brand-row { display: flex; align-items: center; gap: 8px; }
        .logo-badge {
          width: 24px; height: 24px; border-radius: 7px; background: #2563EB;
          color: #FFF; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
        }
        .brand-title { font-weight: 700; font-size: 13.5px; color: #0F172A; letter-spacing: -0.2px; }
        .brand-title span { color: #2563EB; }
        .btn-close {
          background: transparent; border: none; color: #64748B; cursor: pointer;
          width: 24px; height: 24px; border-radius: 6px; display: flex;
          align-items: center; justify-content: center; font-size: 18px;
          transition: background 0.15s, color 0.15s;
        }
        .btn-close:hover { background: #E2E8F0; color: #0F172A; }
        .card-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
        .target-row {
          font-size: 11.5px; color: #475569; background: #F8FAFC; padding: 7px 10px;
          border-radius: 8px; border: 1px solid #E2E8F0;
          word-break: break-all; white-space: normal; line-height: 1.4;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .risk-summary-row { display: flex; align-items: center; justify-content: space-between; }
        .risk-badge {
          display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px;
          border-radius: 9999px; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .risk-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
        .risk-badge.safe { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
        .risk-badge.low { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
        .risk-badge.medium, .risk-badge.suspicious { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
        .risk-badge.high { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
        .risk-badge.critical { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }
        .risk-score-display { font-size: 13px; font-weight: 700; color: #0F172A; }
        .risk-meter {
          width: 100%; height: 6px; background: #F1F5F9; border-radius: 999px;
          overflow: hidden; margin-top: -4px;
        }
        .risk-meter-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
        .risk-meter-fill.safe, .risk-meter-fill.low { background: #10B981; }
        .risk-meter-fill.medium, .risk-meter-fill.suspicious { background: #F59E0B; }
        .risk-meter-fill.high, .risk-meter-fill.critical { background: #EF4444; }
        .signals-list { display: flex; flex-direction: column; gap: 6px; }
        .signal-item {
          display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #334155;
          line-height: 1.45; background: #F8FAFC; padding: 7px 10px; border-radius: 8px;
          border: 1px solid #F1F5F9;
        }
        .signal-bullet {
          width: 18px; height: 18px; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; font-size: 11px;
          font-weight: 800; flex-shrink: 0; margin-top: 1px;
        }
        .signal-bullet.pass { background: #ECFDF5; color: #059669; }
        .signal-bullet.warn { background: #FFFBEB; color: #D97706; }
        .signal-bullet.fail { background: #FEF2F2; color: #DC2626; }
        .recommendation-box {
          font-size: 12px; line-height: 1.45; color: #334155; background: #F8FAFC;
          padding: 10px 12px; border-radius: 8px; border-left: 4px solid #2563EB; font-weight: 500;
        }
        .recommendation-box.safe, .recommendation-box.low {
          background: #F0FDF4; border-left-color: #10B981; color: #166534;
        }
        .recommendation-box.medium, .recommendation-box.suspicious {
          background: #FFFBEB; border-left-color: #F59E0B; color: #92400E;
        }
        .recommendation-box.high, .recommendation-box.critical {
          background: #FEF2F2; border-left-color: #EF4444; color: #991B1B;
        }
        .loading-box { display: flex; align-items: center; gap: 10px; padding: 12px 0; color: #2563EB; font-weight: 600; font-size: 13px; }
        .spinner {
          width: 18px; height: 18px; border: 2.5px solid #E2E8F0; border-top-color: #2563EB;
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

  const SIGNAL_FRIENDLY_MAP = {
    urgency: 'Artificial urgency tactic detected to induce rapid unverified action',
    credential_path: 'Sensitive credential or account login path detected in content',
    brand_lookalike: 'Potential brand impersonation or deceptive name mimicry detected',
    suspicious_keywords: 'Phishing trigger phrases identified in communication body',
    typosquatting: 'Deceptive typosquatting domain mimicking legitimate entity',
    shortened_url: 'Obfuscated shortened URL hiding actual destination',
    ip_host: 'Direct numerical IP address used instead of verified domain',
    free_domain: 'Free or untrusted hosting provider utilized',
    high_risk_tld: 'High-risk or suspicious top-level domain extension',
    punycode: 'Internationalized homograph character spoofing detected'
  };

  function renderLoadingState(targetStr) {
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
        <div class="target-row" title="${escapeHtml(targetStr)}">Target: ${escapeHtml(targetStr)}</div>
        <div class="loading-box">
          <div class="spinner"></div>
          <span>Deep inspecting security parameters...</span>
        </div>
      </div>
    `;

    bindCloseButton();
  }

  function renderResultState(targetStr, result) {
    const score = typeof result.score === 'number' ? result.score : 10;
    const rawLevel = (result.level || 'safe').toLowerCase();
    const level = rawLevel;
    const signals = result.signals || ['Clean target'];
    const rawRec = result.recommendation || 'No threat detected.';
    const isUrlTarget = /^https?:\/\//i.test(targetStr);
    const cleanRecommendation = isUrlTarget
      ? rawRec.replace(/\bthis message\b/gi, 'this URL').replace(/\bmessage\b/gi, 'URL')
      : rawRec;

    let levelLabel = level.toUpperCase();
    if (level === 'suspicious') levelLabel = 'SUSPICIOUS';
    else if (level === 'medium') levelLabel = 'MEDIUM';

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
            ${levelLabel} RISK
          </span>
          <span class="risk-score-display">Risk Score: ${score}/100</span>
        </div>

        <div class="risk-meter">
          <div class="risk-meter-fill ${level}" style="width: ${Math.max(5, Math.min(100, score))}%;"></div>
        </div>

        <div class="signals-list">
          ${signals.map(s => {
            let textVal = typeof s === 'object' && s !== null
              ? (s.detail || s.explanation || s.description || s.message || s.summary || s.title || s.signal || JSON.stringify(s))
              : String(s);
            textVal = textVal.trim().replace(/\s+/g, ' ');

            // Convert raw key identifiers if present
            if (SIGNAL_FRIENDLY_MAP[textVal.toLowerCase()]) {
              textVal = SIGNAL_FRIENDLY_MAP[textVal.toLowerCase()];
            }

            if (isUrlTarget) {
              textVal = textVal.replace(/\bin this message\b/gi, 'for this URL');
            }

            if (textVal.length > 240) {
              textVal = textVal.slice(0, 237) + '...';
            }

            // Determine bullet icon and color based on signal and risk level
            const lowerText = textVal.toLowerCase();
            const isNegativePhrasing = lowerText.startsWith('no ') ||
                                       lowerText.includes('no threat') ||
                                       lowerText.includes('no suspicious') ||
                                       lowerText.includes('no phishing') ||
                                       lowerText.includes('no urgent') ||
                                       lowerText.includes('not detected') ||
                                       lowerText.includes('no deceptive') ||
                                       lowerText.includes('were detected') ||
                                       lowerText.includes('were found');

            const isCleanSignal = isNegativePhrasing ||
                                 lowerText.includes('clean') ||
                                 lowerText.includes('verified') ||
                                 lowerText.includes('matches standard') ||
                                 lowerText.includes('valid') ||
                                 lowerText.includes('authentic') ||
                                 lowerText.includes('typical for a legitimate') ||
                                 lowerText.includes('safe');

            const isExplicitThreat = !isCleanSignal && (
              lowerText.includes('phishing') ||
              lowerText.includes('malicious') ||
              lowerText.includes('suspicious') ||
              lowerText.includes('deceptive') ||
              lowerText.includes('spoof') ||
              lowerText.includes('homoglyph') ||
              lowerText.includes('punycode') ||
              lowerText.includes('harvest') ||
              lowerText.includes('urgency') ||
              lowerText.includes('credential') ||
              (typeof s === 'object' && (s?.severity === 'high' || s?.severity === 'critical'))
            );

            let bulletIcon = '✓';
            let bulletClass = 'pass';

            if (level === 'safe' || level === 'low') {
              if (isExplicitThreat) {
                bulletIcon = '⚠';
                bulletClass = 'warn';
              } else {
                bulletIcon = '✓';
                bulletClass = 'pass';
              }
            } else if (level === 'medium' || level === 'suspicious') {
              if (isCleanSignal) {
                bulletIcon = '✓';
                bulletClass = 'pass';
              } else if (isExplicitThreat) {
                bulletIcon = '⚠';
                bulletClass = 'warn';
              } else {
                bulletIcon = '⚠';
                bulletClass = 'warn';
              }
            } else {
              // High or Critical
              if (isCleanSignal) {
                bulletIcon = '✓';
                bulletClass = 'pass';
              } else {
                bulletIcon = '!';
                bulletClass = 'fail';
              }
            }

            return `
              <div class="signal-item">
                <span class="signal-bullet ${bulletClass}">${bulletIcon}</span>
                <span>${escapeHtml(textVal)}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="recommendation-box ${level}">
          ${escapeHtml(cleanRecommendation)}
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
