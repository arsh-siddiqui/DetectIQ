import React, { useEffect, useState } from "react";

/**
 * TargetCursor Component
 * Unified 1:1 Tactical Reticle & Lock-On System exclusively for the Landing Page.
 * Single reticle that smoothly expands and locks when hovering or clicking elements,
 * with zero lag and no duplicate double-cursor artifacts.
 */
export default function TargetCursor() {
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [clicks, setClicks] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Disable on coarse touch devices
    if (window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    setMounted(true);
    document.body.classList.add("landing-target-active");
    document.documentElement.classList.add("landing-target-active");

    const handleMouseMove = (e) => {
      setIsVisible(true);
      setMousePos({ x: e.clientX, y: e.clientY });

      // Detect interactive elements under cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        const interactive = Boolean(
          el.closest('button, a, input, textarea, select, [role="button"], .cursor-pointer, [class*="bg-card"]')
        );
        setIsHovered(interactive);
      } else {
        setIsHovered(false);
      }
    };

    const handleMouseDown = (e) => {
      setIsClicking(true);
      const newClick = { id: Date.now(), x: e.clientX, y: e.clientY };
      setClicks((prev) => [...prev.slice(-3), newClick]);
      setTimeout(() => {
        setClicks((prev) => prev.filter((c) => c.id !== newClick.id));
      }, 600);
    };

    const handleMouseUp = () => setIsClicking(false);
    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.body.classList.remove("landing-target-active");
      document.documentElement.classList.remove("landing-target-active");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  if (!mounted || !isVisible) return null;

  return (
    <div
      id="target-cursor-root"
      className="fixed inset-0 pointer-events-none z-[999999] overflow-hidden select-none font-mono"
    >
      {/* Tactile Click Ping Ripples */}
      {clicks.map((click) => (
        <div
          key={click.id}
          className="absolute rounded-full border-2 border-accent-cyan pointer-events-none animate-ping"
          style={{
            left: click.x - 24,
            top: click.y - 24,
            width: 48,
            height: 48,
            boxShadow: "0 0 20px rgba(6, 182, 212, 0.9), inset 0 0 10px rgba(37, 99, 235, 0.6)",
          }}
        />
      ))}

      {/* Unified Tactical Reticle (1:1 Cursor Tracking) */}
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
            isClicking ? "scale-75" : isHovered ? "scale-125" : "scale-100"
          }`}
          style={{ width: 40, height: 40 }}
        >
          {/* Precision Center Aim Dot */}
          <div
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              isHovered
                ? "bg-accent-cyan shadow-[0_0_12px_#06B6D4] scale-125"
                : "bg-accent-blue shadow-[0_0_8px_#2563EB]"
            }`}
          />

          {/* Tactical Crosshair Axis Lines */}
          <div className={`absolute top-0 bottom-0 w-[1px] transition-colors duration-200 ${isHovered ? "bg-accent-cyan/80" : "bg-accent-cyan/40"}`} />
          <div className={`absolute left-0 right-0 h-[1px] transition-colors duration-200 ${isHovered ? "bg-accent-cyan/80" : "bg-accent-cyan/40"}`} />

          {/* Outer Segmented Reticle Ring */}
          <div
            className={`absolute inset-1 rounded-full border transition-all duration-300 ${
              isHovered
                ? "border-accent-cyan border-solid shadow-[0_0_14px_rgba(6,182,212,0.8)] rotate-45"
                : "border-accent-blue/60 border-dashed"
            }`}
            style={{
              animation: isHovered ? "none" : "tactical-spin 8s linear infinite",
            }}
          />

          {/* Tactical Lock Brackets (Activated on hover) */}
          {isHovered && (
            <>
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-accent-cyan shadow-[0_0_8px_#06B6D4]" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-accent-cyan shadow-[0_0_8px_#06B6D4]" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-accent-cyan shadow-[0_0_8px_#06B6D4]" />
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-accent-cyan shadow-[0_0_8px_#06B6D4]" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
