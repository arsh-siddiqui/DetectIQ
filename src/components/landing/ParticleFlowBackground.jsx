import React, { useEffect, useRef } from "react";

/**
 * ParticleFlowBackground — Unified background and interaction component across DetectIQ.
 * Supported variants:
 * - "landing" / "subtle" (default): full dynamic flow (~65 particles, 4 solar waves)
 * - "scanner": active threat detection engine (~45-55 particles, dynamic data flow curves)
 * - "dashboard": calm intelligence center (~25-35 particles, soft atmospheric streams)
 * - "history": clean & trustworthy (~15-25 particles, minimal horizontal data flow)
 */
export default function ParticleFlowBackground({ variant = "landing" }) {
  const bgCanvasRef = useRef(null);
  const fgCanvasRef = useRef(null);

  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (!bgCanvas || !fgCanvas) return;

    const bgCtx = bgCanvas.getContext("2d", { alpha: true });
    const fgCtx = fgCanvas.getContext("2d", { alpha: true });
    if (!bgCtx || !fgCtx) return;

    let animationFrameId;
    let width = (bgCanvas.width = fgCanvas.width = window.innerWidth);
    let height = (bgCanvas.height = fgCanvas.height = window.innerHeight);

    // Reduced Motion & Visibility Checks
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isReducedMotion = mediaQuery.matches;

    const handleMotionChange = (e) => {
      isReducedMotion = e.matches;
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMotionChange);
    }

    // State Tracking
    const state = {
      mouse: {
        x: width / 2,
        y: height / 3,
        targetX: width / 2,
        targetY: height / 3,
        isHovered: false,
        hudRotation: 0
      },
      scrollProgress: 0,
      pulses: [], // Click security pulses
      time: 0
    };

    // Determine configuration based on variant & screen size
    const isMobile = width < 768;
    
    let baseParticleCount = 65;
    let baseWaveCount = 4;
    let baseOpacityScale = 1.0;
    let baseSpeedScale = 1.0;

    if (variant === "scanner") {
      baseParticleCount = isMobile ? 25 : 50;
      baseWaveCount = isMobile ? 2 : 3;
      baseOpacityScale = 0.9;
      baseSpeedScale = 1.1;
    } else if (variant === "dashboard") {
      baseParticleCount = isMobile ? 18 : 30;
      baseWaveCount = isMobile ? 1 : 2;
      baseOpacityScale = 0.6;
      baseSpeedScale = 0.7;
    } else if (variant === "history") {
      baseParticleCount = isMobile ? 12 : 20;
      baseWaveCount = 1;
      baseOpacityScale = 0.45;
      baseSpeedScale = 0.5;
    } else {
      // Landing / Subtle
      baseParticleCount = isMobile ? 30 : 65;
      baseWaveCount = isMobile ? 2 : 4;
      baseOpacityScale = 1.0;
      baseSpeedScale = 1.0;
    }

    // 1. Generate Particles
    const particles = [];
    const colors = [
      "rgba(37, 99, 235, ",  // Primary Blue #2563EB
      "rgba(6, 182, 212, ",  // Cyan #06B6D4
      "rgba(124, 58, 237, "  // Soft Violet #7C3AED
    ];

    for (let i = 0; i < baseParticleCount; i++) {
      const colorIdx = i % 10 === 0 ? 2 : (i % 3 === 0 ? 1 : 0);
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: (Math.random() * 1.5 + 1.2) * (variant === "history" ? 0.85 : 1.0),
        colorPrefix: colors[colorIdx],
        baseOpacity: (Math.random() * 0.22 + 0.1) * baseOpacityScale,
        speed: (Math.random() * 0.4 + 0.2) * baseSpeedScale,
        pathOffset: Math.random() * Math.PI * 2,
        flowAngle: variant === "history" ? 0 : (Math.random() - 0.5) * 0.4,
        pulseBrightness: 0
      });
    }

    // 2. Flowing Waves (Bezier Curves)
    const waves = [];
    for (let i = 0; i < baseWaveCount; i++) {
      waves.push({
        yRatio: (i + 1) / (baseWaveCount + 1),
        amplitude: Math.random() * 50 + 30,
        frequency: Math.random() * 0.0012 + 0.0006,
        phase: Math.random() * Math.PI * 2,
        speed: (Math.random() * 0.0008 + 0.0004) * baseSpeedScale,
        strokeColor: i % 2 === 0 
          ? `rgba(6, 182, 212, ${0.08 * baseOpacityScale})` 
          : `rgba(37, 99, 235, ${0.07 * baseOpacityScale})`
      });
    }

    // 3. Network Nodes
    const nodeCount = variant === "history" ? 8 : variant === "dashboard" ? 14 : isMobile ? 12 : 24;
    const networkNodes = [];
    for (let i = 0; i < nodeCount; i++) {
      networkNodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 1.6,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    // Handlers
    const handleResize = () => {
      width = bgCanvas.width = fgCanvas.width = window.innerWidth;
      height = bgCanvas.height = fgCanvas.height = window.innerHeight;
    };

    const handlePointerMove = (e) => {
      state.mouse.targetX = e.clientX;
      state.mouse.targetY = e.clientY;
      state.mouse.isHovered = true;
    };

    const handlePointerLeave = () => {
      state.mouse.isHovered = false;
    };

    const handleScroll = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      state.scrollProgress = docH > 0 ? window.scrollY / docH : 0;
    };

    // Global Click Handler — Single Security Pulse Ring
    const handlePointerDown = (e) => {
      const clickX = e.clientX;
      const clickY = e.clientY;

      state.mouse.targetX = clickX;
      state.mouse.targetY = clickY;
      state.mouse.isHovered = true;

      // Single Solar Security Pulse Ring
      state.pulses.push({
        x: clickX,
        y: clickY,
        radius: 3,
        maxRadius: isMobile ? 75 : 120,
        speed: 3.5,
        opacity: 0.65,
        lineWidth: 1.5,
        color: "rgba(6, 182, 212, ",
        createdAt: performance.now()
      });

      // Brighten nearby particles
      particles.forEach((p) => {
        const dx = p.x - clickX;
        const dy = p.y - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 160) {
          p.pulseBrightness = 0.5 * (1 - dist / 160);
        }
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });

    let isTabVisible = true;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const render = () => {
      if (!isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      state.time += 0.012;
      const t = state.time;

      // Lerp Mouse
      state.mouse.x += (state.mouse.targetX - state.mouse.x) * 0.12;
      state.mouse.y += (state.mouse.targetY - state.mouse.y) * 0.12;
      state.mouse.hudRotation += 0.012;

      bgCtx.clearRect(0, 0, width, height);
      fgCtx.clearRect(0, 0, width, height);

      // ========================================================
      // LAYER 1: BACKGROUND CANVAS (GRID, WAVES, PARTICLES, NODES)
      // ========================================================

      // A. Subtle Cyber Background Grid (5-7% Opacity)
      if (variant !== "history") {
        const gridSize = 44;
        bgCtx.beginPath();
        bgCtx.strokeStyle = `rgba(37, 99, 235, ${0.05 * baseOpacityScale})`;
        bgCtx.lineWidth = 0.75;
        for (let x = 0; x <= width; x += gridSize) {
          bgCtx.moveTo(x, 0);
          bgCtx.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += gridSize) {
          bgCtx.moveTo(0, y);
          bgCtx.lineTo(width, y);
        }
        bgCtx.stroke();
      }

      // B. Flowing Waves
      waves.forEach((w) => {
        if (!isReducedMotion) {
          w.phase += w.speed;
        }

        const baseY = height * w.yRatio + Math.sin(state.scrollProgress * Math.PI) * 30;
        bgCtx.beginPath();
        bgCtx.moveTo(0, baseY + Math.sin(w.phase) * w.amplitude);

        const step = 60;
        for (let x = 0; x <= width + step; x += step) {
          const cy = baseY + Math.sin(x * w.frequency + w.phase) * w.amplitude;
          bgCtx.lineTo(x, cy);
        }

        bgCtx.strokeStyle = w.strokeColor;
        bgCtx.lineWidth = 1.1;
        bgCtx.stroke();
      });

      // C. Fixed Network Nodes
      networkNodes.forEach((node) => {
        const pulse = 0.05 + Math.sin(t * 1.5 + node.pulseOffset) * 0.025;
        bgCtx.beginPath();
        bgCtx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(37, 99, 235, ${(pulse + 0.03) * baseOpacityScale})`;
        bgCtx.fill();
      });

      // D. Flowing Particles & Connection Lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!isReducedMotion) {
          if (variant === "history") {
            p.x += p.speed;
            p.y += Math.sin(t * 0.2 + p.pathOffset) * 0.15;
          } else {
            p.x += Math.cos(p.flowAngle + t * 0.4) * p.speed + Math.sin(t * 0.3 + p.pathOffset) * 0.25;
            p.y -= p.speed * 0.5 + Math.cos(t * 0.25 + p.pathOffset) * 0.2;
          }

          if (p.y < -20) { p.y = height + 20; p.x = Math.random() * width; }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
        }

        // Hover Interaction
        if (state.mouse.isHovered) {
          const dx = state.mouse.x - p.x;
          const dy = state.mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const pullFactor = (1 - dist / 130) * 0.025;
            p.x += dx * pullFactor;
            p.y += dy * pullFactor;
          }
        }

        if (p.pulseBrightness > 0) {
          p.pulseBrightness -= 0.02;
          if (p.pulseBrightness < 0) p.pulseBrightness = 0;
        }

        const opacity = Math.min(0.75, p.baseOpacity + p.pulseBrightness + Math.sin(t * 2 + p.pathOffset) * 0.04);

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = `${p.colorPrefix}${opacity})`;
        bgCtx.fill();

        // Connection Lines (< 100px)
        if (variant !== "history") {
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 100 * 100) {
              const lineOpacity = (1 - Math.sqrt(distSq) / 100) * 0.08 * baseOpacityScale;
              bgCtx.beginPath();
              bgCtx.moveTo(p.x, p.y);
              bgCtx.lineTo(p2.x, p2.y);
              bgCtx.strokeStyle = `rgba(37, 99, 235, ${lineOpacity})`;
              bgCtx.lineWidth = 0.65;
              bgCtx.stroke();
            }
          }
        }
      }

      // ========================================================
      // LAYER 2: FOREGROUND CANVAS (CLICK PULSE & CURSOR RETICLE)
      // ========================================================

      for (let i = state.pulses.length - 1; i >= 0; i--) {
        const pulse = state.pulses[i];
        pulse.radius += pulse.speed;
        pulse.opacity -= 0.018;

        if (pulse.opacity <= 0 || pulse.radius >= pulse.maxRadius) {
          state.pulses.splice(i, 1);
          continue;
        }

        fgCtx.beginPath();
        fgCtx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        fgCtx.strokeStyle = `${pulse.color}${pulse.opacity})`;
        fgCtx.lineWidth = pulse.lineWidth || 1.5;
        fgCtx.stroke();
      }

      // Target HUD Reticle (Landing & Scanner variants)
      if (state.mouse.isHovered && !isMobile && (variant === "landing" || variant === "scanner")) {
        fgCtx.save();
        fgCtx.translate(state.mouse.x, state.mouse.y);

        const outerR = 18;
        fgCtx.save();
        fgCtx.rotate(state.mouse.hudRotation);
        fgCtx.beginPath();
        fgCtx.arc(0, 0, outerR, 0, Math.PI * 2);
        fgCtx.strokeStyle = "rgba(6, 182, 212, 0.75)";
        fgCtx.lineWidth = 1.3;
        fgCtx.setLineDash([5, 4]);
        fgCtx.stroke();
        fgCtx.restore();

        const innerR = 9;
        fgCtx.save();
        fgCtx.rotate(-state.mouse.hudRotation * 1.5);
        fgCtx.beginPath();
        fgCtx.arc(0, 0, innerR, 0, Math.PI * 2);
        fgCtx.strokeStyle = "rgba(37, 99, 235, 0.85)";
        fgCtx.lineWidth = 1.3;
        fgCtx.stroke();

        const bracketLen = 3.5;
        fgCtx.strokeStyle = "rgba(6, 182, 212, 0.9)";
        fgCtx.lineWidth = 1.3;

        [-1, 1].forEach((sx) => {
          [-1, 1].forEach((sy) => {
            const bx = sx * (innerR + 2);
            const by = sy * (innerR + 2);
            fgCtx.beginPath();
            fgCtx.moveTo(bx, by - sy * bracketLen);
            fgCtx.lineTo(bx, by);
            fgCtx.lineTo(bx - sx * bracketLen, by);
            fgCtx.stroke();
          });
        });
        fgCtx.restore();

        const tickLen = 4;
        fgCtx.strokeStyle = "rgba(6, 182, 212, 0.9)";
        fgCtx.lineWidth = 1.3;

        fgCtx.beginPath();
        fgCtx.moveTo(0, -outerR - 3);
        fgCtx.lineTo(0, -outerR + tickLen);
        fgCtx.stroke();

        fgCtx.beginPath();
        fgCtx.moveTo(0, outerR + 3);
        fgCtx.lineTo(0, outerR - tickLen);
        fgCtx.stroke();

        fgCtx.beginPath();
        fgCtx.moveTo(-outerR - 3, 0);
        fgCtx.lineTo(-outerR + tickLen, 0);
        fgCtx.stroke();

        fgCtx.beginPath();
        fgCtx.moveTo(outerR + 3, 0);
        fgCtx.lineTo(outerR - tickLen, 0);
        fgCtx.stroke();

        fgCtx.beginPath();
        fgCtx.arc(0, 0, 2, 0, Math.PI * 2);
        fgCtx.fillStyle = "rgba(6, 182, 212, 0.95)";
        fgCtx.fill();

        fgCtx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMotionChange);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [variant]);

  return (
    <>
      {/* LAYER 1: Background Canvas */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[2] select-none" aria-hidden="true">
        <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
      </div>

      {/* LAYER 2: Foreground Canvas */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[50] select-none" aria-hidden="true">
        <canvas ref={fgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
      </div>
    </>
  );
}

// Reusable Helper Components Export
export function SecurityPulse({ children, className = "" }) {
  return <div className={`relative ${className}`}>{children}</div>;
}

export function FlowingDataPaths({ className = "" }) {
  return <div className={`pointer-events-none ${className}`} />;
}

export function ScannerProcessingEffect({ isScanning }) {
  if (!isScanning) return null;
  return (
    <div className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-accent-blue/40 animate-pulse shadow-[0_0_25px_rgba(37,99,235,0.2)]" />
  );
}

export function AmbientGlow({ color = "blue", className = "" }) {
  const bgClass = color === "cyan" ? "bg-accent-cyan/10" : color === "violet" ? "bg-accent-violet/10" : "bg-accent-blue/10";
  return <div className={`absolute rounded-full blur-[90px] pointer-events-none ${bgClass} ${className}`} />;
}
