// DetectIQ Browser Extension - Background Service Worker

importScripts('api.js');

const urlScanCache = new Map();

// Register Context Menus on Installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'detectiq-scan-link',
    title: '🛡 Scan link with DetectIQ',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'detectiq-scan-selection',
    title: '🛡 Analyze text with DetectIQ',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'detectiq-scan-page',
    title: '🛡 Inspect current page with DetectIQ',
    contexts: ['page']
  });

  // Default badge
  chrome.action.setBadgeText({ text: 'SEC' });
  chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });
});

// Ambient Navigation Guard: Tab activation listener
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url) {
      inspectTabUrl(tab.id, tab.url);
    }
  });
});

// Ambient Navigation Guard: Tab URL update listener
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    inspectTabUrl(tabId, tab.url);
  }
});

// Pre-Navigation Interceptor (WebNavigation)
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return; // Main frame only
    const url = details.url;

    if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.includes('blocked.html')) {
      return;
    }

    // Fast heuristic check for typosquatting / IDN homograph / critical phishing patterns
    const isTyposquat = /rnicrosof|g00gl|paypa1|bankofamenca|login-verify-account/i.test(url);
    const homograph = typeof DetectIQApi !== 'undefined' && DetectIQApi.checkIdnHomograph ? DetectIQApi.checkIdnHomograph(url) : { isHomograph: false };

    if (isTyposquat || homograph.isHomograph) {
      const reason = homograph.isHomograph ? homograph.reason : 'Deceptive typosquatting domain impersonation detected.';
      const blockUrl = chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(url)}&score=95&reason=${encodeURIComponent(reason)}`);
      chrome.tabs.update(details.tabId, { url: blockUrl });
    }
  });
}

// Download File Safety Inspector
if (chrome.downloads && chrome.downloads.onCreated) {
  chrome.downloads.onCreated.addListener((downloadItem) => {
    const filename = downloadItem.filename || downloadItem.finalUrl || '';
    const isDangerousExt = /\.(exe|scr|vbs|bat|cmd|ps1|iso|jar|lnk|hta)$/i.test(filename);
    const isDoubleExt = /\.(pdf|doc|docx|xls|xlsx|jpg|png|txt)\.(exe|scr|vbs|bat|cmd|ps1)$/i.test(filename);
    const isNonHttps = downloadItem.url && downloadItem.url.startsWith('http://');

    if (isDangerousExt || isDoubleExt || (isNonHttps && filename.endsWith('.exe'))) {
      if (chrome.notifications && chrome.notifications.create) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '🛑 DetectIQ Download Guard',
          message: `Caution: Intercepted high-risk download: ${filename.slice(-35)}. Verify sender before opening.`
        });
      }
    }
  });
}

async function inspectTabUrl(tabId, url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('edge://') || url.includes('blocked.html')) {
    chrome.action.setBadgeText({ text: 'SAFE', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
    return;
  }

  // Check Whitelisted domains first
  try {
    let domain = new URL(url).hostname;
    const storage = await new Promise(r => chrome.storage.local.get(['whitelistedDomains'], r));
    const whitelisted = storage.whitelistedDomains || [];
    if (whitelisted.includes(domain)) {
      chrome.action.setBadgeText({ text: 'PASS', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
      return;
    }
  } catch {}

  // Check cache next
  if (urlScanCache.has(url)) {
    const cached = urlScanCache.get(url);
    updateBadgeForTab(tabId, cached.score);
    return;
  }

  try {
    const scan = await DetectIQApi.performScan('url', url);
    
    // LRU Cache Cap (Max 100 entries)
    if (urlScanCache.size >= 100) {
      const oldestKey = urlScanCache.keys().next().value;
      if (oldestKey) urlScanCache.delete(oldestKey);
    }
    urlScanCache.set(url, scan);

    updateBadgeForTab(tabId, scan.score);

    // If critical threat, block navigation
    if (scan.score > 85 && !url.includes('blocked.html')) {
      const blockUrl = chrome.runtime.getURL(`blocked.html?url=${encodeURIComponent(url)}&score=${scan.score}&reason=${encodeURIComponent(scan.recommendation || 'Critical threat detected.')}`);
      chrome.tabs.update(tabId, { url: blockUrl });
    }
  } catch (err) {
    console.debug('[DetectIQ Background] Ambient scan error:', err);
  }
}

// Context Menu Click Handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  let contentToScan = '';
  let scanType = 'url';

  if (info.menuItemId === 'detectiq-scan-link' && info.linkUrl) {
    contentToScan = info.linkUrl;
    scanType = 'url';
  } else if (info.menuItemId === 'detectiq-scan-selection' && info.selectionText) {
    contentToScan = info.selectionText;
    scanType = 'text';
  } else if (info.menuItemId === 'detectiq-scan-page' && tab.url) {
    contentToScan = tab.url;
    scanType = 'url';
  }

  if (!contentToScan) return;

  // Signal content script to display loading modal
  chrome.tabs.sendMessage(tab.id, {
    action: 'SHOW_LOADING_OVERLAY',
    target: contentToScan
  }).catch(() => {});

  // Perform backend analysis
  const result = await performScan(scanType, contentToScan);

  // Send result to content script
  chrome.tabs.sendMessage(tab.id, {
    action: 'SHOW_RESULT_OVERLAY',
    target: contentToScan,
    scanType,
    result
  }).catch((err) => console.warn('Could not send overlay message:', err));

  updateBadgeForTab(tab.id, result.score);
});

// Message Listener from Popup / Content Scripts (Guarded by Sender Verification)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Reject messages from foreign extensions or untrusted external contexts
  if (sender && sender.id && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    if (sender.id !== chrome.runtime.id) {
      console.warn('[DetectIQ Security] Message rejected from untrusted sender:', sender.id);
      return false;
    }
  }

  if (request.action === 'PERFORM_SCAN') {
    performScan(request.scanType, request.content).then(result => {
      sendResponse({ success: true, result });
    });
    return true; // Async response
  }

  if (request.action === 'UPDATE_BADGE') {
    const tabId = sender.tab ? sender.tab.id : undefined;
    updateBadgeForTab(tabId, request.score);
    sendResponse({ success: true });
  }
});

async function performScan(scanType, content) {
  const result = await DetectIQApi.performScan(scanType, content);
  return {
    score: result.score,
    level: result.level,
    category: result.category,
    signals: result.reasons,
    recommendation: result.recommendation,
    isOfflineFallback: result.isOfflineFallback
  };
}

function updateBadgeForTab(tabId, score) {
  let badgeText = 'SAFE';
  let badgeColor = '#10B981';

  if (score > 85) {
    badgeText = 'CRIT';
    badgeColor = '#DC2626';
  } else if (score > 65) {
    badgeText = 'RISK';
    badgeColor = '#F97316';
  } else if (score > 30) {
    badgeText = 'WARN';
    badgeColor = '#F59E0B';
  }

  const badgeOpts = tabId !== undefined ? { text: badgeText, tabId } : { text: badgeText };
  const colorOpts = tabId !== undefined ? { color: badgeColor, tabId } : { color: badgeColor };

  chrome.action.setBadgeText(badgeOpts);
  chrome.action.setBadgeBackgroundColor(colorOpts);
}
