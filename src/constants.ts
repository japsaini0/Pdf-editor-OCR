import type { ToolId } from './types';

export interface ToolDef {
  id: ToolId;
  label: string;
  hint: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'edit-text', label: 'EDIT TEXT', hint: 'Click PDF text to rewrite in place' },
  { id: 'add-text', label: 'ADD TEXT', hint: 'Click canvas to inject new text' },
  { id: 'highlight', label: 'HIGHLIGHT', hint: 'Drag translucent neon band' },
  { id: 'draw-ink', label: 'DRAW INK', hint: 'Freehand tactical stroke' },
  { id: 'box', label: 'BOX', hint: 'Drag vector frame' },
  { id: 'whiteout', label: 'WHITEOUT', hint: 'Drag cover block to redact' },
];

export interface SwatchDef {
  hex: string;
  name: string;
}

export const INJECTION_INKS: SwatchDef[] = [
  { hex: '#ff2e88', name: 'Hot Pink' },
  { hex: '#ccff00', name: 'Neon Lime' },
  { hex: '#00e5ff', name: 'Electric Cyan' },
  { hex: '#9b5cff', name: 'Ultraviolet' },
  { hex: '#111118', name: 'Carbon Ink' },
  { hex: '#ff6b00', name: 'Hazard Orange' },
];

export const COVER_COLORS: SwatchDef[] = [
  { hex: '#ffffff', name: 'Pure Paper' },
  { hex: '#f5f4ef', name: 'Warm Stock' },
  { hex: '#e5e7ef', name: 'Archive Grey' },
  { hex: '#08080e', name: 'Blackout Redact' },
  { hex: '#ccff00', name: 'Lime Patch' },
  { hex: '#ff2e88', name: 'Pink Censor' },
];

export const OCR_LANGUAGES = [
  { code: 'eng', label: 'ENG // ENGLISH' },
  { code: 'spa', label: 'SPA // ESPAÑOL' },
  { code: 'fra', label: 'FRA // FRANÇAIS' },
  { code: 'deu', label: 'DEU // DEUTSCH' },
  { code: 'ita', label: 'ITA // ITALIANO' },
  { code: 'por', label: 'POR // PORTUGUÊS' },
];

export const MARQUEE_SEGMENTS = [
  'LOCAL PROCESSING // YOUR FILE NEVER LEAVES THIS BROWSER',
  'OCR ENGINE ONLINE',
  'CLICK ANY WORD AND REWRITE REALITY',
  'PDF WAS NEVER MEANT TO BE SACRED',
];
