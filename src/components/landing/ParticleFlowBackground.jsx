import React, { useEffect, useRef } from "react";

/**
 * ParticleFlowBackground
 * Renders continuous data particles, curved solar waves, network nodes,
 * and an interactive click security pulse canvas overlay.
 */
export default function ParticleFlowBackground() {
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

    // Reduced motion accessibility
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isReducedMotion = mediaQuery.matches;

    const handleMotionChange = (e) => {
      isReducedMotion = e.matches;
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMotionChange);
    }

    // Interactive state tracking
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
      pulses: [],
      time: 0
    };

    // Particles setup (desktop: 65, mobile: 30)
    const isMobile = width < 768;
    const particleCount = isMobile ? 30 : 65;
    const particles = [];

    const colors = [
      "rgba(37, 99, 235, ",  // Primary Blue
      "rgba(6, 182, 212, ",  // Cyan
      "rgba(124, 58, 237, "  // Soft Violet
    ];

    for (let i = 0; i < particleCount; i++) {
      const colorIdx = i % 10 === 0 ? 2 : (i % 3 === 0 ? 1 : 0);
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseX: Math.random() * width,
        baseY: Math.random() * height,
        radius: Math.random() * 1.6 + 1.2,
        colorPrefix: colors[colorIdx],
        baseOpacity: Math.random() * 0.25 + 0.12,
        speed: Math.random() * 0.45 + 0.2,
        pathOffset: Math.random() * Math.PI * 2,
        pathAmplitude: Math.random() * 40 + 20,
        flowAngle: (Math.random() - 0.5) * 0.4,
        pulseBrightness: 0
      });
    }

    // Curved solar wave paths
    const waveCount = isMobile ? 2 : 4;
    const waves = [];
    for (let i = 0; i < waveCount; i++) {
      waves.push({
        yRatio: (i + 1) / (waveCount + 1),
        amplitude: Math.random() * 60 + 40,
        frequency: Math.random() * 0.0015 + 0.0008,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.0008 + 0.0004,
        strokeColor: i % 2 === 0 ? "rgba(6, 182, 212, 0.09)" : "rgba(37, 99, 235, 0.08)"
      });
    }

    // Network junction nodes
    const nodeCount = isMobile ? 12 : 24;
    const networkNodes = [];
    for (let i = 0; i < nodeCount; i++) {
      networkNodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 1.8,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    // Resize and scroll handlers
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

    // Single Security Pulse trigger on click
    const handlePointerDown = (e) => {
      const clickX = e.clientX;
      const clickY = e.clientY;

      state.mouse.targetX = clickX;
      state.mouse.targetY = clickY;
      state.mouse.isHovered = true;

      state.pulses.push({
        x: clickX,
        y: clickY,
        radius: 3,
        maxRadius: isMobile ? 80 : 120,
        speed: 3.5,
        opacity: 0.65,
        lineWidth: 1.5,
        color: "rgba(6, 182, 212, ",
        createdAt: performance.now()
      });

      particles.forEach((p) => {
        const dx = p.x - clickX;
        const dy = p.y - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          p.pulseBrightness = 0.6 * (1 - dist / 180);
        }
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });

    // Pause rendering when tab is inactive
    let isTabVisible = true;
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Canvas render animation loop
    const render = () => {
      if (!isTabVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      state.time += 0.012;
      const t = state.time;

      // Smooth pointer lerp
      state.mouse.x += (state.mouse.targetX - state.mouse.x) * 0.12;
      state.mouse.y += (state.mouse.targetY - state.mouse.y) * 0.12;
      state.mouse.hudRotation += 0.012;

      bgCtx.clearRect(0, 0, width, height);
      fgCtx.clearRect(0, 0, width, height);

      // Cyber background grid
      const gridSize = 44;
      bgCtx.beginPath();
      bgCtx.strokeStyle = "rgba(37, 99, 235, 0.05)";
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

      // Solar wave Bezier paths
      waves.forEach((w) => {
        if (!isReducedMotion) {
          w.phase += w.speed;
        }

        const baseY = height * w.yRatio + Math.sin(state.scrollProgress * Math.PI) * 40;
        bgCtx.beginPath();
        bgCtx.moveTo(0, baseY + Math.sin(w.phase) * w.amplitude);

        const step = 60;
        for (let x = 0; x <= width + step; x += step) {
          const cy = baseY + Math.sin(x * w.frequency + w.phase) * w.amplitude;
          bgCtx.lineTo(x, cy);
        }

        bgCtx.strokeStyle = w.strokeColor;
        bgCtx.lineWidth = 1.2;
        bgCtx.stroke();
      });

      // Network junction nodes
      networkNodes.forEach((node) => {
        const pulse = 0.06 + Math.sin(t * 1.5 + node.pulseOffset) * 0.03;
        bgCtx.beginPath();
        bgCtx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(37, 99, 235, ${pulse + 0.04})`;
        bgCtx.fill();
      });

      // Flowing particles and dynamic connection lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!isReducedMotion) {
          p.x += Math.cos(p.flowAngle + t * 0.5) * p.speed + Math.sin(t * 0.4 + p.pathOffset) * 0.3;
          p.y -= p.speed * 0.6 + Math.cos(t * 0.3 + p.pathOffset) * 0.2;

          if (p.y < -20) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
        }

        // Pointer proximity attraction
        if (state.mouse.isHovered) {
          const dx = state.mouse.x - p.x;
          const dy = state.mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const pullFactor = (1 - dist / 140) * 0.03;
            p.x += dx * pullFactor;
            p.y += dy * pullFactor;
          }
        }

        // Pulse decay
        if (p.pulseBrightness > 0) {
          p.pulseBrightness -= 0.02;
          if (p.pulseBrightness < 0) p.pulseBrightness = 0;
        }

        const opacity = Math.min(0.8, p.baseOpacity + p.pulseBrightness + Math.sin(t * 2 + p.pathOffset) * 0.05);

        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = `${p.colorPrefix}${opacity})`;
        bgCtx.fill();

        // Node connections (< 110px)
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 110 * 110) {
            const lineOpacity = (1 - Math.sqrt(distSq) / 110) * 0.09;
            bgCtx.beginPath();
            bgCtx.moveTo(p.x, p.y);
            bgCtx.lineTo(p2.x, p2.y);
            bgCtx.strokeStyle = `rgba(37, 99, 235, ${lineOpacity})`;
            bgCtx.lineWidth = 0.7;
            bgCtx.stroke();
          }
        }
      }

      // Security pulse ripple rendering
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

      // Target reticle reticle ring
      if (state.mouse.isHovered && !isMobile) {
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
  }, []);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[2] select-none" aria-hidden="true">
        <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
      </div>

      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[50] select-none" aria-hidden="true">
        <canvas ref={fgCanvasRef} className="absolute inset-0 w-full h-full block opacity-100" />
      </div>
    </>
  );
}
