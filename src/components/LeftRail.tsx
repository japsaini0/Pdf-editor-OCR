import { useEffect, useRef } from 'react';
import {
  Eraser,
  Highlighter,
  PenTool,
  Square,
  Type,
  Wand2,
} from 'lucide-react';
import { COVER_COLORS, INJECTION_INKS, TOOLS } from '../constants';
import { renderPdfPageToCanvas, type LoadedPdfDoc } from '../lib/pdfEngine';
import type { PdfPageMeta, ToolId } from '../types';

interface LeftRailProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  injectionInk: string;
  onSelectInk: (hex: string) => void;
  coverColor: string;
  onSelectCoverColor: (hex: string) => void;
  strokeWidthPt: number;
  onChangeStrokeWidth: (val: number) => void;
  fontSizePt: number;
  onChangeFontSize: (val: number) => void;
  pdfDoc: LoadedPdfDoc | null;
  pagesMeta: PdfPageMeta[];
  currentPage: number;
  onSelectPage: (pageNumber: number) => void;
  pageMutationCounts: Record<number, number>;
}

const TOOL_ICONS: Record<ToolId, typeof Wand2> = {
  'edit-text': Wand2,
  'add-text': Type,
  highlight: Highlighter,
  'draw-ink': PenTool,
  box: Square,
  whiteout: Eraser,
};

function PageThumbPreview({
  doc,
  pageNumber,
}: {
  doc: LoadedPdfDoc;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signal = { cancelled: false };
    renderPdfPageToCanvas(doc, pageNumber, canvas, 0.34, 1, signal).catch(
      () => {}
    );
    return () => {
      signal.cancelled = true;
    };
  }, [doc, pageNumber]);

  return <canvas ref={canvasRef} aria-label={`Page ${pageNumber} preview`} />;
}

export function LeftRail({
  activeTool,
  onSelectTool,
  injectionInk,
  onSelectInk,
  coverColor,
  onSelectCoverColor,
  strokeWidthPt,
  onChangeStrokeWidth,
  fontSizePt,
  onChangeFontSize,
  pdfDoc,
  pagesMeta,
  currentPage,
  onSelectPage,
  pageMutationCounts,
}: LeftRailProps) {
  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <aside className="left-rail" aria-label="Mutation tools and pages">
      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>01</strong> TOOL DECK
          </span>
        </div>
        <div className="tool-grid">
          {TOOLS.map((tool, index) => {
            const Icon = TOOL_ICONS[tool.id];
            const isActive = activeTool === tool.id;
            return (
              <div
                key={tool.id}
                className={`tool-btn-shell ${isActive ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  className={`tool-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelectTool(tool.id)}
                  title={`${tool.hint} (Shortcut ${index + 1})`}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <span className="tool-active-pip" aria-hidden="true" />
                  )}
                  <Icon size={16} />
                  <span className="tool-btn-label">{tool.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>02</strong> INJECTION INK
          </span>
          <span className="section-value">{injectionInk.toUpperCase()}</span>
        </div>
        <div className="swatch-row" role="radiogroup" aria-label="Injection ink color">
          {INJECTION_INKS.map((swatch) => {
            const active = injectionInk.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                className={`swatch-btn ${active ? 'is-active' : ''}`}
                style={{ backgroundColor: swatch.hex }}
                onClick={() => onSelectInk(swatch.hex)}
                title={`${swatch.name} (${swatch.hex})`}
                aria-label={`Injection ink ${swatch.name}`}
                aria-checked={active}
                role="radio"
              />
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>03</strong> COVER COLOR
          </span>
          <span className="section-value">{coverColor.toUpperCase()}</span>
        </div>
        <div className="swatch-row" role="radiogroup" aria-label="Cover color for whiteout">
          {COVER_COLORS.map((swatch) => {
            const active = coverColor.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                className={`swatch-btn ${active ? 'is-active' : ''}`}
                style={{ backgroundColor: swatch.hex }}
                onClick={() => onSelectCoverColor(swatch.hex)}
                title={`${swatch.name} (${swatch.hex})`}
                aria-label={`Cover color ${swatch.name}`}
                aria-checked={active}
                role="radio"
              />
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>04</strong> STROKE WIDTH
          </span>
          <span className="section-value">{strokeWidthPt} PT</span>
        </div>
        <div className="range-wrap">
          <input
            type="range"
            className="pink-slider"
            min={1}
            max={18}
            step={1}
            value={strokeWidthPt}
            onChange={(e) => onChangeStrokeWidth(Number(e.target.value))}
            aria-label="Stroke width in points"
          />
          <div className="mini-font-row">
            <span className="mini-font-label">TEXT SIZE</span>
            <div className="mini-stepper">
              <button
                type="button"
                className="mini-step-btn"
                onClick={() => onChangeFontSize(Math.max(8, fontSizePt - 2))}
                aria-label="Decrease text size"
              >
                -
              </button>
              <span className="section-value">{fontSizePt}PT</span>
              <button
                type="button"
                className="mini-step-btn"
                onClick={() => onChangeFontSize(Math.min(48, fontSizePt + 2))}
                aria-label="Increase text size"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>05</strong> PAGES
          </span>
          <span className="section-value">
            {pagesMeta.length > 0 ? pad2(pagesMeta.length) : '00'}
          </span>
        </div>
        {pdfDoc && pagesMeta.length > 0 ? (
          <div className="thumb-list">
            {pagesMeta.map((meta) => {
              const active = meta.pageNumber === currentPage;
              const edits = pageMutationCounts[meta.pageNumber] || 0;
              return (
                <button
                  key={meta.pageNumber}
                  type="button"
                  className={`thumb-card ${active ? 'is-active' : ''}`}
                  onClick={() => onSelectPage(meta.pageNumber)}
                  aria-current={active ? 'page' : undefined}
                >
                  <div className="thumb-canvas-frame">
                    <PageThumbPreview
                      doc={pdfDoc}
                      pageNumber={meta.pageNumber}
                    />
                  </div>
                  <div className="thumb-meta">
                    <span>PAGE {pad2(meta.pageNumber)}</span>
                    <span>{edits > 0 ? `${edits} MUT` : `${meta.widthPt}×${meta.heightPt}`}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-rail-note">NO PAGES LOADED</div>
        )}
      </section>
    </aside>
  );
}
