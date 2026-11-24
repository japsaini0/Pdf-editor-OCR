import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MutationLayer, PdfPageMeta, PdfTextSpan } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type LoadedPdfDoc = pdfjsLib.PDFDocumentProxy;

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return [0.07, 0.07, 0.09];
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [r, g, b];
}

export async function loadPdfFromBytes(bytes: Uint8Array): Promise<{
  doc: LoadedPdfDoc;
  pagesMeta: PdfPageMeta[];
}> {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    useWorkerFetch: false,
  });
  const doc = await loadingTask.promise;
  const pagesMeta: PdfPageMeta[] = [];

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    pagesMeta.push({
      pageNumber: i,
      widthPt: Math.round(vp.width),
      heightPt: Math.round(vp.height),
    });
  }

  return { doc, pagesMeta };
}

export async function renderPdfPageToCanvas(
  doc: LoadedPdfDoc,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  dpr = 1,
  signal?: { cancelled: boolean }
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: scale * dpr });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  });

  try {
    await renderTask.promise;
  } catch (err) {
    if (signal?.cancelled) return;
    if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
    throw err;
  }
}

export async function extractPageTextSpans(
  doc: LoadedPdfDoc,
  pageNumber: number
): Promise<PdfTextSpan[]> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const spans: PdfTextSpan[] = [];

  let idx = 0;
  for (const rawItem of textContent.items) {
    if (!('str' in rawItem)) continue;
    const text = rawItem.str;
    if (!text || !text.trim()) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, rawItem.transform);
    const fontSizePt = Math.max(
      6,
      Math.hypot(rawItem.transform[0], rawItem.transform[1]) || rawItem.height || 12
    );
    const heightPt = Math.max(fontSizePt * 1.15, rawItem.height || fontSizePt * 1.15);
    const widthPt = Math.max(
      8,
      rawItem.width || text.length * fontSizePt * 0.52
    );
    const xPt = tx[4];
    const yPt = tx[5] - heightPt * 0.84;

    spans.push({
      id: `p${pageNumber}-span-${idx++}`,
      pageNumber,
      text,
      xPt,
      yPt,
      widthPt,
      heightPt,
      fontSizePt,
      fontName: rawItem.fontName,
    });
  }

  return spans;
}

