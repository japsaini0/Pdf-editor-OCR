import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  renderPdfPageToCanvas,
  type LoadedPdfDoc,
} from '../lib/pdfEngine';
import type {
  MutationLayer,
  PdfPageMeta,
  PdfTextSpan,
  PointPt,
  ToolId,
} from '../types';

interface DocumentStageProps {
  pdfDoc: LoadedPdfDoc | null;
  pagesMeta: PdfPageMeta[];
  currentPage: number;
  pageCount: number;
  zoom: number;
  onChangeZoom: (next: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  activeTool: ToolId;
  injectionInk: string;
  coverColor: string;
  strokeWidthPt: number;
  fontSizePt: number;
  textSpans: PdfTextSpan[];
  pageMutations: MutationLayer[];
  totalMutations: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onAddMutation: (layer: MutationLayer) => void;
  onUpdateMutation: (layer: MutationLayer) => void;
  onOpenPdf: () => void;
  onLoadDemo: () => void;
  onDropPdfFile: (file: File) => void;
}

type DraftRect = {
  kind: 'highlight' | 'box' | 'whiteout';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type InlineEditorState =
  | {
      mode: 'new-text';
      xPt: number;
      yPt: number;
      text: string;
      fontSizePt: number;
    }
  | {
      mode: 'edit-span';
      span: PdfTextSpan;
      text: string;
      fontSizePt: number;
    }
  | {
      mode: 'edit-layer';
      layerId: string;
      xPt: number;
      yPt: number;
      text: string;
      fontSizePt: number;
    };

export function DocumentStage({
  pdfDoc,
  pagesMeta,
  currentPage,
  pageCount,
  zoom,
  onChangeZoom,
  onPrevPage,
  onNextPage,
  activeTool,
  injectionInk,
  coverColor,
  strokeWidthPt,
  fontSizePt,
  textSpans,
  pageMutations,
  totalMutations,
  selectedLayerId,
  onSelectLayer,
  onAddMutation,
  onUpdateMutation,
  onOpenPdf,
  onLoadDemo,
  onDropPdfFile,
}: DocumentStageProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const editorInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [draftInk, setDraftInk] = useState<PointPt[] | null>(null);
  const [inlineEditor, setInlineEditor] = useState<InlineEditorState | null>(
    null
  );

  const pageMeta = pagesMeta[currentPage - 1] ?? {
    pageNumber: 1,
    widthPt: 595,
    heightPt: 841,
  };
  const displayWidth = Math.round(pageMeta.widthPt * zoom);
  const displayHeight = Math.round(pageMeta.heightPt * zoom);

  // Render PDF base layer whenever document, page, or zoom changes
  useEffect(() => {
    if (!pdfDoc || !baseCanvasRef.current) return;
    const signal = { cancelled: false };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderPdfPageToCanvas(
      pdfDoc,
      currentPage,
      baseCanvasRef.current,
      zoom,
      dpr,
      signal
    ).catch(() => {});
    return () => {
      signal.cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // Reset draft interactions on page or tool switch
  useEffect(() => {
    setDraftRect(null);
    setDraftInk(null);
    setInlineEditor(null);
  }, [currentPage, activeTool]);

  useEffect(() => {
    if (inlineEditor) {
      setTimeout(() => editorInputRef.current?.focus(), 0);
    }
  }, [inlineEditor]);

  const toPdfPt = (clientX: number, clientY: number): PointPt => {
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return { xPt: 0, yPt: 0 };
    const xPt = Math.max(0, Math.min(pageMeta.widthPt, (clientX - rect.left) / zoom));
    const yPt = Math.max(0, Math.min(pageMeta.heightPt, (clientY - rect.top) / zoom));
    return { xPt, yPt };
  };

  const handleStageDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleStageDragLeave = () => {
    setIsDragOver(false);
  };

  const handleStageDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onDropPdfFile(file);
    }
  };

  const handleLayerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !pdfDoc) return;
    if (e.target !== e.currentTarget) return;

    const pt = toPdfPt(e.clientX, e.clientY);

    if (activeTool === 'add-text') {
      onSelectLayer(null);
      setInlineEditor({
        mode: 'new-text',
        xPt: pt.xPt,
        yPt: pt.yPt,
        text: '',
        fontSizePt,
      });
      return;
    }

    if (activeTool === 'edit-text') {
      onSelectLayer(null);
      setInlineEditor(null);
      return;
    }

    if (activeTool === 'draw-ink') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraftInk([pt]);
      return;
    }

    if (
      activeTool === 'highlight' ||
      activeTool === 'box' ||
      activeTool === 'whiteout'
    ) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraftRect({
        kind: activeTool,
        startX: pt.xPt,
        startY: pt.yPt,
        endX: pt.xPt,
        endY: pt.yPt,
      });
    }
  };

  const handleLayerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draftRect && !draftInk) return;
    const pt = toPdfPt(e.clientX, e.clientY);
    if (draftRect) {
      setDraftRect((prev) =>
        prev ? { ...prev, endX: pt.xPt, endY: pt.yPt } : null
      );
    } else if (draftInk) {
      setDraftInk((prev) => {
        if (!prev) return null;
        const last = prev[prev.length - 1];
        if (Math.hypot(pt.xPt - last.xPt, pt.yPt - last.yPt) < 1.2) return prev;
        return [...prev, pt];
      });
    }
  };

  const handleLayerPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (draftRect) {
      const xPt = Math.min(draftRect.startX, draftRect.endX);
      const yPt = Math.min(draftRect.startY, draftRect.endY);
      const widthPt = Math.abs(draftRect.endX - draftRect.startX);
      const heightPt = Math.abs(draftRect.endY - draftRect.startY);
      setDraftRect(null);

      if (widthPt < 4 || heightPt < 4) return;

      const id = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (draftRect.kind === 'highlight') {
        onAddMutation({
          id,
          type: 'highlight',
          pageNumber: currentPage,
          xPt,
          yPt,
          widthPt,
          heightPt,
          color: injectionInk,
        });
      } else if (draftRect.kind === 'box') {
        onAddMutation({
          id,
          type: 'box',
          pageNumber: currentPage,
          xPt,
          yPt,
          widthPt,
          heightPt,
          strokeWidthPt,
          color: injectionInk,
        });
      } else if (draftRect.kind === 'whiteout') {
        onAddMutation({
          id,
          type: 'whiteout',
          pageNumber: currentPage,
          xPt,
          yPt,
          widthPt,
          heightPt,
          coverColor,
        });
      }
      return;
    }

    if (draftInk) {
      const pts = draftInk;
      setDraftInk(null);
      if (pts.length < 2) return;
      const id = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      onAddMutation({
        id,
        type: 'draw-ink',
        pageNumber: currentPage,
        points: pts,
        strokeWidthPt,
        color: injectionInk,
      });
    }
  };

  const commitInlineEditor = () => {
    if (!inlineEditor) return;
    const trimmed = inlineEditor.text.trimEnd();
    if (!trimmed) {
      setInlineEditor(null);
      return;
    }

    if (inlineEditor.mode === 'new-text') {
      const id = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      onAddMutation({
        id,
        type: 'add-text',
        pageNumber: currentPage,
        xPt: inlineEditor.xPt,
        yPt: inlineEditor.yPt,
        text: trimmed,
        fontSizePt: inlineEditor.fontSizePt,
        color: injectionInk,
      });
    } else if (inlineEditor.mode === 'edit-span') {
      const { span } = inlineEditor;
      const id = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      onAddMutation({
        id,
        type: 'edit-text',
        pageNumber: currentPage,
        xPt: span.xPt,
        yPt: span.yPt,
        widthPt: span.widthPt,
        heightPt: span.heightPt,
        originalText: span.text,
        text: trimmed,
        fontSizePt: Math.round(span.fontSizePt),
        color: injectionInk,
        coverColor,
      });
    } else if (inlineEditor.mode === 'edit-layer') {
      const existing = pageMutations.find((m) => m.id === inlineEditor.layerId);
      if (existing && (existing.type === 'edit-text' || existing.type === 'add-text' || existing.type === 'ocr-stamp')) {
        onUpdateMutation({
          ...existing,
          text: trimmed,
          fontSizePt: inlineEditor.fontSizePt,
          color: injectionInk,
        });
      }
    }

    setInlineEditor(null);
  };

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toolChipName = activeTool.replace('-', ' ').toUpperCase();

  return (
    <main
      className="center-stage"
      onDragOver={handleStageDragOver}
      onDragLeave={handleStageDragLeave}
      onDrop={handleStageDrop}
    >
      {/* Decorative four neon corner brackets */}
      <span className="stage-bracket tl" aria-hidden="true" />
      <span className="stage-bracket tr" aria-hidden="true" />
      <span className="stage-bracket bl" aria-hidden="true" />
      <span className="stage-bracket br" aria-hidden="true" />

      {pdfDoc && (
        <div className="stage-top-hud">
          <div className="page-meta-chip">
            PAGE {pad2(currentPage)} / {pageMeta.widthPt} × {pageMeta.heightPt}{' '}
            PT
          </div>

          <div className="zoom-bar" aria-label="Zoom controls">
            <button
              type="button"
              className="zoom-btn"
              onClick={() => onChangeZoom(Math.max(0.5, Number((zoom - 0.15).toFixed(2))))}
              aria-label="Zoom out"
            >
              <Minus size={13} />
            </button>
            <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="zoom-btn"
              onClick={() => onChangeZoom(Math.min(2.4, Number((zoom + 0.15).toFixed(2))))}
              aria-label="Zoom in"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              className="zoom-reset-btn"
              onClick={() => onChangeZoom(1)}
            >
              RESET
            </button>
          </div>
        </div>
      )}

      <div className={`canvas-scroll-area ${!pdfDoc ? 'is-empty' : ''}`}>
        {!pdfDoc ? (
          <section className="empty-hero" aria-label="Load PDF document">
            <h1 className="hero-headline">BREAK THE PAGE.</h1>
            <p className="hero-sub">
              Load any PDF to rewrite embedded text, draw tactical redactions,
              or scan rasterized pages with local browser OCR.
            </p>

            <div
              className={`dropzone-box ${isDragOver ? 'is-dragover' : ''}`}
              onClick={onOpenPdf}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenPdf();
                }
              }}
            >
              <FileUp size={26} color="var(--neon-lime)" />
              <div className="dropzone-title">
                DROP PDF SPECIMEN HERE OR CLICK TO BROWSE
              </div>
              <div className="dropzone-hint">
                ZERO UPLOAD // CLIENT-SIDE WASM ENGINE READY
              </div>
            </div>

            <div className="hero-actions">
              <div className="btn-shadow-wrap is-lime">
                <button
                  type="button"
                  className="hud-btn hud-btn-lime hero-cta"
                  onClick={onLoadDemo}
                >
                  <Sparkles size={15} />
                  LOAD DEMO DOCUMENT
                </button>
              </div>
              <button
                type="button"
                className="hud-btn hud-btn-secondary hero-cta"
                onClick={onOpenPdf}
              >
                OPEN LOCAL PDF
              </button>
            </div>
          </section>
        ) : (
          <div
            className="page-stage-frame"
            style={{ width: displayWidth, height: displayHeight }}
          >
            <div className="page-shadow-blur" aria-hidden="true" />
            <div className="page-shadow-pink" aria-hidden="true" />
            <div className="page-shadow-cyan" aria-hidden="true" />

            <div
              ref={sheetRef}
              className="page-sheet"
              style={{ width: displayWidth, height: displayHeight }}
            >
              <canvas ref={baseCanvasRef} className="pdf-base-canvas" />

              {/* Vector Mutations SVG Layer */}
              <svg
                className="mutation-svg-layer"
                viewBox={`0 0 ${pageMeta.widthPt} ${pageMeta.heightPt}`}
                aria-hidden="true"
              >
                {pageMutations.map((m) => {
                  const isSel = m.id === selectedLayerId;
                  if (m.type === 'whiteout') {
                    return (
                      <rect
                        key={m.id}
                        x={m.xPt}
                        y={m.yPt}
                        width={m.widthPt}
                        height={m.heightPt}
                        fill={m.coverColor}
                        stroke={isSel ? '#ff2e88' : 'none'}
                        strokeDasharray={isSel ? '4 2' : undefined}
                        strokeWidth={isSel ? 1.5 : 0}
                      />
                    );
                  }
                  if (m.type === 'highlight') {
                    return (
                      <rect
                        key={m.id}
                        x={m.xPt}
                        y={m.yPt}
                        width={m.widthPt}
                        height={m.heightPt}
                        fill={m.color}
                        fillOpacity={0.36}
                        stroke={isSel ? '#ff2e88' : 'none'}
                        strokeWidth={isSel ? 1.5 : 0}
                      />
                    );
                  }
                  if (m.type === 'box') {
                    return (
                      <rect
                        key={m.id}
                        x={m.xPt}
                        y={m.yPt}
                        width={m.widthPt}
                        height={m.heightPt}
                        fill="none"
                        stroke={m.color}
                        strokeWidth={m.strokeWidthPt}
                        strokeDasharray={isSel ? '5 3' : undefined}
                      />
                    );
                  }
                  if (m.type === 'draw-ink' && m.points.length > 1) {
                    const pts = m.points
                      .map((p) => `${p.xPt.toFixed(1)},${p.yPt.toFixed(1)}`)
                      .join(' ');
                    return (
                      <polyline
                        key={m.id}
                        points={pts}
                        fill="none"
                        stroke={m.color}
                        strokeWidth={m.strokeWidthPt}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  }
                  return null;
                })}

                {/* Active Drag Preview */}
                {draftRect && (
                  <rect
                    x={Math.min(draftRect.startX, draftRect.endX)}
                    y={Math.min(draftRect.startY, draftRect.endY)}
                    width={Math.abs(draftRect.endX - draftRect.startX)}
                    height={Math.abs(draftRect.endY - draftRect.startY)}
                    fill={
                      draftRect.kind === 'whiteout'
                        ? coverColor
                        : draftRect.kind === 'highlight'
                          ? injectionInk
                          : 'none'
                    }
                    fillOpacity={draftRect.kind === 'highlight' ? 0.36 : 1}
                    stroke={
                      draftRect.kind === 'box' ? injectionInk : '#00e5ff'
                    }
                    strokeWidth={
                      draftRect.kind === 'box' ? strokeWidthPt : 1.2
                    }
                    strokeDasharray="4 3"
                  />
                )}

                {draftInk && draftInk.length > 1 && (
                  <polyline
                    points={draftInk
                      .map((p) => `${p.xPt.toFixed(1)},${p.yPt.toFixed(1)}`)
                      .join(' ')}
                    fill="none"
                    stroke={injectionInk}
                    strokeWidth={strokeWidthPt}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>

              {/* Pointer & Text Interaction Surface */}
              <div
                className={`page-interaction-layer tool-${activeTool}`}
                onPointerDown={handleLayerPointerDown}
                onPointerMove={handleLayerPointerMove}
                onPointerUp={handleLayerPointerUp}
              >
                {/* Existing PDF Text Targets when EDIT TEXT is active */}
                {activeTool === 'edit-text' &&
                  textSpans.map((span) => (
                    <button
                      key={span.id}
                      type="button"
                      className="pdf-text-target"
                      style={{
                        left: span.xPt * zoom,
                        top: span.yPt * zoom,
                        width: Math.max(12, span.widthPt * zoom),
                        height: Math.max(12, span.heightPt * zoom),
                      }}
                      title={`Rewrite: "${span.text}"`}
                      aria-label={`Edit text: ${span.text}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditor({
                          mode: 'edit-span',
                          span,
                          text: span.text,
                          fontSizePt: Math.round(span.fontSizePt),
                        });
                      }}
                    />
                  ))}

                {/* Textual Mutation Layers (Editable on click) */}
                {pageMutations.map((m) => {
                  if (
                    m.type !== 'edit-text' &&
                    m.type !== 'add-text' &&
                    m.type !== 'ocr-stamp'
                  ) {
                    return null;
                  }
                  const isSelected = m.id === selectedLayerId;
                  const usesCoverBox =
                    m.type === 'edit-text' ||
                    (m.type === 'ocr-stamp' && Boolean(m.coverColor));
                  const padPt = usesCoverBox ? 3 : 0;
                  return (
                    <div
                      key={m.id}
                      className={`mutation-node ${isSelected ? 'is-selected' : ''}`}
                      style={{
                        left: (m.xPt - padPt) * zoom,
                        top: (m.yPt - padPt) * zoom,
                        minWidth:
                          m.type === 'edit-text' || m.type === 'ocr-stamp'
                            ? (m.widthPt + 12) * zoom
                            : undefined,
                        minHeight:
                          m.type === 'edit-text' || m.type === 'ocr-stamp'
                            ? (m.heightPt + 6) * zoom
                            : undefined,
                        backgroundColor:
                          m.type === 'edit-text'
                            ? m.coverColor
                            : m.type === 'ocr-stamp' && m.coverColor
                              ? m.coverColor
                              : 'transparent',
                        padding: usesCoverBox ? `${padPt * zoom}px` : 0,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLayer(m.id);
                        if (activeTool === 'edit-text' || activeTool === 'add-text') {
                          setInlineEditor({
                            mode: 'edit-layer',
                            layerId: m.id,
                            xPt: m.xPt,
                            yPt: m.yPt,
                            text: m.text,
                            fontSizePt: m.fontSizePt,
                          });
                        }
                      }}
                    >
                      <div
                        className="mutation-text-render"
                        style={{
                          color: m.color,
                          fontSize: `${m.fontSizePt * zoom}px`,
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Floating Inline Text Editor / Injector Popover */}
              {inlineEditor && (
                <div
                  className="inline-editor-popover"
                  style={{
                    left: Math.min(
                      displayWidth - 260,
                      Math.max(
                        10,
                        (inlineEditor.mode === 'edit-span'
                          ? inlineEditor.span.xPt
                          : inlineEditor.xPt) * zoom
                      )
                    ),
                    top: Math.min(
                      displayHeight - 150,
                      Math.max(
                        10,
                        (inlineEditor.mode === 'edit-span'
                          ? inlineEditor.span.yPt + inlineEditor.span.heightPt + 6
                          : inlineEditor.yPt + 6) * zoom
                      )
                    ),
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-editor-head">
                    <span>
                      {inlineEditor.mode === 'new-text'
                        ? 'INJECT TEXT'
                        : 'REWRITE REALITY'}
                    </span>
                    <span>{inlineEditor.fontSizePt} PT</span>
                  </div>
                  <textarea
                    ref={editorInputRef}
                    className="inline-editor-input"
                    value={inlineEditor.text}
                    placeholder="Type mutated text..."
                    onChange={(e) =>
                      setInlineEditor((prev) =>
                        prev ? { ...prev, text: e.target.value } : null
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setInlineEditor(null);
                      } else if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        commitInlineEditor();
                      }
                    }}
                  />
                  <div className="inline-editor-actions">
                    <button
                      type="button"
                      className="pager-btn"
                      onClick={() => setInlineEditor(null)}
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      className="hud-btn hud-btn-lime"
                      style={{ height: 26, padding: '0 10px', fontSize: 9 }}
                      onClick={commitInlineEditor}
                    >
                      APPLY
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky HUD Bar */}
      <footer className="stage-bottom-hud">
        <div className="hud-chips-strip" role="status" aria-live="polite">
          <span className="hud-chip-strong">TOOL {toolChipName}</span>
          <span aria-hidden="true">·</span>
          <span>
            PAGE {pageCount > 0 ? pad2(currentPage) : '00'}/
            {pageCount > 0 ? pad2(pageCount) : '00'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="hud-chip-cyan">MUTATIONS {totalMutations}</span>
          <span aria-hidden="true">·</span>
          <span>LOCAL / NO UPLOAD</span>
        </div>

        <div className="hud-pager">
          <button
            type="button"
            className="pager-btn"
            disabled={!pdfDoc || currentPage <= 1}
            onClick={onPrevPage}
          >
            <ChevronLeft size={13} />
            PREV
          </button>
          <button
            type="button"
            className="pager-btn"
            disabled={!pdfDoc || currentPage >= pageCount}
            onClick={onNextPage}
          >
            NEXT
            <ChevronRight size={13} />
          </button>
        </div>
      </footer>
    </main>
  );
}
