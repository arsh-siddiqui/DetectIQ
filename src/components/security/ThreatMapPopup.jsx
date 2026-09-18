import React from 'react';

const THREAT_COLORS = {
  malicious: '#ef4444', // red-500
  suspicious: '#f97316', // orange-500
  clean: '#22c55e', // green-500
  unavailable: '#9ca3af', // gray-400
  unknown: '#9ca3af', // gray-400
};

const SOURCE_LABELS = {
  'direct_ip': 'Direct IP',
  'resolved_ip': 'DNS-resolved IP',
  'received_header_ip': 'Received-header IP'
};

const ThreatMapPopup = ({ feature, filteredIndicators = [], forceClose }) => {
  const props = feature.properties || {};
  const isGroup = props.indicatorCount > 1 || (props.indicatorIds && JSON.parse(props.indicatorIds || '[]').length > 1);

  let exactIndicators = [];
  try {
    const ids = JSON.parse(props.indicatorIds || '[]');
    const uniqueIndicatorIds = [...new Set(ids)];
    const byId = new Map(filteredIndicators.map(indicator => [String(indicator._id || indicator.id), indicator]));
    exactIndicators = uniqueIndicatorIds.map(id => byId.get(String(id))).filter(Boolean);
  } catch (e) {
    console.error('Failed to parse indicatorIds', e);
  }

  // If this is a grouped location and all underlying indicators have been filtered out, close it.
  if (isGroup && exactIndicators.length === 0) {
    if (forceClose) {
      setTimeout(forceClose, 0);
    }
    return null;
  }

  const indicatorCount = isGroup ? exactIndicators.length : 1;

  // Location display logic
  const locationText = [props.city, props.country].filter(Boolean).join(" · ");
  
  // Single Indicator Mode
  if (!isGroup) {
    const threatColor = THREAT_COLORS[props.threat] || THREAT_COLORS.unknown;
    const sourceLabel = SOURCE_LABELS[props.locationSource || props.sourceType] || props.locationSource || props.sourceType || 'Direct IP';
    const providerText = props.provider ? ` via ${props.provider}` : '';
    const orgOrIsp = props.organization || props.isp || '';

    const handleCopy = (e) => {
      navigator.clipboard.writeText(props.ip);
      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg> <span class="text-green-700">Copied</span>`;
      btn.className = "flex-1 flex items-center justify-center gap-1.5 bg-green-100 hover:bg-green-200 text-green-700 py-1.5 px-2 rounded transition-colors text-xs font-bold border border-green-200";
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.className = "flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-2 rounded transition-colors text-xs font-bold";
      }, 2000);
    };

    return (
      <div className="p-2 min-w-[280px] max-w-[340px] text-gray-900 flex flex-col h-full bg-white rounded-lg">
        
        {/* Header */}
        <div className="flex flex-col gap-1.5 mb-3 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: threatColor }}></div>
            <span className="font-mono text-[15px] font-bold text-gray-900 truncate" title={props.ip}>
              {props.ip}
            </span>
          </div>
          <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
            <span className="truncate">{props.type}</span>
            <span style={{ color: threatColor }} className="capitalize ml-2 flex-shrink-0">{props.threat}</span>
          </div>
        </div>
        
        {/* Geographic Context */}
        <div className="space-y-3 text-[11px] text-gray-600 mb-4">
          <div className="flex flex-col gap-0.5">
            {locationText && (
              <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                <span className="text-gray-400">📍</span> {locationText}
              </div>
            )}
            <div className="text-gray-500 italic break-words pl-5">
              Source: {sourceLabel}{providerText}
            </div>
          </div>

          {/* Org / ASN */}
          {(orgOrIsp || props.asn) && (
            <div className="flex flex-col gap-1 bg-gray-50/80 p-2.5 rounded-md border border-gray-100">
              {orgOrIsp && (
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Organization</span>
                  <span className="text-gray-800 font-medium truncate" title={orgOrIsp}>{orgOrIsp}</span>
                </div>
              )}
              {props.asn && (
                <div className="flex flex-col mt-1">
                  <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">ASN</span>
                  <span className="text-gray-600">{props.asn}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="mt-auto pt-2 border-t border-gray-100 flex items-center gap-2">
          <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-2 rounded transition-colors text-xs font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
          <a href={`/security/indicators/${props.id}`} className="flex-[2] flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded transition-colors text-xs font-bold shadow-sm">
            View Indicator 
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      </div>
    );
  }

  // Grouped Location Mode
  const threatRanking = { malicious: 4, suspicious: 3, clean: 1, unknown: 0, unavailable: 0 };
  let highestThreat = 'unknown';
  let maxRank = -1;
  const typesCount = {};

  exactIndicators.forEach(ind => {
    const threat = ind.threatStatus || 'unknown';
    const rank = threatRanking[threat] !== undefined ? threatRanking[threat] : 0;
    if (rank > maxRank) {
      maxRank = rank;
      highestThreat = threat;
    }
    const type = ind.type || 'unknown';
    typesCount[type] = (typesCount[type] || 0) + 1;
  });

  const highestThreatColor = THREAT_COLORS[highestThreat] || THREAT_COLORS.unknown;

  return (
    <div className="p-2 w-[340px] text-gray-900 flex flex-col max-h-[420px] bg-white rounded-lg">
      
      {/* Group Header */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0" style={{ backgroundColor: highestThreatColor }}>
          {indicatorCount}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-bold text-[14px] text-gray-900 truncate" title={locationText || 'Unknown Location'}>
            {locationText || 'Unknown Location'}
          </span>
          <span className="text-[11px] text-gray-500 font-medium">
            Highest Severity: <span style={{ color: highestThreatColor }} className="capitalize font-bold">{highestThreat}</span>
          </span>
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="flex flex-wrap gap-1.5 mb-3 px-1 flex-shrink-0">
        {Object.entries(typesCount).map(([type, count]) => (
          <span key={type} className="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            {count} {type}
          </span>
        ))}
      </div>

      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1 flex-shrink-0">
        Indicators
      </div>

      {/* Scrollable Indicator List */}
      <div className="flex-1 overflow-y-auto mb-3 pr-1 space-y-1.5 custom-scrollbar min-h-[120px]">
        {exactIndicators.map(ind => {
          const indThreatColor = THREAT_COLORS[ind.threatStatus] || THREAT_COLORS.unknown;
            const value = ind.value || ind.normalizedValue;
            return (
              <div key={ind._id || ind.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded transition-colors border border-transparent hover:border-gray-100">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: indThreatColor }}></div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[11px] font-mono text-gray-800 leading-tight" style={{ overflowWrap: 'anywhere' }}>
                    {value}
                  </span>
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">
                    {ind.type}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Group Actions */}
      <div className="mt-auto pt-2 border-t border-gray-100 flex-shrink-0">
        <button onClick={() => {
          // If we want to implement a custom filter action or jump to a specific investigation
        }} className="w-full flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white py-1.5 px-3 rounded transition-colors text-[11px] font-bold shadow-sm">
          View Indicators
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
        </button>
      </div>
    </div>
  );
};

export default ThreatMapPopup;
