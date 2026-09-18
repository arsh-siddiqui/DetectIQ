import React from 'react';
import { 
  ShieldAlert, ShieldCheck, Mail, MapPin, AlertTriangle, 
  HelpCircle, Link as LinkIcon, FileBox, Globe, CheckCircle
} from 'lucide-react';
import ThreatIntelSummary from './ThreatIntelSummary';

const StatusBadge = ({ label, status }) => {
  let color = 'bg-secondary/10 text-secondary border-border';
  if (status === 'pass') color = 'bg-success/10 text-success border-success/30';
  if (status === 'fail' || status === 'softfail') color = 'bg-danger/10 text-danger border-danger/30';
  if (status === 'neutral') color = 'bg-warning/10 text-warning border-warning/30';

  return (
    <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider border ${color}`}>
      {label}: {status || 'unknown'}
    </div>
  );
};

const ThreatBadge = ({ status }) => {
  if (status === 'malicious' || status === 'flagged') return <span className="text-xs px-2 py-0.5 rounded bg-danger/10 text-danger border border-danger/20 font-bold uppercase">Malicious</span>;
  if (status === 'suspicious') return <span className="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 font-bold uppercase">Suspicious</span>;
  if (status === 'clean') return <span className="text-xs px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 font-bold uppercase">Clean</span>;
  return <span className="text-xs px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-border font-bold uppercase">Unknown</span>;
};

const ProviderCoverageState = ({ provider, state }) => {
  let Icon = HelpCircle;
  let color = 'text-secondary';
  let label = 'Not Observed';

  if (state === 'observed') {
    Icon = ShieldCheck;
    color = 'text-accent-blue';
    label = 'Observed';
  } else if (state === 'partial') {
    Icon = ShieldAlert;
    color = 'text-warning';
    label = 'Partial';
  } else if (state === 'error') {
    Icon = AlertTriangle;
    color = 'text-danger';
    label = 'Provider error';
  } else if (state === 'unavailable') {
    Icon = AlertTriangle;
    color = 'text-warning';
    label = 'Unavailable';
  } else if (state === 'not_configured') {
    Icon = HelpCircle;
    color = 'text-muted';
    label = 'Not configured';
  } else if (state === 'not_applicable') {
    Icon = HelpCircle;
    color = 'text-muted';
    label = 'N/A';
  } else if (state === 'not_observed') {
    label = 'Not observed';
  }

  return (
    <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border">
      <span className="text-sm font-semibold text-primary capitalize">{provider}</span>
      <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${color}`}>
        <Icon size={14} />
        {label}
      </div>
    </div>
  );
};

