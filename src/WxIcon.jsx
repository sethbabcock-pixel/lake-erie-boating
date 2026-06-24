import React from "react";

// Monochrome (currentColor) SVG weather icon picked from an NWS forecast string.
export default function WxIcon({ short, size = 30 }) {
  const s = (short || "").toLowerCase();
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
  };
  const cloud = <path d="M7 18h9.5a3.5 3.5 0 000-7 5 5 0 00-9.6-1.3A3.6 3.6 0 007 18z" />;
  const sun = (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3V1.5M12 22.5V21M3 12H1.5M22.5 12H21M5.6 5.6l-1-1M19.4 19.4l-1-1M18.4 5.6l1-1M4.6 19.4l1-1" />
    </>
  );
  const miniSun = (
    <>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 3.6V2.2M3.9 8H2.5M11 5.1l.9-.9M4.6 11.5l-.9.9" />
    </>
  );

  if (/thunder|tstm|waterspout/.test(s))
    return <svg {...p}>{cloud}<path d="M12.5 12.5l-2 3.5h3l-2 3.5" /></svg>;
  if (/snow|flurr|sleet|wintry|ice/.test(s))
    return (
      <svg {...p}>{cloud}
        <circle cx="9" cy="21" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="12" cy="22" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="15" cy="21" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    );
  if (/rain|shower|drizzle/.test(s)) {
    const sunny = /sunny|partly|few|intervals/.test(s);
    return (
      <svg {...p}>
        {sunny && miniSun}{cloud}
        <line x1="9" y1="20" x2="8" y2="22.4" /><line x1="12.5" y1="20" x2="11.5" y2="22.4" /><line x1="16" y1="20" x2="15" y2="22.4" />
      </svg>
    );
  }
  if (/fog|haze|mist|smoke/.test(s))
    return <svg {...p}><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="13" x2="20" y2="13" /><line x1="6" y1="17" x2="18" y2="17" /></svg>;
  if (/wind|breez|gust/.test(s))
    return <svg {...p}><path d="M3 8h11a2.5 2.5 0 10-2.5-2.5M3 12h15a2.5 2.5 0 11-2.5 2.5M3 16h9" /></svg>;
  if (/mostly cloudy|overcast|^cloudy|broken|considerable cloud/.test(s))
    return <svg {...p}>{cloud}</svg>;
  if (/partly|mostly sunny|few clouds|intervals/.test(s))
    return <svg {...p}>{miniSun}{cloud}</svg>;
  if (/sunny|clear|hot|fair/.test(s))
    return <svg {...p}>{sun}</svg>;
  return <svg {...p}>{miniSun}{cloud}</svg>;
}
