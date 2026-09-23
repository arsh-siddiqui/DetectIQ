import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, PlayCircle, ShieldCheck, Mail, Link as LinkIcon, MessageSquare, QrCode, Image as ImageIcon, Brain, FileSearch, GraduationCap, ChevronRight, Activity, Search, ShieldAlert, CheckCircle2, Map as MapIcon, Database, AlertTriangle } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";

const capabilities = [
  { icon: ShieldAlert, text: "Automated Threat Enrichment" },
  { icon: Brain, text: "AI Security Copilot" },
  { icon: FileSearch, text: "Deep Forensic Reports" },
  { icon: MapIcon, text: "Global Intelligence Mapping" }
];

const features = [
  { title: "AI Security Copilot", icon: Brain, description: "Analyze headers, indicators, and routing with our intelligent interactive assistant." },
  { title: "Threat Intelligence Map", icon: MapIcon, description: "Visualize the geographic origin and severity of malicious IPs globally." },
  { title: "Forensic Reporting", icon: FileSearch, description: "Generate detailed, actionable reports outlining risk scores, AI findings, and evidence." },
  { title: "Interactive Threat Graph", icon: Activity, description: "Trace the connections between domains, emails, and threats visually in 2D space." },
  { title: "Multi-Source Enrichment", icon: Search, description: "Automatically cross-reference indicators with global databases like VirusTotal." },
  { title: "Email Detection", icon: Mail, description: "Analyze senders, links, and intent using AI and personalized baselines." },
  { title: "Personalized Patterns", icon: ShieldCheck, description: "Compare new emails against patterns from your trusted email history." },
  { title: "Vulnerability Learning", icon: GraduationCap, description: "Master security concepts with interactive, bite-sized lessons based on your profile." },
];