export default function EmailIntelligencePanel({ intelligence }) {
  if (!intelligence) return <div className="p-8 text-center text-muted">No email intelligence available.</div>;

  const { sender, authentication, observedIps, urls, domains, attachments, evidence, providerCoverage, limitations } = intelligence;

  return (
    <div className="space-y-6">
      {/* Evidence Summary */}
      {evidence && evidence.length > 0 && (
        <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert className="text-danger" size={24} />
            <h3 className="text-lg font-bold text-danger">High-Severity Evidence Detected</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidence.map((ev, idx) => (
              <div key={idx} className="bg-background rounded-xl p-4 border border-danger/10 flex flex-col">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">{ev.category}</div>
                <div className="text-sm font-semibold text-primary mb-1">{ev.title}</div>
                <div className="text-xs text-secondary mb-3 leading-relaxed">{ev.description}</div>
                <div className="mt-auto text-[10px] uppercase text-muted font-mono bg-secondary/20 self-start px-2 py-0.5 rounded">
                  Source: {ev.source}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
            <Mail size={16} className="text-accent-violet" /> Sender Identity
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-xs text-muted block mb-1">From</span>
              <span className="font-mono text-primary break-words">{sender.from || 'Unknown'}</span>
            </div>
            {sender.replyTo && (
              <div>
                <span className="text-xs text-muted block mb-1">Reply-To</span>
                <span className={`font-mono break-words ${sender.differ ? 'text-warning font-bold' : 'text-primary'}`}>
                  {sender.replyTo}
                </span>
                {sender.differ && <div className="text-xs text-warning mt-1">Differs from sender</div>}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
            <ShieldCheck size={16} className="text-accent-violet" /> Authentication
          </h3>
          <div className="space-y-3">
            <StatusBadge label="SPF" status={authentication.spf?.status} />
            <StatusBadge label="DKIM" status={authentication.dkim?.status} />
            <StatusBadge label="DMARC" status={authentication.dmarc?.status} />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
            <CheckCircle size={16} className="text-accent-violet" /> Provider Coverage
          </h3>
          <div className="space-y-2">
            <ProviderCoverageState provider="VirusTotal" state={providerCoverage.virustotal} />
            <ProviderCoverageState provider="AbuseIPDB" state={providerCoverage.abuseipdb} />
            <ProviderCoverageState provider="URLhaus" state={providerCoverage.urlhaus} />
            <ProviderCoverageState provider="AlienVault OTX" state={providerCoverage.otx} />
            <ProviderCoverageState provider="Geolocation" state={providerCoverage.geolocation} />
          </div>
          
          {limitations && limitations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <span className="text-xs font-bold text-muted uppercase">Limitations</span>
              {limitations.map((lim, i) => (
                <p key={i} className="text-xs text-secondary italic">{lim}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {observedIps.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
              <MapPin size={16} className="text-accent-blue" /> Observed IPs
            </h3>
            <div className="space-y-4">
              {observedIps.map((ipObj, idx) => (
                <div key={idx} className="border border-border rounded-xl p-4 bg-background">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-primary text-base">{ipObj.ip}</span>
                      <ThreatBadge status={ipObj.threatStatus} />
                    </div>
                    {ipObj.geolocation?.country && (
                      <div className="text-xs font-medium bg-secondary/20 px-2 py-1 rounded border border-border text-primary flex items-center gap-1">
                        <MapPin size={12} className="text-muted" /> {ipObj.geolocation.country}
                      </div>
                    )}
                  </div>
                  {ipObj.intelligence && Object.keys(ipObj.intelligence).length > 0 && (
                    <div className="mt-3">
                      <ThreatIntelSummary intelligence={ipObj.intelligence} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {urls.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
              <LinkIcon size={16} className="text-accent-blue" /> Embedded URLs
            </h3>
            <div className="space-y-4">
              {urls.map((urlObj, idx) => (
                <div key={idx} className="border border-border rounded-xl p-4 bg-background">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span className="font-mono font-bold text-primary text-sm break-words max-w-full">{urlObj.url}</span>
                    <ThreatBadge status={urlObj.threatStatus} />
                  </div>
                  {urlObj.intelligence && Object.keys(urlObj.intelligence).length > 0 && (
                    <div className="mt-3">
                      <ThreatIntelSummary intelligence={urlObj.intelligence} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {domains.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
              <Globe size={16} className="text-accent-blue" /> Domains
            </h3>
            <div className="space-y-4">
              {domains.map((domObj, idx) => (
                <div key={idx} className="border border-border rounded-xl p-4 bg-background">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span className="font-mono font-bold text-primary text-sm break-words">{domObj.domain}</span>
                    <ThreatBadge status={domObj.threatStatus} />
                  </div>
                  {domObj.intelligence && Object.keys(domObj.intelligence).length > 0 && (
                    <div className="mt-3">
                      <ThreatIntelSummary intelligence={domObj.intelligence} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
              <FileBox size={16} className="text-accent-blue" /> Attachments
            </h3>
            <div className="space-y-4">
              {attachments.map((att, idx) => (
                <div key={idx} className="border border-border rounded-xl p-4 bg-background">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-primary text-sm">{att.filename || 'Unnamed'}</span>
                      <span className="font-mono text-xs text-secondary mt-1">{att.sha256}</span>
                    </div>
                    <ThreatBadge status={att.threatStatus} />
                  </div>
                  {att.intelligence && Object.keys(att.intelligence).length > 0 && (
                    <div className="mt-3">
                      <ThreatIntelSummary intelligence={att.intelligence} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
