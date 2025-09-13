// No libraries required. Drives the native PDF viewer via URL fragments.

// Path to your PDF (must be same-origin on your static host).
const PDF_PATH = "./docs/project.pdf";

// Some browsers (Chromium-family) honor #page and #zoom fragments.
const state = {
  page: 1,
  zoomPercent: 100,  // accepted: e.g. 50, 100, 150; browser may approximate
};

const pdfFrame = document.getElementById("pdfFrame");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomVal = document.getElementById("zoomVal");
const pageInput = document.getElementById("pageInput");
const openNewTab = document.getElementById("openNewTab");

function buildPdfUrl() {
  // Use percentage zoom (works in Chromium). Alternatives some browsers accept: "page-width", "page-fit".
  const zoom = state.zoomPercent; // integer
  return `${PDF_PATH}#page=${state.page}&zoom=${zoom}`;
}

function loadFrame() {
  pdfFrame.src = buildPdfUrl();
  zoomVal.textContent = `${state.zoomPercent}%`;
  pageInput.value = String(state.page);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

prevBtn.addEventListener("click", () => {
  state.page = clamp(state.page - 1, 1, 9999);
  loadFrame();
});

nextBtn.addEventListener("click", () => {
  state.page = clamp(state.page + 1, 1, 9999);
  loadFrame();
});

zoomInBtn.addEventListener("click", () => {
  state.zoomPercent = clamp(state.zoomPercent + 10, 10, 500);
  loadFrame();
});

zoomOutBtn.addEventListener("click", () => {
  state.zoomPercent = clamp(state.zoomPercent - 10, 10, 500);
  loadFrame();
});

pageInput.addEventListener("change", () => {
  const n = parseInt(pageInput.value, 10);
  if (Number.isFinite(n) && n > 0) {
    state.page = n;
    loadFrame();
  } else {
    pageInput.value = String(state.page);
  }
});

openNewTab.addEventListener("click", () => {
  window.open(buildPdfUrl(), "_blank", "noopener,noreferrer");
});

// Initial load
loadFrame();
