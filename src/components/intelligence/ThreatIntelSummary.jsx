import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, HelpCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { normalizeVTState } from '../../utils/intelligenceMapping';

export default function ThreatIntelSummary({ intelligence }) {
  if (!intelligence || Object.keys(intelligence).length === 0) {
    return (
      <div className="bg-card/40 rounded-xl p-5 border border-border flex items-center justify-center text-secondary text-sm">
        No threat intelligence available.
      </div>
    );
  }

  const vt = intelligence.virustotal || intelligence.virusTotal;
  const abuseIpDb = intelligence.abuseipdb || intelligence.abuseIpDb;
  const urlhaus = intelligence.urlhaus;
  const otx = intelligence.otx;
  const rdap = intelligence.rdap;

  const cards = [];
  if (vt) cards.push(<VirusTotalCard key="vt" vt={vt} />);
  if (abuseIpDb) cards.push(<AbuseIpDbCard key="abuse" data={abuseIpDb} />);
  if (urlhaus) cards.push(<UrlhausCard key="urlhaus" data={urlhaus} />);
  if (otx) cards.push(<OtxCard key="otx" data={otx} />);
  if (rdap) cards.push(<RdapCard key="rdap" data={rdap} />);

  const gridClass = cards.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {cards}
    </div>
  );
}

