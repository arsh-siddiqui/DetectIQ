import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, ShieldAlert, Mail, Eye, Lock, ArrowRight, 
  CheckCircle2, Sparkles, AlertTriangle, ExternalLink, Download, Layers,
  Globe, Zap
} from "lucide-react";

function ChromeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="21.17" y1="8" x2="12" y2="8" />
      <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
      <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
    </svg>
  );
}

const EXTENSION_FEATURES = [
  {
    id: "hover",
    name: "Pre-Click Hover Shield",
    icon: Eye,
    tag: "Real-time Inspection",
    headline: "Know Where Links Go Before You Click",
    desc: "Hover over any link across the web to preview its full destination, brand spoofing risk, and threat intelligence score without triggering tracking pixels or drive-by payloads.",
    preview: {
      url: "https://paypa1-login.security-verify.net/auth",
      targetText: "Confirm your account identity immediately",
      verdict: "PHISHING DETECTED",
      score: 94,
      details: ["IDN lookalike character detected", "Domain registered 48h ago", "Matches known credential harvest lure"]
    }
  },
  {
    id: "webmail",
    name: "Webmail Shield (Gmail)",
    icon: Mail,
    tag: "Native Inbox Defense",
    headline: "One-Click Email Forensics Right in Gmail",
    desc: "DetectIQ injects a discrete, privacy-preserving scanner bar into Gmail and webmail providers. Inspect SPF/DKIM authentication, spoofed sender headers, and malicious attachments with zero friction.",
    preview: {
      from: "security@paypa1-support.com",
      subject: "Urgent: Unusual sign-in activity detected on your wallet",
      verdict: "SUSPICIOUS SENDER",
      score: 88,
      details: ["SPF Failed: IP not authorized for paypal.com", "DKIM Signature missing", "High urgency emotional trigger detected"]
    }
  },
  {
    id: "form",
    name: "Credential Phishing Interceptor",
    icon: Lock,
    tag: "Zero-Trust Form Guard",
    headline: "Instant Shield When Entering Sensitive Passwords",
    desc: "DetectIQ continuously checks form action targets. If you begin typing credentials into an unverified or recently registered domain masquerading as a major brand, an instant shadow-DOM warning alerts you before submission.",
    preview: {
      site: "http://microsoft-365-login-verify.top",
      verdict: "CREDENTIAL HARVESTING BLOCKED",
      score: 96,
      details: ["Non-SSL login form submission", "Brand displacement against Microsoft", "Shadow DOM shield actively engaged"]
    }
  }
];

