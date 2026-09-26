import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  ArrowRight, ShieldCheck, Mail, Link as LinkIcon, MessageSquare, QrCode, Image as ImageIcon, 
  Brain, FileSearch, GraduationCap, ChevronRight, Activity, Search, ShieldAlert, CheckCircle2, 
  Map as MapIcon, Database, Lock, Cpu, Sparkles, BookOpen, FileText, Download, ChevronDown, HelpCircle 
} from "lucide-react";

import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import CyberBackground from "../components/landing/CyberBackground";
import HeroSection from "../components/landing/HeroSection";
import ThreatAnalysisDemo from "../components/landing/ThreatAnalysisDemo";

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
  { step: "01", label: "Input", desc: "Provide a suspicious URL, email, text message, QR code, or screenshot." },
  { step: "02", label: "Analyze", desc: "AI, heuristics and threat intelligence engines process target data." },
  { step: "03", label: "Evidence", desc: "We cross-reference with global databases & extract technical proof." },
  { step: "04", label: "Result", desc: "Get an interactive risk score, detailed findings & forensic report." }
];

const faqItems = [
  {
    q: "How does DetectIQ analyze suspicious URLs and links in real time?",
    a: "DetectIQ processes target data through a multi-engine security pipeline: machine learning heuristic models, domain age tracking, homoglyph lookalike detection, SPF/DKIM header alignment, and real-time threat intelligence feeds to extract technical evidence instantly."
  },
  {
    q: "What makes DetectIQ different from traditional URL scanners?",
    a: "Traditional scanners rely solely on static blocklists. DetectIQ combines zero-trust heuristics, AI intent analysis, brand displacement scoring, and interactive forensic reports so you understand why a link is dangerous—not just a binary pass/fail result."
  },
  {
    q: "What technical evidence is included in deep forensic reports?",
    a: "Reports include risk scores, SSL certificate validity, brand displacement scores, SPF/DKIM authentication flags, extracted routing headers, and actionable mitigation guidance."
  },
  {
    q: "How does the Risk Score radial gauge evaluate threats?",
    a: "The 0–100 Risk Score aggregates evidence across technical indicators (SSL status, redirect hops, brand spoofing, domain age, and blacklist matches). Scores above 70 indicate High Threat Severity requiring immediate quarantine."
  },
  {
    q: "How does the AI Security Copilot assist security analysts?",
    a: "The AI Security Copilot synthesizes complex technical indicators into plain-language executive summaries, highlighting actionable mitigation steps, sender red flags, and recommended defense actions."
  }
];

