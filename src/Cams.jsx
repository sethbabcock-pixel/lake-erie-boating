import React, { useEffect, useMemo, useRef, useState } from "react";
import { relevantLinkCams, camSrc, camLink, camIsImage, camIsReplay, camPlace, fmtMiles, nearestCamsWithDist } from "./cams.js";

// Monochrome currentColor icons (Lucide-style), sized in em so they track text.
const VideoIcon = (p) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" />
  </svg>
);
const PhotoIcon = (p) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </svg>
);
const CamTypeIcon = ({ cam, ...p }) => (camIsImage(cam) ? <PhotoIcon {...p} /> : <VideoIcon {...p} />);
const saveDataOn = () => typeof navigator !== "undefined" && Boolean(navigator.connection && navigator.connection.saveData);
const SAFETY_LINE = "One view, one moment — a calm harbor doesn't mean calm water outside it.";
const REPORT_REASONS = ["Not water", "Offline", "Wrong place", "Other"];
const ExternalIcon = (p) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

// Report the selected cam. Sends the existing /api/request-cam fields (spot +
// note are what the endpoint requires today) plus { cam, reason } for the
// extended endpoint, so it works before and after that change.
function CamReport({ cam, spotName, lat, lon }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState("idle");
  const [err, setErr] = useState("");
  useEffect(() => { setOpen(false); setState("idle"); setErr(""); }, [cam && cam.name]);
  const send = async (reason) => {
    setState("sending"); setErr("");
    try {
      const r = await fetch("/api/request-cam", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot: spotName, lat, lon, webcam: "", note: `Cam report: ${reason} — ${cam.name}`, email: "", current: cam.name, cam: cam.name, reason }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong.");
      setState("done");
    } catch (e) { setState("idle"); setErr(e.message); }
  };
  if (state === "done") return <div className="camreport-done" role="status">Thanks — we'll check it.</div>;
  return (
    <div className="camreport">
      <button type="button" className="camlink" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Report this cam</button>
      {open && (
        <div className="camreport-reasons" role="group" aria-label="What's wrong with this cam?">
          {REPORT_REASONS.map((r) => (
            <button key={r} type="button" className="camlink" disabled={state === "sending"} onClick={() => send(r)}>{r}</button>
          ))}
        </div>
      )}
      {err && <div className="modal-err" role="alert">{err}</div>}
    </div>
  );
}

