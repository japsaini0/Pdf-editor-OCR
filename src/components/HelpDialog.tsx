import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="lab-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <h2 className="dialog-title">LAB MANUAL // SHORTCUTS</h2>
          <button
            type="button"
            className="hud-icon-btn"
            onClick={onClose}
            aria-label="Close lab manual"
          >
            <X size={15} />
          </button>
        </div>

        <p style={{ margin: 0, color: 'var(--ink-muted)' }}>
          All PDF rendering, mutations, and Tesseract WASM OCR run locally in
          your browser. Nothing is uploaded.
        </p>

        <div className="shortcut-grid">
          <span className="shortcut-key">KEYS 1 - 6</span>
          <span>Switch active tool in the 01 TOOL DECK</span>

          <span className="shortcut-key">EDIT TEXT</span>
          <span>Click any PDF text line to cover & rewrite in place</span>

          <span className="shortcut-key">OCR SCANNER</span>
          <span>Select language and press SCAN to extract pixel text</span>

          <span className="shortcut-key">CTRL + Z / Y</span>
          <span>Undo or redo mutations across the entire document</span>

          <span className="shortcut-key">DEL / BACKSPACE</span>
          <span>Delete the currently selected layer on the page</span>

          <span className="shortcut-key">+ / - / 0</span>
          <span>Zoom in, zoom out, or reset canvas zoom to 100%</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div className="btn-shadow-wrap is-lime">
            <button
              type="button"
              className="hud-btn hud-btn-lime"
              onClick={onClose}
            >
              GOT IT
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
