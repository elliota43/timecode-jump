(() => {
  const ID = "__timejump_overlay__";
  const LAST_KEY = "__timejump_last__";

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TIMEJUMP_TOGGLE") toggleOverlay();
  });

  function toggleOverlay() {
    let overlay = document.getElementById(ID);
    if (!overlay) overlay = createOverlay();

    const isHidden = overlay.style.display === "none";
    overlay.style.display = isHidden ? "block" : "none";

    if (isHidden) {
      const input = overlay.querySelector("input");
      input.value = localStorage.getItem(LAST_KEY) || "";
      input.focus();
      input.select();
    }
  }

  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = ID;
    overlay.style.cssText = `
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      display: block;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background: rgba(20, 20, 25, 0.92);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 10px 10px;
      min-width: 320px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.45);
      backdrop-filter: blur(10px);
    `;

    const row = document.createElement("div");
    row.style.cssText = `display:flex; gap:10px; align-items:center;`;

    const label = document.createElement("div");
    label.textContent = "Jump to";
    label.style.cssText = `color: rgba(255,255,255,0.85); font-weight: 600; font-size: 13px;`;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "e.g. 1:23, 01:02:03, 90, 1h2m3s";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.style.cssText = `
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      color: rgba(255,255,255,0.92);
      border-radius: 10px;
      padding: 8px 10px;
      outline: none;
      font-size: 13px;
    `;

    const hint = document.createElement("div");
    hint.style.cssText = `margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.55);`;
    hint.textContent = "Enter = seek • Esc = close";

    const status = document.createElement("div");
    status.style.cssText = `margin-top: 6px; font-size: 12px; color: rgba(255,120,120,0.9); display:none;`;
    status.textContent = "Couldn’t find a video on this page.";

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        overlay.style.display = "none";
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const raw = input.value.trim();
        const seconds = parseTimecode(raw);

        if (seconds == null) {
          showError(status, "Invalid timecode. Try 1:23 / 01:02:03 / 90 / 1h2m3s");
          return;
        }

        const vid = findBestVideo();
        if (!vid) {
          showError(status, "Couldn’t find a video on this page.");
          return;
        }

        localStorage.setItem(LAST_KEY, raw);
        status.style.display = "none";

        // clamp within duration if known
        const dur = Number.isFinite(vid.duration) ? vid.duration : null;
        let t = Math.max(0, seconds);
        if (dur != null && dur > 0) t = Math.min(t, dur - 0.001);

        vid.currentTime = t;
        vid.dispatchEvent(new Event("timeupdate", { bubbles: true }));
        overlay.style.display = "none";
      }
    });

    // Click outside to close (nice UX)
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) overlay.style.display = "none";
    });

    row.appendChild(label);
    row.appendChild(input);
    box.appendChild(row);
    box.appendChild(hint);
    box.appendChild(status);
    overlay.appendChild(box);

    document.documentElement.appendChild(overlay);

    return overlay;
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = "block";
  }

  function findBestVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;

    // Prefer the biggest visible video (works well for YouTube + most sites)
    const scored = videos
      .map((v) => {
        const r = v.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
          r.top < (window.innerHeight || 0) && r.left < (window.innerWidth || 0);
        const area = Math.max(0, r.width) * Math.max(0, r.height);
        return { v, score: (visible ? 1 : 0) * 1_000_000 + area };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.v || null;
  }

  // Supports:
  // - "90" (seconds)
  // - "1:23" (mm:ss)
  // - "01:02:03" (hh:mm:ss)
  // - "1h2m3s", "2m", "45s"
  function parseTimecode(input) {
    if (!input) return null;

    // pure number => seconds
    if (/^\d+(\.\d+)?$/.test(input)) return Math.floor(Number(input));

    // h/m/s format
    if (/^\d+h|\d+m|\d+s/i.test(input)) {
      const m = input.toLowerCase().match(/(\d+)\s*h|(\d+)\s*m|(\d+)\s*s/g);
      if (!m) return null;

      let total = 0;
      for (const part of m) {
        const n = parseInt(part, 10);
        if (part.includes("h")) total += n * 3600;
        else if (part.includes("m")) total += n * 60;
        else if (part.includes("s")) total += n;
      }
      return total;
    }

    // colon format
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(input)) {
      const parts = input.split(":").map((p) => parseInt(p, 10));
      if (parts.some((n) => Number.isNaN(n))) return null;

      if (parts.length === 2) {
        const [mm, ss] = parts;
        if (ss >= 60) return null;
        return mm * 60 + ss;
      }
      if (parts.length === 3) {
        const [hh, mm, ss] = parts;
        if (mm >= 60 || ss >= 60) return null;
        return hh * 3600 + mm * 60 + ss;
      }
    }

    return null;
  }

  // Start hidden by default (so it doesn't appear on load)
  // We'll create it lazily on first hotkey.
})();
