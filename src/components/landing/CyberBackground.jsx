import React, { useEffect, useRef } from "react";

export default function CyberBackground() {
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

    // Mouse & HUD State
    const mouse = {
      x: width / 2,
      y: height / 3,
      targetX: width / 2,
      targetY: height / 3,
      isHovered: true,
      pulses: [], // Single solar wave shockwave
      particles: [], // Click energy sparks
      hudRotation: 0
    };

    // 1. Generate Floating Ambient Cyber Data Micro-Nodes (5-10% opacity)
    const particleCount = 40;
    const cyberParticles = [];
    for (let i = 0; i < particleCount; i++) {
      cyberParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.35 - 0.1,
        radius: Math.random() * 1.5 + 1.0,
        pulseAngle: Math.random() * Math.PI * 2,
        baseOpacity: Math.random() * 0.05 + 0.04 // 4% to 9% opacity
      });
    }

    // 2. Generate Faint Circuit-Board Lines & Small Connector Nodes
    const traceCount = 16;
    const circuitTraces = [];
    const initTraces = () => {
      circuitTraces.length = 0;
      for (let i = 0; i < traceCount; i++) {
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        const len1 = Math.random() * 140 + 70;
        const len2 = Math.random() * 90 + 40;
        const dir = Math.floor(Math.random() * 4); // 0: right, 1: down, 2: left, 3: up
        
        let dx = dir === 0 ? 1 : dir === 2 ? -1 : 0;
        let dy = dir === 1 ? 1 : dir === 3 ? -1 : 0;
        
        const p1 = { x: startX, y: startY };
        const p2 = { x: startX + dx * len1, y: startY + dy * len1 };
        
        const turnDx = dx !== 0 ? 0 : (Math.random() > 0.5 ? 1 : -1);
        const turnDy = dy !== 0 ? 0 : (Math.random() > 0.5 ? 1 : -1);
        const p3 = { x: p2.x + turnDx * len2, y: p2.y + turnDy * len2 };

        circuitTraces.push({
          p1, p2, p3,
          nodeRadius: Math.random() * 1.2 + 1.8,
          pulseOffset: Math.random() * Math.PI * 2
        });
      }
    };
    initTraces();

    let waveTime = 0;

    const handleResize = () => {
      if (!bgCanvas || !fgCanvas) return;
      width = bgCanvas.width = fgCanvas.width = window.innerWidth;
      height = bgCanvas.height = fgCanvas.height = window.innerHeight;
      initTraces();
    };

    const handlePointerMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isHovered = true;
    };

    const handlePointerLeave = () => {
      mouse.isHovered = false;
    };

    // Capture phase listener guarantees single solar wave click anywhere
    const handlePointerDown = (e) => {
      const clickX = e.clientX;
      const clickY = e.clientY;

      mouse.targetX = clickX;
      mouse.targetY = clickY;
      mouse.isHovered = true;

      // Single Sonar Shockwave Ring (Subtle & Refined Ripple)
      mouse.pulses.push({
        x: clickX,
        y: clickY,
        radius: 3,
        maxRadius: 75,
        speed: 3.2,
        opacity: 0.45,
        color: "rgba(6, 182, 212, " // cyan
      });

      // Exploding Energy Particle Burst (6 subtle micro-particles)
      const particleBurstCount = 6;
      for (let i = 0; i < particleBurstCount; i++) {
        const angle = (Math.PI * 2 * i) / particleBurstCount + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 2.0 + 1.0;
        mouse.particles.push({
          x: clickX,
          y: clickY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 1.5 + 1.0,
          opacity: 0.5,
          life: 1.0,
          decay: Math.random() * 0.035 + 0.025
        });
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });

    // Render loop
    const render = () => {
      mouse.x += (mouse.targetX - mouse.x) * 0.16;
      mouse.y += (mouse.targetY - mouse.y) * 0.16;
      mouse.hudRotation += 0.014;
      waveTime += 0.012;

      bgCtx.clearRect(0, 0, width, height);
      fgCtx.clearRect(0, 0, width, height);

      // ==========================================
      // LAYER 1: BACKGROUND CANVAS (SUBTLE CYBER GRID & CIRCUIT TRACES - 5-10% OPACITY)
      // ==========================================

      // A. Thin Geometric Grid (Opacity 5–7%)
      const gridSize = 44;
      bgCtx.beginPath();
      bgCtx.strokeStyle = "rgba(37, 99, 235, 0.055)";
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

      // B. Faint Circuit-Board Lines & Small Glowing Nodes (Opacity 5–10%)
      circuitTraces.forEach((trace) => {
        const pulse = 0.05 + Math.sin(waveTime * 1.5 + trace.pulseOffset) * 0.03; // 5% to 8% opacity

        // Circuit Line
        bgCtx.beginPath();
        bgCtx.moveTo(trace.p1.x, trace.p1.y);
        bgCtx.lineTo(trace.p2.x, trace.p2.y);
        bgCtx.lineTo(trace.p3.x, trace.p3.y);
        bgCtx.strokeStyle = `rgba(6, 182, 212, ${pulse})`;
        bgCtx.lineWidth = 1.0;
        bgCtx.stroke();

        // Small Glowing Nodes at Endpoints & Joints (Opacity 6-10%)
        [trace.p1, trace.p2, trace.p3].forEach((pt, idx) => {
          bgCtx.beginPath();
          bgCtx.arc(pt.x, pt.y, idx === 1 ? trace.nodeRadius + 0.5 : trace.nodeRadius, 0, Math.PI * 2);
          bgCtx.fillStyle = `rgba(37, 99, 235, ${pulse + 0.02})`;
          bgCtx.fill();
        });
      });

      // C. Faint Ambient Micro Glowing Nodes (Opacity 5–10%)
      cyberParticles.forEach((p) => {
        p.x += p.vx + Math.sin(p.pulseAngle) * 0.15;
        p.y += p.vy;
        p.pulseAngle += 0.02;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        const currentOpacity = p.baseOpacity + Math.sin(p.pulseAngle) * 0.02;

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(6, 182, 212, ${Math.max(0.04, Math.min(0.09, currentOpacity))})`;
        bgCtx.fill();
      });

      // ==========================================
      // LAYER 2: FOREGROUND CANVAS (z-[50] INTERACTIVE RETICLE & WAVE)
      // ==========================================

      // Single Sonar Wave Shockwave Ring (On Click)
      for (let i = mouse.pulses.length - 1; i >= 0; i--) {
        const pulse = mouse.pulses[i];
        pulse.radius += pulse.speed;
        pulse.opacity -= 0.022;

        if (pulse.opacity <= 0 || pulse.radius >= pulse.maxRadius) {
          mouse.pulses.splice(i, 1);
          continue;
        }

        fgCtx.beginPath();
        fgCtx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        fgCtx.strokeStyle = `${pulse.color}${pulse.opacity})`;
        fgCtx.lineWidth = 1.2;
        fgCtx.stroke();
      }

      // Energy Particle Micro Spark Burst (On Click)
      for (let i = mouse.particles.length - 1; i >= 0; i--) {
        const p = mouse.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.opacity -= p.decay;

        if (p.opacity <= 0) {
          mouse.particles.splice(i, 1);
          continue;
        }

        fgCtx.beginPath();
        fgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fgCtx.fillStyle = `rgba(6, 182, 212, ${p.opacity})`;
        fgCtx.fill();
      }

      // Sleek Target HUD Reticle (Follows Cursor)
      if (mouse.isHovered) {
        fgCtx.save();
        fgCtx.translate(mouse.x, mouse.y);

        const outerR = 18;
        fgCtx.save();
        fgCtx.rotate(mouse.hudRotation);
        fgCtx.beginPath();
        fgCtx.arc(0, 0, outerR, 0, Math.PI * 2);
        fgCtx.strokeStyle = "rgba(6, 182, 212, 0.75)";
        fgCtx.lineWidth = 1.3;
        fgCtx.setLineDash([5, 4]);
        fgCtx.stroke();
        fgCtx.restore();

        const innerR = 9;
        fgCtx.save();
        fgCtx.rotate(-mouse.hudRotation * 1.5);
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
      window.removeEventListener("pointermove", handlePointerMove, { passive: true });
      window.removeEventListener("pointerleave", handlePointerLeave, { passive: true });
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* LAYER 1: Background Subtle Cyber Grid & Circuit Traces (z-[2] BEHIND CARDS & TEXT) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[2] select-none" aria-hidden="true">
        <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
      </div>

      {/* LAYER 2: Foreground Interactive Target HUD & Single Sonar Wave Canvas (z-[50] IN FRONT OF CARDS) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[50] select-none" aria-hidden="true">
        <canvas ref={fgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
      </div>
    </>
  );
}
