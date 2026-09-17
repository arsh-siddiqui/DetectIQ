import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldAlert, ShieldCheck, AlertTriangle, Loader2, Info, Search, Cpu, BookOpen, Brain, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { getScanResult, personalizeScan } from "../../services/detectionService";
import Button from "../../components/ui/Button";


export default function ScanResult() {
  const { id } = useParams();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [personalizeStatus, setPersonalizeStatus] = useState('idle'); // 'idle', 'loading', 'success', 'skipped'

  const handlePersonalize = async () => {
    setPersonalizeStatus('loading');
    try {
      await personalizeScan(id);
      setPersonalizeStatus('success');
    } catch (err) {
      console.error(err);
      setPersonalizeStatus('idle');
      // Could show toast error here
    }
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getScanResult(id);
        setScan(data);
      } catch {
        setError("Failed to load scan result.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-danger-50 text-danger p-6 rounded-2xl flex flex-col items-center text-center">
          <ShieldAlert className="w-12 h-12 mb-4" />
          <h2 className="text-xl font-bold mb-2">Result Not Found</h2>
          <p className="text-sm mb-6">{error || "The scan result you are looking for does not exist or you do not have permission to view it."}</p>
          <Link to="/detection/history">
            <Button variant="primary">Back to History</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isNeedsReview = scan.classification === 'needs_review';
  const isSafe = (scan.riskLevel === 'safe' || scan.riskLevel === 'low') && !isNeedsReview;
  const isMedium = scan.riskLevel === 'medium' || isNeedsReview;
  const isDanger = scan.riskLevel === 'high' || scan.riskLevel === 'critical';

  const riskColor = isDanger ? 'text-danger' : isMedium ? 'text-warning' : 'text-success';
  const RiskIcon = isDanger ? ShieldAlert : isMedium ? AlertTriangle : ShieldCheck;

  // Evidence — items have { source, title, detail, severity }
  const evidenceList = scan.evidence || [];
  const heuristics = evidenceList.filter(e => e.source === 'Heuristics');
  const ml = evidenceList.filter(e => e.source === 'ML_Classifier');
  const threatIntel = evidenceList.filter(e => e.source === 'PhishDestroy' || e.source === 'Threat_Intelligence' || e.source === 'VirusTotal');
  const personalization = evidenceList.filter(e => e.source === 'Personalization_RAG');
  
  // Human-readable classification labels
  const CLASSIFICATION_LABEL = {
    phishing: 'Phishing',
    suspicious: 'Suspicious',
    needs_review: 'Needs Review',
    legitimate: 'Legitimate',
  };

  const displayClassification = CLASSIFICATION_LABEL[scan.classification] || scan.classification;

  const displayTarget = scan.target || scan.heuristicResult?.category || 'Scanned Content';
  const analysisType = scan.scanType || 'unknown';
  const inputType = scan.inputType || analysisType;

  // Derive booleans based on analysisType (what pipeline processed it)
  const isUrlAnalysis = analysisType === 'url';
  const isEmailAnalysis = analysisType === 'email';

  // Specific booleans for display
  const isQrInput = inputType === 'qr';
  const isScreenshotInput = inputType === 'screenshot';

  let llmAnalysisStr = "No analysis available for this scan.";
  try {
    const llm = scan.llmResult;
    if (llm) {
      if (typeof llm === 'string') {
        llmAnalysisStr = llm;
      } else if (llm.summary) {
        llmAnalysisStr = llm.summary;
      } else if (llm.reason) {
        llmAnalysisStr = llm.reason;
      } else if (llm.reasoning) {
        llmAnalysisStr = llm.reasoning;
      } else {
        llmAnalysisStr = JSON.stringify(llm, null, 2);
      }
    } else if (scan.summary) {
      llmAnalysisStr = scan.summary;
    }
  } catch {
    llmAnalysisStr = "Analysis could not be parsed.";
  }

  const confidenceDisplay = scan.confidence ?? scan.confidenceScore ?? 0;

  // Format strings for URL analysis
  const formatUrlText = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    if (text === 'No action needed — this message appears safe.') {
      return 'No immediate action needed — no significant threat indicators were detected for this URL.';
    }
    if (text === 'No phishing indicators, suspicious links, or manipulation tactics were found in this message.') {
      return 'No significant phishing indicators, suspicious URL patterns, or known threat-intelligence matches were detected.';
    }
    if (text === 'This content shows multiple severe warning signs of a scam or phishing attempt. It is highly recommended not to interact with it.') {
      return 'This URL shows multiple severe warning signs of a scam or phishing attempt. It is highly recommended not to visit it.';
    }
    if (text === "This message has some warning signs but isn't a clear-cut scam. Treat it with caution before acting.") {
      return "This URL has some warning signs but isn't a clear-cut scam. Treat it with caution before visiting.";
    }
    if (text === 'This content has minor indicators that warrant a closer look, but no confirmed threats were detected.') {
      return 'This URL has minor indicators that warrant a closer look, but no confirmed threats were detected.';
    }
    if (text === 'No suspicious indicators were found. This content appears safe based on deterministic analysis.') {
      return 'No suspicious indicators were found. This URL appears safe based on deterministic analysis.';
    }

    // General replacements for LLM or other dynamically generated text
    return text
      .replace(/\\bthis message\\b/gi, 'this URL')
      .replace(/\\bmessage\\b/gi, 'URL')
      .replace(/\\bemail\\b/gi, 'URL')
      .replace(/\\bcontent\\b/gi, 'URL')
      .replace(/\\bsender\\b/gi, 'domain')
      .replace(/\\binteract with it\\b/gi, 'visit it')
      .replace(/\\binteracting with\\b/gi, 'visiting');
  };

  const finalRecommendations = isUrlAnalysis && scan.recommendations
    ? scan.recommendations.map(formatUrlText)
    : scan.recommendations;

  const finalLlmAnalysisStr = isUrlAnalysis 
    ? formatUrlText(llmAnalysisStr)
    : llmAnalysisStr;

  const finalReasons = isUrlAnalysis && scan.llmResult?.reasons
    ? scan.llmResult.reasons.map(formatUrlText)
    : scan.llmResult?.reasons;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <Link to="/detection/scanner" className="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-primary transition-colors">
          <ChevronDown className="w-4 h-4 rotate-90" /> Back to Scanner
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/detection/history" className="text-sm font-bold text-accent-blue hover:underline">
            View Scan History
          </Link>
        </div>
      </div>

      {/* Header Banner */}
      <div className={`relative overflow-hidden rounded-3xl border p-8 md:p-12 shadow-elevated ${
        isDanger ? 'bg-danger/5 border-danger/20' : 
        isMedium ? 'bg-warning/5 border-warning/20' : 
        'bg-success/5 border-success/20'
      }`}>
        <div className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none opacity-20 -mr-20 -mt-20 ${
          isDanger ? 'bg-danger' : 
          isMedium ? 'bg-warning' : 
          'bg-success'
        }`} />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-8">
          <div className={`w-28 h-28 rounded-[2rem] flex items-center justify-center flex-shrink-0 shadow-soft border ${
            isDanger ? 'bg-gradient-to-br from-danger to-red-900 border-danger/50 text-white' : 
            isMedium ? 'bg-gradient-to-br from-warning to-orange-700 border-warning/50 text-white' : 
            'bg-gradient-to-br from-success to-emerald-900 border-success/50 text-white'
          }`}>
            <RiskIcon className="w-14 h-14" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                isDanger ? 'bg-danger/10 text-danger border-danger/20' : 
                isMedium ? 'bg-warning/10 text-warning border-warning/20' : 
                'bg-success/10 text-success border-success/20'
              }`}>
                {inputType} {inputType !== analysisType ? `→ ${analysisType}` : ''} Analysis
              </span>
              <span className="text-xs font-semibold text-muted">{new Date(scan.createdAt || Date.now()).toLocaleString()}</span>
            </div>
            
            <h1 className={`text-4xl md:text-5xl font-heading font-black mb-4 capitalize tracking-tight ${riskColor}`}>
              {displayClassification}
            </h1>
            
            <p className="text-secondary font-medium text-base md:text-lg break-all max-w-2xl leading-relaxed">
              {displayTarget}
            </p>
          </div>
          
          <div className="flex flex-row md:flex-col gap-4 w-full md:w-auto mt-6 md:mt-0">
            <div className="flex-1 md:flex-none bg-card/80 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center min-w-[160px]">
              <div className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Risk Score</div>
              <div className={`text-4xl font-heading font-black tracking-tight ${riskColor}`}>{scan.riskScore}<span className="text-xl text-muted font-bold">/100</span></div>
            </div>
            <div className="flex-1 md:flex-none bg-card/80 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center min-w-[160px]">
              <div className="text-xs font-bold text-muted uppercase tracking-wider mb-1">
                {scan.ml?.status === 'available' ? 'AI Confidence' : 'Detection Confidence'}
              </div>
              <div className="text-4xl font-heading font-black tracking-tight text-primary">{confidenceDisplay}<span className="text-xl text-muted font-bold">%</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* QR / Screenshot Decoder Details */}
      {(isQrInput || isScreenshotInput) && (
        <div className="bg-secondary/30 p-8 rounded-3xl border border-border shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-heading font-bold text-primary">
              {isQrInput ? 'QR Code Extracted Payload' : 'Screenshot Extracted Text'}
            </h2>
            <span className="ml-auto text-xs font-bold bg-background border border-border px-3 py-1.5 rounded-lg text-secondary">
              Resolved as: <span className="uppercase text-primary">{analysisType}</span>
            </span>
          </div>
          <p className="p-5 bg-card border border-border rounded-2xl text-primary font-mono text-sm break-all max-h-40 overflow-y-auto shadow-inner">
            {displayTarget}
          </p>
        </div>
      )}

      {/* Row 2: Why this result & Recommended Action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Why this result? */}
        <div className="bg-card p-6 md:p-10 rounded-3xl border border-border shadow-elevated flex flex-col h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-violet/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-accent-violet/10 text-accent-violet flex items-center justify-center shadow-sm">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-heading font-extrabold text-primary">Why this result?</h3>
          </div>
          <div className="text-base md:text-lg font-medium text-secondary leading-relaxed flex-1 relative z-10 p-6 md:p-8 bg-background rounded-2xl border border-border shadow-inner">
            {finalReasons && Array.isArray(finalReasons) && finalReasons.length > 0 ? (
              <ul className="space-y-4">
                {finalReasons.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-accent-violet font-bold mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="whitespace-pre-wrap">{finalLlmAnalysisStr}</div>
            )}
          </div>
        </div>

        {/* Recommended Action */}
        <div className="bg-card p-6 md:p-10 rounded-3xl border border-border shadow-elevated flex flex-col h-full">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 text-accent-blue flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-heading font-extrabold text-primary">Recommended Action</h2>
          </div>
          {finalRecommendations && finalRecommendations.length > 0 ? (
            <ul className="space-y-4 flex-1">
              {finalRecommendations.map((rec, i) => (
                <li key={i} className="flex gap-4 text-sm bg-background p-5 rounded-2xl border border-border shadow-sm">
                  <div className="w-7 h-7 rounded-full bg-accent-blue/10 text-accent-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-bold">{i + 1}</span>
                  </div>
                  <span className="text-primary font-bold leading-relaxed pt-0.5">{rec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex-1 bg-background p-6 rounded-2xl border border-border flex items-center justify-center text-center">
              <p className="text-sm font-medium text-secondary">
                No specific actions recommended. Proceed with standard caution.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: What we checked */}
      <div className="bg-card p-6 md:p-10 rounded-3xl border border-border shadow-elevated relative overflow-hidden">
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 text-accent-cyan flex items-center justify-center shadow-sm">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-heading font-extrabold text-primary">What we checked</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          <div className="bg-background p-6 rounded-2xl border border-border flex items-start gap-4 shadow-sm">
            <CheckCircle className="w-6 h-6 text-success mt-0.5 shrink-0" />
            <span className="text-sm font-bold text-primary">{isUrlAnalysis ? 'URL Structure & Domain' : 'Content & Linguistics'}</span>
          </div>
          {isEmailAnalysis && (
            <div className="bg-background p-6 rounded-2xl border border-border flex items-start gap-4 shadow-sm">
              <CheckCircle className="w-6 h-6 text-success mt-0.5 shrink-0" />
              <span className="text-sm font-bold text-primary">Sender Context</span>
            </div>
          )}
          <div className="bg-background p-6 rounded-2xl border border-border flex items-start gap-4 shadow-sm">
            <CheckCircle className="w-6 h-6 text-success mt-0.5 shrink-0" />
            <span className="text-sm font-bold text-primary">Threat Intelligence</span>
          </div>
          {isEmailAnalysis && (
            <div className="bg-background p-6 rounded-2xl border border-border flex items-start gap-4 shadow-sm">
              <CheckCircle className="w-6 h-6 text-success mt-0.5 shrink-0" />
              <span className="text-sm font-bold text-primary">Personalized Baselines</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Forensic Evidence Section */}
      {scan.forensicInvestigationId && (
        <div className="bg-accent-violet/10 p-6 md:p-10 rounded-3xl border border-accent-violet/20 shadow-soft flex flex-col md:flex-row items-center justify-between gap-8 mt-8">
          <div>
            <h2 className="text-2xl font-heading font-extrabold text-primary mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-violet/20 flex items-center justify-center text-accent-violet">
                <Search className="w-5 h-5" />
              </div>
              Forensic Investigation
            </h2>
            <p className="text-base text-secondary font-medium max-w-xl">
              A detailed forensic investigation has been automatically created. Review routing, indicators, and threat intelligence in the Investigation Center.
            </p>
          </div>
          <div className="flex-shrink-0 w-full md:w-auto">
            <Link to={`/security/investigations/${scan.forensicInvestigationId._id || scan.forensicInvestigationId}`}>
              <button className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-accent-violet to-accent-blue text-white rounded-xl font-bold shadow-soft hover:opacity-95 transition-all flex items-center justify-center min-w-[200px]">
                Open Investigation
              </button>
            </Link>
          </div>
        </div>
      )}
      
      {/* Add to My Email Patterns */}
      {isEmailAnalysis && isSafe && (
        <div className="bg-accent-blue/10 p-6 md:p-10 rounded-3xl border border-accent-blue/20 shadow-soft flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-heading font-extrabold text-primary mb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-blue/20 flex items-center justify-center text-accent-blue">
                <BookOpen className="w-5 h-5" />
              </div>
              Add to My Patterns
            </h2>
            <p className="text-base text-secondary font-medium max-w-xl">
              Save this legitimate email to help DetectIQ learn your normal communication patterns, significantly reducing future false positives.
            </p>
          </div>
          <div className="flex gap-4 w-full md:w-auto flex-shrink-0">
            <button 
              className="px-8 py-4 bg-gradient-to-r from-accent-blue to-accent-violet text-white rounded-xl font-bold shadow-soft hover:opacity-95 transition-all flex items-center justify-center min-w-[200px]"
              disabled={personalizeStatus === 'loading' || personalizeStatus === 'success'}
              onClick={handlePersonalize}
            >
              {personalizeStatus === 'loading' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              {personalizeStatus === 'success' ? 'Saved Successfully' : 'Add to Patterns'}
            </button>
            {personalizeStatus !== 'success' && (
              <button 
                className="px-8 py-4 bg-card border border-border text-primary rounded-xl font-bold hover:bg-secondary transition-all shadow-sm"
                onClick={() => setPersonalizeStatus('skipped')}
              >
                Not Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Row 4: Technical Details */}
      <div className="mt-8">
        <button 
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className={`flex items-center justify-between w-full p-8 bg-card hover:bg-secondary border border-border transition-all ${
            showTechnicalDetails ? 'rounded-t-3xl border-b-transparent' : 'rounded-3xl shadow-sm hover:shadow-card'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary text-primary flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <span className="font-heading font-extrabold text-primary text-xl">Technical Details</span>
          </div>
          {showTechnicalDetails ? <ChevronUp className="w-6 h-6 text-muted" /> : <ChevronDown className="w-6 h-6 text-muted" />}
        </button>
        
        {showTechnicalDetails && (
          <div className="space-y-6 animate-in slide-in-from-top-4 duration-300 -mt-8 pt-12 pb-10 px-6 md:px-10 border border-t-0 border-border bg-card rounded-b-3xl">
            <EvidenceCard
              title={isUrlAnalysis ? "URL Safety Checks" : "Message Safety Checks"}
              icon={Search}
              evidence={heuristics}
              emptyMsg="No heuristic signals detected — content appears normal."
            />

            {!isUrlAnalysis && (
              <EvidenceCard
                title="Machine Learning Classifier"
                icon={Cpu}
                evidence={ml}
                emptyMsg="ML classifier was not applicable for this scan."
              />
            )}

            <div className="bg-background p-6 md:p-8 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-primary">Threat Intelligence</h3>
              </div>
              {threatIntel.length > 0 ? (
                <ul className="space-y-4">
                  {threatIntel.map((e, i) => (
                    <li key={i} className="flex gap-4 text-sm bg-card p-5 rounded-2xl border border-border shadow-sm">
                      <Info className={`w-6 h-6 flex-shrink-0 mt-0.5 ${e.severity === 'high' || e.severity === 'critical' ? 'text-danger' : 'text-accent-blue'}`} />
                      <div>
                        <span className="font-bold text-primary text-base">{e.title || e.type} ({e.source}):</span>{" "}
                        <span className="text-secondary font-medium leading-relaxed block mt-1">{e.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-secondary font-medium">No threat intelligence hits for this content.</p>
              )}
            </div>

            {isEmailAnalysis && (
              <EvidenceCard
                title="Email Pattern Comparison"
                icon={BookOpen}
                evidence={personalization}
                emptyMsg="No email history available. Add legitimate emails to My Email Patterns to enable personalized detection."
              />
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-6 pt-4 mt-8">
        <Link to="/detection/scanner" className="flex-1">
          <button className="w-full bg-gradient-to-r from-accent-blue to-accent-violet text-white px-8 py-5 rounded-2xl font-bold shadow-soft hover:opacity-95 transition-all flex items-center justify-center gap-2 text-base">
            Scan Another Item
          </button>
        </Link>
        <Link to="/detection/history" className="flex-1">
          <button className="w-full bg-card border border-border text-primary px-8 py-5 rounded-2xl font-bold shadow-sm hover:bg-secondary transition-colors text-base">
            View Scan History
          </button>
        </Link>
      </div>
    </div>
  );
}

function EvidenceCard({ title, icon: Icon, evidence, emptyMsg }) {
  return (
    <div className="bg-background p-6 md:p-8 rounded-3xl border border-border shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-primary">{title}</h3>
      </div>
      {evidence.length > 0 ? (
        <ul className="space-y-4">
          {evidence.map((e, i) => (
            <li key={i} className="flex gap-4 text-sm bg-card p-5 rounded-2xl border border-border shadow-sm">
              <Info className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
                e.severity === 'high' || e.severity === 'critical' ? 'text-danger' :
                e.severity === 'medium' ? 'text-warning' :
                e.severity === 'info' ? 'text-accent-blue' : 'text-success'
              }`} />
              <div>
                <span className="font-bold text-primary text-base">{e.title || e.type}:</span>{" "}
                <span className="text-secondary font-medium leading-relaxed block mt-1">{e.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-secondary font-medium">{emptyMsg || "No evidence detected in this category."}</p>
      )}
    </div>
  );
}