function FaqItem({ faq, index }) {
  const [isOpen, setIsOpen] = useState(index === 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-background border border-border rounded-2xl overflow-hidden shadow-sm"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 hover:bg-secondary/40 transition-colors cursor-pointer"
      >
        <span className="font-heading font-bold text-primary text-base sm:text-lg flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-accent-blue flex-shrink-0" />
          {faq.q}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border/60 bg-card/40"
          >
            <p className="px-6 py-5 text-sm text-secondary leading-relaxed font-medium">
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const demoSectionRef = useRef(null);
  const featuresSectionRef = useRef(null);

  const scrollToDemo = () => {
    const el = document.getElementById("investigate") || document.getElementById("live-demo-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (demoSectionRef.current) {
      demoSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToExplore = () => {
    const el = document.getElementById("features");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (featuresSectionRef.current) {
      featuresSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="bg-background min-h-screen text-primary selection:bg-accent-blue/30 relative overflow-x-hidden font-sans">
      <Navbar />

      {/* BACKGROUND VISUAL LAYER */}
      <CyberBackground />

      {/* HERO SECTION */}
      <div id="hero">
        <HeroSection 
          onRunScanClick={scrollToDemo} 
          onExploreClick={scrollToExplore} 
        />
      </div>

      {/* CAPABILITY STRIP */}
      <section className="border-y border-border bg-card/70 backdrop-blur-md relative z-10 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
            {capabilities.map((cap, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2, delay: i * 0.08 }}
                onClick={scrollToDemo}
                className="py-6 px-4 flex flex-col items-center justify-center text-center gap-2.5 group hover:bg-secondary/60 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-accent-blue group-hover:text-white transition-all shadow-sm">
                  <cap.icon className="w-5 h-5 text-accent-blue group-hover:text-white transition-colors" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-primary group-hover:text-accent-blue transition-colors">{cap.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES GRID (FEATURES SECTION) */}
      <section id="features" ref={featuresSectionRef} className="py-20 lg:py-28 bg-card/60 border-b border-border relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16 max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 text-accent-cyan text-xs font-mono font-bold tracking-wider uppercase mb-3 border border-accent-cyan/20">
              <Sparkles className="w-3.5 h-3.5" /> ADVANCED THREAT CAPABILITIES
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-black text-primary mb-4 tracking-tight">
              Comprehensive Detection Suite
            </h2>
            <p className="text-secondary font-medium text-base sm:text-lg">
              Every forensic tool you need to analyze, understand, and neutralize digital threats across all channels.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ 
                  scale: 1.03, 
                  y: -5, 
                  borderColor: "rgba(6, 182, 212, 0.5)",
                  boxShadow: "0 12px 35px -10px rgba(37, 99, 235, 0.22)"
                }}
                whileTap={{ scale: 0.97 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: i * 0.06 }}
                onClick={scrollToDemo}
                className="bg-background border border-border p-6 rounded-2xl shadow-sm hover:shadow-elevated transition-all duration-200 group flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-accent-blue/10 flex items-center justify-center mb-5 group-hover:bg-accent-blue group-hover:text-white transition-all group-hover:rotate-6">
                    <feature.icon className="w-6 h-6 text-accent-blue group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-base font-bold text-primary mb-2 font-heading group-hover:text-accent-blue transition-colors">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-secondary leading-relaxed">{feature.description}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 flex items-center gap-1 text-xs font-mono font-bold text-accent-blue opacity-70 group-hover:opacity-100 transition-opacity">
                  <span>EXPLORE MODULE</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (TIMELINE WORKFLOW - ABOUT SECTION) */}
      <section id="about" className="py-20 lg:py-28 bg-background border-b border-border relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16 max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-mono font-bold tracking-wider uppercase mb-3 border border-accent-blue/20">
              <Cpu className="w-3.5 h-3.5" /> SECURITY PIPELINE
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-black text-primary mb-4 tracking-tight">
              How DetectIQ Works
            </h2>
            <p className="text-secondary font-medium text-base sm:text-lg">
              A transparent, zero-trust pipeline from submission to evidence explanation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6 sm:gap-8 relative">
            {/* Connecting line on desktop */}
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-[2px] bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-violet opacity-30" />
            
            {workflowSteps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.04, y: -4, borderColor: "rgba(37, 99, 235, 0.5)" }}
                whileTap={{ scale: 0.97 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                onClick={scrollToDemo}
                className="relative z-10 flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-card transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-background border border-border shadow-inner flex items-center justify-center font-mono font-black text-xl text-accent-blue group-hover:scale-110 group-hover:bg-accent-blue group-hover:text-white transition-all mb-5">
                  {step.step}
                </div>
                <h3 className="text-lg font-bold text-primary mb-2 font-heading group-hover:text-accent-blue transition-colors">{step.label}</h3>
                <p className="text-xs sm:text-sm text-secondary leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* INVESTIGATE SECTION (INTERACTIVE THREAT ANALYSIS SCANNER) */}
      <section id="investigate" ref={demoSectionRef} className="py-20 lg:py-28 relative z-10 scroll-mt-20 border-b border-border">
        <ThreatAnalysisDemo />
      </section>

      {/* RESOURCES SECTION (KNOWLEDGEBASE, FAQS & DOCUMENTATION) */}
      <section id="resources" className="py-20 lg:py-28 bg-card/60 relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16 max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-mono font-bold tracking-wider uppercase mb-3 border border-accent-blue/20">
              <BookOpen className="w-3.5 h-3.5" /> SECURITY RESOURCES
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-black text-primary mb-4 tracking-tight">
              Knowledgebase & FAQs
            </h2>
            <p className="text-secondary font-medium text-base sm:text-lg">
              Frequently asked questions about DetectIQ threat analysis, AI detection models, and privacy standards.
            </p>
          </motion.div>

          {/* INTERACTIVE FAQ ACCORDION */}
          <div className="max-w-3xl mx-auto space-y-4">
            {faqItems.map((faq, i) => (
              <FaqItem key={i} faq={faq} index={i} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
