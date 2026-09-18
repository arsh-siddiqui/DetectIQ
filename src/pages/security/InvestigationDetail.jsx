import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Routes, Route, NavLink } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, ShieldAlert, Activity, Clock, 
  FileText, ChevronDown, ChevronRight, Hash, Network,
  Globe, Brain, LayoutDashboard, Search, FileBox
} from 'lucide-react';
import * as securityService from '../../services/securityService';
import InvestigationGraph from '../../components/security/InvestigationGraph';
import InvestigationTimeline from '../../components/security/InvestigationTimeline';
import InvestigationCopilot from '../../components/security/InvestigationCopilot';
import ForensicReportView from '../../components/security/ForensicReportView';
import ForensicIntelligencePanel from '../../components/intelligence/ForensicIntelligencePanel';
import EmailIntelligencePanel from '../../components/intelligence/EmailIntelligencePanel';
import * as copilotService from '../../services/copilotService';

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

const OverviewTab = ({ inv }) => {
  return (
    <div className="w-full space-y-6">
      {inv.scan && (
        <Section title="Detection Verdict" icon={ShieldAlert}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Verdict</div>
              <div className="text-xl font-semibold text-primary capitalize">{inv.scan.classification}</div>
            </div>
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Risk Level</div>
              <div className={`text-xl font-semibold capitalize ${
                inv.scan.riskLevel === 'critical' ? 'text-danger' :
                inv.scan.riskLevel === 'high' ? 'text-warning' :
                inv.scan.riskLevel === 'medium' ? 'text-warning' : 'text-accent-blue'
              }`}>{inv.scan.riskLevel}</div>
            </div>
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Risk Score</div>
              <div className="text-xl font-semibold text-primary">{inv.scan.riskScore} / 100</div>
            </div>
            <div className="bg-secondary/50 p-4 rounded-lg">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Confidence</div>
              <div className="text-xl font-semibold text-primary">High</div>
            </div>
          </div>
        </Section>
      )}

      <Section title="Analyst Summary" icon={Activity}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between pb-3 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider">Enrichment</span>
              <span className="text-lg font-semibold text-primary capitalize">{inv.analystSummary?.enrichmentStatus}</span>
            </div>
            <div className="flex justify-between pb-3 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider">Public IPs</span>
              <span className="text-lg font-semibold text-primary">{inv.analystSummary?.publicIpCount}</span>
            </div>
            <div className="flex justify-between pb-3 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider">Domains / URLs</span>
              <span className="text-lg font-semibold text-primary">{inv.analystSummary?.domainCount} domains • {inv.analystSummary?.urlCount} URLs</span>
            </div>
            <div className="flex justify-between pb-3 border-b border-border/50 items-center">
              <span className="text-xs text-muted uppercase tracking-wider">Flagged Indicators</span>
              <span className="text-lg font-semibold text-danger">{inv.analystSummary?.flaggedIndicatorCount}</span>
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wider text-muted mb-4">Authentication</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-secondary/50 p-3 rounded-lg text-center">
                <div className="text-[10px] text-muted uppercase mb-1">SPF</div>
                <div className={`text-sm font-bold ${inv.analystSummary?.spfStatus === 'pass' ? 'text-success' : inv.analystSummary?.spfStatus === 'fail' ? 'text-danger' : 'text-secondary'}`}>{inv.analystSummary?.spfStatus}</div>
              </div>
              <div className="bg-secondary/50 p-3 rounded-lg text-center">
                <div className="text-[10px] text-muted uppercase mb-1">DKIM</div>
                <div className={`text-sm font-bold ${inv.analystSummary?.dkimStatus === 'pass' ? 'text-success' : inv.analystSummary?.dkimStatus === 'fail' ? 'text-danger' : 'text-secondary'}`}>{inv.analystSummary?.dkimStatus}</div>
              </div>
              <div className="bg-secondary/50 p-3 rounded-lg text-center">
                <div className="text-[10px] text-muted uppercase mb-1">DMARC</div>
                <div className={`text-sm font-bold ${inv.analystSummary?.dmarcStatus === 'pass' ? 'text-success' : inv.analystSummary?.dmarcStatus === 'fail' ? 'text-danger' : 'text-secondary'}`}>{inv.analystSummary?.dmarcStatus || 'N/A'}</div>
              </div>
            </div>
            
            {/* Authentication Context */}
            {['phishing', 'suspicious'].includes(inv.scan?.classification?.toLowerCase()) && 
             ['pass'].some(status => [inv.analystSummary?.spfStatus, inv.analystSummary?.dkimStatus, inv.analystSummary?.dmarcStatus].includes(status)) && (
              <div className="mt-4 p-3 rounded bg-warning/10 border border-warning/20 text-xs text-warning leading-relaxed">
                <span className="font-semibold block mb-1">Context:</span>
                Authentication passed. This confirms message authentication but does not by itself establish that the content is trustworthy. Other evidence contributed to the final assessment.
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Identity & Context" icon={FileText}>
        <div className="space-y-4 text-sm bg-secondary/30 p-4 rounded-lg">
          {inv.headers?.from && (
            <div>
              <div className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Sender (From)</div>
              <div className="text-primary font-mono text-sm break-words overflow-wrap-anywhere">{inv.headers.from}</div>
            </div>
          )}
          {inv.headers?.to && (
            <div>
              <div className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Recipient (To)</div>
              <div className="text-secondary font-mono text-sm break-words overflow-wrap-anywhere">{inv.headers.to}</div>
            </div>
          )}
          {inv.headers?.subject && (
            <div>
              <div className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Subject</div>
              <div className="text-primary font-medium">{inv.headers.subject}</div>
            </div>
          )}
          {inv.headers?.replyTo && (
            <div>
              <div className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Reply-To</div>
              <div className="text-secondary font-mono text-sm break-words overflow-wrap-anywhere">{inv.headers.replyTo}</div>
            </div>
          )}
          {inv.headers?.messageId && (
            <div>
              <div className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Message-ID</div>
              <div className="text-secondary font-mono text-sm break-words overflow-wrap-anywhere">{inv.headers.messageId}</div>
            </div>
          )}
          {inv.sourceType && (
            <div>
              <div className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Source Type</div>
              <div className="text-secondary text-sm uppercase">{inv.sourceType.replace('_', ' ')}</div>
            </div>
          )}
          {inv.analysisDepth && (
            <div>
              <div className="text-xs text-muted mb-1 uppercase tracking-wider font-semibold">Analysis Depth</div>
              <div className="text-secondary text-sm capitalize">{inv.analysisDepth}</div>
            </div>
          )}
        </div>
      </Section>
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
              <div>
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
                     <span key={idx} className={`px-2 py-1 rounded text-xs font-mono font-bold ${ipObj.type === 'private' ? 'bg-secondary text-secondary' : 'bg-accent-blue/20 text-accent-blue'}`}>
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
                      <div key={idx} className="text-[11px] font-mono text-secondary bg-secondary/30 p-2 rounded border border-border overflow-wrap-anywhere">
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
              <div key={idx} className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
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
    <div className="h-[calc(100vh-280px)] min-h-[600px] border border-border rounded-xl overflow-hidden bg-[#0f172a] relative">
      <InvestigationGraph data={{ nodes: inv.graph.nodes, links: inv.graph.edges || [] }} />
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
