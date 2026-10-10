import React from 'react';

/**
 * BrandLogo - Unified DetectIQ Brand Mark & Wordmark
 *
 * Implements the official 'D' + forensic magnifying lens ('Q') + telemetry data cubes icon
 * with the signature "Detect" [solid] + "IQ" [cyan-to-blue gradient] wordmark.
 */
export function BrandIcon({ size = 32, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      aria-label="DetectIQ Logo Mark"
    >
      <defs>
        {/* Gradients for Ribbon D */}
        <linearGradient id="diq-outer-d" x1="20" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="45%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        <linearGradient id="diq-fold" x1="25" y1="50" x2="60" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        <linearGradient id="diq-lens-rim" x1="38" y1="38" x2="66" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        <radialGradient id="diq-lens-glass" cx="48" cy="48" r="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="60%" stopColor="#0369A1" />
          <stop offset="100%" stopColor="#0F172A" />
        </radialGradient>

        <linearGradient id="diq-handle" x1="60" y1="60" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>

      {/* Telemetry Pixel Cubes on Left */}
      <rect x="10" y="14" width="7" height="7" rx="1.5" fill="#6366F1" />
      <rect x="2" y="30" width="6.5" height="6.5" rx="1.5" fill="#00F0FF" />
      <rect x="9" y="38" width="8" height="8" rx="1.5" fill="#3B82F6" />
      <rect x="4" y="49" width="6" height="6" rx="1.5" fill="#0284C7" />
      <rect x="11" y="60" width="7.5" height="7.5" rx="1.5" fill="#38BDF8" />

      {/* Main Stylized 'D' Outer Arc */}
      <path 
        d="M26 12 C48 12, 86 16, 86 46 C86 74, 52 82, 28 82 L28 66 C42 66, 68 62, 68 46 C68 28, 44 26, 26 26 Z" 
        fill="url(#diq-outer-d)" 
      />

      {/* Lower Inner Fold / Spine of D */}
      <path 
        d="M26 26 L26 82 L42 82 L42 70 L38 66 L38 34 L26 26 Z" 
        fill="url(#diq-fold)" 
      />

      {/* Magnifying Glass Handle (forms the tail of Q) */}
      <path 
        d="M60 60 L78 78 L83 73 L65 55 Z" 
        fill="url(#diq-handle)" 
      />
      <circle cx="79" cy="76" r="2.5" fill="#FFFFFF" />

      {/* Magnifying Lens Outer Rim */}
      <circle 
        cx="52" 
        cy="50" 
        r="16" 
        fill="url(#diq-lens-glass)" 
        stroke="url(#diq-lens-rim)" 
        strokeWidth="3.5" 
      />

      {/* Center Iris / Pupil */}
      <circle cx="52" cy="50" r="8" fill="#0284C7" />
      <circle cx="52" cy="50" r="5" fill="#0369A1" />

      {/* Glossy Spherical Highlight Glare */}
      <ellipse cx="48" cy="45" rx="4" ry="2.5" transform="rotate(-30 48 45)" fill="#FFFFFF" fillOpacity="0.85" />
      <circle cx="56" cy="53" r="1.5" fill="#FFFFFF" fillOpacity="0.5" />
    </svg>
  );
}

export default function BrandLogo({ 
  size = 'md', 
  showText = true, 
  showTagline = false,
  className = '',
  onClick,
  animated = false 
}) {
  const sizeMap = {
    xs: { icon: 22, text: 'text-sm', tag: 'text-[8px]' },
    sm: { icon: 28, text: 'text-base', tag: 'text-[9px]' },
    md: { icon: 34, text: 'text-xl', tag: 'text-[10px]' },
    lg: { icon: 44, text: 'text-2xl', tag: 'text-xs' },
    xl: { icon: 56, text: 'text-3xl', tag: 'text-sm' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div 
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className={`transition-transform duration-200 ${animated ? 'hover:scale-105' : ''}`}>
        <BrandIcon size={currentSize.icon} />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className={`font-heading font-black tracking-tight ${currentSize.text} flex items-center`}>
            <span className="text-primary transition-colors">Detect</span>
            <span className="bg-gradient-to-r from-[#00F0FF] via-[#0284C7] to-[#3B82F6] bg-clip-text text-transparent ml-0.5">
              IQ
            </span>
          </div>

          {showTagline && (
            <span className={`text-muted uppercase tracking-[0.2em] font-bold mt-1 font-mono ${currentSize.tag}`}>
              Intelligence-Driven Threat Detection
            </span>
          )}
        </div>
      )}
    </div>
  );
}
