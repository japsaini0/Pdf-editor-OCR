import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentStage } from './components/DocumentStage';
import { HelpDialog } from './components/HelpDialog';
import { LeftRail } from './components/LeftRail';
import { MarqueeStrip } from './components/MarqueeStrip';
import { RightPanel } from './components/RightPanel';
import { TopBar } from './components/TopBar';
import { TOOLS } from './constants';
import { runOcrOnCanvas } from './lib/ocrEngine';
import {
  exportMutatedPdf,
  extractPageTextSpans,
  generateDemoPdfBytes,
  loadPdfFromBytes,
  renderCompositeCanvasForOcr,
  type LoadedPdfDoc,
} from './lib/pdfEngine';
import type {
  ActivityEntry,
  MutationLayer,
  OcrLineItem,
  PdfPageMeta,
  PdfTextSpan,
  ToastNotice,
  ToolId,
} from './types';

function nowTimestamp(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<LoadedPdfDoc | null>(null);
  const [pagesMeta, setPagesMeta] = useState<PdfPageMeta[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [spansByPage, setSpansByPage] = useState<Record<number, PdfTextSpan[]>>(
    {}
  );

  // Tool & style state
  const [activeTool, setActiveTool] = useState<ToolId>('edit-text');
  const [injectionInk, setInjectionInk] = useState<string>('#ff2e88');
  const [coverColor, setCoverColor] = useState<string>('#ffffff');
  const [strokeWidthPt, setStrokeWidthPt] = useState<number>(3);
  const [fontSizePt, setFontSizePt] = useState<number>(14);

  // Undo/Redo history of document mutations
  const [history, setHistory] = useState<MutationLayer[][]>([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const mutations = history[historyIdx];
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // OCR state
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('IDLE // READY');
  const [ocrLines, setOcrLines] = useState<OcrLineItem[]>([]);
  const [coverOcrOriginals, setCoverOcrOriginals] = useState(true);

  // Chrome & feedback state
  const [loadingOverlay, setLoadingOverlay] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([
    {
      id: 'boot-1',
      timestamp: nowTimestamp(),
      message: 'LAB BOOTED // WASM OCR + PDF PIPELINE ARMED',
      tone: 'cyan',
    },
  ]);

  const appendLog = useCallback(
    (message: string, tone: ActivityEntry['tone'] = 'neutral') => {
      setActivityLog((prev) => [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowTimestamp(),
          message,
          tone,
        },
        ...prev.slice(0, 39),
      ]);
    },
    []
  );

  const pushToast = useCallback(
    (message: string, variant: ToastNotice['variant'] = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  const commitMutations = useCallback(
    (next: MutationLayer[]) => {
      setHistory((prev) => [...prev.slice(0, historyIdx + 1), next]);
      setHistoryIdx((idx) => idx + 1);
    },
    [historyIdx]
  );

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    setHistoryIdx((i) => i - 1);
    setSelectedLayerId(null);
    appendLog('UNDO EXECUTED', 'cyan');
  }, [canUndo, appendLog]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    setHistoryIdx((i) => i + 1);
    setSelectedLayerId(null);
    appendLog('REDO EXECUTED', 'cyan');
  }, [canRedo, appendLog]);

  // Extract text spans lazily for current page
  useEffect(() => {
    if (!pdfDoc) return;
    if (spansByPage[currentPage]) return;

    let cancelled = false;
    extractPageTextSpans(pdfDoc, currentPage)
      .then((spans) => {
        if (cancelled) return;
        setSpansByPage((prev) => ({ ...prev, [currentPage]: spans }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, spansByPage]);

  const loadPdfBytes = useCallback(
    async (bytes: Uint8Array, name: string) => {
      setLoadingOverlay(`MOUNTING ${name.toUpperCase()}`);
      try {
        const { doc, pagesMeta: metas } = await loadPdfFromBytes(bytes);
        setPdfBytes(bytes);
        setPdfDoc(doc);
        setPagesMeta(metas);
        setFileName(name);
        setCurrentPage(1);
        setZoom(1);
        setSpansByPage({});
        setHistory([[]]);
        setHistoryIdx(0);
        setSelectedLayerId(null);
        setOcrLines([]);
        setOcrProgress(0);
        setOcrStatusText('IDLE // READY');

        appendLog(
          `LOADED ${name.toUpperCase()} (${metas.length} PAGES)`,
          'lime'
        );
        pushToast(`${name.toUpperCase()} MOUNTED`, 'success');
      } catch (err) {
        console.error(err);
        appendLog(`LOAD FAILED: ${(err as Error).message}`, 'pink');
        pushToast('FAILED TO PARSE PDF SPECIMEN', 'error');
      } finally {
        setLoadingOverlay(null);
      }
    },
    [appendLog, pushToast]
  );

  const handleLoadDemo = useCallback(async () => {
    setLoadingOverlay('SYNTHESIZING DEMO SPECIMEN');
    try {
      const bytes = await generateDemoPdfBytes();
      await loadPdfBytes(bytes, 'SPEC09_MUTATION_LAB.pdf');
      appendLog('DEMO READY // PAGE 02 CONTAINS RASTER SCAN FOR OCR', 'cyan');
    } catch (err) {
      console.error(err);
      pushToast('DEMO GENERATION FAILED', 'error');
      setLoadingOverlay(null);
    }
  }, [loadPdfBytes, appendLog, pushToast]);

  const handleOpenPdfFile = useCallback(
    async (file: File) => {
      if (
        !file.name.toLowerCase().endsWith('.pdf') &&
        file.type !== 'application/pdf'
      ) {
        pushToast('ONLY .PDF FILES ARE ACCEPTED', 'error');
        appendLog(`REJECTED NON-PDF: ${file.name}`, 'pink');
        return;
      }
      const buf = await file.arrayBuffer();
      await loadPdfBytes(new Uint8Array(buf), file.name);
    },
    [loadPdfBytes, pushToast, appendLog]
  );

  const handleExportPdf = useCallback(async () => {
    if (!pdfBytes || !fileName) return;
    setLoadingOverlay('COMPILING MUTATED PDF');
    try {
      const outBytes = await exportMutatedPdf(pdfBytes, mutations);
      const blob = new Blob([outBytes.slice().buffer], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base = fileName.replace(/\.pdf$/i, '');
      a.download = `${base}_mutated.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      appendLog(
        `EXPORTED ${base.toUpperCase()}_MUTATED.PDF (${mutations.length} MUTATIONS)`,
        'lime'
      );
      pushToast('MUTATED PDF EXPORTED', 'success');
    } catch (err) {
      console.error(err);
      appendLog('EXPORT ERROR', 'pink');
      pushToast('PDF EXPORT FAILED', 'error');
    } finally {
      setLoadingOverlay(null);
    }
  }, [pdfBytes, fileName, mutations, appendLog, pushToast]);

  const pageMutations = useMemo(
    () => mutations.filter((m) => m.pageNumber === currentPage),
    [mutations, currentPage]
  );

  const pageMutationCounts = useMemo(() => {
    const map: Record<number, number> = {};
    for (const m of mutations) {
      map[m.pageNumber] = (map[m.pageNumber] || 0) + 1;
    }
    return map;
  }, [mutations]);

  const handleAddMutation = useCallback(
    (layer: MutationLayer) => {
      commitMutations([...mutations, layer]);
      setSelectedLayerId(layer.id);
      appendLog(
        `P${String(layer.pageNumber).padStart(2, '0')} + ${layer.type.toUpperCase()}`,
        'lime'
      );
    },
    [commitMutations, mutations, appendLog]
  );

  const handleUpdateMutation = useCallback(
    (updated: MutationLayer) => {
      commitMutations(
        mutations.map((m) => (m.id === updated.id ? updated : m))
      );
      appendLog(`UPDATED ${updated.type.toUpperCase()} LAYER`, 'cyan');
    },
    [commitMutations, mutations, appendLog]
  );

  const handleDeleteLayer = useCallback(
    (id: string) => {
      const target = mutations.find((m) => m.id === id);
      if (!target) return;
      commitMutations(mutations.filter((m) => m.id !== id));
      if (selectedLayerId === id) setSelectedLayerId(null);
      appendLog(`DELETED ${target.type.toUpperCase()} LAYER`, 'pink');
    },
    [mutations, commitMutations, selectedLayerId, appendLog]
  );

  const handleRunOcr = useCallback(async () => {
    if (!pdfDoc || ocrScanning) return;
    setOcrScanning(true);
    setOcrProgress(0.05);
    setOcrStatusText('RASTERIZING PAGE');
    appendLog(
      `OCR SCAN STARTED // PAGE ${String(currentPage).padStart(2, '0')} [${ocrLanguage.toUpperCase()}]`,
      'cyan'
    );

    try {
      const { canvas, scale } = await renderCompositeCanvasForOcr(
        pdfDoc,
        currentPage,
        pageMutations,
        2.0
      );

      const lines = await runOcrOnCanvas(
        canvas,
        scale,
        ocrLanguage,
        ({ status, progress }) => {
          setOcrStatusText(status);
          setOcrProgress(progress);
        }
      );

      setOcrLines(lines);
      appendLog(`OCR COMPLETE // ${lines.length} LINES EXTRACTED`, 'lime');
      pushToast(`OCR EXTRACTED ${lines.length} LINES`, 'success');
    } catch (err) {
      console.error(err);
      setOcrStatusText('SCAN FAILED');
      appendLog(`OCR ERROR: ${(err as Error).message}`, 'pink');
      pushToast('OCR ENGINE FAILED ON PAGE', 'error');
    } finally {
      setOcrScanning(false);
    }
  }, [
    pdfDoc,
    ocrScanning,
    currentPage,
    ocrLanguage,
    pageMutations,
    appendLog,
    pushToast,
  ]);

  const handleStampOcrOnPage = useCallback(() => {
    const selected = ocrLines.filter((l) => l.selected && l.text.trim());
    if (selected.length === 0) return;

    const stamped: MutationLayer[] = selected.map((line, i) => ({
      id: `ocr-stamp-${Date.now()}-${i}`,
      type: 'ocr-stamp',
      pageNumber: currentPage,
      xPt: line.xPt,
      yPt: line.yPt,
      widthPt: line.widthPt,
      heightPt: line.heightPt,
      text: line.text.trim(),
      fontSizePt: Math.max(8, Math.min(24, Math.round(line.heightPt * 0.78))),
      color: injectionInk,
      coverColor: coverOcrOriginals ? coverColor : undefined,
    }));

    commitMutations([...mutations, ...stamped]);
    appendLog(
      `STAMPED ${stamped.length} OCR LINES ON PAGE ${String(currentPage).padStart(2, '0')}`,
      'lime'
    );
    pushToast(`STAMPED ${stamped.length} OCR LINES`, 'success');
  }, [
    ocrLines,
    currentPage,
    injectionInk,
    coverOcrOriginals,
    coverColor,
    commitMutations,
    mutations,
    appendLog,
    pushToast,
  ]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isEditingField) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (isEditingField) return;
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isEditingField) return;

      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < TOOLS.length) {
        setActiveTool(TOOLS[idx].id);
        return;
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedLayerId
      ) {
        e.preventDefault();
        handleDeleteLayer(selectedLayerId);
        return;
      }

      if (e.key === '=' || e.key === '+') {
        setZoom((z) => Math.min(2.4, Number((z + 0.15).toFixed(2))));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))));
      } else if (e.key === '0') {
        setZoom(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, selectedLayerId, handleDeleteLayer]);

  return (
    <div className="lab-shell">
      <div className="fx-grain" aria-hidden="true" />
      <div className="fx-scanlines" aria-hidden="true" />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleOpenPdfFile(file);
          e.target.value = '';
        }}
      />

      <TopBar
        fileName={fileName}
        pageCount={pagesMeta.length}
        mutationCount={mutations.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenPdf={() => fileInputRef.current?.click()}
        onExportPdf={handleExportPdf}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <MarqueeStrip />

      <div className="workspace-grid">
        <LeftRail
          activeTool={activeTool}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            appendLog(`TOOL -> ${tool.toUpperCase()}`, 'neutral');
          }}
          injectionInk={injectionInk}
          onSelectInk={setInjectionInk}
          coverColor={coverColor}
          onSelectCoverColor={setCoverColor}
          strokeWidthPt={strokeWidthPt}
          onChangeStrokeWidth={setStrokeWidthPt}
          fontSizePt={fontSizePt}
          onChangeFontSize={setFontSizePt}
          pdfDoc={pdfDoc}
          pagesMeta={pagesMeta}
          currentPage={currentPage}
          onSelectPage={(p) => {
            setCurrentPage(p);
            setSelectedLayerId(null);
            setOcrLines([]);
          }}
          pageMutationCounts={pageMutationCounts}
        />

        <DocumentStage
          pdfDoc={pdfDoc}
          pagesMeta={pagesMeta}
          currentPage={currentPage}
          pageCount={pagesMeta.length}
          zoom={zoom}
          onChangeZoom={setZoom}
          onPrevPage={() => {
            setCurrentPage((p) => Math.max(1, p - 1));
            setSelectedLayerId(null);
            setOcrLines([]);
          }}
          onNextPage={() => {
            setCurrentPage((p) => Math.min(pagesMeta.length, p + 1));
            setSelectedLayerId(null);
            setOcrLines([]);
          }}
          activeTool={activeTool}
          injectionInk={injectionInk}
          coverColor={coverColor}
          strokeWidthPt={strokeWidthPt}
          fontSizePt={fontSizePt}
          textSpans={spansByPage[currentPage] ?? []}
          pageMutations={pageMutations}
          totalMutations={mutations.length}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onAddMutation={handleAddMutation}
          onUpdateMutation={handleUpdateMutation}
          onOpenPdf={() => fileInputRef.current?.click()}
          onLoadDemo={handleLoadDemo}
          onDropPdfFile={handleOpenPdfFile}
        />

        <RightPanel
          hasDocument={Boolean(pdfDoc)}
          ocrLanguage={ocrLanguage}
          onChangeOcrLanguage={setOcrLanguage}
          ocrScanning={ocrScanning}
          ocrProgress={ocrProgress}
          ocrStatusText={ocrStatusText}
          onRunOcr={handleRunOcr}
          ocrLines={ocrLines}
          onToggleOcrLine={(id) =>
            setOcrLines((prev) =>
              prev.map((l) =>
                l.id === id ? { ...l, selected: !l.selected } : l
              )
            )
          }
          onUpdateOcrLineText={(id, text) =>
            setOcrLines((prev) =>
              prev.map((l) => (l.id === id ? { ...l, text } : l))
            )
          }
          coverOcrOriginals={coverOcrOriginals}
          onToggleCoverOcrOriginals={setCoverOcrOriginals}
          onStampOcrOnPage={handleStampOcrOnPage}
          pageMutations={pageMutations}
          selectedLayerId={selectedLayerId}
          onSelectLayer={(id) => setSelectedLayerId(id)}
          onDeleteLayer={handleDeleteLayer}
          activityLog={activityLog}
        />
      </div>

      {/* Bottom Center Toast Stack */}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="assertive">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-wrap is-${t.variant}`}>
              <div className="toast-banner" role="alert">
                {t.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Blurred Loading Overlay */}
      {loadingOverlay && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-card">
            <div className="loading-title">MUTATION LAB // BUSY</div>
            <div className="loading-sub">{loadingOverlay}</div>
            <div className="neon-loader-track">
              <div className="neon-loader-bar" />
            </div>
          </div>
        </div>
      )}

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export default App;
