import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const VoxStudentLogo: React.FC<LogoProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="diamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
        <linearGradient id="highlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.15"/>
        </filter>
      </defs>
      
      {/* Main Diamond Shape */}
      <path
        d="M50 10 L80 35 L50 90 L20 35 Z"
        fill="url(#diamondGradient)"
        filter="url(#shadow)"
      />
      
      {/* Top facet highlight */}
      <path
        d="M50 10 L65 30 L50 40 L35 30 Z"
        fill="url(#highlightGradient)"
      />
      
      {/* Left facet */}
      <path
        d="M20 35 L35 30 L50 40 L50 90 Z"
        fill="url(#diamondGradient)"
        fillOpacity="0.8"
      />
      
      {/* Right facet */}
      <path
        d="M80 35 L65 30 L50 40 L50 90 Z"
        fill="url(#diamondGradient)"
        fillOpacity="0.9"
      />
      
      {/* Center shine */}
      <ellipse
        cx="50"
        cy="35"
        rx="8"
        ry="4"
        fill="url(#highlightGradient)"
        transform="rotate(-15 50 35)"
      />
      
      {/* Small sparkle */}
      <circle
        cx="42"
        cy="25"
        r="1.5"
        fill="white"
        fillOpacity="0.8"
      />
      
      {/* Another sparkle */}
      <circle
        cx="58"
        cy="45"
        r="1"
        fill="white"
        fillOpacity="0.6"
      />
    </svg>
  );
};

export const VoxStudentLogoWhite: React.FC<LogoProps> = ({ size = 40, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="whiteDiamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="whiteHighlightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      
      {/* Main Diamond Shape */}
      <path
        d="M50 10 L80 35 L50 90 L20 35 Z"
        fill="url(#whiteDiamondGradient)"
      />
      
      {/* Top facet highlight */}
      <path
        d="M50 10 L65 30 L50 40 L35 30 Z"
        fill="url(#whiteHighlightGradient)"
      />
      
      {/* Left facet */}
      <path
        d="M20 35 L35 30 L50 40 L50 90 Z"
        fill="url(#whiteDiamondGradient)"
        fillOpacity="0.6"
      />
      
      {/* Right facet */}
      <path
        d="M80 35 L65 30 L50 40 L50 90 Z"
        fill="url(#whiteDiamondGradient)"
        fillOpacity="0.7"
      />
      
      {/* Center shine */}
      <ellipse
        cx="50"
        cy="35"
        rx="8"
        ry="4"
        fill="url(#whiteHighlightGradient)"
        transform="rotate(-15 50 35)"
      />
      
      {/* Small sparkle */}
      <circle
        cx="42"
        cy="25"
        r="1.5"
        fill="white"
        fillOpacity="1"
      />
      
      {/* Another sparkle */}
      <circle
        cx="58"
        cy="45"
        r="1"
        fill="white"
        fillOpacity="0.8"
      />
    </svg>
  );
};