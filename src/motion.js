// prefers-reduced-motion helpers: no smooth scrolling, no autoplaying hero video.
const mq = () => (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null);

export const reducedMotion = () => !!mq()?.matches;

// Use for every scrollTo / scrollIntoView call.
export const scrollBehavior = () => (reducedMotion() ? "auto" : "smooth");

// Pause any autoplaying hero video (including ones mounted later) when the
// visitor prefers reduced motion. The poster image stays visible.
export function pauseVideosIfReduced() {
  if (!reducedMotion() || typeof document === "undefined") return () => {};
  const stop = (v) => { try { v.removeAttribute("autoplay"); v.pause(); } catch (e) { /* ignore */ } };
  const sweep = () => document.querySelectorAll("video.hero-video").forEach(stop);
  sweep();
  const mo = new MutationObserver(sweep);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}
