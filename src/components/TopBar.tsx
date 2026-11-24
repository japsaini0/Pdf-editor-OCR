import { Download, FolderOpen, HelpCircle, Redo2, Undo2 } from 'lucide-react';

interface TopBarProps {
  fileName: string | null;
  pageCount: number;
  mutationCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPdf: () => void;
  onExportPdf: () => void;
  onOpenHelp: () => void;
}

export function TopBar({
  fileName,
  pageCount,
  mutationCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenPdf,
  onExportPdf,
  onOpenHelp,
}: TopBarProps) {
  const hasDoc = Boolean(fileName && pageCount > 0);
  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo-badge" aria-hidden="true">
          P
        </div>
        <div className="brand-lockup">
          <div className="wordmark" data-text="PDF/RIOT">
            PDF/RIOT
          </div>
          <div className="brand-tagline">DOCUMENT MUTATION LAB</div>
        </div>
      </div>

      <div className="topbar-center">
        <div className="file-chip-wrap">
          <div className="file-chip" role="status" aria-live="polite">
            <span
              className={`pulse-dot ${hasDoc ? '' : 'is-idle'}`}
              aria-hidden="true"
            />
            <span className="file-chip-name">
              {fileName ? fileName.toUpperCase() : 'NO_SPECIMEN_LOADED'}
            </span>
            <span className="file-chip-meta">
              {hasDoc
                ? `${pad2(pageCount)}P / ${pad2(mutationCount)}E`
                : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="hud-icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo last mutation"
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="hud-icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo mutation"
        >
          <Redo2 size={15} />
        </button>

        <button
          type="button"
          className="hud-btn hud-btn-secondary"
          onClick={onOpenPdf}
        >
          <FolderOpen size={14} />
          OPEN PDF
        </button>

        <div className="btn-shadow-wrap is-lime">
          <button
            type="button"
            className="hud-btn hud-btn-lime"
            onClick={onExportPdf}
            disabled={!hasDoc}
          >
            <Download size={14} />
            EXPORT PDF
          </button>
        </div>

        <button
          type="button"
          className="hud-icon-btn"
          onClick={onOpenHelp}
          title="Lab Manual & Shortcuts"
          aria-label="Open help and keyboard shortcuts"
        >
          <HelpCircle size={15} />
        </button>
      </div>
    </header>
  );
}
