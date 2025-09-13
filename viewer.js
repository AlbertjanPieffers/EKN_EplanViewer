// Import PDF.js as an ES module (v4 uses .mjs). Keep versions in both URLs identical.
import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs";

// If the rest of your code expects a global, keep this line:
window.pdfjsLib = pdfjsLib;


// Basic PDF viewer with thumbnails, zoom, paging, simple text search and annotation overlay.

const PDF_URL = "./docs/project.pdf";

const state = {
  pdf: null,
  page: 1,
  scale: 1.2,
  minScale: 0.4,
  maxScale: 3.0,
  searchQuery: "",
  annotating: false,
  annotations: {}, // { "<page>": [ { path: [ [x,y], ... ] } ] }
};

const pdfCanvas = document.getElementById("pdfCanvas");
const pdfCtx = pdfCanvas.getContext("2d");
const annCanvas = document.getElementById("annCanvas");
const annCtx = annCanvas.getContext("2d");

const thumbsEl = document.getElementById("thumbs");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomVal = document.getElementById("zoomVal");
const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const toggleAnnotate = document.getElementById("toggleAnnotate");
const clearAnn = document.getElementById("clearAnn");
const canvasHost = document.getElementById("canvasHost");

function loadAnnotations() {
  try {
    const raw = localStorage.getItem("eplan_ann");
    if (raw) state.annotations = JSON.parse(raw);
  } catch (_) {}
}

function saveAnnotations() {
  localStorage.setItem("eplan_ann", JSON.stringify(state.annotations));
}

function updateZoomLabel() {
  zoomVal.textContent = `${Math.round(state.scale * 100)}%`;
}

async function renderPage() {
  const page = await state.pdf.getPage(state.page);
  const viewport = page.getViewport({ scale: state.scale });

  pdfCanvas.width = Math.floor(viewport.width);
  pdfCanvas.height = Math.floor(viewport.height);
  annCanvas.width = pdfCanvas.width;
  annCanvas.height = pdfCanvas.height;

  // Render PDF
  await page.render({
    canvasContext: pdfCtx,
    viewport
  }).promise;

  pageInfo.textContent = `${state.page} / ${state.pdf.numPages}`;

  // Render existing annotations
  drawAnnotations();
}

function drawAnnotations() {
  annCtx.clearRect(0, 0, annCanvas.width, annCanvas.height);
  const pageKey = String(state.page);
  const items = state.annotations[pageKey] || [];
  annCtx.lineWidth = 2;
  annCtx.strokeStyle = "#ffcc00";
  annCtx.lineJoin = "round";
  annCtx.lineCap = "round";
  for (const ann of items) {
    const path = ann.path;
    if (!path || path.length < 2) continue;
    annCtx.beginPath();
    annCtx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) {
      annCtx.lineTo(path[i][0], path[i][1]);
    }
    annCtx.stroke();
  }
}

async function buildThumbnails(pdf) {
  thumbsEl.innerHTML = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.2 });
    const c = document.createElement("canvas");
    c.width = Math.floor(viewport.width);
    c.height = Math.floor(viewport.height);
    const ctx = c.getContext("2d");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const wrap = document.createElement("div");
    wrap.className = "thumb";
    wrap.appendChild(c);
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = `Page ${i}`;
    wrap.appendChild(label);
    wrap.addEventListener("click", () => {
      state.page = i;
      renderPage();
    });
    thumbsEl.appendChild(wrap);
  }
}

async function doSearch() {
  // Simple on-page text search: highlight matches by scrolling to first match (basic demo).
  // For robust search across all pages, consider building a text index by walking all pages.
  const q = searchInput.value.trim();
  if (!q) return;

  // Try to find next page containing the query (basic loop)
  let start = state.page;
  for (let i = 0; i < state.pdf.numPages; i++) {
    const pageNum = ((start - 1 + i) % state.pdf.numPages) + 1;
    const page = await state.pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(it => it.str).join(" ").toLowerCase();
    if (text.includes(q.toLowerCase())) {
      state.page = pageNum;
      await renderPage();
      break;
    }
  }
}

function setAnnotating(on) {
  state.annotating = on;
  annCanvas.style.pointerEvents = on ? "auto" : "none";
}

function attachAnnotationEvents() {
  let drawing = false;
  let currentPath = [];

  function toCanvasPoint(evt) {
    const rect = annCanvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * (annCanvas.width / rect.width);
    const y = (evt.clientY - rect.top) * (annCanvas.height / rect.height);
    return [x, y];
  }

  annCanvas.addEventListener("pointerdown", (e) => {
    if (!state.annotating) return;
    drawing = true;
    currentPath = [toCanvasPoint(e)];
    e.preventDefault();
  });

  annCanvas.addEventListener("pointermove", (e) => {
    if (!state.annotating || !drawing) return;
    const pt = toCanvasPoint(e);
    const last = currentPath[currentPath.length - 1];
    currentPath.push(pt);
    annCtx.beginPath();
    annCtx.moveTo(last[0], last[1]);
    annCtx.lineTo(pt[0], pt[1]);
    annCtx.strokeStyle = "#ffcc00";
    annCtx.lineWidth = 2;
    annCtx.lineCap = "round";
    annCtx.lineJoin = "round";
    annCtx.stroke();
    e.preventDefault();
  });

  const finish = () => {
    if (!drawing) return;
    drawing = false;
    const pageKey = String(state.page);
    state.annotations[pageKey] = state.annotations[pageKey] || [];
    state.annotations[pageKey].push({ path: currentPath });
    saveAnnotations();
  };

  annCanvas.addEventListener("pointerup", finish);
  annCanvas.addEventListener("pointerleave", finish);
}

function initUI() {
  searchBtn.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

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

  toggleAnnotate.addEventListener("change", (e) => {
    setAnnotating(e.target.checked);
  });

  clearAnn.addEventListener("click", () => {
    const pageKey = String(state.page);
    state.annotations[pageKey] = [];
    saveAnnotations();
    drawAnnotations();
  });

  // Basic drag-to-pan on the main host (for large pages)
  let panning = false;
  let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;
  const scroller = document.querySelector(".viewer");

  canvasHost.addEventListener("mousedown", (e) => {
    if (state.annotating) return;
    panning = true;
    startX = e.clientX;
    startY = e.clientY;
    scrollLeft = scroller.scrollLeft;
    scrollTop = scroller.scrollTop;
  });

  window.addEventListener("mousemove", (e) => {
    if (!panning) return;
    scroller.scrollLeft = scrollLeft - (e.clientX - startX);
    scroller.scrollTop = scrollTop - (e.clientY - startY);
  });
  window.addEventListener("mouseup", () => { panning = false; });
}

async function boot() {
  loadAnnotations();
  updateZoomLabel();
  initUI();
  attachAnnotationEvents();

  const pdf = await pdfjsLib.getDocument(PDF_URL).promise;
  state.pdf = pdf;

  await buildThumbnails(pdf);
  await renderPage();
}

boot().catch(err => {
  console.error("Failed to initialize viewer:", err);
});

