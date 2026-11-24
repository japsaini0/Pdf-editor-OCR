export type ToolId =
  | 'edit-text'
  | 'add-text'
  | 'highlight'
  | 'draw-ink'
  | 'box'
  | 'whiteout';

export interface PdfPageMeta {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
}

export interface PdfTextSpan {
  id: string;
  pageNumber: number;
  text: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  fontSizePt: number;
  fontName?: string;
}

export interface PointPt {
  xPt: number;
  yPt: number;
}

export type MutationLayer =
  | {
      id: string;
      type: 'edit-text';
      pageNumber: number;
      xPt: number;
      yPt: number;
      widthPt: number;
      heightPt: number;
      originalText: string;
      text: string;
      fontSizePt: number;
      color: string;
      coverColor: string;
    }
  | {
      id: string;
      type: 'add-text';
      pageNumber: number;
      xPt: number;
      yPt: number;
      text: string;
      fontSizePt: number;
      color: string;
    }
  | {
      id: string;
      type: 'highlight';
      pageNumber: number;
      xPt: number;
      yPt: number;
      widthPt: number;
      heightPt: number;
      color: string;
    }
  | {
      id: string;
      type: 'draw-ink';
      pageNumber: number;
      points: PointPt[];
      strokeWidthPt: number;
      color: string;
    }
  | {
      id: string;
      type: 'box';
      pageNumber: number;
      xPt: number;
      yPt: number;
      widthPt: number;
      heightPt: number;
      strokeWidthPt: number;
      color: string;
    }
  | {
      id: string;
      type: 'whiteout';
      pageNumber: number;
      xPt: number;
      yPt: number;
      widthPt: number;
      heightPt: number;
      coverColor: string;
    }
  | {
      id: string;
      type: 'ocr-stamp';
      pageNumber: number;
      xPt: number;
      yPt: number;
      widthPt: number;
      heightPt: number;
      text: string;
      fontSizePt: number;
      color: string;
      coverColor?: string;
    };

export interface OcrLineItem {
  id: string;
  text: string;
  confidence: number;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  selected: boolean;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  message: string;
  tone: 'lime' | 'pink' | 'cyan' | 'neutral';
}

export interface ToastNotice {
  id: string;
  message: string;
  variant: 'success' | 'error';
}
