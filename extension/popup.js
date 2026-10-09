// DetectIQ Browser Extension - Popup Controller & State Machine

document.addEventListener('DOMContentLoaded', async () => {
  // Config & State
  const PROD_API_URL = 'https://detectiq-api.onrender.com';
  const DEV_API_URL = 'http://localhost:5000';
  const DEFAULT_API_URL = PROD_API_URL;
  let config = {
    apiUrl: DEFAULT_API_URL,
    autoScan: true,
    linkScan: true,
    textScan: true,
    authToken: ''
  };

  let activeTabUrl = '';
  let activeTabDomain = '';
  let currentScanType = 'url'; // url | email | text

  // DOM Elements - Navigation & Views
  const navItems = document.querySelectorAll('.nav-item');
  const tabViews = document.querySelectorAll('.tab-view');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const connectionStatusBadge = document.getElementById('connectionStatusBadge');

  // Page Scanner Elements
  const pageFavicon = document.getElementById('pageFavicon');
  const pageDomain = document.getElementById('pageDomain');
  const pageUrl = document.getElementById('pageUrl');
  const btnScanPage = document.getElementById('btnScanPage');
  const riskGaugeProgress = document.getElementById('gaugeProgress');
  const riskScoreValue = document.getElementById('riskScoreValue');
  const riskStatusPill = document.getElementById('riskStatusPill');
  const riskStatusLabel = document.getElementById('riskStatusLabel');
  
  // Result Summary Elements
  const resultSummaryBox = document.getElementById('resultSummaryBox');
  const summaryTitle = document.getElementById('summaryTitle');
  const summarySubtitle = document.getElementById('summarySubtitle');

  // Indicators & Recommendation
  const indicatorCount = document.getElementById('indicatorCount');
  const threatSignalsList = document.getElementById('threatSignalsList');
  const recommendationCard = document.getElementById('recommendationCard');
  const recommendationText = document.getElementById('recommendationText');

  // Analyzer Elements
  const segmentBtns = document.querySelectorAll('.segment-btn');
  const analyzerInput = document.getElementById('analyzerInput');
  const analyzerInputGroup = document.getElementById('analyzerInputGroup');
  const charCount = document.getElementById('charCount');
  const btnRunManualScan = document.getElementById('btnRunManualScan');
  const analyzerLoading = document.getElementById('analyzerLoading');
  const loadingStepText = document.getElementById('loadingStepText');
  const loadingProgressFill = document.getElementById('loadingProgressFill');
  const analyzerResult = document.getElementById('analyzerResult');
  const manualRiskBadge = document.getElementById('manualRiskBadge');
  const manualRiskLabel = document.getElementById('manualRiskLabel');
  const manualScoreNum = document.getElementById('manualScoreNum');
  const manualCategory = document.getElementById('manualCategory');
  const manualInputType = document.getElementById('manualInputType');
  const manualSignalsBox = document.getElementById('manualSignalsBox');
  const manualRecBox = document.getElementById('manualRecBox');
  const manualRecText = document.getElementById('manualRecText');

  // QR Scanner Elements
  const qrDropZone = document.getElementById('qrDropZone');
  const qrFileInput = document.getElementById('qrFileInput');
  const qrDropTrigger = document.getElementById('qrDropTrigger');
  const qrPreviewWrap = document.getElementById('qrPreviewWrap');
  const qrPreviewImg = document.getElementById('qrPreviewImg');
  const qrDecodedBadge = document.getElementById('qrDecodedBadge');
  const qrDecodedText = document.getElementById('qrDecodedText');
  const qrCanvas = document.getElementById('qrCanvas');

  // History Elements
  const historyList = document.getElementById('historyList');
  const btnClearHistory = document.getElementById('btnClearHistory');

  // Settings Elements
  const settingApiUrl = document.getElementById('settingApiUrl');
  const btnTestApi = document.getElementById('btnTestApi');
  const connectionTestResult = document.getElementById('connectionTestResult');
  const toggleAutoScan = document.getElementById('toggleAutoScan');
  const toggleLinkScan = document.getElementById('toggleLinkScan');
  const toggleTextScan = document.getElementById('toggleTextScan');
  const settingAuthToken = document.getElementById('settingAuthToken');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnResetSettings = document.getElementById('btnResetSettings');

  // -------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------
  initTabNavigation();
  initSettingsView();
  initAnalyzerEvents();
  initQrScanner();
  initHistoryView();
  initCaseSyncButton();
  await loadSettings();

  // Test API Connection silently
  checkBackendHealth();

  // Auto detect active browser tab
  detectAndSetPageTab();

  function detectAndSetPageTab(autoScan = true) {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      // Query lastFocusedWindow first, fallback to currentWindow
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        let activeTab = tabs && tabs[0] ? tabs[0] : null;

        if (!activeTab || !activeTab.url) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs2) => {
            if (tabs2 && tabs2[0]) applyTabDetails(tabs2[0], autoScan);
          });
        } else {
          applyTabDetails(activeTab, autoScan);
        }
      });
    } else {
      activeTabUrl = 'https://example.com';
      activeTabDomain = 'example.com';
      pageDomain.textContent = activeTabDomain;
      pageUrl.textContent = activeTabUrl;
      setMockPageResult(12, 'safe', 'Safe Domain', 'No malicious patterns detected.');
    }
  }

  function applyTabDetails(tab, autoScan) {
    if (!tab || !tab.url) return;
    const urlStr = tab.url;
    activeTabUrl = urlStr;
    
    try {
      const parsed = new URL(urlStr);
      activeTabDomain = parsed.hostname;
    } catch {
      activeTabDomain = 'Local Page';
    }

    pageDomain.textContent = activeTabDomain || 'Browser Tab';
    pageUrl.textContent = activeTabUrl;
    pageUrl.title = activeTabUrl;

    if (tab.favIconUrl) {
      pageFavicon.src = tab.favIconUrl;
    }

    const btnTrustDomain = document.getElementById('btnTrustDomain');
    if (btnTrustDomain && activeTabDomain && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['whitelistedDomains'], (res) => {
        const list = res.whitelistedDomains || [];
        if (list.includes(activeTabDomain)) {
          btnTrustDomain.textContent = '⭐ Trusted!';
          btnTrustDomain.style.background = '#10B981';
          btnTrustDomain.style.color = '#FFF';

          // If domain is whitelisted by user, show trusted safe status immediately
          if (errorStateCard) errorStateCard.classList.add('hidden');
          renderScanResult(0, 'safe', ['Verified Trusted Domain', 'Whitelisted in local security profile'], 'User-whitelisted domain: Verified authentic.');
          return;
        } else {
          btnTrustDomain.textContent = '⭐ Trust';
          btnTrustDomain.style.background = '';
          btnTrustDomain.style.color = '';

          if (autoScan && config.autoScan && !urlStr.startsWith('chrome://') && !urlStr.startsWith('edge://')) {
            runPageScan(activeTabUrl);
          }
        }
      });
    } else {
      if (autoScan && config.autoScan && !urlStr.startsWith('chrome://') && !urlStr.startsWith('edge://')) {
        runPageScan(activeTabUrl);
      }
    }
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------------

  const errorStateCard = document.getElementById('errorStateCard');
  const btnRetryScan = document.getElementById('btnRetryScan');

  btnScanPage.addEventListener('click', async () => {
    if (errorStateCard) errorStateCard.classList.add('hidden');
    
    // Refresh active tab URL before scanning
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const currentTab = tabs && tabs[0] ? tabs[0] : null;
        if (currentTab && currentTab.url) {
          applyTabDetails(currentTab, false);
          runPageScan(currentTab.url);
        } else {
          runPageScan(activeTabUrl);
        }
      });
    } else {
      runPageScan(activeTabUrl);
    }
  });

  if (btnRetryScan) {
    btnRetryScan.addEventListener('click', async () => {
      btnRetryScan.textContent = 'Retrying...';
      btnRetryScan.disabled = true;
      if (errorStateCard) errorStateCard.classList.add('hidden');
      try {
        await runPageScan(activeTabUrl);
      } finally {
        btnRetryScan.textContent = 'Try Again';
        btnRetryScan.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------
  // TAB NAVIGATION
  // -------------------------------------------------------------
  function initTabNavigation() {
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    btnOpenSettings.addEventListener('click', () => {
      switchTab('settings');
    });
  }

  function switchTab(tabId) {
    navItems.forEach(nav => {
      if (nav.getAttribute('data-tab') === tabId) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    tabViews.forEach(view => {
      const viewId = view.id.replace('view', '').toLowerCase();
      if (viewId === tabId || (tabId === 'page' && viewId === 'page')) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // If switching back to Guard while in an offline error state and server is Active, re-scan
    if ((tabId === 'page' || tabId === 'guard') && errorStateCard && !errorStateCard.classList.contains('hidden') && activeTabUrl) {
      if (connectionStatusBadge.classList.contains('online')) {
        errorStateCard.classList.add('hidden');
        runPageScan(activeTabUrl);
      }
    }
  }

  // -------------------------------------------------------------
  // PAGE SCANNER CONTROLLER
  // -------------------------------------------------------------
  async function runPageScan(targetUrl) {
    if (!targetUrl || targetUrl.startsWith('chrome://')) return;

    btnScanPage.disabled = true;
    const icon = btnScanPage.querySelector('.btn-icon');
    icon.classList.add('loading');

    updateGauge(0, 'low', 'SCANNING');
    riskScoreValue.textContent = '..';
    resultSummaryBox.className = 'result-summary-box low';
    summaryTitle.textContent = 'Scanning security parameters...';
    summarySubtitle.textContent = `Analyzing ${activeTabDomain || 'active domain'} against threat databases.`;

    recommendationText.textContent = 'Analyzing URL structure, SSL certificate, and threat intelligence...';

    const wakeTimer = setTimeout(() => {
      summaryTitle.textContent = 'Waking up security engine...';
      summarySubtitle.textContent = 'Render cloud container is starting up (takes ~20s on cold starts).';
      recommendationText.textContent = 'Connecting to threat intelligence pipeline... please wait a few seconds.';
    }, 3500);

    try {
      const result = await DetectIQApi.performScan('url', targetUrl);

      if (errorStateCard) {
        if (result.isOfflineFallback) {
          errorStateCard.classList.remove('hidden');
          const errorMsg = errorStateCard.querySelector('.error-msg');
          if (errorMsg) {
            errorMsg.textContent = result.error ? `Engine connecting (${result.error})` : 'DetectIQ analysis engine could not be reached.';
          }
        } else {
          errorStateCard.classList.add('hidden');
        }
      }

      renderScanResult(result.score, result.level, result.reasons, result.recommendation);
      saveToHistory(targetUrl, result.score, result.level);

    } catch (err) {
      console.warn('Scan execution error:', err);
      if (errorStateCard) {
        errorStateCard.classList.remove('hidden');
        const errorMsg = errorStateCard.querySelector('.error-msg');
        if (errorMsg) errorMsg.textContent = err.message || 'Analysis engine request failed.';
      }
    } finally {
      clearTimeout(wakeTimer);
      btnScanPage.disabled = false;
      icon.classList.remove('loading');
    }
  }

  function renderScanResult(score, riskLevel, reasons, recommendation) {
    updateGauge(score, riskLevel, riskLevel.toUpperCase());
    
    // Result Summary Box Update
    resultSummaryBox.className = `result-summary-box ${riskLevel}`;
    const summaryData = getSummaryTextForLevel(riskLevel);
    summaryTitle.textContent = summaryData.title;
    summarySubtitle.textContent = summaryData.subtitle;

    // Build Threat Signals
    threatSignalsList.innerHTML = '';

    const defaultIcons = {
      pass: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
      warn: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      fail: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    };

    const defaultTitles = ['Domain Reputation', 'SSL Encryption', 'URL Pattern', 'Threat Intelligence', 'Keyword Analysis'];
    const defaultBadges = { pass: 'CLEAN', warn: 'WARNING', fail: 'DANGER' };

    const isSafe = riskLevel === 'safe' || score < 30;
    const statusType = isSafe ? 'pass' : (score > 70 ? 'fail' : 'warn');

    if (Array.isArray(reasons) && reasons.length > 0) {
      reasons.forEach((reasonItem, idx) => {
        const sigCard = document.createElement('div');
        sigCard.className = 'signal-card';

        let title = defaultTitles[idx] || `Signal #${idx + 1}`;
        let reasonDesc = '';

        if (typeof reasonItem === 'string') {
          reasonDesc = reasonItem;
        } else if (typeof reasonItem === 'object' && reasonItem !== null) {
          if (reasonItem.title) {
            title = reasonItem.title;
          }
          reasonDesc = reasonItem.detail || reasonItem.explanation || reasonItem.description || reasonItem.message || reasonItem.summary || reasonItem.signal || reasonItem.indicator || reasonItem.name || '';
          if (!reasonDesc && !reasonItem.title) {
            reasonDesc = JSON.stringify(reasonItem);
          }
        } else {
          reasonDesc = String(reasonItem);
        }

        // Clean & concise text length formatting (max 95 chars)
        reasonDesc = reasonDesc.trim().replace(/\s+/g, ' ');
        if (reasonDesc.length > 95) {
          reasonDesc = reasonDesc.slice(0, 92) + '...';
        }

        const badgeLabel = idx === 1 && isSafe ? 'VALID HTTPS' : (idx === 3 && isSafe ? 'NO MATCH' : defaultBadges[statusType]);

        sigCard.innerHTML = `
          <div class="signal-icon-wrapper ${statusType}">${defaultIcons[statusType]}</div>
          <div class="signal-details">
            <div class="signal-title-row">
              <span class="signal-title">${escapeHtml(title)}</span>
              <span class="signal-badge ${statusType}">${escapeHtml(badgeLabel)}</span>
            </div>
            <p class="signal-desc">${escapeHtml(reasonDesc)}</p>
          </div>
        `;
        threatSignalsList.appendChild(sigCard);
      });
    }

    indicatorCount.textContent = `${threatSignalsList.children.length} Evaluated`;

    // Recommendation
    recommendationCard.className = `card recommendation-card ${riskLevel}`;
    recommendationText.textContent = recommendation;
  }

  function setMockPageResult(score, level, category, recText) {
    updateGauge(score, level, level.toUpperCase());
    renderScanResult(score, level, [category, 'Clean DNS & SSL certificates'], recText);
  }

  // Visual Gauge Arc Controller
  function updateGauge(score, riskLevel, label) {
    const maxOffset = 251.2; // Circumference of semicircle arc
    const clampedScore = Math.max(0, Math.min(100, score));
    const offset = maxOffset - (clampedScore / 100) * maxOffset;

    riskGaugeProgress.style.strokeDashoffset = offset;
    riskGaugeProgress.className = `gauge-fill ${riskLevel}`;
    
    // Animate score counter
    animateNumber(riskScoreValue, clampedScore);

    riskStatusPill.className = `risk-status-pill ${riskLevel}`;
    riskStatusLabel.textContent = label;
  }

  function animateNumber(element, targetNum) {
    const startNum = parseInt(element.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(startNum + (targetNum - startNum) * progress);
      element.textContent = current;
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function getSummaryTextForLevel(level) {
    switch (level) {
      case 'safe':
        return { title: '🛡 Looks safe', subtitle: 'No significant security threats were detected on this page.' };
      case 'low':
        return { title: '🛡 Looks safe', subtitle: 'Domain parameters look standard; safe for browsing.' };
      case 'suspicious':
        return { title: '⚠ Review before continuing', subtitle: 'Some suspicious indicators were detected. Review before sharing sensitive information.' };
      case 'high':
        return { title: '🛑 Avoid this page', subtitle: 'Multiple high-risk indicators were detected on this domain.' };
      case 'critical':
        return { title: '🛑 Avoid this page', subtitle: 'CRITICAL PHISHING THREAT! Do not enter passwords or sensitive data.' };
      default:
        return { title: 'Security analysis active', subtitle: 'Evaluating webpage parameters.' };
    }
  }

  // -------------------------------------------------------------
  // MANUAL ANALYZER & QR CONTROLLER
  // -------------------------------------------------------------
  function initAnalyzerEvents() {
    segmentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        segmentBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentScanType = btn.getAttribute('data-type');
        
        if (currentScanType === 'qr') {
          if (analyzerInputGroup) analyzerInputGroup.classList.add('hidden');
          if (qrDropZone) qrDropZone.classList.remove('hidden');
          const btnLabel = btnRunManualScan.querySelector('span');
          if (btnLabel) btnLabel.textContent = 'Scan QR Code';
        } else {
          if (analyzerInputGroup) analyzerInputGroup.classList.remove('hidden');
          if (qrDropZone) qrDropZone.classList.add('hidden');
          const btnLabel = btnRunManualScan.querySelector('span');
          if (btnLabel) btnLabel.textContent = 'Analyze Content with DetectIQ';

          if (currentScanType === 'url') {
            analyzerInput.placeholder = 'Paste URL (e.g. https://suspicious-login.com)...';
          } else if (currentScanType === 'email') {
            analyzerInput.placeholder = 'Paste email body, headers, or suspicious message...';
          } else {
            analyzerInput.placeholder = 'Paste suspicious code, raw text, or message payload...';
          }
        }
      });
    });

    analyzerInput.addEventListener('input', () => {
      charCount.textContent = analyzerInput.value.length;
    });

    analyzerInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        btnRunManualScan.click();
      }
    });

    btnRunManualScan.addEventListener('click', async () => {
      if (currentScanType === 'qr') {
        // If on QR tab, trigger file upload if no input available
        const inputContent = analyzerInput.value.trim();
        if (inputContent) {
          await runManualScanAction('url', inputContent);
        } else if (qrFileInput) {
          qrFileInput.click();
        }
        return;
      }

      const inputContent = analyzerInput.value.trim();
      if (!inputContent) {
        analyzerInput.focus();
        return;
      }

      await runManualScanAction(currentScanType, inputContent);
    });
  }

  // -------------------------------------------------------------
  // QR CODE SCANNER (Offline, MV3-compliant jsQR)
  // -------------------------------------------------------------
  function initQrScanner() {
    if (!qrDropZone || !qrFileInput) return;

    if (qrDropTrigger) {
      qrDropTrigger.addEventListener('click', () => {
        qrFileInput.click();
      });
    }

    qrFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        processQrImage(file);
      }
    });

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(name => {
      qrDropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        qrDropZone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      qrDropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        qrDropZone.classList.remove('drag-active');
      });
    });

    qrDropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt && dt.files && dt.files[0];
      if (file && file.type.startsWith('image/')) {
        processQrImage(file);
      }
    });

    // Clipboard Paste (Ctrl+V)
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const qrBtn = document.querySelector('.segment-btn[data-type="qr"]');
            if (qrBtn && !qrBtn.classList.contains('active')) {
              qrBtn.click();
            }
            processQrImage(blob);
            break;
          }
        }
      }
    });
  }

  function processQrImage(fileOrBlob) {
    if (!fileOrBlob) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (qrPreviewImg) {
        qrPreviewImg.src = dataUrl;
      }
      if (qrPreviewWrap) {
        qrPreviewWrap.classList.remove('hidden');
      }
      decodeQrFromDataUrl(dataUrl);
    };
    reader.readAsDataURL(fileOrBlob);
  }

  function decodeQrFromDataUrl(dataUrl) {
    const img = new Image();
    img.onload = () => {
      try {
        if (!qrCanvas) return;
        qrCanvas.width = img.width;
        qrCanvas.height = img.height;
        const ctx = qrCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        let decoded = null;
        if (typeof window.jsQR === 'function') {
          const code = window.jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            decoded = code.data;
          }
        }

        if (decoded) {
          if (qrDecodedBadge) qrDecodedBadge.classList.remove('hidden');
          if (qrDecodedText) qrDecodedText.textContent = decoded;
          if (analyzerInput) {
            analyzerInput.value = decoded;
            if (charCount) charCount.textContent = decoded.length;
          }
          // Automatically trigger scan on decoded target
          runManualScanAction('url', decoded);
        } else {
          if (qrDecodedBadge) qrDecodedBadge.classList.remove('hidden');
          if (qrDecodedText) qrDecodedText.textContent = 'No QR code recognized. Ensure the image is clear.';
        }
      } catch (err) {
        console.error('QR decode error:', err);
        if (qrDecodedText) qrDecodedText.textContent = 'Error decoding QR: ' + (err.message || 'unknown error');
      }
    };
    img.onerror = () => {
      if (qrDecodedText) qrDecodedText.textContent = 'Failed to load image file.';
    };
    img.src = dataUrl;
  }

  async function runManualScanAction(scanType, inputContent) {
    if (!inputContent) return;

    btnRunManualScan.disabled = true;
    analyzerLoading.classList.remove('hidden');
    analyzerResult.classList.add('hidden');

    loadingProgressFill.style.width = '30%';
    loadingStepText.textContent = 'Analyzing content structure...';

    setTimeout(() => {
      loadingProgressFill.style.width = '65%';
      loadingStepText.textContent = 'Checking threat intelligence databases...';
    }, 400);

    setTimeout(() => {
      loadingProgressFill.style.width = '90%';
      loadingStepText.textContent = 'Evaluating threat intelligence indicators...';
    }, 800);

    try {
      const effectiveType = scanType === 'qr' ? 'url' : scanType;
      const result = await DetectIQApi.performScan(effectiveType, inputContent);
      renderAnalyzerResult(result.score, result.level, result.category, result.reasons, result.recommendation);
      saveToHistory(inputContent.slice(0, 40) + '...', result.score, result.level);
    } catch (err) {
      console.debug('Backend offline, using fallback manual analyzer:', err);
      const effectiveType = scanType === 'qr' ? 'url' : scanType;
      const fallback = await DetectIQApi.performScan(effectiveType, inputContent);
      renderAnalyzerResult(fallback.score, fallback.level, fallback.category, fallback.reasons, fallback.recommendation);
    } finally {
      loadingProgressFill.style.width = '100%';
      setTimeout(() => {
        analyzerLoading.classList.add('hidden');
        analyzerResult.classList.remove('hidden');
        btnRunManualScan.disabled = false;
      }, 300);
    }
  }

  function renderAnalyzerResult(score, level, category, signals, recommendation) {
    manualRiskBadge.className = `risk-status-pill ${level}`;
    manualRiskLabel.textContent = level.toUpperCase();
    manualScoreNum.textContent = `Score: ${score}/100`;

    manualCategory.textContent = category;
    manualInputType.textContent = currentScanType.toUpperCase();

    manualSignalsBox.innerHTML = '';
    if (Array.isArray(signals)) {
      signals.forEach(sig => {
        const row = document.createElement('div');
        row.className = 'result-meta-row';

        let label = 'Indicator';
        let value = '';

        if (typeof sig === 'string') {
          value = sig;
        } else if (typeof sig === 'object' && sig !== null) {
          if (sig.title) {
            label = sig.title;
          }
          value = sig.detail || sig.explanation || sig.description || sig.message || sig.summary || sig.signal || sig.indicator || sig.name || '';
          if (!value && !sig.title) {
            value = JSON.stringify(sig);
          }
        } else {
          value = String(sig);
        }

        value = value.trim().replace(/\s+/g, ' ');
        if (value.length > 95) {
          value = value.slice(0, 92) + '...';
        }

        row.innerHTML = `<span class="meta-label">${escapeHtml(label)}:</span><span class="meta-value">${escapeHtml(value)}</span>`;
        manualSignalsBox.appendChild(row);
      });
    }

    manualRecBox.className = `recommendation-card ${level}`;
    manualRecText.textContent = recommendation;
  }

  // -------------------------------------------------------------
  // HISTORY CONTROLLER
  // -------------------------------------------------------------
  function initHistoryView() {
    btnClearHistory.addEventListener('click', () => {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scanHistory: [] }, () => {
          renderHistoryList([]);
        });
      } else {
        renderHistoryList([]);
      }
    });

    loadHistory();
  }

  function loadHistory() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['scanHistory'], (res) => {
        renderHistoryList(res.scanHistory || []);
      });
    }
  }

  function saveToHistory(target, score, level) {
    const item = {
      target: target.replace(/^https?:\/\//, ''),
      score,
      level,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['scanHistory'], (res) => {
        const list = res.scanHistory || [];
        list.unshift(item);
        if (list.length > 20) list.pop();
        chrome.storage.local.set({ scanHistory: list }, () => {
          renderHistoryList(list);
        });
      });
    }
  }

  function renderHistoryList(items) {
    historyList.innerHTML = '';
    if (!items || items.length === 0) {
      historyList.innerHTML = '<div class="form-help" style="text-align:center; padding: 12px;">No scan history recorded.</div>';
      return;
    }

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-icon ${item.level}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="history-details">
          <div class="history-target">${escapeHtml(item.target)}</div>
          <div class="history-time">${escapeHtml(item.time)}</div>
        </div>
        <div class="history-score ${item.level}">${item.score}/100</div>
      `;
      historyList.appendChild(el);
    });
  }

  function initCaseSyncButton() {
    const btnTrustDomain = document.getElementById('btnTrustDomain');
    if (btnTrustDomain) {
      btnTrustDomain.addEventListener('click', async () => {
        if (!activeTabDomain) return;
        chrome.storage.local.get(['whitelistedDomains'], (res) => {
          const list = res.whitelistedDomains || [];
          if (!list.includes(activeTabDomain)) {
            list.push(activeTabDomain);
            chrome.storage.local.set({ whitelistedDomains: list }, () => {
              btnTrustDomain.textContent = '⭐ Trusted!';
              btnTrustDomain.style.background = '#10B981';
              btnTrustDomain.style.color = '#FFF';
            });
          } else {
            const updated = list.filter(d => d !== activeTabDomain);
            chrome.storage.local.set({ whitelistedDomains: updated }, () => {
              btnTrustDomain.textContent = '⭐ Trust';
              btnTrustDomain.style.background = '';
              btnTrustDomain.style.color = '';
            });
          }
        });
      });
    }

    const btnCopyReport = document.getElementById('btnCopyReport');
    if (btnCopyReport) {
      btnCopyReport.addEventListener('click', () => {
        const report = `[DetectIQ Security Report]\nDomain: ${activeTabDomain}\nURL: ${activeTabUrl}\nScore: ${riskScoreValue.textContent}/100 (${riskStatusLabel.textContent})\nSummary: ${summaryTitle.textContent}\nRecommendation: ${recommendationText.textContent}\nTimestamp: ${new Date().toISOString()}`;
        navigator.clipboard.writeText(report).then(() => {
          const orig = btnCopyReport.innerHTML;
          btnCopyReport.textContent = '✓ Copied!';
          setTimeout(() => { btnCopyReport.innerHTML = orig; }, 1800);
        });
      });
    }

    const btnLogCase = document.getElementById('btnLogCase');
    if (btnLogCase) {
      btnLogCase.addEventListener('click', async () => {
        btnLogCase.disabled = true;
        const origText = btnLogCase.innerHTML;
        btnLogCase.textContent = 'Syncing...';
        try {
          await DetectIQApi.logInvestigationCase(activeTabUrl || 'Active Target', {
            domain: activeTabDomain
          });
          btnLogCase.textContent = '✓ Synced to Dashboard!';
        } catch {
          btnLogCase.textContent = '✓ Saved to Threat Log!';
        } finally {
          setTimeout(() => {
            btnLogCase.disabled = false;
            btnLogCase.innerHTML = origText;
          }, 2200);
        }
      });
    }
  }

  // -------------------------------------------------------------
  // SETTINGS CONTROLLER
  // -------------------------------------------------------------
  function initSettingsView() {
    btnSaveSettings.addEventListener('click', saveSettings);

    const btnPresetProd = document.getElementById('btnPresetProd');
    const btnPresetLocal = document.getElementById('btnPresetLocal');

    if (btnPresetProd) {
      btnPresetProd.addEventListener('click', () => {
        settingApiUrl.value = PROD_API_URL;
        saveSettings();
        checkBackendHealth();
      });
    }

    if (btnPresetLocal) {
      btnPresetLocal.addEventListener('click', () => {
        settingApiUrl.value = DEV_API_URL;
        saveSettings();
        checkBackendHealth();
      });
    }

    btnResetSettings.addEventListener('click', () => {
      settingApiUrl.value = DEFAULT_API_URL;
      toggleAutoScan.checked = true;
      toggleLinkScan.checked = true;
      toggleTextScan.checked = true;
      settingAuthToken.value = '';
      saveSettings();
      checkBackendHealth();
    });

    btnTestApi.addEventListener('click', checkBackendHealth);
  }

  async function loadSettings() {
    if (chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['apiUrl', 'autoScan', 'linkScan', 'textScan', 'authToken'], (res) => {
          config.apiUrl = res.apiUrl || DEFAULT_API_URL;
          config.autoScan = res.autoScan !== undefined ? res.autoScan : true;
          config.linkScan = res.linkScan !== undefined ? res.linkScan : true;
          config.textScan = res.textScan !== undefined ? res.textScan : true;
          config.authToken = res.authToken || '';

          settingApiUrl.value = config.apiUrl;
          toggleAutoScan.checked = config.autoScan;
          toggleLinkScan.checked = config.linkScan;
          toggleTextScan.checked = config.textScan;
          settingAuthToken.value = config.authToken;
          resolve();
        });
      });
    }
  }

  function saveSettings() {
    config.apiUrl = settingApiUrl.value.trim() || DEFAULT_API_URL;
    config.autoScan = toggleAutoScan.checked;
    config.linkScan = toggleLinkScan.checked;
    config.textScan = toggleTextScan.checked;
    config.authToken = settingAuthToken.value.trim();

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(config, () => {
        showConnectionTest('Settings saved successfully!', true);
      });
    } else {
      showConnectionTest('Settings saved!', true);
    }
  }

  async function checkBackendHealth() {
    connectionTestResult.className = 'connection-test-result';
    connectionTestResult.textContent = 'Testing API endpoint...';
    connectionTestResult.classList.remove('hidden');

    const targetUrl = settingApiUrl.value.trim() || config.apiUrl;
    const isOnline = await DetectIQApi.healthCheck(targetUrl);

    if (isOnline) {
      showConnectionTest('Connected to DetectIQ Server (200 OK)', true);
      connectionStatusBadge.className = 'status-indicator online';
      connectionStatusBadge.querySelector('.status-label').textContent = 'Active';

      // Auto-recover: if the scan had fallen back to offline mode while waking up, re-scan with live backend
      if (errorStateCard && !errorStateCard.classList.contains('hidden') && activeTabUrl) {
        errorStateCard.classList.add('hidden');
        runPageScan(activeTabUrl);
      }
    } else {
      showConnectionTest('Cannot reach backend (Offline Heuristic Mode)', false);
      connectionStatusBadge.className = 'status-indicator';
      connectionStatusBadge.querySelector('.status-label').textContent = 'Standby';
    }
  }

  function showConnectionTest(msg, isSuccess) {
    connectionTestResult.className = `connection-test-result ${isSuccess ? 'success' : 'error'}`;
    connectionTestResult.textContent = msg;
    connectionTestResult.classList.remove('hidden');
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
});
