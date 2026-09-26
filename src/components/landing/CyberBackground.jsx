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
      pulses: [], // Sonar wave shockwaves
      particles: [], // Click energy sparks
      hudRotation: 0
    };

    // Generate Floating Ambient Cyber Data Particles (Cyber Dust)
    const particleCount = 35;
    const cyberParticles = [];
    for (let i = 0; i < particleCount; i++) {
      cyberParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -Math.random() * 0.45 - 0.15,
        radius: Math.random() * 2.2 + 1.2,
        pulseAngle: Math.random() * Math.PI * 2,
        baseOpacity: Math.random() * 0.35 + 0.15
      });
    }

    let waveTime = 0;

    const handleResize = () => {
      if (!bgCanvas || !fgCanvas) return;
      width = bgCanvas.width = fgCanvas.width = window.innerWidth;
      height = bgCanvas.height = fgCanvas.height = window.innerHeight;
    };

    const handlePointerMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isHovered = true;
    };

    const handlePointerLeave = () => {
      mouse.isHovered = false;
    };

    // Capture phase listener guarantees clicks work anywhere on page
    const handlePointerDown = (e) => {
      const clickX = e.clientX;
      const clickY = e.clientY;

      mouse.targetX = clickX;
      mouse.targetY = clickY;
      mouse.isHovered = true;

      // 1. Primary & Secondary Sonar Shockwave Rings
      mouse.pulses.push({
        x: clickX,
        y: clickY,
        radius: 4,
        maxRadius: 240,
        speed: 6.0,
        opacity: 1.0,
        color: "rgba(6, 182, 212, " // cyan
      });

      mouse.pulses.push({
        x: clickX,
        y: clickY,
        radius: 2,
        maxRadius: 190,
        speed: 4.2,
        opacity: 0.9,
        color: "rgba(139, 92, 246, " // violet
      });

      // 2. Exploding Energy Particle Burst (16 particles with trail)
      const particleBurstCount = 16;
      for (let i = 0; i < particleBurstCount; i++) {
        const angle = (Math.PI * 2 * i) / particleBurstCount + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 4.5 + 3.0;
        mouse.particles.push({
          x: clickX,
          y: clickY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3.0 + 2.0,
          opacity: 1.0,
          life: 1.0,
          decay: Math.random() * 0.022 + 0.018
        });
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });

    // Render loop
    const render = () => {
      // Smooth lerp mouse coordinates
      mouse.x += (mouse.targetX - mouse.x) * 0.16;
      mouse.y += (mouse.targetY - mouse.y) * 0.16;
      mouse.hudRotation += 0.014;
      waveTime += 0.012;

      // Clear both canvases
      bgCtx.clearRect(0, 0, width, height);
      fgCtx.clearRect(0, 0, width, height);

      // ==========================================
      // LAYER 1: BACKGROUND CANVAS (z-[2] BEHIND CARDS)
      // ==========================================

      // C. Corner Ambient Cyber Radar Sweeps (Top-Left & Bottom-Right)
      const radarCenters = [
        { x: 120, y: 120, radius: 90 },
        { x: width - 140, y: height - 140, radius: 100 }
      ];

      radarCenters.forEach((rc) => {
        bgCtx.save();
        bgCtx.translate(rc.x, rc.y);

        // Concentric Radar Target Rings
        [0.4, 0.75, 1.0].forEach((scale) => {
          bgCtx.beginPath();
          bgCtx.arc(0, 0, rc.radius * scale, 0, Math.PI * 2);
          bgCtx.strokeStyle = "rgba(37, 99, 235, 0.06)";
          bgCtx.lineWidth = 1;
          bgCtx.stroke();
        });

        // Rotating Sweep Line
        bgCtx.rotate(waveTime * 0.8);
        bgCtx.beginPath();
        bgCtx.moveTo(0, 0);
        bgCtx.lineTo(rc.radius, 0);
        bgCtx.strokeStyle = "rgba(6, 182, 212, 0.14)";
        bgCtx.lineWidth = 1.5;
        bgCtx.stroke();

        bgCtx.restore();
      });

      // C. Draw Ambient Luminous Data Sparks
      cyberParticles.forEach((p) => {
        p.x += p.vx + Math.sin(p.pulseAngle) * 0.2;
        p.y += p.vy;
        p.pulseAngle += 0.025;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        const currentOpacity = p.baseOpacity + Math.sin(p.pulseAngle) * 0.1;

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(6, 182, 212, ${Math.max(0.04, currentOpacity)})`;
        bgCtx.fill();
      });

      // ==========================================
      // LAYER 2: FOREGROUND CANVAS (z-[50] IN FRONT OF CARDS)
      // ==========================================

      // A. Sonar Wave Shockwave Rings (On Click)
      for (let i = mouse.pulses.length - 1; i >= 0; i--) {
        const pulse = mouse.pulses[i];
        pulse.radius += pulse.speed;
        pulse.opacity -= 0.016;

        if (pulse.opacity <= 0 || pulse.radius >= pulse.maxRadius) {
          mouse.pulses.splice(i, 1);
          continue;
        }

        fgCtx.beginPath();
        fgCtx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
        fgCtx.strokeStyle = `${pulse.color}${pulse.opacity})`;
        fgCtx.lineWidth = 2.5;
        fgCtx.stroke();
      }

      // B. Exploding Energy Particles (On Click)
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

      // C. High-Contrast Target HUD Reticle (Follows Cursor Smoothly) - Sleek Micro-Reticle
      if (mouse.isHovered) {
        fgCtx.save();
        fgCtx.translate(mouse.x, mouse.y);

        // 1. Outer Dashed HUD Ring (Rotating Clockwise)
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

        // 2. Inner Tech Bracket Ring (Rotating Counter-Clockwise)
        const innerR = 9;
        fgCtx.save();
        fgCtx.rotate(-mouse.hudRotation * 1.5);
        fgCtx.beginPath();
        fgCtx.arc(0, 0, innerR, 0, Math.PI * 2);
        fgCtx.strokeStyle = "rgba(37, 99, 235, 0.85)";
        fgCtx.lineWidth = 1.3;
        fgCtx.stroke();

        // Bracket corners
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

        // 3. Precision Crosshair Ticks (Top, Bottom, Left, Right)
        const tickLen = 4;
        fgCtx.strokeStyle = "rgba(6, 182, 212, 0.9)";
        fgCtx.lineWidth = 1.3;

        // Top tick
        fgCtx.beginPath();
        fgCtx.moveTo(0, -outerR - 3);
        fgCtx.lineTo(0, -outerR + tickLen);
        fgCtx.stroke();

        // Bottom tick
        fgCtx.beginPath();
        fgCtx.moveTo(0, outerR + 3);
        fgCtx.lineTo(0, outerR - tickLen);
        fgCtx.stroke();

        // Left tick
        fgCtx.beginPath();
        fgCtx.moveTo(-outerR - 3, 0);
        fgCtx.lineTo(-outerR + tickLen, 0);
        fgCtx.stroke();

        // Right tick
        fgCtx.beginPath();
        fgCtx.moveTo(outerR + 3, 0);
        fgCtx.lineTo(outerR - tickLen, 0);
        fgCtx.stroke();

        // 4. Center Glowing Dot
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
      {/* LAYER 1: Background Vector Waves & Hex Shield Canvas (z-[2] BEHIND CARDS & TEXT) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[2] select-none" aria-hidden="true">
        <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
        
        {/* Soft Ambient Cyber Grid Texture Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:36px_36px] opacity-[0.035] dark:opacity-[0.07] pointer-events-none" />

        {/* Multi-Layer Radial Soft Ambient Glow Orbs */}
        <div className="absolute -top-40 -right-40 w-[650px] h-[650px] bg-accent-blue/15 rounded-full blur-[140px] dark:bg-accent-blue/25 pointer-events-none" />
        <div className="absolute top-1/3 -left-40 w-[550px] h-[550px] bg-accent-violet/15 rounded-full blur-[140px] dark:bg-accent-violet/25 pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-accent-cyan/12 rounded-full blur-[150px] dark:bg-accent-cyan/20 pointer-events-none" />
      </div>

      {/* LAYER 2: Foreground Interactive Target HUD & Sonar Click Waves Canvas (z-[50] IN FRONT OF CARDS) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[50] select-none" aria-hidden="true">
        <canvas ref={fgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
      </div>
    </>
  );
}
