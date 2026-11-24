# PDF/RIOT — Document Mutation Lab

A local, browser-based PDF editor and WASM OCR scanner styled as a cyber-brutalist document mutation lab. All PDF rendering, text rewriting, vector annotations, OCR extraction, and PDF export run entirely in the browser with zero server uploads.

## Features

- **Local PDF Rendering & Export**: Powered by `pdfjs-dist` and `pdf-lib`. Open any local `.pdf` via file picker or drag-and-drop, or generate a 2-page demo dossier (`SPEC09_MUTATION_LAB.pdf`) locally.
- **01 Tool Deck**:
  - `EDIT TEXT`: Click extracted embedded PDF text spans to cover and rewrite them in place.
  - `ADD TEXT`: Click anywhere on the page canvas to inject new text annotations.
  - `HIGHLIGHT`: Drag translucent highlight bands over content.
  - `DRAW INK`: Freehand vector ink strokes.
  - `BOX`: Tactical vector rectangular frames.
  - `WHITEOUT`: Solid cover/redaction patches using the selected cover color.
- **06 OCR Scanner & 07 Recognized Text**: Client-side `tesseract.js` WebAssembly OCR with a 16-segment progress meter, editable recognized lines with confidence percentages, and one-click `STAMP ON PAGE` (with optional original-pixel cover patches).
- **08 Layers, History & 09 Activity Log**: Full Undo/Redo (`Ctrl+Z` / `Ctrl+Y`), per-page mutation layer selection and deletion, zoom controls (`+` / `-` / `RESET`), keyboard shortcuts (`1`–`6` tool switching, `Del` remove selected layer), and timestamped session logs.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **PDF Processing**: `pdfjs-dist` + `pdf-lib`
- **OCR Engine**: `tesseract.js` + `@tesseract.js-data/eng` (bundled locally in `public/tesseract/` for offline English OCR, with remote `tessdata` fallback for additional languages)
- **Icons & Fonts**: `lucide-react`, `@fontsource/anton`, `@fontsource/bricolage-grotesque`, `@fontsource/jetbrains-mono`

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deploying on Vercel

This project builds to static files in `dist/` (including `dist/tesseract/`). Vercel auto-detects the Vite preset:

- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

Or deploy directly via CLI:

```bash
npm install -g vercel
vercel
vercel --prod
```
