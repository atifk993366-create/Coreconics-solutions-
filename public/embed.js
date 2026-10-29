/*! Labsmart embed SDK — drop-in widget for partner websites */
(function () {
  var listeners = {};
  window.addEventListener("message", function (e) {
    var d = e.data; if (!d || d.source !== "labsmart") return;
    if (!window.__lsOrigin || e.origin !== window.__lsOrigin) return; // only trust our own iframe origin
    (listeners[d.type] || []).forEach(function (f) { try { f(d.data); } catch (x) { console.error(x); } });
  });
  window.LabsmartEmbed = {
    mount: function (selector, opts) {
      var el = typeof selector === "string" ? document.querySelector(selector) : selector; if (!el) throw new Error("LabsmartEmbed: container not found");
      if (!opts || !opts.url) throw new Error("LabsmartEmbed: url (from /embed/session) required");
      window.__lsOrigin = new URL(opts.url).origin;
      var f = document.createElement("iframe"); f.src = opts.url + (opts.view ? "#/" + encodeURIComponent(opts.view) : "");
      f.style.cssText = "width:100%;height:100%;min-height:600px;border:0;border-radius:12px"; f.allow = "clipboard-write"; f.title = "Lab";
      el.innerHTML = ""; el.appendChild(f); return f;
    },
    on: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  };
})();
