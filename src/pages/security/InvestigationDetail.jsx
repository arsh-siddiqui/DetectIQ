import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Routes, Route, NavLink } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, ShieldAlert, Activity, Clock, 
  FileText, ChevronDown, ChevronRight, Hash, Network,
  Globe, Brain, LayoutDashboard, Search, FileBox,
  CheckCircle2, XCircle, ShieldCheck, AlertTriangle, HelpCircle,
  Server, Link2, Shield, Layers, Compass, BookOpen
} from 'lucide-react';
import * as securityService from '../../services/securityService';
import InvestigationGraph from '../../components/security/InvestigationGraph';
import InvestigationTimeline from '../../components/security/InvestigationTimeline';
import InvestigationCopilot from '../../components/security/InvestigationCopilot';
import ForensicReportView from '../../components/security/ForensicReportView';
import ForensicIntelligencePanel from '../../components/intelligence/ForensicIntelligencePanel';
import EmailIntelligencePanel from '../../components/intelligence/EmailIntelligencePanel';
import * as copilotService from '../../services/copilotService';
import useEvidenceScroller from '../../hooks/useEvidenceScroller';

const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg bg-card shadow-soft overflow-hidden mb-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-interactive transition-colors"
      >
        <div className="flex items-center gap-2 text-primary text-lg font-semibold">
          <Icon size={18} className="text-accent-violet" />
          {title}
        </div>
        {isOpen ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};

const AUTH_PROTOCOLS = {
  spf: {
    code: 'SPF',
    fullName: 'Sender Policy Framework',
    description: 'Validates that the sending mail server IP is authorized by the domain owner in DNS records.',
  },
  dkim: {
    code: 'DKIM',
    fullName: 'DomainKeys Identified Mail',
    description: 'Cryptographically verifies digital signature to ensure the email content was not altered in transit.',
  },
  dmarc: {
    code: 'DMARC',
    fullName: 'Domain-based Message Authentication, Reporting & Conformance',
    description: 'Specifies sender alignment policy and instructs receivers how to handle failed emails (quarantine/reject).',
  },
};

const AuthProtocolCard = ({ protocolKey, status }) => {
  const protocol = AUTH_PROTOCOLS[protocolKey] || {
    code: protocolKey?.toUpperCase(),
    fullName: 'Email Authentication Protocol',
    description: '',
  };

  const rawStatus = (status || 'n/a').toLowerCase();
  const isPass = rawStatus === 'pass';
  const isFail = rawStatus === 'fail' || rawStatus === 'softfail';
  const isNeutral = rawStatus === 'neutral';

  const badgeConfig = isPass
    ? {
        border: 'border-emerald-500/30 bg-emerald-500/5',
        badge: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30',
        icon: <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />,
        text: 'PASS',
      }
    : isFail
    ? {
        border: 'border-red-500/30 bg-red-500/5',
        badge: 'bg-red-500/15 text-red-500 border border-red-500/30',
        icon: <XCircle size={16} className="text-red-500 flex-shrink-0" />,
        text: rawStatus === 'softfail' ? 'SOFTFAIL' : 'FAIL',
      }
    : isNeutral
    ? {
        border: 'border-amber-500/30 bg-amber-500/5',
        badge: 'bg-amber-500/15 text-amber-500 border border-amber-500/30',
        icon: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
        text: 'NEUTRAL',
      }
    : {
        border: 'border-border bg-secondary/30',
        badge: 'bg-secondary text-muted border border-border',
        icon: <HelpCircle size={16} className="text-muted flex-shrink-0" />,
        text: rawStatus === 'n/a' ? 'N/A' : rawStatus.toUpperCase(),
      };

  return (
    <div className={`p-4 rounded-xl border ${badgeConfig.border} transition-all duration-200 hover:shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-bold font-mono tracking-tight text-primary">
            {protocol.code}
          </span>
          <span className="text-xs font-semibold text-secondary">
            ({protocol.fullName})
          </span>
        </div>
        <p className="text-[11px] text-muted mt-1 leading-relaxed">
          {protocol.description}
        </p>
      </div>

      <div className="flex-shrink-0 self-start sm:self-center">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${badgeConfig.badge}`}>
          {badgeConfig.icon}
          <span>{badgeConfig.text}</span>
        </span>
      </div>
    </div>
  );
};

