import { useState, useRef, useEffect } from 'react';
import { Send, Bot, AlertCircle, Search, HelpCircle, Loader2, FileText } from 'lucide-react';
import * as copilotService from '../../services/copilotService';

const SUGGESTED_QUESTIONS = [
  "Why is this email considered risky?",
  "What authentication failures were found?",
  "Which indicators deserve attention?",
  "What does the routing chain show?",
  "Summarize this investigation."
];

export default function InvestigationCopilot({ investigationId, investigation, onCitationClick }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (questionText) => {
    if (!questionText.trim()) return;

    const newMessages = [...messages, { role: 'user', content: questionText }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await copilotService.askInvestigationCopilot(investigationId, questionText);
      if (response.success) {
        setMessages([...newMessages, { role: 'assistant', data: response.data }]);
      } else {
        setMessages([...newMessages, { role: 'error', content: 'Copilot unavailable.' }]);
      }
    } catch (err) {
      setMessages([...newMessages, { 
        role: 'error', 
        content: err.response?.data?.error?.message || 'Failed to communicate with Copilot.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const formatEvidenceLabel = (id) => {
    if (!id) return '';
    if (id === 'E_VERDICT') return 'Evidence · Detection Verdict';
    if (id === 'E_AUTH') return 'Evidence · Authentication';
    if (id === 'E_ROUTE') return 'Evidence · Routing';
    if (id === 'E_EMAIL_ID') return 'Evidence · Email Identity';
    if (id.startsWith('E_IND_')) {
      const num = id.split('_')[2];
      return `Evidence · Indicator ${num}`;
    }
    if (id.startsWith('E_ATT_')) {
      const num = id.split('_')[2];
      return `Evidence · Attachment ${num}`;
    }
    return `Evidence · ${id.replace(/^E_/, '')}`;
  };

  const replaceEvidenceIdsInText = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/\[E_VERDICT\]/g, 'Evidence · Detection Verdict')
      .replace(/\[E_AUTH\]/g, 'Evidence · Authentication')
      .replace(/\[E_ROUTE\]/g, 'Evidence · Routing')
      .replace(/\[E_EMAIL_ID\]/g, 'Evidence · Email Identity')
      .replace(/\[E_IND_(\d+)\]/g, 'Evidence · Indicator $1')
      .replace(/\[E_ATT_(\d+)\]/g, 'Evidence · Attachment $1');
  };

  const getProviderState = () => {
    const coverage = investigation?.emailIntelligenceSummary?.providerCoverage;
    if (coverage && typeof coverage === 'object') {
      const vals = Object.values(coverage);
      if (vals.some(v => v === 'unavailable')) return 'unavailable';
      if (vals.length > 0 && vals.every(v => v === 'not_configured')) return 'not_configured';
      if (vals.some(v => v === 'not_observed')) return 'not_observed';
    }

    const indicators = investigation?.indicators || [];
    if (indicators.length > 0) {
      const statuses = indicators.map(ind => ind.threatStatus || ind.intelligence?.status).filter(Boolean);
      if (statuses.some(s => s === 'unavailable')) return 'unavailable';
      if (statuses.length > 0 && statuses.every(s => s === 'not_configured')) return 'not_configured';
      if (statuses.some(s => s === 'not_observed' || s === 'benign' || s === 'clear')) return 'not_observed';
    }

    const enrichment = investigation?.analystSummary?.enrichmentStatus || investigation?.enrichmentStatus;
    if (enrichment === 'not_configured') return 'not_configured';
    if (enrichment === 'failed') return 'unavailable';

    return 'not_observed';
  };

  const formatUncertainty = (text) => {
    if (!text || typeof text !== 'string') return text;
    const tiRegex = /no threat intelligence (?:is )?available/i;
    if (tiRegex.test(text)) {
      const state = getProviderState();
      if (state === 'unavailable') {
        return "Threat intelligence could not be determined because the provider was unavailable.";
      }
      if (state === 'not_configured') {
        return "Threat intelligence could not be determined because the provider was not configured.";
      }
      return "No confirmed malicious observation was found for the relevant URLs or domains.";
    }
    return replaceEvidenceIdsInText(text);
  };

  const renderEvidenceCitations = (ids) => {
    if (!ids || ids.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {ids.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => onCitationClick && onCitationClick(id)}
            className="text-[11px] font-medium text-accent-violet bg-accent-violet/10 hover:bg-accent-violet/20 px-2 py-0.5 rounded border border-accent-violet/20 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <FileText size={11} />
            {formatEvidenceLabel(id)}
          </button>
        ))}
      </div>
    );
  };

  const renderAssistantMessage = (data) => {
    return (
      <div className="space-y-4 text-sm text-slate-900 dark:text-slate-100 font-normal">
        {data.summary && (
          <p className="leading-relaxed text-slate-900 dark:text-slate-100 font-medium">
            {replaceEvidenceIdsInText(data.summary)}
          </p>
        )}
        {data.overallAssessment && (
          <p className="leading-relaxed text-slate-800 dark:text-slate-200">
            {replaceEvidenceIdsInText(data.overallAssessment)}
          </p>
        )}

        {data.keyFindings?.length > 0 && (
          <div className="bg-card p-4 rounded-lg border border-border/80 shadow-xs">
            <h4 className="font-bold text-slate-900 dark:text-white mb-3 text-[15px]">Key Findings</h4>
            <ul className="space-y-3.5">
              {data.keyFindings.map((kf, i) => (
                <li key={i} className="border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      kf.severity === 'critical' ? 'bg-danger/20 text-danger' :
                      kf.severity === 'high' ? 'bg-warning/20 text-warning' :
                      kf.severity === 'medium' ? 'bg-warning/20 text-warning' :
                      'bg-accent-blue/20 text-accent-blue'
                    }`}>
                      {kf.severity}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{replaceEvidenceIdsInText(kf.title)}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 mt-1.5 text-sm leading-relaxed">
                    {replaceEvidenceIdsInText(kf.description)}
                  </p>
                  {renderEvidenceCitations(kf.evidenceIds)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.uncertainties?.length > 0 && (
          <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/20">
            <h4 className="font-bold text-amber-950 dark:text-amber-300 mb-2 flex items-center gap-1.5 text-sm">
              <HelpCircle size={15} /> Missing Evidence
            </h4>
            <ul className="list-disc list-inside space-y-1.5">
              {data.uncertainties.map((u, i) => (
                <li key={i} className="text-slate-900 dark:text-slate-100 text-sm leading-relaxed font-medium">
                  {formatUncertainty(u)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.recommendedActions?.length > 0 && (
          <div className="bg-accent-blue/5 p-4 rounded-lg border border-accent-blue/20">
            <h4 className="font-bold text-blue-900 dark:text-accent-blue mb-2.5 text-sm">Recommended Actions</h4>
            <ul className="space-y-3">
              {data.recommendedActions.map((ra, i) => (
                <li key={i}>
                  <p className="font-semibold text-slate-900 dark:text-white">{replaceEvidenceIdsInText(ra.action)}</p>
                  <p className="text-slate-700 dark:text-slate-300 text-xs mt-0.5 leading-relaxed">
                    {replaceEvidenceIdsInText(ra.reason)}
                  </p>
                  {renderEvidenceCitations(ra.evidenceIds)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-secondary/80 p-4 border-b border-border/50 flex items-center gap-3">
        <div className="p-2 bg-accent-violet/20 rounded-lg">
          <Bot className="text-accent-violet" size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-primary">Investigation Copilot</h3>
          <p className="text-xs text-muted font-medium uppercase tracking-wider mt-0.5">AI-Assisted Analysis · Grounded by DetectIQ Evidence</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-accent-violet/10 flex items-center justify-center">
              <Search className="text-accent-violet/50" size={32} />
            </div>
            <div>
              <p className="text-secondary font-medium mb-1">How can I help with this investigation?</p>
              <p className="text-sm text-muted">I can analyze headers, indicators, and routing.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-xs bg-secondary text-secondary px-3 py-1.5 rounded-full border border-border hover:bg-interactive hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-accent-violet/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={16} className="text-accent-violet" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-accent-violet text-white rounded-tr-sm' 
                  : msg.role === 'error'
                  ? 'bg-danger/10 border border-danger/20 text-danger rounded-tl-sm'
                  : 'bg-secondary/70 border border-border text-slate-900 dark:text-slate-100 rounded-tl-sm shadow-sm'
              }`}>
                {msg.role === 'user' ? msg.content : msg.role === 'error' ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span className="text-sm">{msg.content}</span>
                  </div>
                ) : renderAssistantMessage(msg.data)}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-accent-violet/20 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-accent-violet" />
            </div>
            <div className="bg-secondary border border-border rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-accent-violet" />
              <span className="text-sm text-muted">Analyzing evidence...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-secondary/50 border-t border-border/50">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="flex gap-2 relative"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask a question about this investigation..."
            className="flex-1 bg-background border border-border rounded-lg pl-4 pr-12 py-3 text-sm text-primary placeholder-muted focus:outline-none focus:border-accent-violet focus:ring-1 focus:ring-accent-violet transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2 top-2 bottom-2 bg-accent-violet hover:bg-accent-violet/90 text-white rounded-md w-10 flex items-center justify-center transition-colors disabled:opacity-50 disabled:hover:bg-accent-violet"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
