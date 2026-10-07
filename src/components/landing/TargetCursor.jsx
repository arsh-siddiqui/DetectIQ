import React, { useEffect, useState, useRef, useCallback } from "react";

/**
 * TargetCursor Component
 * High-tech tactical cyber reticle & lock-on targeting system exclusively for the landing page.
 * Replaces the default arrow cursor with a tactical reticle and locks onto
 * boxes, buttons, text blocks, inputs, cards, and security badges.
 */
export default function TargetCursor() {
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [targetLock, setTargetLock] = useState(null);
  const [isClicking, setIsClicking] = useState(false);
  const [clicks, setClicks] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  const requestRef = useRef(null);
  const currentPos = useRef({ x: -100, y: -100 });
  const targetPos = useRef({ x: -100, y: -100 });
  const currentLockRef = useRef(null);

  // Helper to identify and categorize target elements under cursor
  const findTarget = useCallback((clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el || el === document.body || el === document.documentElement) return null;

    // Ignore cursor itself or elements specifically marked to ignore
    if (el.closest('.target-cursor-ignore') || el.closest('#target-cursor-root')) return null;

    // 1. Action elements: buttons, links, clickable items (Highest priority)
    const actionEl = el.closest('button, a, [role="button"], .cursor-pointer');
    if (actionEl && !actionEl.closest('.target-cursor-ignore')) {
      const rect = actionEl.getBoundingClientRect();
      return {
        element: actionEl,
        rect,
        category: "ACTION_NODE",
        label: actionEl.innerText?.slice(0, 24).trim().toUpperCase() || "INTERACT",
      };
    }

    // 2. Input fields and textareas
    const inputEl = el.closest('input, textarea, select');
    if (inputEl) {
      const rect = inputEl.getBoundingClientRect();
      return {
        element: inputEl,
        rect,
        category: "INPUT_BUFFER",
        label: "ENTER_PAYLOAD",
      };
    }

    // 3. Badges, tags, and chips
    const badgeEl = el.closest('[class*="rounded-full"], [class*="rounded-lg"], [class*="badge"]');
    if (badgeEl && badgeEl.getBoundingClientRect().width < 340) {
      const rect = badgeEl.getBoundingClientRect();
      return {
        element: badgeEl,
        rect,
        category: "VECTOR_BADGE",
        label: badgeEl.innerText?.slice(0, 20).trim().toUpperCase() || "TELEMETRY",
      };
    }

    // 4. Headings & Titles
    const headingEl = el.closest('h1, h2, h3, h4');
    if (headingEl) {
      const rect = headingEl.getBoundingClientRect();
      return {
        element: headingEl,
        rect,
        category: "INTEL_HEADER",
        label: "CLASSIFIED",
      };
    }

    // 5. Feature cards, step boxes, and module blocks
    const cardEl = el.closest('[class*="bg-card"], [class*="rounded-2xl"], [class*="rounded-3xl"], .group');
    if (cardEl && cardEl.getBoundingClientRect().width < window.innerWidth * 0.92) {
      const rect = cardEl.getBoundingClientRect();
      return {
        element: cardEl,
        rect,
        category: "SYSTEM_MODULE",
        label: "SECURITY_NODE",
      };
    }

    // 6. Text streams / Paragraphs
    const textEl = el.closest('p, blockquote');
    if (textEl) {
      const rect = textEl.getBoundingClientRect();
      if (rect.height < 300) {
        return {
          element: textEl,
          rect,
          category: "DATA_STREAM",
          label: "FORENSIC_TEXT",
        };
      }
    }

    return null;
  }, []);

  useEffect(() => {
    // Only activate on devices with fine pointer (mouse/trackpad), not touchscreens
    if (window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    setMounted(true);
    document.body.classList.add("landing-target-active");
    document.documentElement.classList.add("landing-target-active");

    const handleMouseMove = (e) => {
      setIsVisible(true);
      targetPos.current = { x: e.clientX, y: e.clientY };

      const target = findTarget(e.clientX, e.clientY);
      if (target) {
        const { rect, category, label } = target;
        const newLock = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          category,
          label,
        };
        currentLockRef.current = newLock;
        setTargetLock(newLock);
      } else {
        currentLockRef.current = null;
        setTargetLock(null);
      }
    };

    const handleMouseDown = (e) => {
      setIsClicking(true);
      const newClick = { id: Date.now(), x: e.clientX, y: e.clientY };
      setClicks((prev) => [...prev.slice(-4), newClick]);
      setTimeout(() => {
        setClicks((prev) => prev.filter((c) => c.id !== newClick.id));
      }, 700);
    };

    const handleMouseUp = () => {
      setIsClicking(false);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
      setTargetLock(null);
      currentLockRef.current = null;
    };

    const handleScroll = () => {
      if (targetPos.current.x > 0 && targetPos.current.y > 0) {
        const target = findTarget(targetPos.current.x, targetPos.current.y);
        if (target) {
          const { rect, category, label } = target;
          setTargetLock({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            category,
            label,
          });
        } else {
          setTargetLock(null);
        }
      }
    };

    // Smooth 60fps RAF position update
    const updatePosition = () => {
      const dx = targetPos.current.x - currentPos.current.x;
      const dy = targetPos.current.y - currentPos.current.y;
      
      // Fast yet smooth interpolation
      currentPos.current.x += dx * 0.55;
      currentPos.current.y += dy * 0.55;

      setMousePos({ x: currentPos.current.x, y: currentPos.current.y });
      requestRef.current = requestAnimationFrame(updatePosition);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("scroll", handleScroll, { passive: true });
    requestRef.current = requestAnimationFrame(updatePosition);

    return () => {
      document.body.classList.remove("landing-target-active");
      document.documentElement.classList.remove("landing-target-active");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("scroll", handleScroll);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [findTarget]);

  if (!mounted || !isVisible) return null;

  const isLocked = Boolean(targetLock);

  return (
    <div
      id="target-cursor-root"
      className="fixed inset-0 pointer-events-none z-[999999] overflow-hidden select-none font-mono"
    >
      {/* 1. Tactile Click Ripples */}
      {clicks.map((click) => (
        <div
          key={click.id}
          className="absolute rounded-full border-2 border-accent-cyan pointer-events-none animate-ping"
          style={{
            left: click.x - 28,
            top: click.y - 28,
            width: 56,
            height: 56,
            boxShadow: "0 0 24px rgba(6, 182, 212, 0.9), inset 0 0 12px rgba(37, 99, 235, 0.6)",
          }}
        />
      ))}

      {/* 2. Tactical Box Lock Brackets (snaps exactly around the hovered element) */}
      {isLocked && targetLock && (
        <div
          className="absolute transition-all duration-150 ease-out pointer-events-none"
          style={{
            left: Math.round(targetLock.left - 5),
            top: Math.round(targetLock.top - 5),
            width: Math.round(targetLock.width + 10),
            height: Math.round(targetLock.height + 10),
          }}
        >
          {/* Subtle Cyber Lock Perimeter Box */}
          <div
            className="absolute inset-0 rounded-lg border border-accent-cyan/40 bg-accent-blue/[0.04] transition-all"
            style={{
              boxShadow:
                "0 0 25px rgba(6, 182, 212, 0.18), inset 0 0 16px rgba(37, 99, 235, 0.08)",
            }}
          />

          {/* Sweeping Laser Line Scan */}
          <div
            className="absolute left-1 right-1 h-[2px] bg-gradient-to-r from-transparent via-accent-cyan to-transparent pointer-events-none"
            style={{
              animation: "laser-sweep 1.8s ease-in-out infinite",
              boxShadow: "0 0 8px rgba(6, 182, 212, 0.8)",
            }}
          />

          {/* Top-Left Tactical Bracket */}
          <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.9)]" />

          {/* Top-Right Tactical Bracket */}
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.9)]" />

          {/* Bottom-Left Tactical Bracket */}
          <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.9)]" />

          {/* Bottom-Right Tactical Bracket */}
          <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.9)]" />
        </div>
      )}

      {/* 3. Main Precision Reticle (Free-Aim & Lock-On Cursor) */}
      <div
        className="absolute pointer-events-none"
        style={{
          transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`,
          left: 0,
          top: 0,
        }}
      >
        <div
          className={`relative -left-1/2 -top-1/2 flex items-center justify-center transition-all duration-150 ${
            isClicking ? "scale-75" : isLocked ? "scale-110" : "scale-100"
          }`}
          style={{ width: 44, height: 44 }}
        >
          {/* Precision Center Aim Dot */}
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
              isLocked
                ? "bg-accent-cyan shadow-[0_0_12px_#06B6D4] scale-125"
                : "bg-accent-blue shadow-[0_0_8px_#2563EB]"
            }`}
          />

          {/* Tactical Crosshair Axis Lines */}
          <div className="absolute top-0 bottom-0 w-[1px] bg-accent-cyan/50 pointer-events-none" />
          <div className="absolute left-0 right-0 h-[1px] bg-accent-cyan/50 pointer-events-none" />

          {/* Outer Segmented Reticle Ring */}
          <div
            className={`absolute inset-1.5 rounded-full border border-dashed transition-all duration-300 ${
              isLocked
                ? "border-accent-cyan shadow-[0_0_14px_rgba(6,182,212,0.6)] rotate-45 scale-105"
                : "border-accent-blue/60"
            }`}
            style={{
              animation: isLocked ? "none" : "tactical-spin 10s linear infinite",
            }}
          />

          {/* 4 Compass Targeting Notches */}
          <div className="absolute -top-1 w-1.5 h-[2px] bg-accent-cyan shadow-[0_0_8px_#06B6D4]" />
          <div className="absolute -bottom-1 w-1.5 h-[2px] bg-accent-cyan shadow-[0_0_8px_#06B6D4]" />
          <div className="absolute -left-1 h-1.5 w-[2px] bg-accent-cyan shadow-[0_0_8px_#06B6D4]" />
          <div className="absolute -right-1 h-1.5 w-[2px] bg-accent-cyan shadow-[0_0_8px_#06B6D4]" />

          {/* Lock Acquisition Ring (appears when locked) */}
          {isLocked && (
            <div className="absolute -inset-1.5 border border-accent-cyan/50 rounded-sm animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
