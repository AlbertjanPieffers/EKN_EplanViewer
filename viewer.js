// PDF.js v3 UMD is loaded globally as window.pdfjsLib from index.html.

// Configuration
const PDF_URL = "./docs/project.pdf";

// State
const state = {
  pdf: null,
  page: 1,
  scale: 1.2,
  minScale: 0.4,
  maxScale: 3.0,
  tool: null, // "pen-red" | "pen-green" | "rect-red" | "rect-green" | "text" | null
  strokes: {}, // { "page:1": [ {type, color, path or rect or text}, ... ] }
  drawing: false,
  currentPath: [],
  startPt: null,
  pan: { active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 }
};

// Elements
const pdfCanvas = document.getElementById("pdfCanvas");
const pdfCtx = pdfCanvas.getContext("2d");
const annCanvas = document.getElementById("annCanvas");
const annCtx = annCanvas.getContext("2d");
const wrap = document.getElementById("canvasWrap");

const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomVal = document.getElementById("zoomVal");
const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");

const toolsEl = document.querySelectorAll("[data-tool]");
const undoBtn = document.getElementById("undo");
const clearBtn = document.getElementById("clear");
const saveBtn = document.getElementById("save");
const loadBtn = document.getElementById("load");
const exportJsonBtn = document.getElementById("exportJson");
const importJsonInput = document.getElementById("importJson");

// Helpers
function key() { return `page:${state.page}`; }
function updateZoomLabel() { zoomVal.textContent = `${Math.round(state.scale * 100)}%`; }
function strokesForPage() { return state.strokes[key()] || []; }
function setStrokesForPage(arr) { state.strokes[key()] = arr; }
function pushStroke(stroke) {
  const arr = strokesForPage();
  arr.push(stroke);
  setStrokesForPage(arr);
}

function loadLocal() {
  try {
    const raw = localStorage.getItem("eplan_ann_v2");
    if (raw) state.strokes = JSON.parse(raw);
  } catch (_) {}
}
function saveLocal() {
  localStorage.setItem("eplan_ann_v2", JSON.stringify(state.strokes));
}

function drawAllAnnotations() {
  annCtx.clearRect(0, 0, annCanvas.width, annCanvas.height);
  const arr = strokesForPage();
  for (const s of arr) {
    if (s.type === "pen") {
      annCtx.beginPath();
      annCtx.lineWidth = 2;
      annCtx.strokeStyle = s.color;
      annCtx.lineJoin = "round";
      annCtx.lineCap = "round";
      const p = s.path;
      if (!p || p.length < 2) continue;
      annCtx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) annCtx.lineTo(p[i][0], p[i][1]);
      annCtx.stroke();
    } else if (s.type === "rect") {
      annCtx.lineWidth = 2;
      annCtx.strokeStyle = s.color;
      annCtx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === "text") {
      annCtx.fillStyle = s.color;
      annCtx.font = "16px sans-serif";
      annCtx.fillText(s.value, s.x, s.y);
    }
  }
}

function toCanvasPoint(evt) {
  const rect = annCanvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (annCanvas.width / rect.width);
  const y = (evt.clientY - rect.top) * (annCanvas.height / rect.height);
  return [x, y];
}

// Rendering
async function renderPage() {
  const page = await state.pdf.getPage(state.page);
  const viewport = page.getViewport({ scale: state.scale });

  pdfCanvas.width = Math.floor(viewport.width);
  pdfCanvas.height = Math.floor(viewport.height);
  annCanvas.width = pdfCanvas.width;
  annCanvas.height = pdfCanvas.height;

  await page.render({ canvasContext: pdfCtx, viewport }).promise;
  pageInfo.textContent = `${state.page} / ${state.pdf.numPages}`;
  drawAllAnnotations();
}

// UI events
zoomInBtn.addEventListener("click", () => {
  state.scale = Math.min(state.scale + 0.1, state.maxScale);
  updateZoomLabel();
  renderPage();
});
zoomOutBtn.addEventListener("click", () => {
  state.scale = Math.max(state.scale - 0.1, state.minScale);
  updateZoomLabel();
  renderPage();
});
prevBtn.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  renderPage();
});
nextBtn.addEventListener("click", () => {
  state.page = Math.min(state.pdf.numPages, state.page + 1);
  renderPage();
});
updateZoomLabel();

