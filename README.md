# EKLUND Engineering EPLAN Web Viewer

A lightweight, self-hosted PDF viewer with red/greenlining annotations, designed for viewing **EPLAN schematics** and similar technical PDFs directly in the browser.  
The viewer runs fully client-side (no server needed) and can be hosted on **GitHub Pages** or any static web host.

---

## ✨ Features

- **PDF.js v3** rendering — crisp, zoomable technical drawings
- **Red/Greenlining tools**:
  - Freehand pen (red or green)
  - Rectangles (red or green)
  - Inline text notes (gold)
- **Pan & zoom** for large drawings
- **Undo / Clear / Save / Load**
- **Export / Import annotations as JSON**
- **Share links** — annotations are embedded in the URL hash using LZ-String compression  
  Anyone opening the link sees the same markup (no backend required)
- **Local autosave** — annotations are saved in `localStorage` when not using a shared link
- **Offline-first** — runs entirely in the browser, no login or internet connection needed

---

## 📁 Project structure

```
.
├── index.html          # Main viewer page
├── viewer.js           # Viewer logic (PDF rendering + annotations)
├── viewer.css          # Styling (black + gold theme)
├── docs/
│   └── project.pdf      # Example EPLAN PDF to view
└── assets/
    └── logo.png         # Optional logo
```

---

## 🚀 Getting started

### 1. Clone or download this repo
```bash
git clone https://github.com/AlbertjanPieffers/EKN_EplanViewer.git
cd EKN_EplanViewer
```

### 2. Add your PDF files
Put your EPLAN or other PDFs in `docs/` and set `PDF_URL` in `viewer.js`:

```javascript
const PDF_URL = "./docs/project.pdf";
```

### 3. Run locally
Use any static HTTP server (not `file:///` URLs).  
For example with `npx`:

```bash
npx http-server .
```

Then open:
```
http://localhost:8080
```

---

## 🌐 Deploy on GitHub Pages

1. Push your code to GitHub  
2. Go to **Settings → Pages**  
3. Under **Build and deployment**, set:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / folder: `/ (root)`
4. Save and wait a few seconds  
5. Visit your site at:
```
https://<your-username>.github.io/<repo-name>/
```

---

## 📤 Sharing annotations

- Click **Share link** — it copies a URL with `#ann=...` hash
- Send the link to anyone — they will see your red/greenlining
- If they edit, they must click **Share link** again to create a new link

> **Note:** Shared links are read-only (they don’t overwrite local annotations).

---

## ⚙️ Browser support

| Browser            | Status                                      |
|--------------------|----------------------------------------------|
| Chrome / Edge / Brave / Opera | ✅ Supported |
| Firefox             | ✅ Supported (slightly slower on large PDFs) |
| Safari               | ⚠️ Limited URL hash length supported |

---

## ⚖️ License

**MIT License** — free for personal, educational, or commercial use.  
Attribution is appreciated but not required.

---

## 💡 Future ideas

- Add ellipse, arrow, or highlighter tools  
- Allow switching between multiple PDFs  
- Optional Supabase backend to sync annotations between users