function VirusTotalCard({ vt }) {
  const stateInfo = normalizeVTState(vt);

  // Icon mapping
  let Icon = HelpCircle;
  let colorClass = 'text-secondary';
  let bgClass = 'bg-secondary/10';
  let borderClass = 'border-border';

  if (stateInfo.state === 'clean') {
    Icon = ShieldCheck;
    colorClass = 'text-success';
    bgClass = 'bg-success/10';
    borderClass = 'border-success/30';
  } else if (stateInfo.state === 'suspicious') {
    Icon = AlertTriangle;
    colorClass = 'text-warning';
    bgClass = 'bg-warning/10';
    borderClass = 'border-warning/30';
  } else if (stateInfo.state === 'malicious') {
    Icon = ShieldAlert;
    colorClass = 'text-danger';
    bgClass = 'bg-danger/10';
    borderClass = 'border-danger/30';
  }

  // Derive simple message
  let summaryText = vt.summary;
  if (!summaryText) {
    if (stateInfo.state === 'clean') summaryText = "VirusTotal found no malicious detections.";
    else if (stateInfo.state === 'malicious') summaryText = "VirusTotal identified malicious detections for this indicator.";
    else if (stateInfo.state === 'suspicious') summaryText = "VirusTotal flagged this indicator as suspicious.";
    else if (stateInfo.state === 'unknown' || stateInfo.state === 'not_found') summaryText = "The indicator was not observed by this provider.";
    else summaryText = "Threat intelligence is currently unavailable.";
  }

  return (
    <div className={`rounded-xl border ${borderClass} bg-card overflow-hidden flex flex-col h-full`}>
      <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
        <h4 className="font-semibold text-primary">VirusTotal</h4>
        <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${bgClass} ${colorClass} border ${borderClass}`}>
          <Icon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{stateInfo.label}</span>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col justify-center">
        <p className="text-sm font-medium text-primary mb-4 leading-relaxed">
          {summaryText}
        </p>

        {vt.totalEngines > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <div className="text-xs text-secondary uppercase tracking-wider mb-1">Engines Checked</div>
              <div className="text-3xl font-bold font-mono text-primary">{vt.totalEngines}</div>
            </div>
            <div>
              <div className="text-xs text-secondary uppercase tracking-wider mb-1">Detections</div>
              <div className="text-base flex flex-col gap-1 mt-1">
                <span className={vt.maliciousVotes > 0 ? 'text-danger font-bold flex items-center gap-1' : 'text-primary font-bold flex items-center gap-1'}>
                  <div className={`w-2.5 h-2.5 rounded-full ${vt.maliciousVotes > 0 ? 'bg-danger' : 'bg-success'}`}></div>
                  {vt.maliciousVotes} malicious
                </span>
                <span className={vt.suspiciousVotes > 0 ? 'text-warning font-bold flex items-center gap-1' : 'text-secondary font-medium flex items-center gap-1'}>
                  <div className={`w-2 h-2 rounded-full ${vt.suspiciousVotes > 0 ? 'bg-warning' : 'bg-border'}`}></div>
                  {vt.suspiciousVotes} suspicious
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Confidence only shown if there is a threat (as specified by user to avoid misleading '0% safe') */}
        {vt.totalEngines > 0 && vt.confidence > 0 && stateInfo.state !== 'clean' && (
          <div className="mb-4">
             <div className="text-xs text-secondary uppercase tracking-wider mb-1">Assessment Strength</div>
             <div className="text-sm font-bold text-primary">{vt.confidence >= 80 ? 'High' : vt.confidence >= 50 ? 'Moderate' : 'Limited'}</div>
          </div>
        )}

        {vt.checkedAt && (
          <div className="mt-auto flex items-center gap-1.5 text-xs text-muted pt-3 border-t border-border/50">
            <Clock className="w-3.5 h-3.5" />
            <span>Last checked: {format(new Date(vt.checkedAt), 'MMM d, yyyy HH:mm')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AbuseIpDbCard({ data }) {
  let Icon = HelpCircle;
  let colorClass = 'text-secondary';
  let bgClass = 'bg-secondary/10';
  let borderClass = 'border-border';
  let label = 'No abuse reports';

  if (data.status === 'skipped' || data.status === 'rate_limited' || data.status === 'error') {
    Icon = AlertTriangle;
    label = data.status === 'skipped' ? 'Not configured' : 'Unavailable';
  } else if (data.totalReports > 0) {
    Icon = ShieldAlert;
    colorClass = 'text-danger';
    bgClass = 'bg-danger/10';
    borderClass = 'border-danger/30';
    label = 'Abuse reported';
  } else if (data.status === 'available' && data.totalReports === 0) {
    Icon = ShieldCheck;
  }

  return (
    <div className={`rounded-xl border ${borderClass} bg-card overflow-hidden flex flex-col h-full`}>
      <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
        <h4 className="font-semibold text-primary">AbuseIPDB</h4>
        <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${bgClass} ${colorClass} border ${borderClass}`}>
          <Icon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col justify-center">
        <p className="text-sm font-medium text-primary mb-4 leading-relaxed">
          {data.summary || 'No data available.'}
        </p>

        {data.status === 'available' && data.totalReports > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <div className="text-xs text-secondary uppercase tracking-wider mb-1">Total Reports</div>
              <div className="text-3xl font-bold font-mono text-primary">{data.totalReports}</div>
            </div>
            <div>
              <div className="text-xs text-secondary uppercase tracking-wider mb-1">Confidence Score</div>
              <div className="text-3xl font-bold font-mono text-danger">{data.abuseConfidenceScore}%</div>
            </div>
          </div>
        )}

        {data.checkedAt && (
          <div className="mt-auto flex items-center gap-1.5 text-xs text-muted pt-3 border-t border-border/50">
            <Clock className="w-3.5 h-3.5" />
            <span>Last checked: {format(new Date(data.checkedAt), 'MMM d, yyyy HH:mm')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function UrlhausCard({ data }) {
  let Icon = HelpCircle;
  let colorClass = 'text-secondary';
  let bgClass = 'bg-secondary/10';
  let borderClass = 'border-border';
  let label = 'Not observed';

  if (data.status === 'skipped' || data.status === 'rate_limited' || data.status === 'error') {
    Icon = AlertTriangle;
    label = data.status === 'skipped' ? 'Not configured' : 'Unavailable';
  } else if (data.status === 'available' && data.threat === 'malicious') {
    Icon = ShieldAlert;
    colorClass = 'text-danger';
    bgClass = 'bg-danger/10';
    borderClass = 'border-danger/30';
    label = 'Malicious URL';
  }

  return (
    <div className={`rounded-xl border ${borderClass} bg-card overflow-hidden flex flex-col h-full`}>
      <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
        <h4 className="font-semibold text-primary">URLhaus</h4>
        <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${bgClass} ${colorClass} border ${borderClass}`}>
          <Icon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col justify-center">
        <p className="text-sm font-medium text-primary mb-4 leading-relaxed">
          {data.summary || 'No data available.'}
        </p>

        {data.status === 'available' && data.tags && data.tags.length > 0 && (
          <div className="mb-4">
             <div className="text-xs text-secondary uppercase tracking-wider mb-2">Tags</div>
             <div className="flex flex-wrap gap-1.5">
               {data.tags.map(tag => (
                 <span key={tag} className="px-2 py-0.5 bg-secondary text-xs rounded border border-border text-primary">{tag}</span>
               ))}
             </div>
          </div>
        )}

        {data.firstSeen && (
          <div className="mt-auto flex items-center gap-1.5 text-xs text-muted pt-3 border-t border-border/50">
            <Clock className="w-3.5 h-3.5" />
            <span>Added: {format(new Date(data.firstSeen), 'MMM d, yyyy HH:mm')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function OtxCard({ data }) {
  let Icon = HelpCircle;
  let colorClass = 'text-secondary';
  let bgClass = 'bg-secondary/10';
  let borderClass = 'border-border';
  let label = 'Not observed';

  if (data.status === 'skipped' || data.status === 'rate_limited' || data.status === 'error') {
    Icon = AlertTriangle;
    label = data.status === 'skipped' ? 'Not configured' : 'Unavailable';
  } else if (data.pulseCount > 0) {
    Icon = ShieldAlert;
    colorClass = 'text-warning';
    bgClass = 'bg-warning/10';
    borderClass = 'border-warning/30';
    label = 'Pulses Found';
  } else if (data.status === 'available' && data.pulseCount === 0) {
    Icon = ShieldCheck;
  }

  return (
    <div className={`rounded-xl border ${borderClass} bg-card overflow-hidden flex flex-col h-full`}>
      <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
        <h4 className="font-semibold text-primary">AlienVault OTX</h4>
        <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${bgClass} ${colorClass} border ${borderClass}`}>
          <Icon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col justify-center">
        <p className="text-sm font-medium text-primary mb-4 leading-relaxed">
          {data.summary || 'No data available.'}
        </p>

        {data.status === 'available' && data.pulseCount > 0 && (
          <div className="mb-4 space-y-3">
            {data.malwareFamilies && data.malwareFamilies.length > 0 && (
              <div>
                <div className="text-xs text-secondary uppercase tracking-wider mb-1.5">Malware Families</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.malwareFamilies.map(malware => (
                    <span key={malware} className="px-2 py-0.5 bg-danger/10 text-danger text-xs font-medium rounded border border-danger/20">{malware}</span>
                  ))}
                </div>
              </div>
            )}
            {data.tags && data.tags.length > 0 && (
              <div>
                <div className="text-xs text-secondary uppercase tracking-wider mb-1.5">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-secondary/20 text-xs rounded border border-border text-primary">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[10px] text-muted italic mt-2 leading-tight">
              OTX observations are contextual intelligence and do not independently determine the DetectIQ verdict.
            </div>
          </div>
        )}

        {data.firstSeen && (
          <div className="mt-auto flex items-center gap-1.5 text-xs text-muted pt-3 border-t border-border/50">
            <Clock className="w-3.5 h-3.5" />
            <span>First seen: {format(new Date(data.firstSeen), 'MMM d, yyyy')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RdapCard({ data }) {
  let Icon = HelpCircle;
  let colorClass = 'text-secondary';
  let bgClass = 'bg-secondary/10';
  let borderClass = 'border-border';
  let label = 'RDAP';

  if (data.state === 'error' || data.state === 'timeout') {
    Icon = AlertTriangle;
    label = 'Lookup failed';
  } else if (data.state === 'unavailable') {
    Icon = AlertTriangle;
    label = 'Unavailable';
  } else if (data.state === 'not_observed') {
    Icon = HelpCircle;
    label = 'Not observed';
  } else if (data.state === 'success') {
    Icon = ShieldCheck;
    colorClass = 'text-accent-blue';
    bgClass = 'bg-accent-blue/10';
    borderClass = 'border-accent-blue/30';
    label = 'Available';
  }

  let summaryText = data.summary || 'RDAP lookup failed.';
  if (data.state === 'not_observed') summaryText = 'Registration data not observed.';
  if (data.state === 'unavailable') summaryText = 'RDAP service unavailable.';
  if (data.state === 'error' || data.state === 'timeout') summaryText = 'RDAP lookup failed.';

  return (
    <div className={`rounded-xl border ${borderClass} bg-card overflow-hidden flex flex-col h-full`}>
      <div className="p-4 border-b border-border bg-background/50 flex items-center justify-between">
        <h4 className="font-semibold text-primary">Registration (RDAP)</h4>
        <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${bgClass} ${colorClass} border ${borderClass}`}>
          <Icon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col justify-center">
        <p className="text-sm font-medium text-primary mb-4 leading-relaxed">
          {summaryText}
        </p>

        {data.state === 'success' && (
          <div className="mb-4 space-y-3 text-sm">
            {data.registrar && (
              <div>
                <span className="text-xs text-secondary uppercase tracking-wider block mb-1">Registrar</span>
                <span className="font-medium text-primary">{data.registrar}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {data.createdAt && (
                <div>
                  <span className="text-xs text-secondary uppercase tracking-wider block mb-1">Created</span>
                  <span className="font-medium text-primary">{format(new Date(data.createdAt), 'MMM d, yyyy')}</span>
                </div>
              )}
              {data.registrationAgeDays !== null && (
                <div>
                  <span className="text-xs text-secondary uppercase tracking-wider block mb-1">Age</span>
                  <span className="font-medium text-primary">{data.registrationAgeDays} days</span>
                </div>
              )}
              {data.updatedAt && (
                <div>
                  <span className="text-xs text-secondary uppercase tracking-wider block mb-1">Updated</span>
                  <span className="font-medium text-primary">{format(new Date(data.updatedAt), 'MMM d, yyyy')}</span>
                </div>
              )}
              {data.expiresAt && (
                <div>
                  <span className="text-xs text-secondary uppercase tracking-wider block mb-1">Expires</span>
                  <span className="font-medium text-primary">{format(new Date(data.expiresAt), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
            {data.statuses && data.statuses.length > 0 && (
              <div>
                <span className="text-xs text-secondary uppercase tracking-wider block mb-1">Status</span>
                <div className="flex flex-wrap gap-1">
                  {data.statuses.map((status, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-secondary/30 text-xs rounded border border-border text-primary">{status}</span>
                  ))}
                </div>
              </div>
            )}
            {data.nameservers && data.nameservers.length > 0 && (
              <div>
                <span className="text-xs text-secondary uppercase tracking-wider block mb-1">Nameservers</span>
                <div className="flex flex-col gap-0.5">
                  {data.nameservers.map((ns, idx) => (
                    <span key={idx} className="font-mono text-secondary text-xs">{ns}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {data.state === 'success' && data.rdapServer && (
          <div className="mt-auto pt-3 border-t border-border/50">
             <span className="text-xs text-muted block text-right">Source: {data.rdapServer}</span>
          </div>
        )}
      </div>
    </div>
  );
}
