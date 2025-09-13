name: EPLAN Web Viewer
description: >
  A lightweight, self-hosted PDF viewer with red/greenlining annotations,
  designed for viewing EPLAN schematics and similar technical PDFs directly
  in the browser. The viewer runs fully client-side (no server needed) and
  can be hosted on GitHub Pages or any static web host.

features:
  - PDF.js v3 rendering — crisp, zoomable technical drawings
  - Red/Greenlining tools:
    - Freehand pen (red or green)
    - Rectangles (red or green)
    - Inline text notes (gold)
  - Pan & zoom for large drawings
  - Undo / Clear / Save / Load
  - Export / Import annotations as JSON
  - Share links — annotations are embedded in the URL hash using LZ-String compression
  - Local autosave — annotations are saved in localStorage when not using a shared link
  - Offline-first — runs entirely in the browser, no login or internet connection needed

project_structure: |
  .
  ├── index.html          # Main viewer page
  ├── viewer.js           # Viewer logic (PDF rendering + annotations)
  ├── viewer.css          # Styling (black + gold theme)
  ├── docs/
  │   └── project.pdf      # Example EPLAN PDF to view
  └── assets/
      └── logo.png         # Optional logo

getting_started:
  - step: Clone or download this repo
    code: |
      git clone https://github.com/<your-username>/eplan-web-viewer.git
      cd eplan-web-viewer
  - step: Add your PDF files
    description: Put your EPLAN or other PDFs in `docs/` and set `PDF_URL` in `viewer.js`
    code: |
      const PDF_URL = "./docs/project.pdf";
  - step: Run locally
    description: Use any static HTTP server (not file:/// URLs). For example with npx:
    code: |
      npx http-server .
    result: |
      Then open: http://localhost:8080

github_pages_deploy:
  - Push your code to GitHub
  - Go to Settings → Pages
  - Under Build and deployment, set:
    - Source: Deploy from a branch
    - Branch: main / folder: / (root)
  - Save and wait a few seconds
  - Visit your site at: https://<your-username>.github.io/<repo-name>/

sharing_annotations:
  - Click "Share link" — it copies a URL with #ann=... hash
  - Send the link to anyone — they will see your red/greenlining
  - If they edit, they must click "Share link" again to create a new link
  note: Shared links are read-only (they don’t overwrite local annotations)

browser_support:
  chromium: "✅ Chrome, Edge, Brave, Opera"
  firefox: "✅ Firefox (slightly slower on large PDFs)"
  safari: "⚠️ Safari (limited URL hash length supported)"

license: MIT
license_note: Free for personal, educational, or commercial use. Attribution is appreciated but not required.

future_ideas:
  - Add ellipse, arrow, or highlighter tools
  - Allow switching between multiple PDFs
  - Optional Supabase backend to sync annotations between users
