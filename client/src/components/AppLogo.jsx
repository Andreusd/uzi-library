import React from 'react';

/**
 * Authentic brand logo for Uzi Library.
 * Features an elegant open book with dimensional pages and bookmark ribbon
 * resting on a rounded squircle that dynamically adapts to the active theme palette.
 */
export default function AppLogo({ 
  className = 'w-9 h-9', 
  iconClassName = 'w-5 h-5',
  showBackground = true 
}) {
  const emblem = (
    <svg
      viewBox="0 0 24 24"
      className={`${iconClassName} drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.35)] shrink-0`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Back book cover depth / under-page shadow */}
      <path
        d="M3.5 6.5 C 7.8 4.2, 10.6 5.5, 12 7.5 C 13.4 5.5, 16.2 4.2, 20.5 6.5 L 20.5 17.5 C 16.2 15.2, 13.4 16.5, 12 18.5 C 10.6 16.5, 7.8 15.2, 3.5 17.5 Z"
        fill="#000000"
        fillOpacity="0.25"
      />

      {/* Main open pages (Crisp Ivory) */}
      <path
        d="M3 5 C 7.8 2.8, 10.8 4.3, 12 6.5 C 13.2 4.3, 16.2 2.8, 21 5 L 21 16 C 16.2 13.8, 13.2 15.3, 12 17.5 C 10.8 15.3, 7.8 13.8, 3 16 Z"
        fill="#FFFFFF"
      />

      {/* Left page soft inner glow */}
      <path
        d="M3 5 C 7.8 2.8, 10.8 4.3, 12 6.5 L 12 17.5 C 10.8 15.3, 7.8 13.8, 3 16 Z"
        fill="#FEF9E7"
        fillOpacity="0.6"
      />

      {/* Right page soft inner glow */}
      <path
        d="M21 5 C 16.2 2.8, 13.2 4.3, 12 6.5 L 12 17.5 C 13.2 15.3, 16.2 13.8, 21 16 Z"
        fill="#FDF3D2"
        fillOpacity="0.75"
      />

      {/* Center spine crease line */}
      <line
        x1="12"
        y1="6.8"
        x2="12"
        y2="17.2"
        stroke="#78350F"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.35"
      />

      {/* Subtle page text hints */}
      <path
        d="M5.5 8 C 7.8 7.2, 9.6 7.8, 10.6 8.5"
        stroke="#B45309"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />
      <path
        d="M5.5 10.5 C 7.8 9.7, 9.6 10.3, 10.6 11"
        stroke="#B45309"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />
      <path
        d="M13.4 8.5 C 14.4 7.8, 16.2 7.2, 18.5 8"
        stroke="#B45309"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />
      <path
        d="M13.4 11 C 14.4 10.3, 16.2 9.7, 18.5 10.5"
        stroke="#B45309"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />

      {/* Silk bookmark ribbon */}
      <path
        d="M11 3.5 L 13 3.5 L 13 11.5 L 12 10.5 L 11 11.5 Z"
        fill="#92400E"
      />
      <path
        d="M11.3 3.5 L 12.7 3.5 L 12.7 11 L 12 10.2 L 11.3 11 Z"
        fill="#D97706"
      />
    </svg>
  );

  if (!showBackground) {
    return emblem;
  }

  return (
    <div
      className={`rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 relative overflow-hidden select-none ${className}`}
    >
      {/* Top-left subtle border glow */}
      <div className="absolute inset-0 rounded-xl border border-white/20 pointer-events-none" />
      {emblem}
    </div>
  );
}