const OverviewTab = ({ inv }) => {
  return (
    <div className="w-full space-y-6">
      {inv.scan && (
        <div id="evidence-E_VERDICT">
          <Section title="Detection Verdict" icon={ShieldAlert}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary/40 border border-border/60 p-4 rounded-xl">
                <div className="text-[11px] text-muted uppercase tracking-wider font-bold mb-1">Verdict</div>
                <div className="text-xl font-bold text-primary capitalize">{inv.scan.classification}</div>
              </div>
              <div className="bg-secondary/40 border border-border/60 p-4 rounded-xl">
                <div className="text-[11px] text-muted uppercase tracking-wider font-bold mb-1">Risk Level</div>
                <div className={`text-xl font-bold capitalize ${
                  inv.scan.riskLevel === 'critical' ? 'text-danger' :
                  inv.scan.riskLevel === 'high' ? 'text-warning' :
                  inv.scan.riskLevel === 'medium' ? 'text-warning' : 'text-accent-blue'
                }`}>{inv.scan.riskLevel}</div>
              </div>
              <div className="bg-secondary/40 border border-border/60 p-4 rounded-xl">
                <div className="text-[11px] text-muted uppercase tracking-wider font-bold mb-1">Risk Score</div>
                <div className="text-xl font-bold text-primary font-mono">{inv.scan.riskScore} <span className="text-xs text-muted font-normal">/ 100</span></div>
              </div>
              <div className="bg-secondary/40 border border-border/60 p-4 rounded-xl">
                <div className="text-[11px] text-muted uppercase tracking-wider font-bold mb-1">Confidence</div>
                <div className="text-xl font-bold text-emerald-500">High</div>
              </div>
            </div>
          </Section>
        </div>
      )}

      <Section title="Analyst Summary" icon={Activity}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between pb-3.5 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider font-semibold">Enrichment Status</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold capitalize bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 size={13} />
                {inv.analystSummary?.enrichmentStatus || 'Completed'}
              </span>
            </div>
            <div className="flex justify-between pb-3.5 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider font-semibold">Public IPs</span>
              <span className="text-lg font-bold text-primary font-mono">{inv.analystSummary?.publicIpCount ?? 0}</span>
            </div>
            <div className="flex justify-between pb-3.5 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider font-semibold">Domains / URLs</span>
              <span className="text-sm font-semibold text-primary">
                {inv.analystSummary?.domainCount ?? 0} {inv.analystSummary?.domainCount === 1 ? 'domain' : 'domains'} &middot; {inv.analystSummary?.urlCount ?? 0} {inv.analystSummary?.urlCount === 1 ? 'URL' : 'URLs'}
              </span>
            </div>
            <div className="flex justify-between pb-3.5 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider font-semibold">Flagged Indicators</span>
              <span className={`text-lg font-bold font-mono ${(inv.analystSummary?.flaggedIndicatorCount || 0) > 0 ? 'text-danger' : 'text-emerald-500'}`}>
                {inv.analystSummary?.flaggedIndicatorCount ?? 0}
              </span>
            </div>
          </div>

          <div id="evidence-E_AUTH">
            <div className="flex items-center gap-2 mb-3.5 pb-2 border-b border-border/50">
              <ShieldCheck size={16} className="text-accent-violet" />
              <h4 className="text-xs uppercase tracking-wider text-muted font-bold">Email Authentication Protocols</h4>
            </div>

            <div className="space-y-3">
              <AuthProtocolCard protocolKey="spf" status={inv.analystSummary?.spfStatus} />
              <AuthProtocolCard protocolKey="dkim" status={inv.analystSummary?.dkimStatus} />
              <AuthProtocolCard protocolKey="dmarc" status={inv.analystSummary?.dmarcStatus} />
            </div>
            
            {/* Authentication Context */}
            {['phishing', 'suspicious'].includes(inv.scan?.classification?.toLowerCase()) && 
             ['pass'].some(status => [inv.analystSummary?.spfStatus, inv.analystSummary?.dkimStatus, inv.analystSummary?.dmarcStatus].includes(status)) && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 leading-relaxed flex items-start gap-2.5">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-bold block mb-0.5">Authentication Anomaly:</span>
                  Authentication passed, but other heuristic and threat indicators classified this email as malicious (e.g. compromised domain or legitimate infrastructure abused for phishing).
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <div id="evidence-E_EMAIL_ID">
        <Section title="Identity & Context" icon={FileText}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inv.headers?.from && (
              <div className="bg-secondary/40 p-4 rounded-xl border border-border/60">
                <div className="text-[11px] text-muted mb-1.5 uppercase tracking-wider font-bold">Sender (From)</div>
                <div className="text-primary font-mono text-sm break-words overflow-wrap-anywhere select-all font-semibold">
                  {inv.headers.from}
                </div>
              </div>
            )}
            {inv.headers?.to && (
              <div className="bg-secondary/40 p-4 rounded-xl border border-border/60">
                <div className="text-[11px] text-muted mb-1.5 uppercase tracking-wider font-bold">Recipient (To)</div>
                <div className="text-secondary font-mono text-sm break-words overflow-wrap-anywhere select-all">
                  {inv.headers.to}
                </div>
              </div>
            )}
            {inv.headers?.subject && (
              <div className="bg-secondary/40 p-4 rounded-xl border border-border/60 md:col-span-2">
                <div className="text-[11px] text-muted mb-1.5 uppercase tracking-wider font-bold">Subject</div>
                <div className="text-primary font-semibold text-base leading-snug">
                  {inv.headers.subject}
                </div>
              </div>
            )}
            {inv.headers?.replyTo && (
              <div className="bg-secondary/40 p-4 rounded-xl border border-border/60">
                <div className="text-[11px] text-muted mb-1.5 uppercase tracking-wider font-bold">Reply-To</div>
                <div className="text-secondary font-mono text-sm break-words overflow-wrap-anywhere">
                  {inv.headers.replyTo}
                </div>
              </div>
            )}
            {inv.sourceType && (
              <div className="bg-secondary/40 p-4 rounded-xl border border-border/60">
                <div className="text-[11px] text-muted mb-1.5 uppercase tracking-wider font-bold">Source Type</div>
                <div className="text-primary font-semibold text-sm uppercase">
                  {inv.sourceType.replace('_', ' ')}
                </div>
              </div>
            )}
            {inv.analysisDepth && (
              <div className="bg-secondary/40 p-4 rounded-xl border border-border/60">
                <div className="text-[11px] text-muted mb-1.5 uppercase tracking-wider font-bold">Analysis Depth</div>
                <div className="text-primary font-semibold text-sm capitalize">
                  {inv.analysisDepth}
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
};

const EvidenceTab = ({ inv }) => {
  return (
    <div className="w-full space-y-6">
      <Section title="Email Headers" icon={FileText}>
         <div className="space-y-4 text-sm">
            <div>
              <div className="text-xs text-muted mb-1">Message-ID</div>
              <div className="text-secondary break-words font-mono text-xs bg-secondary/50 p-2 rounded">{inv.headers?.messageId || 'None'}</div>
            </div>
            {inv.headers?.received?.length > 0 && (
              <div id="evidence-E_ROUTE">
                <div className="text-xs text-muted mb-2 uppercase tracking-wider font-semibold">Received Routing Hops</div>
                <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-auto hide-scrollbar border border-border rounded bg-secondary/20 p-2">
                  {inv.headers.received.map((hop, idx) => (
                    <div key={idx} className="text-[11px] p-2 rounded bg-secondary/50 font-mono text-secondary whitespace-pre-wrap">
                      {hop.raw}
                    </div>
                  ))}
                </div>
              </div>
            )}
         </div>
      </Section>

      <Section title="Extracted Evidence" icon={Hash}>
         {(inv.extracted?.urls?.length > 0 || inv.extracted?.ipAddresses?.length > 0) ? (
           <div className="space-y-6">
             {inv.extracted?.ipAddresses?.length > 0 && (
               <div>
                 <span className="text-muted text-xs font-bold uppercase block mb-2">IP Addresses:</span>
                 <div className="flex flex-wrap gap-2">
                   {inv.extracted.ipAddresses.map((ipObj, idx) => (
                     <span key={idx} id={`evidence-E_IND_${ipObj.ip}`} className={`px-2 py-1 rounded text-xs font-mono font-bold ${ipObj.type === 'private' ? 'bg-secondary text-secondary' : 'bg-accent-blue/20 text-accent-blue'}`}>
                       {ipObj.ip} ({ipObj.type})
                     </span>
                   ))}
                 </div>
               </div>
             )}
             
             {inv.extracted?.urls?.length > 0 && (
                <div>
                  <span className="text-muted text-xs font-bold uppercase block mb-2">URLs:</span>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {inv.extracted.urls.map((url, idx) => (
                      <div key={idx} id={`evidence-E_IND_${idx + 1}`} className="text-[11px] font-mono text-secondary bg-secondary/30 p-2 rounded border border-border overflow-wrap-anywhere">
                        {url}
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
         ) : (
           <p className="text-sm text-muted">No URLs or IP addresses extracted.</p>
         )}
      </Section>

      <Section title="Attachments" icon={FileBox}>
        {inv.attachments && inv.attachments.length > 0 ? (
          <div className="space-y-3">
            {inv.attachments.map((att, idx) => (
              <div key={idx} id={`evidence-E_ATT_${idx + 1}`} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                <div className="text-sm font-semibold text-primary truncate">{att.filename || 'Unnamed'}</div>
                <div className="text-xs text-muted flex gap-4">
                  <span className="bg-secondary/50 px-2 py-0.5 rounded">{(att.sizeBytes / 1024).toFixed(1)} KB</span>
                  <span className="bg-secondary/50 px-2 py-0.5 rounded">{att.contentType}</span>
                </div>
                {att.sha256 && (
                  <div className="text-[11px] font-mono text-secondary overflow-wrap-anywhere pt-2 border-t border-border mt-2">
                    <span className="text-muted font-semibold mr-2 uppercase tracking-wider text-[10px]">SHA-256:</span>
                    {att.sha256}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted py-2">No attachments found.</div>
        )}
      </Section>
    </div>
  );
};

const IntelligenceTab = ({ inv }) => {
  if (inv.emailIntelligence) {
    return (
      <div className="w-full">
        <EmailIntelligencePanel intelligence={inv.emailIntelligence} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <ForensicIntelligencePanel 
        geoPoints={inv.geoPoints || []} 
        indicators={inv.indicators || []}
        enrichmentStatus={inv.enrichmentStatus}
      />
    </div>
  );
};

const TimelineTab = ({ inv }) => {
  if (!inv.timeline || inv.timeline.length === 0) {
    return (
      <div className="w-full text-center py-16 bg-card border border-border shadow-soft rounded-xl">
        <Clock size={40} className="mx-auto text-muted mb-4" />
        <p className="text-secondary">No timeline events available.</p>
      </div>
    );
  }
  return (
    <div className="w-full">
      <div className="bg-card border border-border shadow-soft rounded-xl p-6">
        <InvestigationTimeline timeline={inv.timeline} />
      </div>
    </div>
  );
};

const GraphForensicBreakdown = ({ inv }) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const nodes = inv.graph?.nodes || [];
  const edges = inv.graph?.edges || [];

  const ipNodes = nodes.filter(n => n.type === 'ip');
  const domainNodes = nodes.filter(n => n.type === 'domain');
  const urlNodes = nodes.filter(n => n.type === 'url');
  const locationNodes = nodes.filter(n => n.type === 'location');
  const emailNodes = nodes.filter(n => n.type === 'email' || n.type === 'person');
  const attachmentNodes = nodes.filter(n => n.type === 'attachment' || n.type === 'hash');

  const senderDomainNode = domainNodes.find(d => {
    return edges.some(e => (e.relation === 'sent from' || e.relation === 'reply_to domain') && (e.target?.id || e.target) === d.id);
  });

  const getNodeRoleDescription = (node) => {
    switch (node.type) {
      case 'email':
        return 'Central subject of analysis. Root node to which all header hops, senders, and hyperlinks connect.';
      case 'person':
        return `Identity extracted from email headers (${node.label || node.id}) representing the sender or recipient.`;
      case 'domain': {
        const isSender = edges.some(e => (e.relation === 'sent from' || e.relation === 'reply_to domain') && (e.target?.id || e.target) === node.id);
        if (isSender) return `Primary originating domain (${node.label || node.id}) configured in the sender address.`;
        const hasUrlParent = edges.some(e => e.relation === 'hosted on' && (e.target?.id || e.target) === node.id);
        if (hasUrlParent) return `Host domain parsed from an embedded URL in the email body or tracking chain.`;
        return `External domain referenced in the email message headers or HTML body.`;
      }
      case 'ip': {
        const isReceived = edges.some(e => (e.relation === 'received via' || e.relation === 'contains ip') && (e.target?.id || e.target) === node.id);
        if (isReceived) return `Mail Transfer Agent (MTA) relay IP extracted from Received: trace headers.`;
        return `Network endpoint associated with the message delivery path.`;
      }
      case 'location':
        return `Geographic hosting jurisdiction (${node.label || node.id}) resolved via GeoIP lookup of relay infrastructure.`;
      case 'url':
        return `Hyperlink extracted from the email HTML body or plaintext payload.`;
      case 'attachment':
        return `File attachment payload delivered inside the email message.`;
      case 'hash':
        return `Cryptographic hash (SHA-256) of attachment used for virus/malware signatures.`;
      default:
        return `Forensic indicator (${node.label || node.id}) captured during inspection.`;
    }
  };

  const filteredNodes = nodes.filter(node => {
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'ips' && node.type !== 'ip') return false;
      if (selectedFilter === 'domains' && node.type !== 'domain') return false;
      if (selectedFilter === 'urls' && node.type !== 'url') return false;
      if (selectedFilter === 'identities' && node.type !== 'person' && node.type !== 'email') return false;
      if (selectedFilter === 'locations' && node.type !== 'location') return false;
      if (selectedFilter === 'attachments' && node.type !== 'attachment' && node.type !== 'hash') return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const labelMatch = (node.label || '').toLowerCase().includes(q);
      const idMatch = (node.id || '').toLowerCase().includes(q);
      const typeMatch = (node.type || '').toLowerCase().includes(q);
      if (!labelMatch && !idMatch && !typeMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 mt-6">
      {/* Header & Overview Stats */}
      <div className="bg-card border border-border shadow-soft rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-accent-violet" />
              <h3 className="text-lg font-bold text-primary">Graph Architecture & Forensic Breakdown</h3>
            </div>
            <p className="text-sm text-secondary mt-1">
              Comprehensive forensic analysis tracing delivery relays, domain infrastructure, and connected threat indicators.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-secondary/40 border border-border rounded-lg text-xs font-medium text-secondary">
              <strong className="text-primary">{nodes.length}</strong> Entities
            </span>
            <span className="px-3 py-1 bg-secondary/40 border border-border rounded-lg text-xs font-medium text-secondary">
              <strong className="text-primary">{edges.length}</strong> Relationships
            </span>
            <span className="px-3 py-1 bg-secondary/40 border border-border rounded-lg text-xs font-medium text-secondary">
              <strong className="text-primary">{ipNodes.length}</strong> Relay IPs
            </span>
            <span className="px-3 py-1 bg-secondary/40 border border-border rounded-lg text-xs font-medium text-secondary">
              <strong className="text-primary">{domainNodes.length}</strong> Domains
            </span>
          </div>
        </div>

        {/* 3 Core Architecture Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Card 1: Delivery Chain & Transit */}
          <div className="p-4 rounded-xl bg-secondary/20 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-warning mb-2">
                <Server size={18} />
                <h4 className="font-semibold text-sm text-primary">Delivery Chain & Transit Relays</h4>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                {ipNodes.length > 0 ? (
                  <>
                    The message traversed <strong>{ipNodes.length} Mail Transfer Agent (MTA)</strong> hop(s)
                    {locationNodes.length > 0 && <> originating from or passing through <strong>{locationNodes.map(l => l.label).join(', ')}</strong></>}.
                    Inspecting relay hops verifies whether the message was submitted from legitimate authorized infrastructure or an unauthorized intermediary.
                  </>
                ) : (
                  'No intermediary MTA relay IPs were extracted from the headers. The message may have been submitted directly or headers were anonymized.'
                )}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted flex items-center gap-1.5">
              <Compass size={13} />
              <span>Yellow dots in graph represent routing IPs & relays</span>
            </div>
          </div>

          {/* Card 2: Domains & Web Targets */}
          <div className="p-4 rounded-xl bg-secondary/20 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sky-400 mb-2">
                <Globe size={18} />
                <h4 className="font-semibold text-sm text-primary">Domain Ecosystem & Content Links</h4>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Found <strong>{domainNodes.length} domain(s)</strong> and <strong>{urlNodes.length} URL(s)</strong> embedded in the message.
                {senderDomainNode ? (
                  <> Originating domain is <strong>{senderDomainNode.label}</strong>, while external links point to destinations such as redirect gateways, CDNs, or marketing platforms.</>
                ) : (
                  ' Identifies tracking redirects (e.g., customer.io, sendgrid) vs. actual phishing destinations.'
                )}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted flex items-center gap-1.5">
              <Link2 size={13} />
              <span>Sky-blue nodes represent URLs; orange nodes represent domains</span>
            </div>
          </div>

          {/* Card 3: Threat Correlation */}
          <div className="p-4 rounded-xl bg-secondary/20 border border-border flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-accent-violet mb-2">
                <Shield size={18} />
                <h4 className="font-semibold text-sm text-primary">Threat Correlation & Verdict</h4>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Overall investigation verdict is{' '}
                <span className={`font-semibold capitalize ${
                  inv.verdict === 'malicious' ? 'text-danger' :
                  inv.verdict === 'suspicious' ? 'text-warning' : 'text-success'
                }`}>
                  {inv.verdict || 'clean'}
                </span>
                {' '}with a risk score of <strong>{inv.risk_score || 0}/100</strong>.
                Each graph entity is cross-referenced with threat intelligence feeds (AbuseIPDB, VirusTotal, URLhaus) to isolate malicious indicators from benign infrastructure.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted flex items-center gap-1.5">
              <Layers size={13} />
              <span>Red highlights indicate flagged indicators or risky targets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Structured Entities Directory */}
      <div className="bg-card border border-border shadow-soft rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-semibold text-primary">Connected Entities Directory</h4>
            <p className="text-xs text-secondary mt-0.5">
              Every node depicted in the graph, its technical classification, and its specific forensic role in this email.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search entities..." 
                className="pl-8 pr-3 py-1.5 text-xs bg-secondary/30 border border-border rounded-lg text-primary placeholder-muted focus:outline-none focus:border-accent-violet"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-border">
          {[
            { id: 'all', label: `All (${nodes.length})` },
            { id: 'domains', label: `Domains (${domainNodes.length})` },
            { id: 'ips', label: `IPs (${ipNodes.length})` },
            { id: 'urls', label: `URLs (${urlNodes.length})` },
            { id: 'identities', label: `Identities (${emailNodes.length})` },
            { id: 'locations', label: `Jurisdictions (${locationNodes.length})` },
            { id: 'attachments', label: `Files (${attachmentNodes.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium ${
                selectedFilter === tab.id 
                  ? 'bg-accent-violet text-white shadow-sm' 
                  : 'bg-secondary/40 text-secondary hover:text-primary hover:bg-secondary/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Entities Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted font-medium">
                <th className="pb-2.5 pl-2">Entity</th>
                <th className="pb-2.5">Type</th>
                <th className="pb-2.5">Connections</th>
                <th className="pb-2.5">Forensic Role in Investigation</th>
                <th className="pb-2.5 pr-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-muted">
                    No entities found matching your search.
                  </td>
                </tr>
              ) : (
                filteredNodes.map(node => {
                  const connectedEdges = edges.filter(e => {
                    const s = e.source?.id || e.source;
                    const t = e.target?.id || e.target;
                    return s === node.id || t === node.id;
                  });

                  const isFlagged = node.metadata?.threat_status === 'malicious' || 
                                    node.metadata?.threat_status === 'suspicious' ||
                                    node.metadata?.is_malicious === true;

                  return (
                    <tr key={node.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pl-2 max-w-[220px]">
                        <div className="font-mono text-primary truncate font-medium" title={node.label || node.id}>
                          {node.label || node.id}
                        </div>
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <span className="capitalize px-2 py-0.5 rounded-md font-medium text-[11px] bg-secondary/50 text-secondary border border-border">
                          {node.type}
                        </span>
                      </td>
                      <td className="py-3 whitespace-nowrap text-secondary">
                        <span className="font-medium text-primary">{connectedEdges.length}</span> link{connectedEdges.length !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3 text-secondary pr-4 leading-relaxed max-w-[420px]">
                        {getNodeRoleDescription(node)}
                      </td>
                      <td className="py-3 pr-2 text-right whitespace-nowrap">
                        {isFlagged ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger px-2 py-0.5 rounded bg-danger/10 border border-danger/20">
                            <AlertTriangle size={11} /> Flagged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success px-2 py-0.5 rounded bg-success/10 border border-success/20">
                            <CheckCircle2 size={11} /> Clean / Info
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const GraphTab = ({ inv }) => {
  if (!inv.graph || !inv.graph.nodes || inv.graph.nodes.length === 0) {
    return (
      <div className="text-center py-20 bg-card border border-border shadow-soft rounded-xl w-full">
        <Network size={48} className="mx-auto text-muted mb-4" />
        <p className="text-secondary">No investigation graph data available.</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="h-[calc(100vh-280px)] min-h-[600px] border border-border rounded-xl overflow-hidden bg-[#0f172a] relative">
        <InvestigationGraph data={{ nodes: inv.graph.nodes, links: inv.graph.edges || [] }} investigation={inv} />
      </div>
      <GraphForensicBreakdown inv={inv} />
    </div>
  );
};

const CopilotTab = ({ invId, inv }) => {
  return (
    <div className="h-[calc(100vh-280px)] min-h-[600px]">
      <InvestigationCopilot investigationId={invId} investigation={inv} />
    </div>
  );
};

const ReportTab = ({ invId }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const data = await copilotService.getInvestigationReport(invId);
        setReport(data);
      } catch {
        // Report might not exist
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [invId]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const newReport = await copilotService.generateInvestigationReport(invId);
      setReport(newReport);
    } catch (err) {
      console.error(err);
      setError('Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-muted flex items-center gap-3"><div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin"></div> Loading report state...</div>;
  }

  return (
    <div className="w-full">
      <div className="flex justify-end mb-6">
        <button 
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-violet hover:bg-accent-violet/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 shadow-lg shadow-accent-violet/20"
        >
          {generating ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating...</>
          ) : (
            <><FileText size={18} /> {report ? 'Regenerate Report' : 'Generate Forensic Report'}</>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-lg mb-6 flex items-center gap-3">
          <ShieldAlert size={20} />
          {error}
        </div>
      )}

      {report ? (
        <ForensicReportView report={report} />
      ) : (
        <div className="text-center py-20 bg-card border border-border shadow-soft rounded-2xl">
          <FileText size={48} className="mx-auto text-muted mb-4" />
          <h3 className="text-lg font-medium text-primary mb-2">No Report Available</h3>
          <p className="text-secondary max-w-sm mx-auto">Generate a comprehensive AI-powered forensic report to document findings and recommendations.</p>
        </div>
      )}
    </div>
  );
};

const TABS = [
  { path: "", label: "Overview", icon: LayoutDashboard },
  { path: "evidence", label: "Evidence", icon: Search },
  { path: "intelligence", label: "Intelligence", icon: Globe },
  { path: "timeline", label: "Timeline", icon: Clock },
  { path: "graph", label: "Graph", icon: Network },
  { path: "copilot", label: "Copilot", icon: Brain },
  { path: "report", label: "Report", icon: FileText }
];

const InvestigationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  useEvidenceScroller();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await securityService.getInvestigationById(id);
        setInv(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load investigation details. It may not exist or you do not have access.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-muted">
          <div className="w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !inv) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-danger">
          <ShieldAlert size={48} className="mb-4 opacity-50" />
          <p>{error || 'Investigation not found.'}</p>
          <button 
            onClick={() => navigate('/security/investigations')}
            className="mt-6 px-4 py-2 bg-secondary hover:bg-interactive text-primary rounded-lg transition-colors"
          >
            Back to Investigations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-6 flex flex-col">
        <div className="w-full flex-1 flex flex-col">
          
          {/* Header */}
          <div className="flex items-center gap-4 pb-6">
            <button 
              onClick={() => navigate('/security/investigations')}
              className="p-2 hover:bg-interactive rounded-lg text-secondary transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-primary break-words">
                {inv.headers?.subject || '(No Subject)'}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary mt-2">
                <span className="flex items-center gap-1"><Clock size={14} /> {format(new Date(inv.createdAt), 'MMM d, yyyy HH:mm')}</span>
                <span className="uppercase">{inv.sourceType.replace('_', ' ')}</span>
                <span className="uppercase text-accent-violet font-medium">Depth: {inv.analysisDepth}</span>
              </div>
            </div>
            {inv.scan && (
              <div className={`px-4 py-2 rounded-lg border flex flex-col items-end flex-shrink-0 justify-center ${
                inv.scan.riskLevel === 'critical' ? 'bg-danger/10 border-danger/30 text-danger' :
                inv.scan.riskLevel === 'high' ? 'bg-warning/10 border-warning/30 text-warning' :
                inv.scan.riskLevel === 'medium' ? 'bg-warning/10 border-warning/30 text-warning' :
                'bg-accent-blue/10 border-accent-blue/30 text-accent-blue'
              }`}>
                <span className="text-xs uppercase font-medium tracking-wider mb-0.5">Risk Level</span>
                <span className="text-xl font-bold capitalize leading-none">{inv.scan.riskLevel}</span>
              </div>
            )}
          </div>
          
          {/* Tabs Navigation */}
          <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto hide-scrollbar flex-shrink-0">
            {TABS.map(tab => (
              <NavLink 
                key={tab.path} 
                to={`/security/investigations/${id}${tab.path ? `/${tab.path}` : ''}`}
                end={tab.path === ""}
                className={({ isActive }) => `flex items-center gap-2 px-4 py-3 border-b-2 text-[15px] font-medium transition-colors whitespace-nowrap ${isActive ? 'border-accent-violet text-accent-violet' : 'border-transparent text-secondary hover:text-primary hover:border-border'}`}
              >
                <tab.icon size={16} />
                {tab.label}
              </NavLink>
            ))}
          </div>
          
          {/* Content Area */}
          <div className="flex-1">
            <Routes>
              <Route index element={<OverviewTab inv={inv} />} />
              <Route path="evidence" element={<EvidenceTab inv={inv} />} />
              <Route path="intelligence" element={<IntelligenceTab inv={inv} />} />
              <Route path="timeline" element={<TimelineTab inv={inv} />} />
              <Route path="graph" element={<GraphTab inv={inv} />} />
              <Route path="copilot" element={<CopilotTab invId={id} inv={inv} />} />
              <Route path="report" element={<ReportTab invId={id} />} />
            </Routes>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InvestigationDetail;
