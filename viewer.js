// viewer.js (for native iframe viewer only)
document.addEventListener("DOMContentLoaded", () => {
  const PDF_PATH = "./docs/project.pdf";

  const pdfFrame = document.getElementById("pdfFrame");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  const zoomVal = document.getElementById("zoomVal");
  const pageInput = document.getElementById("pageInput");
  const openNewTab = document.getElementById("openNewTab");

  if (!pdfFrame) {
    console.error("Missing element: #pdfFrame. Check your index.html.");
    return;
  }

  const state = { page: 1, zoomPercent: 100 };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function buildUrl() { return `${PDF_PATH}#page=${state.page}&zoom=${state.zoomPercent}`; }
  function loadFrame() {
    pdfFrame.src = buildUrl();
    zoomVal.textContent = `${state.zoomPercent}%`;
    pageInput.value = String(state.page);
  }

  prevBtn?.addEventListener("click", () => { state.page = clamp(state.page - 1, 1, 9999); loadFrame(); });
  nextBtn?.addEventListener("click", () => { state.page = clamp(state.page + 1, 1, 9999); loadFrame(); });
  zoomInBtn?.addEventListener("click", () => { state.zoomPercent = clamp(state.zoomPercent + 10, 10, 500); loadFrame(); });
  zoomOutBtn?.addEventListener("click", () => { state.zoomPercent = clamp(state.zoomPercent - 10, 10, 500); loadFrame(); });
  pageInput?.addEventListener("change", () => {
    const n = parseInt(pageInput.value, 10);
    state.page = Number.isFinite(n) && n > 0 ? n : state.page;
    pageInput.value = String(state.page);
    loadFrame();
  });
  openNewTab?.addEventListener("click", () => window.open(buildUrl(), "_blank", "noopener,noreferrer"));

  loadFrame();
});