const workflowSteps = [
  { step: "01", label: "Input", desc: "Provide an email, URL, text, QR, or image." },
  { step: "02", label: "Analyze", desc: "AI and threat engines process the data instantly." },
  { step: "03", label: "Evidence", desc: "We cross-reference with global databases & your patterns." },
  { step: "04", label: "Result", desc: "Get a clear risk score and actionable recommendation." }
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="bg-background min-h-screen text-primary selection:bg-accent-blue/30">
      <Navbar />

      {/* HERO SECTION */}
      <section 
        className="relative pt-10 pb-20 lg:pt-16 lg:pb-28 overflow-hidden min-h-[calc(88vh-68px)] flex items-center bg-no-repeat bg-cover bg-[center_right] sm:bg-[center_right_15%] lg:bg-center transition-colors duration-300"
        style={{
          backgroundImage: "url('/assets/detectiq-cyber-hero.png')",
        }}
      >
        {/* Subtle left-to-right atmospheric gradient overlay */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to right, rgba(248, 250, 255, 0.92) 0%, rgba(248, 250, 255, 0.55) 50%, rgba(248, 250, 255, 0.05) 100%)"
          }}
        />

        <div className="max-w-[1400px] w-full mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
          
          {/* Left-aligned Hero Content */}
          <div className="flex flex-col items-start text-left max-w-xl lg:max-w-[580px] xl:max-w-[640px]">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-blue/15 border border-accent-blue/30 text-[#315B8A] text-[10px] sm:text-xs font-bold tracking-wide uppercase mb-6 sm:mb-8 shadow-sm backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
              Live Threat Scan Active &bull; Zero-Trust Validation
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-heading font-black leading-[1.05] tracking-tight mb-6">
              <span className="block text-[#07152B]">Detect. Defend.</span>
              <span className="block bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-violet bg-clip-text text-transparent pb-1">Stay Ahead.</span>
            </h1>
            
            <p className="text-base sm:text-lg text-[#263B59] font-medium leading-relaxed mb-6">
              Detect threats across emails, URLs, messages, QR codes, and screenshots with AI-powered analysis, threat intelligence, and forensic investigation.
            </p>
            
            {/* 5 Input Channels Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {["Email", "URL", "Message", "QR Code", "Screenshot"].map((channel) => (
                <div key={channel} className="px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#315B8A]/20 text-[#07152B] text-xs font-semibold flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" /> {channel}
                </div>
              ))}
            </div>

            {/* Workflow Process */}
            <div className="flex flex-wrap items-center gap-2 mb-8 sm:mb-10 text-xs font-bold uppercase tracking-wider text-[#315B8A]">
              <div className="flex items-center gap-1.5 text-accent-blue"><Search size={14}/> Detect</div>
              <ChevronRight size={12} className="text-[#315B8A]/70" />
              <div className="flex items-center gap-1.5 text-accent-cyan"><Database size={14}/> Enrich</div>
              <ChevronRight size={12} className="text-[#315B8A]/70" />
              <div className="flex items-center gap-1.5 text-accent-violet"><Activity size={14}/> Investigate</div>
              <ChevronRight size={12} className="text-[#315B8A]/70" />
              <div className="flex items-center gap-1.5 text-[#07152B]"><Brain size={14}/> Explain</div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <button 
                onClick={() => navigate("/register")}
                className="px-8 py-3.5 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white rounded-xl font-bold shadow-soft transition-all text-sm sm:text-base inline-flex items-center gap-2"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate("/detection/email")}
                className="px-8 py-3.5 bg-white/85 hover:bg-white border border-[#315B8A]/25 text-[#07152B] rounded-xl font-bold transition-all text-sm sm:text-base shadow-sm backdrop-blur-sm"
              >
                Explore Detection
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* CAPABILITY STRIP */}
      <section className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {capabilities.map((cap, i) => (
              <div key={i} className="py-6 px-4 flex flex-col items-center justify-center text-center gap-3">
                <cap.icon className="w-6 h-6 text-accent-blue" />
                <span className="text-sm font-bold text-primary">{cap.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (TIMELINE) */}
      <section className="py-24 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-black text-primary mb-4">How DetectIQ Works</h2>
            <p className="text-secondary font-medium">A seamless pipeline from submission to security.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-[2px] bg-border" />
            
            {workflowSteps.map((step, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center font-heading font-black text-xl text-accent-blue mb-6">
                  {step.step}
                </div>
                <h3 className="text-lg font-bold text-primary mb-2">{step.label}</h3>
                <p className="text-sm text-secondary leading-relaxed px-4">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-24 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-heading font-black text-primary mb-4">Comprehensive Detection Suite</h2>
            <p className="text-secondary font-medium text-lg">Every tool you need to analyze, understand, and neutralize digital threats across all channels.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="bg-background border border-border p-6 rounded-3xl hover:border-accent-blue/30 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-accent-blue/10 flex items-center justify-center mb-6 group-hover:bg-accent-blue/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-accent-blue" />
                </div>
                <h3 className="text-base font-bold text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY LEARNING SECTION */}
      <section className="py-24 bg-background border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-accent-blue/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2">
            <h2 className="text-3xl md:text-4xl font-heading font-black text-primary mb-6">Learn to spot what AI spots.</h2>
            <p className="text-lg text-secondary leading-relaxed mb-8">
              Detection is only half the battle. DetectIQ helps you understand common security vulnerabilities, recognize warning signs, assess your knowledge, and build better security awareness.
            </p>
            <ul className="space-y-4 mb-10">
              {[
                "Real-world threat scenarios",
                "Easy-to-understand vulnerability lessons",
                "Personalized progress tracking",
                "Quick security assessments"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-primary font-medium">
                  <CheckCircle2 className="w-5 h-5 text-accent-blue" />
                  {item}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => navigate("/vulnerabilities")}
              className="px-6 py-3 bg-card border border-border hover:border-primary text-primary rounded-xl font-bold transition-all inline-flex items-center gap-2 shadow-sm"
            >
              Explore Learning
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="lg:w-1/2 w-full">
            <div className="bg-card border border-border p-8 rounded-3xl shadow-elevated">
              <div className="mb-6">
                <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Vulnerability</div>
                <div className="text-2xl font-heading font-bold text-primary">Phishing</div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">What is it?</div>
                  <div className="p-4 bg-background rounded-xl border border-border text-sm text-secondary">
                    A deceptive attempt to obtain sensitive information.
                  </div>
                </div>
                
                <div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">How to recognize</div>
                  <div className="p-4 bg-accent-blue/10 rounded-xl border border-accent-blue/20 text-sm text-primary">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Urgent requests</li>
                      <li>Suspicious links</li>
                      <li>Sender mismatch</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Prevention</div>
                  <div className="p-4 bg-success/10 rounded-xl border border-success/20 text-sm text-success font-medium">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Verify the sender</li>
                      <li>Use official websites</li>
                      <li>Avoid unexpected links</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 bg-card text-center px-6">
        <div className="max-w-3xl mx-auto">
          <ShieldCheck className="w-16 h-16 text-accent-blue mx-auto mb-8" />
          <h2 className="text-4xl md:text-5xl font-heading font-black text-primary mb-6">Stay ahead of digital threats with DetectIQ.</h2>
          <p className="text-xl text-secondary mb-10 max-w-xl mx-auto">
            Join the platform that combines elite AI detection with interactive security learning.
          </p>
          <button 
            onClick={() => navigate("/register")}
            className="px-10 py-5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-xl font-bold shadow-soft transition-all text-lg"
          >
            Create Your Account
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