export default function ExtensionShowcase() {
  const [activeTab, setActiveTab] = useState("hover");
  const [showInstallModal, setShowInstallModal] = useState(false);

  const activeFeature = EXTENSION_FEATURES.find(f => f.id === activeTab) || EXTENSION_FEATURES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16 max-w-3xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-mono font-bold tracking-wider uppercase mb-4 border border-accent-blue/20">
          <ChromeIcon className="w-3.5 h-3.5 text-accent-cyan" /> BROWSER EXTENSION (MANIFEST V3)
        </div>
        <h2 className="text-3xl md:text-5xl font-heading font-black text-primary mb-4 tracking-tight leading-tight">
          DetectIQ In Your Browser
        </h2>
        <p className="text-secondary font-medium text-base sm:text-lg leading-relaxed">
          Active real-time protection while you browse. Intercept deceptive links, inspect suspicious Gmail messages, and stop credential harvesting before it starts.
        </p>
      </motion.div>

      {/* Main Interactive Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-12">
        {/* Left: Feature Selection Buttons */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {EXTENSION_FEATURES.map((feature) => {
            const Icon = feature.icon;
            const isSelected = activeTab === feature.id;
            return (
              <motion.button
                key={feature.id}
                whileHover={{ scale: 1.01, x: 4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveTab(feature.id)}
                className={`p-5 rounded-2xl text-left border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-card border-accent-blue shadow-glow"
                    : "bg-card/60 border-border/70 hover:bg-card/90 hover:border-accent-blue/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isSelected ? "bg-accent-blue text-white" : "bg-accent-blue/10 text-accent-blue"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-heading font-bold text-primary text-base">
                      {feature.name}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-accent-blue/20 text-accent-blue" : "bg-secondary/40 text-muted"
                  }`}>
                    {feature.tag}
                  </span>
                </div>
                <p className="text-xs text-secondary leading-relaxed pl-10">
                  {feature.desc}
                </p>
              </motion.button>
            );
          })}

          {/* Quick Stat Pill */}
          <div className="mt-2 p-4 rounded-2xl bg-card/40 border border-border/60 flex items-center justify-between text-xs font-mono text-muted">
            <span className="flex items-center gap-2 text-primary font-bold">
              <CheckCircle2 className="w-4 h-4 text-accent-cyan" /> 46/46 Automated Tests Passing
            </span>
            <span className="text-accent-blue font-bold">Manifest V3 Compliant</span>
          </div>
        </div>

        {/* Right: Live Interactive Simulation Card */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature.id}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -10 }}
              transition={{ duration: 0.3 }}
              className="bg-card/90 border border-accent-blue/40 rounded-3xl p-6 sm:p-8 shadow-elevated backdrop-blur-xl relative overflow-hidden"
            >
              {/* Subtle accent glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/15 rounded-full blur-3xl pointer-events-none" />

              {/* Simulation Header Bar */}
              <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-danger/80" />
                  <span className="w-3 h-3 rounded-full bg-warning/80" />
                  <span className="w-3 h-3 rounded-full bg-success/80" />
                  <span className="text-xs font-mono text-muted ml-2">DetectIQ Shield Active — Chrome Tab</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-danger/10 border border-danger/30 text-danger text-[11px] font-mono font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" /> {activeFeature.preview.verdict}
                </div>
              </div>

              {/* Simulation Content Body */}
              <div className="space-y-4">
                {activeFeature.id === "hover" && (
                  <div className="p-4 rounded-xl bg-background/80 border border-border">
                    <div className="text-xs text-muted font-mono mb-1">Simulated User Link:</div>
                    <div className="text-sm font-semibold text-primary underline decoration-accent-blue decoration-2 cursor-pointer mb-3">
                      {activeFeature.preview.targetText}
                    </div>
                    {/* Floating Overlay Badge Mock */}
                    <div className="p-3.5 rounded-lg bg-card border border-accent-blue/60 shadow-soft">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-mono text-muted">Inspected Destination:</span>
                        <span className="font-mono font-bold text-danger">Risk Score: {activeFeature.preview.score}/100</span>
                      </div>
                      <div className="font-mono text-xs text-danger break-all font-semibold">
                        {activeFeature.preview.url}
                      </div>
                    </div>
                  </div>
                )}

                {activeFeature.id === "webmail" && (
                  <div className="p-4 rounded-xl bg-background/80 border border-border space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-muted">From: <strong className="text-danger">{activeFeature.preview.from}</strong></span>
                      <span className="text-danger font-bold">Score: {activeFeature.preview.score}/100</span>
                    </div>
                    <div className="text-sm font-bold text-primary">
                      {activeFeature.preview.subject}
                    </div>
                    <div className="p-2.5 rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-accent-blue text-xs flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold">
                        <ShieldCheck className="w-4 h-4" /> DetectIQ In-Gmail Security Banner
                      </span>
                      <span className="font-mono text-[10px] font-bold uppercase bg-accent-blue text-white px-2 py-0.5 rounded">Scanned</span>
                    </div>
                  </div>
                )}

                {activeFeature.id === "form" && (
                  <div className="p-4 rounded-xl bg-background/80 border border-border space-y-3">
                    <div className="text-xs font-mono text-muted">Target Submission Host:</div>
                    <div className="text-sm font-mono text-danger font-bold break-all">
                      {activeFeature.preview.site}
                    </div>
                    <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/40 text-danger text-xs font-semibold flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      <span>Shadow-DOM Guard: Blocked plaintext transmission of credentials to unverified host.</span>
                    </div>
                  </div>
                )}

                {/* Technical Reasons List */}
                <div className="p-4 rounded-2xl bg-card border border-border/70 space-y-2">
                  <div className="text-xs font-mono text-muted uppercase tracking-wider font-bold mb-2">
                    Heuristic & Global Threat Evidence:
                  </div>
                  {activeFeature.preview.details.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 text-xs text-secondary font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-blue flex-shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Interactive Trigger */}
              <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs font-medium text-secondary">
                  Works seamlessly in Google Chrome, Microsoft Edge, Brave & Opera.
                </span>
                <button
                  onClick={() => setShowInstallModal(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-soft transition-all"
                >
                  <ChromeIcon className="w-4 h-4" />
                  <span>Get Extension</span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Extension Install Instructions Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInstallModal(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-accent-blue/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-elevated relative"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                  <ChromeIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-primary text-lg">Load DetectIQ in Chrome</h3>
                  <p className="text-xs text-muted">Developer Mode / Local Unpacked Installation</p>
                </div>
              </div>

              <div className="space-y-3.5 my-6 text-xs text-secondary leading-relaxed">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border">
                  <span className="w-5 h-5 rounded-full bg-accent-blue/20 text-accent-blue font-bold flex items-center justify-center flex-shrink-0 text-[11px]">1</span>
                  <span>Open your browser and navigate to <code className="px-1.5 py-0.5 rounded bg-card text-accent-blue font-mono">chrome://extensions</code></span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border">
                  <span className="w-5 h-5 rounded-full bg-accent-blue/20 text-accent-blue font-bold flex items-center justify-center flex-shrink-0 text-[11px]">2</span>
                  <span>Enable <strong>Developer mode</strong> in the top-right corner of the Extensions page.</span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border">
                  <span className="w-5 h-5 rounded-full bg-accent-blue/20 text-accent-blue font-bold flex items-center justify-center flex-shrink-0 text-[11px]">3</span>
                  <span>Click <strong>Load unpacked</strong> and select the <code className="px-1.5 py-0.5 rounded bg-card text-accent-blue font-mono">extension</code> folder from the repository.</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 text-primary text-xs font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
