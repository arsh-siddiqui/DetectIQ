import React from "react";
import { motion } from "framer-motion";
import { Shield, Activity, Cpu, ArrowRight, Sparkles, CheckCircle, Search, Database, Lock, Eye } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";

export default function HeroSection({ onRunScanClick, onExploreClick }) {
  const { theme } = useAppData();
  const isDark = theme === "dark";

  return (
    <section className="relative pt-8 pb-12 lg:pt-14 lg:pb-20 overflow-hidden text-primary z-10 select-none">
      
      {/* LAYER 1: Integrated Theme-Specific Cybersecurity Background Image */}
      <div 
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-500 pointer-events-none z-0 ${
          isDark ? "opacity-75" : "opacity-90"
        }`}
        style={{
          backgroundImage: `url(${isDark ? '/assets/hero-cyber-dark-bg.jpg' : '/assets/hero-cyber-bg.jpg'})`
        }}
      />

      {/* LAYER 2: Soft Theme-Matched Gradient Overlay for Text Contrast */}
      <div className={`absolute inset-0 transition-all duration-500 pointer-events-none z-0 ${
        isDark 
          ? "bg-gradient-to-b from-background/40 via-background/70 to-background" 
          : "bg-gradient-to-b from-background/20 via-background/40 to-background"
      }`} />

      {/* LAYER 3: Hero Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Prominent & Modern DETECTIQ Badge with Outfit Brand Font */}
        <div className="flex justify-center mb-8">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center px-6 py-2.5 rounded-full bg-card/95 border border-accent-blue/30 dark:border-accent-blue/50 backdrop-blur-md shadow-card hover:border-accent-blue hover:shadow-glow transition-all cursor-pointer group"
          >
            <span className="text-lg sm:text-xl font-heading font-black tracking-[0.18em] uppercase text-primary group-hover:text-accent-blue transition-colors">
              DETECTIQ
            </span>
          </motion.div>
        </div>

        <div className="text-center max-w-4xl mx-auto">
          {/* Status indicators */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8"
          >
            {[
              { label: "[ DETECTION READY ]", icon: Cpu, color: "accent-blue" },
              { label: "[ THREAT ENGINE ]", icon: Shield, color: "accent-cyan" },
              { label: "[ REAL-TIME ANALYSIS ]", icon: Activity, color: "accent-violet" }
            ].map((badge, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3.5 py-1.5 rounded-lg bg-${badge.color}/10 border border-${badge.color}/30 text-${badge.color} text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 shadow-sm cursor-pointer hover:bg-${badge.color}/20 transition-all backdrop-blur-md`}
              >
                <badge.icon className="w-3.5 h-3.5" />
                <span>{badge.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Large headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-heading font-black tracking-tight leading-[1.08] mb-6"
          >
            <span className="block text-primary">Detect the threat.</span>
            <span className="bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-violet bg-clip-text text-transparent block">
              Understand the evidence.
            </span>
          </motion.h1>

          {/* Supporting text */}
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-base sm:text-lg lg:text-xl text-secondary font-medium leading-relaxed max-w-3xl mx-auto mb-10"
          >
            DetectIQ analyzes suspicious links, emails, messages, QR codes and screenshots to identify threats and explain the evidence behind them.
          </motion.p>

          {/* Action CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <motion.button
              whileHover={{ 
                scale: 1.03, 
                y: -2,
                boxShadow: "0 0 30px rgba(37, 99, 235, 0.45)"
              }}
              whileTap={{ scale: 0.95, y: 1 }}
              onClick={onRunScanClick}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white font-bold rounded-xl shadow-soft transition-all duration-200 flex items-center justify-center gap-3 group text-base cursor-pointer"
            >
              <span>Run Threat Analysis</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-200" />
            </motion.button>

            <motion.button
              whileHover={{ 
                scale: 1.03, 
                y: -2,
                borderColor: "rgba(37, 99, 235, 0.6)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)"
              }}
              whileTap={{ scale: 0.95, y: 1 }}
              onClick={onExploreClick}
              className="w-full sm:w-auto px-8 py-4 bg-card/90 border border-border text-primary hover:bg-secondary/80 font-bold rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 text-base cursor-pointer backdrop-blur-md"
            >
              <span>Explore DetectIQ</span>
            </motion.button>
          </motion.div>

          {/* Input channels summary chips */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-mono text-muted uppercase tracking-wider"
          >
            <span className="text-secondary font-bold mr-1">5 Detection Vectors:</span>
            {["Suspicious URLs", "Emails", "Messages", "QR Codes", "Screenshots"].map((vector, i) => (
              <motion.span 
                key={i} 
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/80 border border-border/80 hover:border-accent-blue/50 text-primary font-medium cursor-pointer transition-all shadow-sm backdrop-blur-md"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                {vector}
              </motion.span>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
