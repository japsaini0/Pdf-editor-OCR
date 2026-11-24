import { createWorker, OEM, type Block } from 'tesseract.js';
import type { OcrLineItem } from '../types';

export interface OcrProgressUpdate {
  status: string;
  progress: number;
}

const LOCAL_ENG_LANG_PATH = '/tesseract/lang';
const REMOTE_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0';

function extractLinesFromBlocks(
  blocks: Block[] | null,
  renderScale: number,
  fallbackText: string
): OcrLineItem[] {
  const items: OcrLineItem[] = [];

  if (blocks && blocks.length > 0) {
    let idx = 0;
    for (const block of blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          const clean = line.text.replace(/\s+/g, ' ').trim();
          if (!clean) continue;

          const x0 = line.bbox.x0 / renderScale;
          const y0 = line.bbox.y0 / renderScale;
          const x1 = line.bbox.x1 / renderScale;
          const y1 = line.bbox.y1 / renderScale;

          items.push({
            id: `ocr-line-${idx++}-${Date.now()}`,
            text: clean,
            confidence: Math.round(line.confidence),
            xPt: Math.max(4, x0),
            yPt: Math.max(4, y0),
            widthPt: Math.max(24, x1 - x0),
            heightPt: Math.max(10, y1 - y0),
            selected: true,
          });
        }
      }
    }
  }

  if (items.length === 0 && fallbackText.trim()) {
    const rawLines = fallbackText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    rawLines.forEach((line, i) => {
      items.push({
        id: `ocr-fallback-${i}-${Date.now()}`,
        text: line,
        confidence: 75,
        xPt: 48,
        yPt: 80 + i * 22,
        widthPt: Math.min(480, Math.max(80, line.length * 7)),
        heightPt: 14,
        selected: true,
      });
    });
  }

  return items;
}

export async function runOcrOnCanvas(
  canvas: HTMLCanvasElement,
  renderScale: number,
  language: string,
  onProgress: (update: OcrProgressUpdate) => void
): Promise<OcrLineItem[]> {
  onProgress({ status: 'INITIALIZING WORKER', progress: 0.08 });

  const langPath = language === 'eng' ? LOCAL_ENG_LANG_PATH : REMOTE_LANG_PATH;

  const worker = await createWorker(language, OEM.LSTM_ONLY, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core',
    langPath,
    gzip: true,
    logger: (msg) => {
      const normalizedStatus = (msg.status || 'PROCESSING').toUpperCase();
      const rawPct = typeof msg.progress === 'number' ? msg.progress : 0;
      const weighted =
        msg.status === 'recognizing text'
          ? 0.28 + rawPct * 0.72
          : Math.min(0.26, rawPct * 0.26);
      onProgress({
        status: normalizedStatus,
        progress: Math.max(0.05, Math.min(1, weighted)),
      });
    },
  });

  try {
    const result = await worker.recognize(
      canvas,
      {},
      { blocks: true, text: true }
    );
    onProgress({ status: 'COMPLETE', progress: 1 });
    return extractLinesFromBlocks(
      result.data.blocks,
      renderScale,
      result.data.text
    );
  } finally {
    await worker.terminate();
  }
}