export function drawMutationsOnContext(
  ctx: CanvasRenderingContext2D,
  mutations: MutationLayer[],
  scale: number
): void {
  for (const m of mutations) {
    ctx.save();
    if (m.type === 'whiteout') {
      ctx.fillStyle = m.coverColor;
      ctx.fillRect(
        m.xPt * scale,
        m.yPt * scale,
        m.widthPt * scale,
        m.heightPt * scale
      );
    } else if (m.type === 'highlight') {
      ctx.globalAlpha = 0.36;
      ctx.fillStyle = m.color;
      ctx.fillRect(
        m.xPt * scale,
        m.yPt * scale,
        m.widthPt * scale,
        m.heightPt * scale
      );
    } else if (m.type === 'box') {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = Math.max(1, m.strokeWidthPt * scale);
      ctx.strokeRect(
        m.xPt * scale,
        m.yPt * scale,
        m.widthPt * scale,
        m.heightPt * scale
      );
    } else if (m.type === 'draw-ink') {
      if (m.points.length > 1) {
        ctx.strokeStyle = m.color;
        ctx.lineWidth = Math.max(1, m.strokeWidthPt * scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(m.points[0].xPt * scale, m.points[0].yPt * scale);
        for (let i = 1; i < m.points.length; i += 1) {
          ctx.lineTo(m.points[i].xPt * scale, m.points[i].yPt * scale);
        }
        ctx.stroke();
      }
    } else if (m.type === 'edit-text') {
      ctx.fillStyle = m.coverColor;
      ctx.fillRect(
        (m.xPt - 2) * scale,
        (m.yPt - 2) * scale,
        (m.widthPt + 8) * scale,
        (m.heightPt + 4) * scale
      );
      ctx.fillStyle = m.color;
      ctx.font = `600 ${m.fontSizePt * scale}px Helvetica, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      const lines = m.text.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, m.xPt * scale, (m.yPt + i * m.fontSizePt * 1.18) * scale);
      });
    } else if (m.type === 'add-text') {
      ctx.fillStyle = m.color;
      ctx.font = `600 ${m.fontSizePt * scale}px Helvetica, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      const lines = m.text.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, m.xPt * scale, (m.yPt + i * m.fontSizePt * 1.18) * scale);
      });
    } else if (m.type === 'ocr-stamp') {
      if (m.coverColor) {
        ctx.fillStyle = m.coverColor;
        ctx.fillRect(
          (m.xPt - 3) * scale,
          (m.yPt - 3) * scale,
          Math.max(m.widthPt + 12, m.text.length * m.fontSizePt * 0.56) * scale,
          (m.heightPt + 6) * scale
        );
      }
      ctx.fillStyle = m.color;
      ctx.font = `600 ${m.fontSizePt * scale}px Helvetica, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(m.text, m.xPt * scale, m.yPt * scale);
    }
    ctx.restore();
  }
}

export async function renderCompositeCanvasForOcr(
  doc: LoadedPdfDoc,
  pageNumber: number,
  pageMutations: MutationLayer[],
  ocrScale = 2.0
): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const canvas = document.createElement('canvas');
  await renderPdfPageToCanvas(doc, pageNumber, canvas, ocrScale, 1);
  const ctx = canvas.getContext('2d');
  if (ctx && pageMutations.length > 0) {
    drawMutationsOnContext(ctx, pageMutations, ocrScale);
  }
  return { canvas, scale: ocrScale };
}

export async function exportMutatedPdf(
  sourceBytes: Uint8Array,
  mutations: MutationLayer[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const m of mutations) {
    const page = pages[m.pageNumber - 1];
    if (!page) continue;
    const { height } = page.getSize();

    if (m.type === 'whiteout') {
      const [r, g, b] = hexToRgbTuple(m.coverColor);
      page.drawRectangle({
        x: m.xPt,
        y: height - (m.yPt + m.heightPt),
        width: m.widthPt,
        height: m.heightPt,
        color: rgb(r, g, b),
      });
    } else if (m.type === 'highlight') {
      const [r, g, b] = hexToRgbTuple(m.color);
      page.drawRectangle({
        x: m.xPt,
        y: height - (m.yPt + m.heightPt),
        width: m.widthPt,
        height: m.heightPt,
        color: rgb(r, g, b),
        opacity: 0.36,
      });
    } else if (m.type === 'box') {
      const [r, g, b] = hexToRgbTuple(m.color);
      page.drawRectangle({
        x: m.xPt,
        y: height - (m.yPt + m.heightPt),
        width: m.widthPt,
        height: m.heightPt,
        borderColor: rgb(r, g, b),
        borderWidth: m.strokeWidthPt,
      });
    } else if (m.type === 'draw-ink') {
      if (m.points.length > 1) {
        const [r, g, b] = hexToRgbTuple(m.color);
        for (let i = 1; i < m.points.length; i += 1) {
          const p0 = m.points[i - 1];
          const p1 = m.points[i];
          page.drawLine({
            start: { x: p0.xPt, y: height - p0.yPt },
            end: { x: p1.xPt, y: height - p1.yPt },
            thickness: m.strokeWidthPt,
            color: rgb(r, g, b),
          });
        }
      }
    } else if (m.type === 'edit-text') {
      const [cr, cg, cb] = hexToRgbTuple(m.coverColor);
      page.drawRectangle({
        x: m.xPt - 2,
        y: height - (m.yPt + m.heightPt + 2),
        width: Math.max(m.widthPt + 8, m.text.length * m.fontSizePt * 0.56),
        height: m.heightPt + 4,
        color: rgb(cr, cg, cb),
      });
      const [r, g, b] = hexToRgbTuple(m.color);
      const lines = m.text.split('\n');
      lines.forEach((line, idx) => {
        page.drawText(line, {
          x: m.xPt,
          y: height - (m.yPt + m.fontSizePt * 0.92 + idx * m.fontSizePt * 1.18),
          size: m.fontSizePt,
          font: helveticaBold,
          color: rgb(r, g, b),
        });
      });
    } else if (m.type === 'add-text') {
      const [r, g, b] = hexToRgbTuple(m.color);
      const lines = m.text.split('\n');
      lines.forEach((line, idx) => {
        page.drawText(line, {
          x: m.xPt,
          y: height - (m.yPt + m.fontSizePt * 0.92 + idx * m.fontSizePt * 1.18),
          size: m.fontSizePt,
          font: helveticaBold,
          color: rgb(r, g, b),
        });
      });
    } else if (m.type === 'ocr-stamp') {
      if (m.coverColor) {
        const [cr, cg, cb] = hexToRgbTuple(m.coverColor);
        page.drawRectangle({
          x: m.xPt - 3,
          y: height - (m.yPt + m.heightPt + 3),
          width: Math.max(m.widthPt + 12, m.text.length * m.fontSizePt * 0.56),
          height: m.heightPt + 6,
          color: rgb(cr, cg, cb),
        });
      }
      const [r, g, b] = hexToRgbTuple(m.color);
      page.drawText(m.text, {
        x: m.xPt,
        y: height - (m.yPt + m.fontSizePt * 0.92),
        size: m.fontSizePt,
        font: helvetica,
        color: rgb(r, g, b),
      });
    }
  }

  return pdfDoc.save();
}

async function createScannedSpecimenPngBytes(): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 1190;
  canvas.height = 1682;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle scan frame
  ctx.strokeStyle = '#1b1b24';
  ctx.lineWidth = 4;
  ctx.strokeRect(86, 86, 1018, 1510);

  ctx.fillStyle = '#111118';
  ctx.font = 'bold 46px Helvetica, Arial, sans-serif';
  ctx.fillText('INTERCEPTED SCAN // ANNEX B', 130, 190);

  ctx.font = 'bold 26px Courier New, monospace';
  ctx.fillStyle = '#343444';
  ctx.fillText('SOURCE: RASTERIZED FAX CAPTURE (NO TEXT LAYER)', 130, 250);

  ctx.fillStyle = '#111118';
  ctx.fillRect(130, 285, 930, 4);

  const lines = [
    'DOCUMENT ID: RIOT-02-BITMAP',
    'CLEARANCE: LOCAL BROWSER SANDBOX ONLY',
    'INSTRUCTION: RUN OCR SCAN TO EXTRACT THESE PIXELS.',
    'CLAUSE 01: ANY STATIC IMAGE CAN BECOME EDITABLE TEXT.',
    'CLAUSE 02: INSPECT CONFIDENCE SCORES IN THE RIGHT PANEL.',
    'CLAUSE 03: EDIT ANY RECOGNIZED LINE AND STAMP ON PAGE.',
    'TARGET PAYLOAD: REWRITE THIS SERIAL CODE -> RX-994-ALPHA',
    'VERIFICATION STATUS: ZERO EXTERNAL NETWORK UPLOAD',
  ];

  ctx.font = '600 28px Helvetica, Arial, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillStyle = '#14141d';
    ctx.fillText(line, 130, 385 + i * 74);
  });

  // Simulated redaction stamp box
  ctx.strokeStyle = '#222230';
  ctx.lineWidth = 3;
  ctx.strokeRect(130, 1040, 930, 220);
  ctx.font = 'bold 30px Courier New, monospace';
  ctx.fillText('CALIBRATION CHECKLIST:', 162, 1105);
  ctx.font = '26px Helvetica, Arial, sans-serif';
  ctx.fillText('1. SELECT ENGLISH OR TARGET LANGUAGE IN 06 OCR SCANNER', 162, 1162);
  ctx.fillText('2. PRESS SCAN TO RUN CLIENT-SIDE WASM RECOGNITION', 162, 1212);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png')
  );
  return new Uint8Array(await blob.arrayBuffer());
}

export async function generateDemoPdfBytes(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  // Page 1: A4 Vector Document (595 x 841 pt)
  const p1 = pdfDoc.addPage([595, 841]);

  p1.drawRectangle({
    x: 42,
    y: 734,
    width: 511,
    height: 62,
    color: rgb(0.06, 0.06, 0.1),
  });
  p1.drawText('DOCUMENT MUTATION PROTOCOL // SPEC-09', {
    x: 58,
    y: 760,
    size: 18,
    font: fontBold,
    color: rgb(0.8, 1, 0),
  });
  p1.drawText('LOCAL BROWSER SANDBOX - EDITION 2026', {
    x: 58,
    y: 743,
    size: 9,
    font: fontMono,
    color: rgb(0.95, 0.95, 0.98),
  });

  p1.drawText('SECTION 1.0 - LIVE VECTOR TEXT TARGETS', {
    x: 46,
    y: 696,
    size: 13,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.12),
  });

  const bodyLines = [
    'Select EDIT TEXT from the left tool deck and click any sentence below.',
    'Original glyphs can be overwritten in place using your chosen Cover Color.',
    'Every edit stays inside this browser until you click EXPORT PDF.',
    '',
    'Subject Name: OPERATOR-09 (AUTHORIZED LAB USER)',
    'Facility Code: SECTOR-42 // CHROMIUM WORKBENCH',
    'Clearance Note: PDF WAS NEVER MEANT TO BE SACRED',
    'Audit Trail: ZERO SERVER TRANSMISSION CONFIRMED',
  ];

  bodyLines.forEach((text, i) => {
    if (!text) return;
    p1.drawText(text, {
      x: 46,
      y: 660 - i * 24,
      size: 11.5,
      font: i >= 4 ? fontBold : fontRegular,
      color: rgb(0.11, 0.11, 0.16),
    });
  });

  p1.drawRectangle({
    x: 46,
    y: 356,
    width: 503,
    height: 92,
    borderColor: rgb(0.15, 0.15, 0.22),
    borderWidth: 1.5,
  });

  p1.drawText('MUTATION EXERCISES (TRY THESE TOOLS)', {
    x: 60,
    y: 424,
    size: 11,
    font: fontMono,
    color: rgb(0.08, 0.08, 0.12),
  });
  p1.drawText('1. HIGHLIGHT: Drag across any paragraph to mark tactical emphasis.', {
    x: 60,
    y: 400,
    size: 10.5,
    font: fontRegular,
    color: rgb(0.15, 0.15, 0.2),
  });
  p1.drawText('2. WHITEOUT + ADD TEXT: Cover confidential IDs and inject new data.', {
    x: 60,
    y: 380,
    size: 10.5,
    font: fontRegular,
    color: rgb(0.15, 0.15, 0.2),
  });

  p1.drawText('PAGE 02 CONTAINS A RASTER SCAN FOR TESTING THE OCR SCANNER.', {
    x: 46,
    y: 120,
    size: 10.5,
    font: fontMono,
    color: rgb(0.15, 0.15, 0.22),
  });
  p1.drawText('REF: PDF-RIOT-DEMO-V1 // 595 x 841 PT', {
    x: 46,
    y: 72,
    size: 9,
    font: fontMono,
    color: rgb(0.45, 0.45, 0.52),
  });

  // Page 2: Pure Rasterized Scan Specimen for real Tesseract OCR
  const p2 = pdfDoc.addPage([595, 841]);
  const pngBytes = await createScannedSpecimenPngBytes();
  const pngImage = await pdfDoc.embedPng(pngBytes);
  p2.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: 595,
    height: 841,
  });

  return pdfDoc.save();
}
