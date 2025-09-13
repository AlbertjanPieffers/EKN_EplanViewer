// viewer.js — EPLAN-like PDF viewer with red/greenlining, inline text notes, share-link, local autosave, and mobile sidebar.
// Requirements in index.html:
//  - pdf.js v3 UMD loaded and window.pdfjsLib configured
//  - LZString loaded from CDN (for share-link compression)
//  - HTML elements with the IDs used below exist

// ---------------- Configuration ----------------
const PDF_URL   = "./docs/project.pdf";
const LOCAL_KEY = "eplan_ann_v2";
const HASH_KEY  = "ann";
const SIDEBAR_KEY = "eplan_sidebar_open";

// Drawing settings
const PEN_RED    = "#ff0000";
const PEN_GREEN  = "#00ff6a";
const TEXT_COLOR = "#ffcc00";
const TEXT_FONT  = "16px sans-serif";

// ---------------- State ----------------
const state = {
  pdf: null,
  page: 1,
  scale: 1.2,
  minScale: 0.4,
  maxScale: 3.0,
  tool: null, // "pen-red" | "pen-green" | "rect-red" | "rect-green" | "text" | null
  strokes: {}, // { "page:1": [ {type, color, path}|{type, color, x,y,w,h}|{type, color, x,y, value} ] }
  drawing: false,
  currentPath: [],
  startPt: null,
  pan: { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 },
  sharedMode: false // true when data comes from URL hash
};

// ---------------- Boot ----------------
document.addEventListener("DOMContentLoaded", bootViewer);

