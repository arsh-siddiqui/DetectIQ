import { FileText, Info, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function ForensicReportView({ report }) {
  if (!report) return null;

  const {
    deterministicSummary,
    aiFindings,
    limitations,
    generatedAt,
    reportVersion
  } = report;

  const verdict = deterministicSummary?.verdict || {};

  return (
    <div className="bg-card rounded-xl border border-border shadow-xl overflow-hidden text-sm">
      {/* Header */}
      <div className="bg-secondary p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-blue/20 text-accent-blue rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">Forensic Investigation Report</h2>
              <p className="text-muted mt-1">Generated {format(new Date(generatedAt), 'PPP p')}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-secondary/80 text-secondary border border-border rounded-full text-xs font-medium">
              v{reportVersion}.0
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Detection Verdict */}
        <section>
          <h3 className="text-lg font-semibold text-primary mb-4 border-b border-border pb-2">1. Detection Verdict</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-secondary/50 p-4 rounded-lg border border-border">
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Classification</p>
              <p className="text-lg font-semibold font-mono text-primary capitalize">{verdict.classification}</p>
            </div>
            <div className="bg-secondary/50 p-4 rounded-lg border border-border">
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Risk Score</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold font-mono text-primary">{verdict.riskScore}/100</p>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  verdict.riskLevel === 'critical' || verdict.riskLevel === 'high' ? 'bg-danger/20 text-danger border border-danger/30' :
                  verdict.riskLevel === 'medium' ? 'bg-warning/20 text-warning border border-warning/30' :
                  'bg-success/20 text-success border border-success/30'
                }`}>
                  {verdict.riskLevel}
                </span>
              </div>
            </div>
            <div className="bg-secondary/50 p-4 rounded-lg border border-border">
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Confidence</p>
              <p className="text-lg font-semibold font-mono text-primary">{verdict.confidence}%</p>
            </div>
          </div>
        </section>

        {/* AI Findings */}
        {aiFindings ? (
          <section>
            <h3 className="text-lg font-semibold text-primary mb-4 border-b border-border pb-2 flex items-center gap-2">
              <Shield size={18} className="text-accent-violet" />
              2. AI Copilot Analysis
            </h3>
            
            <div className="space-y-6">
              <div className="bg-accent-violet/5 p-4 rounded-lg border border-accent-violet/20">
                <h4 className="font-medium text-accent-violet mb-2">Executive Summary</h4>
                <p className="text-secondary leading-relaxed">{aiFindings.summary}</p>
              </div>

              {aiFindings.keyFindings?.length > 0 && (
                <div>
                  <h4 className="font-medium text-primary mb-3">Key Findings</h4>
                  <div className="grid gap-3">
                    {aiFindings.keyFindings.map((finding, idx) => (
                      <div key={idx} className="bg-secondary/50 p-4 rounded-lg border border-border">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-primary">{finding.title}</p>
                            <p className="text-muted mt-1">{finding.description}</p>
                          </div>
                          <span className={`shrink-0 px-2 py-1 rounded text-[10px] uppercase font-bold ${
                            finding.severity === 'critical' ? 'bg-danger/20 text-danger' :
                            finding.severity === 'high' ? 'bg-warning/20 text-warning' :
                            finding.severity === 'medium' ? 'bg-warning/20 text-warning' :
                            'bg-accent-blue/20 text-accent-blue'
                          }`}>
                            {finding.severity}
                          </span>
                        </div>
                        {finding.evidenceIds?.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                            {finding.evidenceIds.map(id => {
                              let label = `Evidence · ${id}`;
                              if (id === 'E_VERDICT') label = 'Evidence · Detection Verdict';
                              else if (id === 'E_AUTH') label = 'Evidence · Authentication';
                              else if (id.startsWith('E_IND_')) {
                                const num = id.split('_')[2];
                                label = `Evidence #${num}`;
                              }
                              return (
                                <span key={id} className="text-[11px] font-medium text-accent-violet bg-accent-violet/10 px-2 py-1 rounded border border-accent-violet/20 flex items-center gap-1">
                                  <FileText size={12} />
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section>
            <h3 className="text-lg font-semibold text-primary mb-4 border-b border-border pb-2">2. AI Copilot Analysis</h3>
            <div className="bg-secondary/50 p-4 rounded-lg border border-border text-center text-muted">
              AI insights are currently unavailable for this report.
            </div>
          </section>
        )}

        {/* Limitations */}
        {limitations?.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-primary mb-4 border-b border-border pb-2 flex items-center gap-2">
              <Info size={18} className="text-muted" />
              3. Evidence Limitations
            </h3>
            <div className="bg-secondary/50 p-4 rounded-lg border border-border">
              <ul className="list-disc list-inside space-y-2 text-secondary">
                {limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
