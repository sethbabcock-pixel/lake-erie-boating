// Tiny colour helpers shared by the sponsor hero (render-time text guard) and
// the admin Sponsors editor (warnings). Hex only (#rgb / #rrggbb); anything
// else returns null so callers leave the sponsor's value untouched.
export const AA = 4.5;
export const WHITE = "#ffffff";
export const NEAR_BLACK = "#11151c";

export function parseHex(h) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || "").trim());
  if (!m) return null;
  let x = m[1];
  if (x.length === 3) x = x.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
}
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);

// WCAG contrast ratio, or null when either colour isn't a parseable hex.
export function contrast(a, b) {
  const A = parseHex(a), B = parseHex(b);
  if (!A || !B) return null;
  const [hi, lo] = [lum(A), lum(B)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Text colour for `bg`: the sponsor's own `fg` when it passes AA, else white or
// near-black, whichever contrasts more. Unparseable colours pass through.
export function readableOn(fg, bg) {
  const r = contrast(fg, bg);
  if (r == null || r >= AA) return fg;
  return (contrast(WHITE, bg) || 0) >= (contrast(NEAR_BLACK, bg) || 0) ? WHITE : NEAR_BLACK;
}

// CIE76 colour distance (perceptual; ~2.3 is a just-noticeable difference).
function lab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function colorDistance(a, b) {
  const A = parseHex(a), B = parseHex(b);
  if (!A || !B) return Infinity;
  const p = lab(A), q = lab(B);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// The verdict palette (light + dark theme tokens in styles.css).
export const VERDICT_COLORS = [
  ["GO green", ["#1B936A", "#33CC99"]],
  ["CAUTION gold", ["#A9831C", "#D4AF37", "#E3C04A"]],
  ["NO-GO red", ["#C0392B", "#E2664E"]],
];
export const VERDICT_CLOSE = 18;

// Name of the verdict colour `hex` is close to, or "".
export function nearVerdict(hex) {
  for (const [name, list] of VERDICT_COLORS) if (list.some((v) => colorDistance(hex, v) < VERDICT_CLOSE)) return name;
  return "";
}
