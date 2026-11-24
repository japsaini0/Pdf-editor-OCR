# PDF/RIOT — Document Mutation Lab

**PDF/RIOT** is a browser-based PDF editor and OCR scanner built for modifying PDF documents completely locally. Every file you open, every edit you draw, and every pixel scanned by OCR runs inside your browser—nothing is uploaded to an external server.

---

## What You Can Do

### 1. Load a Document
- Click **OPEN PDF** in the top bar (or drag and drop a `.pdf` file onto the center workspace).
- Or click **LOAD DEMO DOCUMENT** to try a built-in 2-page test PDF:
  - **Page 01**: Contains selectable vector text for testing in-place text edits and annotations.
  - **Page 02**: Contains a rasterized bitmap scan (no underlying text layer) designed for testing the OCR scanner.

### 2. Edit & Annotate (`01 TOOL DECK`)
Select a tool from the left rail, pick an **Injection Ink** (`02`), a **Cover Color** (`03`), and adjust **Stroke Width / Text Size** (`04`):

- **EDIT TEXT**: Hover over existing text on a PDF page and click any line or phrase to cover the original text and rewrite it in place.
- **ADD TEXT**: Click anywhere on the document canvas to insert new text at that position.
- **HIGHLIGHT**: Click and drag across a region to add a translucent neon highlight band.
- **DRAW INK**: Click and drag to sketch freehand vector strokes on the page.
- **BOX**: Click and drag to draw rectangular frames.
- **WHITEOUT**: Click and drag to mask or redact sections using your selected Cover Color.

### 3. Scan Images with OCR (`06 OCR SCANNER` & `07 RECOGNIZED TEXT`)
Use the right panel to turn scanned or non-selectable page pixels into editable text:

1. Choose a recognition language (English runs fully offline using bundled traineddata; additional languages fetch traineddata when scanned).
2. Click **SCAN** to run client-side Tesseract WebAssembly OCR on the active page.
3. Review the extracted lines and their confidence percentages (`% CONF`) in **07 RECOGNIZED TEXT**, edit any line directly in its text box, and uncheck lines you do not want.
4. Toggle **COVER ORIGINAL PIXELS** if you want the stamped text to mask the underlying bitmap text, then click **STAMP ON PAGE**.

### 4. Manage Pages, Layers & History
- **05 PAGES**: Click any page thumbnail in the left rail (or use **PREV / NEXT** in the bottom HUD) to switch pages.
- **08 LAYERS**: Lists every mutation on the current page. Click a layer to select it on the canvas, or click its trash icon to remove it.
- **09 ACTIVITY LOG**: Shows a timestamped feed of actions taken during your session.
- **Undo / Redo & Zoom**: Use the top bar buttons (or keyboard shortcuts) to undo/redo changes and zoom in, out, or reset to `100%`.
- **EXPORT PDF**: Compiles all edits, drawings, redactions, and stamped OCR text into a new `.pdf` file downloaded straight to your device.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `1` – `6` | Switch between tools in `01 TOOL DECK` |
| `Ctrl + Z` / `Cmd + Z` | Undo last mutation |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo mutation |
| `Delete` / `Backspace` | Delete the currently selected layer |
| `+` / `-` / `0` | Zoom in, zoom out, or reset zoom to `100%` |
| `Enter` / `Esc` | Apply or cancel an open inline text editor |

---

## Project Architecture

```text
├── public/tesseract/        # Bundled Tesseract worker, WASM cores, and local English traineddata
├── src/
│   ├── App.tsx              # Main state, undo/redo history, shortcuts, PDF & OCR orchestration
│   ├── constants.ts         # Tools, ink swatches, cover colors, OCR languages, ticker text
│   ├── types.ts             # TypeScript models for mutations, text spans, OCR lines, and logs
│   ├── components/
│   │   ├── TopBar.tsx       # Branding, active file status chip, undo/redo, open/export, help
│   │   ├── MarqueeStrip.tsx # Status ticker bar
│   │   ├── LeftRail.tsx     # Tool deck, colors, stroke/font controls, page thumbnails
│   │   ├── DocumentStage.tsx# PDF canvas, vector/text mutation overlay, inline text editor, zoom
│   │   ├── RightPanel.tsx   # OCR scanner, editable OCR results, layers list, activity log
│   │   └── HelpDialog.tsx   # Keyboard shortcuts & quick manual modal
│   ├── lib/
│   │   ├── pdfEngine.ts     # PDF.js rendering/text extraction + pdf-lib demo generator & exporter
│   │   └── ocrEngine.ts     # Tesseract.js v7 WASM worker integration
│   └── styles/
│       ├── tokens.css       # Color palette, typography, clips, and layout tokens
│       └── lab.css          # Cyber-brutalist HUD layout, scanlines, grain, and micro-interactions
└── package.json
```

### Local Development

```bash
npm install
npm run dev
```