// Footer under the player: the current cam's direct link, a report button, and
// spot-relevant cam directories collapsed behind a disclosure.
function CamLinks({ cam, lat, lon, lake, spotName }) {
  const dirs = relevantLinkCams(lat, lon, lake);
  if (!cam && !dirs.length) return null;
  return (
    <>
      {cam && (
        <div className="camlinks">
          <a className="camlink primary" href={camLink(cam)} target="_blank" rel="noopener noreferrer">
            Open this cam <ExternalIcon />
          </a>
          <CamReport cam={cam} spotName={spotName} lat={lat} lon={lon} />
        </div>
      )}
      {dirs.length > 0 && (
        <details className="camdirs">
          <summary>More cams nearby ({dirs.length})</summary>
          <div className="camlinks">
            {dirs.map((c) => (
              <a key={c.name} className="camlink" href={c.url} target="_blank" rel="noopener noreferrer" title={c.name}>
                {c.name} <ExternalIcon />
              </a>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

// "These cams are wrong / not working" → suggest a better one for this spot.
// Auto-nearest webcams (e.g. Windy) can surface the wrong view (a highway, not
// the water), so let boaters point us at the right feed; it lands in /admin.
function CamSuggest({ spotName, lat, lon, current }) {
  const [open, setOpen] = useState(false);
  const [webcam, setWebcam] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!webcam.trim() && !note.trim()) { setErr("Add a webcam link or a note."); return; }
    setState("sending"); setErr("");
    try {
      const r = await fetch("/api/request-cam", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spot: spotName, lat, lon, webcam, note, email, current }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong.");
      setState("done");
    } catch (e2) { setErr(e2.message); }
  };
  if (state === "done") return <div className="camsuggest-done">Thanks — we'll take a look and get the right cam in.</div>;
  return (
    <div className="camsuggest">
      {!open ? (
        <button className="linklike" onClick={() => setOpen(true)}>Cams wrong or not working? Suggest a better one →</button>
      ) : (
        <form className="camsuggest-form" onSubmit={submit}>
          <input className="field" value={webcam} onChange={(e) => setWebcam(e.target.value)} placeholder="Link to a better webcam (harbor, marina, beach cam)" maxLength={300} />
          <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Or tell us what's wrong (e.g. these show the highway, not the water)" />
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email (optional)" maxLength={254} />
          {err && <div className="modal-err">{err}</div>}
          <button className="cbtn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send suggestion"}</button>
        </form>
      )}
    </div>
  );
}

// Load the YouTube IFrame Player API once. The player reports real errors
// (ended stream / "recording not available" / embedding disabled) that a plain
// iframe's onLoad can't — that's how we catch dead YouTube cams client-side,
// since YouTube blocks server-side liveness checks from datacenter IPs.
let ytApiPromise;
function loadYT() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

function YouTubeCam({ videoId, title, onLoaded, onFail }) {
  const holder = useRef(null);
  useEffect(() => {
    let player, watchdog, cancelled = false;
    const inner = document.createElement("div");
    inner.style.width = "100%"; inner.style.height = "100%";
    if (holder.current) holder.current.appendChild(inner);
    loadYT().then((YT) => {
      if (cancelled || !YT) return;
      player = new YT.Player(inner, {
        width: "100%", height: "100%", videoId,
        playerVars: { autoplay: 1, mute: 1, rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: () => {
            try { const f = player.getIframe && player.getIframe(); if (f && title) f.title = title; } catch {}
            // If it never actually starts playing/buffering, the stream is dead.
            watchdog = setTimeout(() => {
              const st = player && player.getPlayerState && player.getPlayerState();
              if (st !== 1 && st !== 3) onFail();
            }, 9000);
          },
          onStateChange: (e) => {
            if (e.data === 1 || e.data === 3) {
              clearTimeout(watchdog);
              // An ended live stream replays as an old recording — not a live
              // view of the water. The player flags live content; treat an
              // explicit isLive === false as dead (absent flag → trust it).
              const vd = player && player.getVideoData && player.getVideoData();
              if (e.data === 1 && vd && vd.isLive === false) { onFail(); return; }
              onLoaded();
            } // playing / buffering
            else if (e.data === 0) onFail(); // ended
          },
          onError: () => { clearTimeout(watchdog); onFail(); },
        },
      });
    });
    return () => {
      cancelled = true; clearTimeout(watchdog);
      try { player && player.destroy(); } catch {}
    };
  }, [videoId, title]);
  return <div ref={holder} className="ytholder" />;
}

const ytPoster = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault_live.jpg`;

export default function Cams({ lat, lon, spotName, lake }) {
  // The effective cam list comes back with the status check (built-ins minus
  // any the admin disabled, plus admin-added feeds); the bundled list is the
  // fallback while loading or if the endpoint is unreachable.
  const [serverCams, setServerCams] = useState(null);
  // Pull more than we'll show so we can drop any that are offline right now.
  const ranked = useMemo(
    () => nearestCamsWithDist(lat, lon, lake, 12, serverCams || undefined),
    [lat, lon, lake, serverCams]
  );
  const candidates = useMemo(() => ranked.map((r) => r.cam), [ranked]);
  const miles = useMemo(() => Object.fromEntries(ranked.map((r) => [r.cam.name, r.miles])), [ranked]);
  const isFar = ranked.length > 0 && ranked[0].far;

  // Server-side liveness for the NON-YouTube feeds (images, ipcamlive, wetmet,
  // pixelcaster): { "<cam name>": "live" | "offline" | "unknown" }.
  // YouTube cams come back "unknown" (YT blocks edge checks) and are validated
  // client-side by the player instead. null = still checking.
  const [status, setStatus] = useState(null);
  // YouTube cams the player reported dead this session → also hidden.
  const [failed, setFailed] = useState({});

  useEffect(() => {
    let abort = false;
    setStatus(null); setFailed({}); setServerCams(null);
    const pt = (lat != null && lon != null) ? `&lat=${lat}&lon=${lon}` : "";
    fetch(`/marine/cams?lake=${encodeURIComponent(lake || "Lake Erie")}${pt}`)
      .then((r) => r.json())
      .then((d) => {
        if (abort) return;
        if (Array.isArray(d.cams) && d.cams.length) setServerCams(d.cams);
        setStatus(d.status || {});
      })
      .catch(() => { if (!abort) setStatus({}); });
    const t = setTimeout(() => { if (!abort) setStatus((s) => s ?? {}); }, 8000);
    return () => { abort = true; clearTimeout(t); };
  }, [lake, lat, lon]);

  // Hide cams confirmed offline (server) or reported dead (player). Fall back to
  // the full list if that would leave nothing, so the section is never empty.
  const cams = useMemo(() => {
    const base = status ? candidates.filter((c) => status[c.name] !== "offline") : candidates.slice();
    const ok = base.filter((c) => !failed[c.name]);
    return (ok.length ? ok : base).slice(0, 8);
  }, [candidates, status, failed]);
  const hiddenCount = candidates.length - cams.length;

  const [sel, setSel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [iframeFail, setIframeFail] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [started, setStarted] = useState(false); // user tapped play
  const [loadedAt, setLoadedAt] = useState(null); // image cams: last successful load
  const cam = cams[sel] || cams[0];
  const saveData = saveDataOn();
  // Images load straight away (they are the poster) unless Data Saver is on.
  const needsTap = cam && !started && (!camIsImage(cam) || saveData);

  useEffect(() => { setSel(0); }, [lat, lon, lake]);
  useEffect(() => { setSel(0); }, [cams.length]); // a cam dropped out → jump to a working one
  useEffect(() => { setLoaded(false); setIframeFail(false); setTimedOut(false); setStarted(false); setLoadedAt(null); }, [cam]);

  const markFailed = (name) => setFailed((f) => (f[name] ? f : { ...f, [name]: true }));

  // Refresh snapshot (image) cams on a timer with a cache-buster. Paused while
  // the tab is hidden; slower on Data Saver.
  const [bust, setBust] = useState(0);
  const refreshMs = saveData ? 60000 : 15000;
  useEffect(() => {
    if (!camIsImage(cam) || needsTap) return;
    const tick = () => { if (!document.hidden) setBust((b) => b + 1); };
    const t = setInterval(tick, refreshMs);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [cam, needsTap, refreshMs]);

  // No load signal in time → say we can't confirm (never silently claim "Live").
  useEffect(() => {
    if (loaded || !cam || needsTap || iframeFail) return;
    const t = setTimeout(() => setTimedOut(true), camIsImage(cam) ? 10000 : 15000);
    return () => clearTimeout(t);
  }, [cam, loaded, needsTap, iframeFail]);

  const heading = isFar && cam && miles[cam.name] != null ? `Nearest cam · ${Math.round(miles[cam.name])} mi away` : "Live cams";

  if (status === null) {
    return (
      <section className="card">
        <div className="card-head"><h2>Live cams</h2></div>
        {/* Inside a sized .camwrap: reserves the player's 16:9 space and keeps the
            absolutely-positioned spinner in the card (it once anchored to the
            viewport, and React reused that node, scoring a full-screen layout shift). */}
        <div className="camwrap" key="cam-pending"><div className="camloading" role="status" aria-live="polite"><span className="spinner" />finding live cams…</div></div>
      </section>
    );
  }

  if (!cams.length) {
    return (
      <section className="card">
        <div className="card-head"><h2>Live cams</h2></div>
        <div className="camempty">No live webcams for this spot right now; they come and go. Check the directory links below, or point us at one.</div>
        <CamLinks lat={lat} lon={lon} lake={lake} spotName={spotName} />
        <CamSuggest spotName={spotName} lat={lat} lon={lon} current="" />
      </section>
    );
  }

  // Chip driven by actual state, never by feed shape alone.
  const failedNow = iframeFail || timedOut;
  const isImg = camIsImage(cam);
  let chip;
  if (failedNow) chip = { cls: "warn", text: "Can't confirm live" };
  else if (camIsReplay(cam)) chip = { cls: "replay", text: "Replay" };
  else if (isImg) {
    const mins = loadedAt ? Math.floor((Date.now() - loadedAt) / 60000) : null;
    chip = { cls: "photo", text: !loadedAt ? `Photo · refreshes every ${saveData ? 60 : 15} sec` : mins < 1 ? "Photo · updated just now" : `Photo · updated ${mins}m ago` };
  } else if (loaded) chip = { cls: "video", text: "Live" };
  else chip = { cls: "photo", text: needsTap ? "Tap to play" : "Loading…" };

  const mi = miles[cam.name];
  const place = camPlace(cam);
  const where = mi != null ? `${place} · ${fmtMiles(mi)} away` : place;
  const title = `Webcam: ${cam.name}${mi != null ? `, ${fmtMiles(mi)} from ${spotName || "this spot"}` : ""}`;
  const go = (i) => setSel((i + cams.length) % cams.length);

  return (
    <section className="card">
      <div className="card-head">
        <h2>{heading}</h2>
        <span className={`cam-kind ${chip.cls}`} role="status" aria-live="polite"><CamTypeIcon cam={cam} /> {chip.text}</span>
      </div>

      <div className="camsel-wrap">
        <CamTypeIcon cam={cam} className="camsel-ic" />
        <select className="sel camsel" value={sel} onChange={(e) => setSel(Number(e.target.value))} aria-label="Choose a webcam" title={cam.name}>
          {cams.map((c, i) => (
            <option key={c.name} value={i} title={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      {cams.length > 1 && (
        <div className="camnav">
          <button type="button" className="camlink" onClick={() => go(sel - 1)} aria-label="Previous cam">‹ Prev</button>
          <span>{sel + 1} of {cams.length}</span>
          <button type="button" className="camlink" onClick={() => go(sel + 1)} aria-label="Next cam">Next ›</button>
        </div>
      )}

      <div className={`camwrap${isImg && !needsTap ? " photo" : ""}${isImg && loaded ? " ready" : ""}`}>
        {needsTap ? (
          <button type="button" className="campost" onClick={() => setStarted(true)} aria-label={`${isImg ? "Load photo" : "Play"}: ${cam.name}`}>
            {cam.yt && <img src={ytPoster(cam.yt)} alt="" loading="lazy" decoding="async" />}
            <span className="campost-name">{cam.name}</span>
            <span className="campost-play" aria-hidden="true">▶</span>
          </button>
        ) : (
          <>
            {!loaded && !failedNow && <div className="camloading" role="status" aria-live="polite"><span className="spinner" />loading {cam.name}…</div>}
            {failedNow && (
              <div className="camloading" role="status" aria-live="polite">
                <span>{iframeFail ? "This cam isn't responding right now." : "Can't confirm this cam is live."}{" "}
                  <a href={camLink(cam)} target="_blank" rel="noopener noreferrer">Open it directly ↗</a></span>
              </div>
            )}
            {isImg ? (
              <img key={cam.name} alt={`Still from ${cam.name}`} src={`${cam.img}?t=${bust}`}
                onLoad={() => { setLoaded(true); setLoadedAt(Date.now()); setTimedOut(false); setIframeFail(false); }} onError={() => setIframeFail(true)}
                style={{ opacity: loaded ? 1 : 0 }} />
            ) : cam.yt ? (
              <YouTubeCam key={cam.name} videoId={cam.yt} title={title}
                onLoaded={() => setLoaded(true)} onFail={() => markFailed(cam.name)} />
            ) : (
              <iframe key={cam.name} title={title} src={camSrc(cam)} loading="lazy"
                allow="autoplay; fullscreen; encrypted-media"
                onLoad={() => setLoaded(true)} style={{ opacity: loaded || failedNow ? 1 : 0 }} />
            )}
          </>
        )}
      </div>

      <div className={`camwhere${mi != null && mi > 25 ? " far" : ""}`} title={cam.name}>{where}</div>
      <div className="camsafety">{SAFETY_LINE}</div>

      <CamLinks cam={cam} lat={lat} lon={lon} lake={lake} spotName={spotName} />
      <div className="hint">
        {isImg
          ? `Still image, refreshes about every ${saveData ? 60 : 15} seconds.`
          : camIsReplay(cam) ? "Recorded replay or timelapse, not a live view." : "Video. Some players need a tap to start."}
        {hiddenCount > 0 && ` ${hiddenCount} cam${hiddenCount > 1 ? "s" : ""} not responding, hidden.`}
      </div>
      <CamSuggest spotName={spotName} lat={lat} lon={lon} current={cams.map((c) => c.name).join(", ")} />
    </section>
  );
}
