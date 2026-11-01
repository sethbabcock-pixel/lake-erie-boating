// In-article ad for the static boating guides. Reads the same admin-managed
// settings as the app (/api/site-config → ads: master switch, pause, slot ID)
// and skips ad-free subscribers. Placed before the article's third section so
// it always sits inside real content. The label shows only once Google fills
// the unit; an unfilled or blocked unit is removed. ?adtest=1 serves Google's
// sample ads and keeps the box visible with its status.
(function () {
  var test = /[?&]adtest=1\b/.test(location.search);
  function beacon(status) {
    if (test || Math.random() >= 0.25) return; // same 1-in-4 sample as the app
    try { navigator.sendBeacon("/api/adstat", new Blob([JSON.stringify({ r: [{ p: "guide", s: status }] })], { type: "application/json" })); } catch (e) {}
  }
  Promise.all([
    fetch("/api/site-config").then(function (r) { return r.json(); }),
    fetch("/auth/me", { credentials: "same-origin" }).then(function (r) { return r.json(); }).catch(function () { return null; }),
  ]).then(function (res) {
    var ads = res[0] && res[0].ads, me = res[1];
    if (!ads || !ads.enabled || (ads.off || []).indexOf("guide") >= 0) return;
    var slot = ads.slots && ads.slots.guide;
    if (!/^\d{8,12}$/.test(slot || "") || !/^ca-pub-\d+$/.test(ads.client || "")) return;
    if (me && me.user && me.user.adFree) return;
    var art = document.querySelector("article");
    if (!art) return;
    var h2s = art.querySelectorAll("h2");
    var anchor = h2s[2] || h2s[h2s.length - 1];
    if (!anchor) return;
    var wrap = document.createElement("div");
    wrap.className = "guide-ad pending";
    wrap.innerHTML = '<span class="guide-adlabel">Advertisement' + (test ? " · test" : "") + '</span>';
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", ads.client);
    ins.setAttribute("data-ad-slot", slot);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    if (test) ins.setAttribute("data-adtest", "on");
    wrap.appendChild(ins);
    anchor.parentNode.insertBefore(wrap, anchor);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    var done = false;
    function finish(status) {
      if (done) return; done = true; beacon(status);
      if (status === "filled") wrap.className = "guide-ad";
      else if (!test) wrap.parentNode && wrap.parentNode.removeChild(wrap);
    }
    new MutationObserver(function () {
      var s = ins.getAttribute("data-ad-status");
      if (s === "filled" || s === "unfilled") finish(s);
    }).observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
    setTimeout(function () { finish("noresponse"); }, 12000);
  }).catch(function () {});
})();
