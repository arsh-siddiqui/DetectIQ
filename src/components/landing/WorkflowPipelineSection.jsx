import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Sparkles, CheckCircle2 } from "lucide-react";

const workflowSteps = [
  { step: "01", label: "Input", desc: "Provide a suspicious URL, email, text message, QR code, or screenshot." },
  { step: "02", label: "Analyze", desc: "AI, heuristics and threat intelligence engines process target data." },
  { step: "03", label: "Evidence", desc: "We cross-reference with global databases & extract technical proof." },
  { step: "04", label: "Result", desc: "Get an interactive risk score, detailed findings & forensic report." }
];

export default function WorkflowPipelineSection({ onCardClick }) {
  const [activeStage, setActiveStage] = useState(0); // Currently illuminated stage (0..3)
  const [packetPosition, setPacketPosition] = useState(0); // 0 to 100% along the active connector
  const [activeSegment, setActiveSegment] = useState(null); // Segment being illuminated on click (0..2)
  const [cardPulseIndex, setCardPulseIndex] = useState(null); // Stage index receiving click pulse
  
  const containerRef = useRef(null);

  // Check Reduced Motion
  const isReducedMotion = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    isReducedMotion.current = mq.matches;
    const handler = (e) => (isReducedMotion.current = e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    return () => mq.removeEventListener && mq.removeEventListener("change", handler);
  }, []);

  // Continuous background data packet traveling along pipeline (Input -> Analyze -> Evidence -> Result)
  useEffect(() => {
    if (isReducedMotion.current) return;

    let frameId;
    let progress = 0;

    const animatePipeline = () => {
      progress += 0.45; // Speed of continuous data flow
      if (progress >= 100) {
        progress = 0;
        setActiveStage((prev) => (prev + 1) % 4);
      }
      setPacketPosition(progress);
      frameId = requestAnimationFrame(animatePipeline);
    };

    frameId = requestAnimationFrame(animatePipeline);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Handle Card Click Interaction
  const handleStepClick = (e, index) => {
    // Trigger parent click scroll/navigation if provided
    if (onCardClick) onCardClick();

    setCardPulseIndex(index);
    const nextSeg = index < 3 ? index : 0;
    setActiveSegment(nextSeg);

    // Reset pulse state smoothly within 800-1000ms
    setTimeout(() => {
      setCardPulseIndex(null);
      setActiveSegment(null);
    }, 900);
  };

  return (
    <section id="about" ref={containerRef} className="py-20 lg:py-28 bg-transparent border-b border-border relative z-10 scroll-mt-20 overflow-hidden">
      
      {/* Curved Solar / Data Waves Background SVG (Subtle curved paths behind cards) */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-25 z-0" aria-hidden="true">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 400" fill="none">
          <path
            d="M -100 120 C 300 20, 600 220, 1300 80"
            stroke="url(#solarWaveGrad1)"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
          <path
            d="M -100 260 C 400 320, 800 140, 1300 290"
            stroke="url(#solarWaveGrad2)"
            strokeWidth="1.2"
          />
          <defs>
            <linearGradient id="solarWaveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="solarWaveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#2563eb" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* SECTION HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-mono font-bold tracking-wider uppercase mb-3 border border-accent-blue/20 shadow-sm">
            <Cpu className="w-3.5 h-3.5" /> SECURITY PIPELINE
          </div>
          <h2 className="text-3xl md:text-5xl font-heading font-black text-primary mb-4 tracking-tight">
            How DetectIQ Works
          </h2>
          <p className="text-secondary font-medium text-base sm:text-lg">
            A transparent, zero-trust pipeline from submission to evidence explanation.
          </p>
        </motion.div>

        {/* PIPELINE GRID WITH ACTIVE CONNECTOR & PARTICLES */}
        <div className="grid md:grid-cols-4 gap-6 sm:gap-8 relative">
          
          {/* Active Data Pipeline Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-[5.25rem] left-[10%] right-[10%] h-[3px] bg-accent-blue/15 dark:bg-accent-blue/25 rounded-full overflow-hidden">
            
            {/* Glowing Segment on Click */}
            {activeSegment !== null && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-violet shadow-[0_0_12px_rgba(6,182,212,0.8)]"
              />
            )}

            {/* Continuous Travelling Data Packet */}
            {!isReducedMotion.current && (
              <div 
                className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-accent-cyan to-transparent shadow-[0_0_10px_rgba(6,182,212,0.9)] transition-all duration-75"
                style={{ left: `${packetPosition}%` }}
              />
            )}
          </div>

          {/* 4 PIPELINE STAGE CARDS */}
          {workflowSteps.map((step, i) => {
            const isStageActive = activeStage === i;
            const isPulsing = cardPulseIndex === i;

            return (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.03, y: -4, borderColor: "rgba(6, 182, 212, 0.45)" }}
                whileTap={{ scale: 0.97 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                onClick={(e) => handleStepClick(e, i)}
                className={`relative z-10 flex flex-col items-center text-center p-8 rounded-3xl bg-white/85 dark:bg-card/85 backdrop-blur-md border border-border/80 shadow-sm hover:shadow-elevated transition-all cursor-pointer group ${
                  isPulsing ? "ring-2 ring-accent-cyan/60 border-accent-cyan shadow-[0_0_25px_rgba(6,182,212,0.25)]" : ""
                }`}
              >
                {/* Click Soft Circular Rings Pulse */}
                <AnimatePresence>
                  {isPulsing && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: 1.35, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.85, ease: "easeOut" }}
                      className="absolute inset-0 rounded-3xl border-2 border-accent-cyan pointer-events-none"
                    />
                  )}
                </AnimatePresence>

                {/* Step Circle Badge with Dynamic Glow */}
                <div 
                  className={`w-12 h-12 rounded-full font-mono font-bold text-sm flex items-center justify-center transition-all duration-300 mb-6 relative ${
                    isStageActive || isPulsing
                      ? "bg-accent-blue text-white shadow-[0_0_16px_rgba(37,99,235,0.5)] scale-110"
                      : "bg-accent-blue/10 text-accent-blue group-hover:bg-accent-blue group-hover:text-white"
                  }`}
                >
                  {step.step}

                  {/* Stage arrival pulse ring */}
                  {(isStageActive || isPulsing) && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-accent-cyan/30 pointer-events-none" />
                  )}
                </div>

                <h3 className="text-lg font-bold text-primary mb-2 font-heading group-hover:text-accent-blue transition-colors">
                  {step.label}
                </h3>
                <p className="text-xs sm:text-sm text-secondary leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