function bootViewer() {
  // ---- Collect DOM ----
  const ids = [
    "pdfCanvas","annCanvas","canvasWrap",
    "zoomIn","zoomOut","zoomVal",
    "prevPage","nextPage","pageInfo",
    "undo","clear","save","load",
    "exportJson","importJson","shareLink",
    "sidebar","sidebarToggle","sidebarCollapse"
  ];
  const el = {};
  let missing = [];
  for (const id of ids) {
    el[id] = document.getElementById(id);
    if (!el[id]) missing.push("#" + id);
  }
  el.tools = document.querySelectorAll("[data-tool]");

  if (!window.pdfjsLib) {
    console.error("pdfjsLib is not available. Check your index.html includes.");
    return;
  }
  if (missing.length) {
    console.error("Missing DOM elements:", missing.join(", "));
    return;
  }

  // Canvas contexts
  const pdfCtx = el.pdfCanvas.getContext("2d");
  const annCtx = el.annCanvas.getContext("2d");

  // ---- Helpers ----
  function pageKey(n = state.page) { return `page:${n}`; }
  function strokesForPage(n = state.page) { return state.strokes[pageKey(n)] || []; }
  function setStrokesForPage(arr, n = state.page) { state.strokes[pageKey(n)] = arr; }
  function pushStroke(stroke) {
    const arr = strokesForPage();
    arr.push(stroke);
    setStrokesForPage(arr);
  }
  function updateZoomLabel() { el.zoomVal.textContent = `${Math.round(state.scale * 100)}%`; }

  function toCanvasPoint(evt) {
    const rect = el.annCanvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * (el.annCanvas.width / rect.width);
    const y = (evt.clientY - rect.top)  * (el.annCanvas.height / rect.height);
    return [x, y];
  }

  // Local storage
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) state.strokes = JSON.parse(raw) || {};
    } catch (_) {}
  }
  const saveLocalThrottled = (() => {
    let t = null;
    return function save() {
      if (state.sharedMode) return; // do not overwrite when in shared mode
      if (t) return;
      t = setTimeout(() => {
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state.strokes)); } catch (_) {}
        t = null;
      }, 200);
    };
  })();

  // Share link (hash)
  function encodeAnnotationsToHash(obj) {
    const json = JSON.stringify(obj);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return `#${HASH_KEY}=${compressed}`;
  }
  function decodeAnnotationsFromHash() {
    const m = location.hash.match(new RegExp(`#${HASH_KEY}=([^&]+)`));
    if (!m) return null;
    try {
      const json = LZString.decompressFromEncodedURIComponent(m[1]);
      if (!json) return null;
      const data = JSON.parse(json);
      return data && typeof data === "object" ? data : null;
    } catch { return null; }
  }
  function applyHashAnnotationsIfAny() {
    const data = decodeAnnotationsFromHash();
    if (data) {
      state.strokes = data;
      state.sharedMode = true;
      return true;
    }
    state.sharedMode = false;
    return false;
  }

  // ---- Rendering ----
  async function renderPage() {
    const page = await state.pdf.getPage(state.page);
    const viewport = page.getViewport({ scale: state.scale });

    el.pdfCanvas.width  = Math.floor(viewport.width);
    el.pdfCanvas.height = Math.floor(viewport.height);
    el.annCanvas.width  = el.pdfCanvas.width;
    el.annCanvas.height = el.pdfCanvas.height;

    await page.render({ canvasContext: pdfCtx, viewport }).promise;
    el.pageInfo.textContent = `${state.page} / ${state.pdf.numPages}`;
    drawAllAnnotations();
  }

  function drawAllAnnotations() {
    annCtx.clearRect(0, 0, el.annCanvas.width, el.annCanvas.height);
    const arr = strokesForPage();
    for (const s of arr) {
      if (s.type === "pen") {
        annCtx.beginPath();
        annCtx.lineWidth = 2;
        annCtx.strokeStyle = s.color;
        annCtx.lineJoin = "round";
        annCtx.lineCap = "round";
        if (!s.path || s.path.length < 2) continue;
        annCtx.moveTo(s.path[0][0], s.path[0][1]);
        for (let i = 1; i < s.path.length; i++) {
          annCtx.lineTo(s.path[i][0], s.path[i][1]);
        }
        annCtx.stroke();
      } else if (s.type === "rect") {
        annCtx.lineWidth = 2;
        annCtx.strokeStyle = s.color;
        annCtx.strokeRect(s.x, s.y, s.w, s.h);
      } else if (s.type === "text") {
        annCtx.fillStyle = s.color || TEXT_COLOR;
        annCtx.font = TEXT_FONT;
        annCtx.fillText(s.value, s.x, s.y);
      }
    }
  }

  // ---- Inline text editor ----
  function showTextEditor(x, y) {
    const existing = document.getElementById("textEditor");
    if (existing) existing.remove();

    const editor = document.createElement("input");
    editor.type = "text";
    editor.id = "textEditor";
    editor.placeholder = "Type note, Enter to save";
    editor.autocomplete = "off";

    // Position editor over the canvas at the clicked coordinate
    const rect = el.annCanvas.getBoundingClientRect();
    const scaleX = rect.width / el.annCanvas.width;
    const scaleY = rect.height / el.annCanvas.height;

    editor.style.position = "absolute";
    editor.style.left = `${rect.left + x * scaleX}px`;
    editor.style.top  = `${rect.top  + (y - 6) * scaleY}px`;
    editor.style.minWidth = "160px";
    editor.style.padding = "4px 8px";
    editor.style.borderRadius = "6px";
    editor.style.border = "1px solid #444";
    editor.style.background = "#111";
    editor.style.color = "#f3f3f3";
    editor.style.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    editor.style.zIndex = "1000";

    document.body.appendChild(editor);
    editor.focus();

    function commit() {
      const val = editor.value.trim();
      editor.remove();
      if (!val) return;
      pushStroke({ type: "text", color: TEXT_COLOR, x, y, value: val });
      drawAllAnnotations();
      saveLocalThrottled();
    }
    function cancel() { editor.remove(); }

    editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") cancel();
    });
    editor.addEventListener("blur", commit);
  }

  // ---- UI wiring ----
  el.zoomIn.addEventListener("click", () => {
    state.scale = Math.min(state.scale + 0.1, state.maxScale);
    updateZoomLabel();
    renderPage();
  });
  el.zoomOut.addEventListener("click", () => {
    state.scale = Math.max(state.scale - 0.1, state.minScale);
    updateZoomLabel();
    renderPage();
  });
  el.prevPage.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    renderPage();
  });
  el.nextPage.addEventListener("click", () => {
    state.page = Math.min(state.pdf.numPages, state.page + 1);
    renderPage();
  });
  updateZoomLabel();

  el.tools.forEach(btn => {
    btn.addEventListener("click", () => {
      state.tool = btn.dataset.tool;
      el.annCanvas.style.pointerEvents = "auto";
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      state.tool = null;
      el.annCanvas.style.pointerEvents = "none";
    }
  });

  // Drawing handlers
  el.annCanvas.addEventListener("pointerdown", (e) => {
    if (!state.tool) return;

    const [x, y] = toCanvasPoint(e);

    if (state.tool === "text") {
      showTextEditor(x, y);
      e.preventDefault();
      return;
    }

    state.drawing = true;
    if (state.tool.startsWith("pen")) {
      state.currentPath = [[x, y]];
    } else if (state.tool.startsWith("rect")) {
      state.startPt = [x, y];
    }
    e.preventDefault();
  });

  el.annCanvas.addEventListener("pointermove", (e) => {
    if (!state.tool || !state.drawing) return;
    const [x, y] = toCanvasPoint(e);

    if (state.tool.startsWith("pen")) {
      const last = state.currentPath[state.currentPath.length - 1];
      state.currentPath.push([x, y]);
      annCtx.beginPath();
      annCtx.moveTo(last[0], last[1]);
      annCtx.lineTo(x, y);
      annCtx.strokeStyle = state.tool.endsWith("red") ? PEN_RED : PEN_GREEN;
      annCtx.lineWidth = 2;
      annCtx.lineJoin = "round";
      annCtx.lineCap = "round";
      annCtx.stroke();
    } else if (state.tool.startsWith("rect")) {
      drawAllAnnotations(); // live preview
      const [sx, sy] = state.startPt;
      const w = x - sx;
      const h = y - sy;
      annCtx.lineWidth = 2;
      annCtx.strokeStyle = state.tool.endsWith("red") ? PEN_RED : PEN_GREEN;
      annCtx.strokeRect(sx, sy, w, h);
    }
  });

  el.annCanvas.addEventListener("pointerup", (e) => {
    if (!state.tool || !state.drawing) return;
    state.drawing = false;

    if (state.tool.startsWith("pen")) {
      const color = state.tool.endsWith("red") ? PEN_RED : PEN_GREEN;
      pushStroke({ type: "pen", color, path: state.currentPath });
      state.currentPath = [];
    } else if (state.tool.startsWith("rect")) {
      const [x2, y2] = toCanvasPoint(e);
      const [sx, sy] = state.startPt;
      const rect = { x: sx, y: sy, w: x2 - sx, h: y2 - sy };
      const color = state.tool.endsWith("red") ? PEN_RED : PEN_GREEN;
      pushStroke({ type: "rect", color, ...rect });
      state.startPt = null;
    }
    drawAllAnnotations();
    saveLocalThrottled();
  });

  // Pan by dragging the wrapper (scroll the .viewer)
  el.canvasWrap.addEventListener("mousedown", (e) => {
    if (state.tool) return; // do not pan while drawing
    state.pan.active = true;
    state.pan.startX = e.clientX;
    state.pan.startY = e.clientY;
    const scroller = document.querySelector(".viewer");
    state.pan.scrollLeft = scroller.scrollLeft;
    state.pan.scrollTop  = scroller.scrollTop;
  });
  window.addEventListener("mousemove", (e) => {
    if (!state.pan.active) return;
    const scroller = document.querySelector(".viewer");
    scroller.scrollLeft = state.pan.scrollLeft - (e.clientX - state.pan.startX);
    scroller.scrollTop  = state.pan.scrollTop  - (e.clientY - state.pan.startY);
  });
  window.addEventListener("mouseup", () => { state.pan.active = false; });

  // Actions
  el.undo.addEventListener("click", () => {
    const arr = strokesForPage();
    arr.pop();
    setStrokesForPage(arr);
    drawAllAnnotations();
    saveLocalThrottled();
  });
  el.clear.addEventListener("click", () => {
    setStrokesForPage([]);
    drawAllAnnotations();
    saveLocalThrottled();
  });
  el.save.addEventListener("click", () => {
    if (state.sharedMode) {
      alert("You are viewing a shared link. Edit and press Share link to create a new shared URL.");
    } else {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state.strokes)); } catch (_) {}
      alert("Saved locally on this device.");
    }
  });
  el.load.addEventListener("click", () => {
    if (state.sharedMode) {
      alert("Shared link is already loaded from the URL.");
    } else {
      loadLocal();
      drawAllAnnotations();
      alert("Loaded local annotations.");
    }
  });
  el.exportJson.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.strokes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotations.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  el.importJson.addEventListener("change", async () => {
    const file = el.importJson.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data && typeof data === "object") {
        state.strokes = data;
        drawAllAnnotations();
        saveLocalThrottled();
      }
    } catch (e) {
      console.error("Invalid JSON:", e);
    } finally {
      el.importJson.value = "";
    }
  });

  // Share link
  el.shareLink.addEventListener("click", () => {
    const hash = encodeAnnotationsToHash(state.strokes);
    const url = `${location.origin}${location.pathname}${hash}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    alert("Share this URL:\n\n" + url);
  });

  // React to hash changes
  window.addEventListener("hashchange", () => {
    const wasShared = state.sharedMode;
    if (applyHashAnnotationsIfAny()) {
      drawAllAnnotations();
      if (!wasShared) alert("Loaded shared annotations from URL.");
    } else if (wasShared) {
      loadLocal();
      state.sharedMode = false;
      drawAllAnnotations();
    }
  });

  // ---- Collapsible sidebar (mobile friendly) ----
  const isMobile = () => window.matchMedia("(max-width: 900px)").matches;
  function setSidebar(open) {
    if (open) el.sidebar.classList.add("open");
    else el.sidebar.classList.remove("open");
    try { localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0"); } catch (_) {}
  }
  // Restore state
  const savedSidebar = (typeof localStorage !== "undefined") ? localStorage.getItem(SIDEBAR_KEY) : null;
  if (savedSidebar === "1") setSidebar(true);
  else if (savedSidebar === "0") setSidebar(false);
  else setSidebar(!isMobile()); // default: open on desktop, closed on mobile

  el.sidebarToggle.addEventListener("click", () => setSidebar(true));
  el.sidebarCollapse.addEventListener("click", () => setSidebar(false));

  // Optional: edge-swipe to open
  let touchStartX = null;
  window.addEventListener("touchstart", (e) => {
    if (!isMobile()) return;
    if (el.sidebar.classList.contains("open")) return;
    if (e.touches && e.touches[0].clientX < 24) {
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (touchStartX === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    if (dx > 40) {
      setSidebar(true);
      touchStartX = null;
    }
  }, { passive: true });
  window.addEventListener("touchend", () => { touchStartX = null; });

  // ---- Initialize ----
  (async function init() {
    const hasShared = applyHashAnnotationsIfAny();
    if (!hasShared) loadLocal();

    const task = pdfjsLib.getDocument(PDF_URL);
    state.pdf = await task.promise;

    await renderPage();
  })().catch(err => {
    console.error("Failed to initialize viewer:", err);
  });
}
