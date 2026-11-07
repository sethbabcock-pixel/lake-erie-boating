import React from "react";

// Shared monochrome (currentColor) SVG icons — one consistent, professional
// set instead of emoji. Sized in em so the surrounding font-size controls them.
const base = (size) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true, className: "ico",
});

export const IconStar = ({ filled = false, size = "1em" }) => (
  <svg {...base(size)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 3.4l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.4z" />
  </svg>
);

export const IconCheck = ({ size = "1em" }) => (
  <svg {...base(size)} strokeWidth={2.6}><path d="M4.5 12.5l5 5 10-11" /></svg>
);

export const IconClock = ({ size = "1em" }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
);

export const IconNoGo = ({ size = "1em" }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M5.7 5.7l12.6 12.6" /></svg>
);

export const IconAlert = ({ size = "1em" }) => (
  <svg {...base(size)}>
    <path d="M12 3.2L1.9 20.3h20.2L12 3.2z" /><path d="M12 10v4.5" />
    <circle cx="12" cy="17.4" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSunrise = ({ size = "1em" }) => (
  <svg {...base(size)}>
    <path d="M4 18h16M8 18a4 4 0 1 1 8 0" />
    <path d="M12 4v4M5.2 8.2l1.4 1.4M18.8 8.2l-1.4 1.4M9.5 2.8L12 5.3l2.5-2.5" transform="translate(0 1.5)" />
  </svg>
);

export const IconSunset = ({ size = "1em" }) => (
  <svg {...base(size)}>
    <path d="M4 18h16M8 18a4 4 0 1 1 8 0" />
    <path d="M12 9V5M5.2 8.2l1.4 1.4M18.8 8.2l-1.4 1.4M9.5 7.5L12 10l2.5-2.5" transform="translate(0 1.5)" />
  </svg>
);

export const IconDoc = ({ size = "1em" }) => (
  <svg {...base(size)} strokeWidth={1.9}>
    <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
);

export const IconRefresh = ({ size = "1em" }) => (
  <svg {...base(size)} strokeWidth={2.2}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 3v4h-4" /></svg>
);

// ---- Added for the UX review (verdict marks + emoji replacement) ----
export const IconX = ({ size = "1em" }) => (
  <svg {...base(size)} strokeWidth={2.6}><path d="M6 6l12 12M18 6L6 18" /></svg>
);

// "No data / unknown": a neutral dash in a ring, deliberately not a check.
export const IconDash = ({ size = "1em" }) => (
  <svg {...base(size)} strokeWidth={2.4}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
);

export const IconPin = ({ size = "1em" }) => (
  <svg {...base(size)}><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
);

export const IconWave = ({ size = "1em" }) => (
  <svg {...base(size)}><path d="M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" /></svg>
);

export const IconMail = ({ size = "1em" }) => (
  <svg {...base(size)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6.5L20.5 7" /></svg>
);
