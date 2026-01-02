(() => {
  const ID = "__timejump_overlay__";
  const LAST_KEY = "__timejump_last__";

  let activeVideo = null;
  let ro = null;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TIMEJUMP_TOGGLE") toggleOverlay();
  });

  window.addEventListener(
    "resize",
    () => {
      const overlay = document.getElementById(ID);
      if (overlay && overlay.style.display !== "none") positionBoxOverVideo(overlay);
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      const overlay = document.getElementById(ID);
      if (overlay && overlay.style.display !== "none") positionBoxOverVideo(overlay);
    },
    { passive: true, capture: true }
  );

  document.addEventListener("fullscreenchange", () => {
    const overlay = document.getElementById(ID);
    if (overlay && overlay.style.display !== "none") positionBoxOverVideo(overlay);
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
      positionBoxOverVideo(overlay);
    }
  }

  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = ID;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: none;
      background: transparent;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    `;

    const box = document.createElement("div");
    box.dataset.timejumpBox = "1";
    box.style.cssText = `
      position: fixed;
      background: rgba(20, 20, 25, 0.92);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 10px 10px;
      min-width: 340px;
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

        const dur = Number.isFinite(vid.duration) ? vid.duration : null;
        let t = Math.max(0, seconds);
        if (dur != null && dur > 0) t = Math.min(t, dur - 0.001);

        vid.currentTime = t;

        vid.dispatchEvent(new Event("timeupdate", { bubbles: true }));
        vid.dispatchEvent(new Event("seeking", { bubbles: true }));
        vid.dispatchEvent(new Event("seeked", { bubbles: true }));

        overlay.style.display = "none";
      }
    });

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

  function positionBoxOverVideo(overlay) {
    const box = overlay.querySelector("[data-timejump-box]");
    if (!box) return;

    const vid = findBestVideo();
    if (!vid) return;

    if (vid !== activeVideo) {
      activeVideo = vid;
      if (ro) ro.disconnect();
      ro = new ResizeObserver(() => requestAnimationFrame(() => positionBoxOverVideo(overlay)));
      ro.observe(vid);
    }

    const r = vid.getBoundingClientRect();
    const fallback = r.width < 50 || r.height < 50;
    const targetCx = fallback ? window.innerWidth / 2 : r.left + r.width / 2;
    const targetCy = fallback ? window.innerHeight / 2 : r.top + r.height / 2;

    const boxRect = box.getBoundingClientRect();
    let left = targetCx - boxRect.width / 2;
    let top = targetCy - boxRect.height / 2;

    const pad = 10;
    left = Math.max(pad, Math.min(left, window.innerWidth - boxRect.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - boxRect.height - pad));

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.style.display = "block";
  }

  function findBestVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;

    const playing = videos.find((v) => !v.paused && !v.ended && v.readyState >= 2);
    if (playing) return playing;

    const scored = videos
      .map((v) => {
        const r = v.getBoundingClientRect();
        const visible =
          r.width > 0 &&
          r.height > 0 &&
          r.bottom > 0 &&
          r.right > 0 &&
          r.top < window.innerHeight &&
          r.left < window.innerWidth;

        const area = Math.max(0, r.width) * Math.max(0, r.height);
        return { v, score: (visible ? 1 : 0) * 1_000_000 + area };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.v || null;
  }

  function parseTimecode(input) {
    if (!input) return null;

    if (/^\d+(\.\d+)?$/.test(input)) return Math.floor(Number(input));

    if (/[hms]/i.test(input)) {
      const parts = input.toLowerCase().match(/\d+\s*[hms]/g);
      if (!parts) return null;

      let total = 0;
      for (const part of parts) {
        const n = parseInt(part, 10);
        if (Number.isNaN(n)) return null;
        if (part.includes("h")) total += n * 3600;
        else if (part.includes("m")) total += n * 60;
        else if (part.includes("s")) total += n;
      }
      return total;
    }

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(input)) {
      const nums = input.split(":").map((p) => parseInt(p, 10));
      if (nums.some((n) => Number.isNaN(n))) return null;

      if (nums.length === 2) {
        const [mm, ss] = nums;
        if (ss >= 60) return null;
        return mm * 60 + ss;
      }

      if (nums.length === 3) {
        const [hh, mm, ss] = nums;
        if (mm >= 60 || ss >= 60) return null;
        return hh * 3600 + mm * 60 + ss;
      }
    }

    return null;
  }
})();