toolsEl.forEach(btn => {
  btn.addEventListener("click", () => {
    state.tool = btn.dataset.tool;
    annCanvas.style.pointerEvents = "auto";
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    state.tool = null;
    annCanvas.style.pointerEvents = "none";
  }
});

// Annotation drawing
annCanvas.addEventListener("pointerdown", (e) => {
  if (!state.tool) return;
  state.drawing = true;
  const [x, y] = toCanvasPoint(e);
  if (state.tool.startsWith("pen")) {
    state.currentPath = [[x, y]];
  } else if (state.tool.startsWith("rect")) {
    state.startPt = [x, y];
  } else if (state.tool === "text") {
    const value = prompt("Enter note text:");
    if (value && value.trim()) {
      const color = "text-red" in state ? "#ff0000" : "#ffcc00"; // default yellow
      pushStroke({ type: "text", color: "#ffcc00", x, y, value: value.trim() });
      drawAllAnnotations();
      saveLocal();
    }
  }
  e.preventDefault();
});

annCanvas.addEventListener("pointermove", (e) => {
  if (!state.tool || !state.drawing) return;
  const [x, y] = toCanvasPoint(e);

  if (state.tool.startsWith("pen")) {
    const last = state.currentPath[state.currentPath.length - 1];
    state.currentPath.push([x, y]);
    annCtx.beginPath();
    annCtx.moveTo(last[0], last[1]);
    annCtx.lineTo(x, y);
    annCtx.strokeStyle = state.tool.endsWith("red") ? "#ff0000" : "#00ff6a";
    annCtx.lineWidth = 2;
    annCtx.lineJoin = "round";
    annCtx.lineCap = "round";
    annCtx.stroke();
  } else if (state.tool.startsWith("rect")) {
    // Draw live preview
    drawAllAnnotations();
    const [sx, sy] = state.startPt;
    const w = x - sx;
    const h = y - sy;
    annCtx.lineWidth = 2;
    annCtx.strokeStyle = state.tool.endsWith("red") ? "#ff0000" : "#00ff6a";
    annCtx.strokeRect(sx, sy, w, h);
  }
});

annCanvas.addEventListener("pointerup", (e) => {
  if (!state.tool || !state.drawing) return;
  state.drawing = false;

  if (state.tool.startsWith("pen")) {
    const color = state.tool.endsWith("red") ? "#ff0000" : "#00ff6a";
    pushStroke({ type: "pen", color, path: state.currentPath });
    state.currentPath = [];
  } else if (state.tool.startsWith("rect")) {
    const [x2, y2] = toCanvasPoint(e);
    const [sx, sy] = state.startPt;
    const rect = { x: sx, y: sy, w: x2 - sx, h: y2 - sy };
    const color = state.tool.endsWith("red") ? "#ff0000" : "#00ff6a";
    pushStroke({ type: "rect", color, ...rect });
    state.startPt = null;
  }
  drawAllAnnotations();
  saveLocal();
});

// Pan by dragging blank area (use wrapper to scroll)
wrap.addEventListener("mousedown", (e) => {
  if (state.tool) return; // do not pan while drawing
  state.pan.active = true;
  state.pan.startX = e.clientX;
  state.pan.startY = e.clientY;
  const scroller = document.querySelector(".viewer");
  state.pan.scrollLeft = scroller.scrollLeft;
  state.pan.scrollTop = scroller.scrollTop;
});

window.addEventListener("mousemove", (e) => {
  if (!state.pan.active) return;
  const scroller = document.querySelector(".viewer");
  scroller.scrollLeft = state.pan.scrollLeft - (e.clientX - state.pan.startX);
  scroller.scrollTop = state.pan.scrollTop - (e.clientY - state.pan.startY);
});

window.addEventListener("mouseup", () => { state.pan.active = false; });

// Actions
undoBtn.addEventListener("click", () => {
  const arr = strokesForPage();
  arr.pop();
  setStrokesForPage(arr);
  drawAllAnnotations();
  saveLocal();
});
clearBtn.addEventListener("click", () => {
  setStrokesForPage([]);
  drawAllAnnotations();
  saveLocal();
});
saveBtn.addEventListener("click", saveLocal);
loadBtn.addEventListener("click", () => { loadLocal(); drawAllAnnotations(); });

exportJsonBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.strokes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "annotations.json";
  a.click();
  URL.revokeObjectURL(url);
});

importJsonInput.addEventListener("change", async () => {
  const file = importJsonInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data && typeof data === "object") {
      state.strokes = data;
      drawAllAnnotations();
      saveLocal();
    }
  } catch (e) {
    console.error("Invalid JSON:", e);
  } finally {
    importJsonInput.value = "";
  }
});

// Boot
(async function boot() {
  loadLocal();
  const loadingTask = pdfjsLib.getDocument(PDF_URL);
  state.pdf = await loadingTask.promise;
  await renderPage();
})();
