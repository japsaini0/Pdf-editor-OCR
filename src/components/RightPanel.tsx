import { ScanText, Stamp, Trash2 } from 'lucide-react';
import { OCR_LANGUAGES } from '../constants';
import type { ActivityEntry, MutationLayer, OcrLineItem } from '../types';

interface RightPanelProps {
  hasDocument: boolean;
  ocrLanguage: string;
  onChangeOcrLanguage: (lang: string) => void;
  ocrScanning: boolean;
  ocrProgress: number;
  ocrStatusText: string;
  onRunOcr: () => void;
  ocrLines: OcrLineItem[];
  onToggleOcrLine: (id: string) => void;
  onUpdateOcrLineText: (id: string, text: string) => void;
  coverOcrOriginals: boolean;
  onToggleCoverOcrOriginals: (val: boolean) => void;
  onStampOcrOnPage: () => void;
  pageMutations: MutationLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  activityLog: ActivityEntry[];
}

function summarizeLayer(layer: MutationLayer): string {
  switch (layer.type) {
    case 'edit-text':
      return `"${layer.text}"`;
    case 'add-text':
      return `"${layer.text}"`;
    case 'ocr-stamp':
      return `"${layer.text}"`;
    case 'highlight':
      return `${Math.round(layer.widthPt)}×${Math.round(layer.heightPt)} PT BAND`;
    case 'box':
      return `${Math.round(layer.widthPt)}×${Math.round(layer.heightPt)} PT FRAME`;
    case 'whiteout':
      return `${Math.round(layer.widthPt)}×${Math.round(layer.heightPt)} PT PATCH`;
    case 'draw-ink':
      return `${layer.points.length} VECTOR PTS`;
  }
}

export function RightPanel({
  hasDocument,
  ocrLanguage,
  onChangeOcrLanguage,
  ocrScanning,
  ocrProgress,
  ocrStatusText,
  onRunOcr,
  ocrLines,
  onToggleOcrLine,
  onUpdateOcrLineText,
  coverOcrOriginals,
  onToggleCoverOcrOriginals,
  onStampOcrOnPage,
  pageMutations,
  selectedLayerId,
  onSelectLayer,
  onDeleteLayer,
  activityLog,
}: RightPanelProps) {
  const filledSegments = Math.round(ocrProgress * 16);
  const selectedOcrCount = ocrLines.filter((l) => l.selected && l.text.trim()).length;

  return (
    <aside className="right-panel" aria-label="OCR scanner, layers, and activity log">
      {/* 06 OCR SCANNER */}
      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>06</strong> OCR SCANNER
          </span>
          <span className="section-value">TESSERACT WASM</span>
        </div>

        <div className="ocr-hero-card">
          <h2 className="ocr-hero-heading">MAKE PIXELS TALK</h2>
          <p className="ocr-hero-sub">
            Extract raw bitmap text locally on the active page.
          </p>

          <div className="ocr-controls-row">
            <select
              className="hud-select"
              value={ocrLanguage}
              onChange={(e) => onChangeOcrLanguage(e.target.value)}
              aria-label="OCR language"
              disabled={ocrScanning}
            >
              {OCR_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>

            <div className="btn-shadow-wrap is-pink">
              <button
                type="button"
                className="hud-btn hud-btn-pink"
                onClick={onRunOcr}
                disabled={!hasDocument || ocrScanning}
              >
                <ScanText size={14} />
                {ocrScanning ? 'SCANNING' : 'SCAN'}
              </button>
            </div>
          </div>

          <div className="segmented-progress" aria-label="OCR progress">
            <div className="progress-meta-row">
              <span>{ocrStatusText}</span>
              <span>{Math.round(ocrProgress * 100)}%</span>
            </div>
            <div className="progress-segments" role="progressbar" aria-valuenow={Math.round(ocrProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
              {Array.from({ length: 16 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`progress-seg ${idx < filledSegments ? 'is-filled' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 07 RECOGNIZED TEXT */}
      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>07</strong> RECOGNIZED TEXT
          </span>
          <span className="section-value">{ocrLines.length} LINES</span>
        </div>

        {ocrLines.length > 0 ? (
          <>
            <div className="ocr-lines-list">
              {ocrLines.map((line, i) => (
                <div key={line.id} className="ocr-line-row">
                  <div className="ocr-line-head">
                    <label className="ocr-line-check">
                      <input
                        type="checkbox"
                        checked={line.selected}
                        onChange={() => onToggleOcrLine(line.id)}
                      />
                      <span>LINE {String(i + 1).padStart(2, '0')}</span>
                    </label>
                    <span className="ocr-conf">{line.confidence}% CONF</span>
                  </div>
                  <textarea
                    className="ocr-textarea"
                    value={line.text}
                    onChange={(e) => onUpdateOcrLineText(line.id, e.target.value)}
                    aria-label={`Recognized OCR line ${i + 1}`}
                  />
                </div>
              ))}
            </div>

            <div className="ocr-stamp-options">
              <label className="stamp-cover-toggle">
                <input
                  type="checkbox"
                  checked={coverOcrOriginals}
                  onChange={(e) => onToggleCoverOcrOriginals(e.target.checked)}
                />
                <span>COVER ORIGINAL PIXELS</span>
              </label>
              <span className="section-value">{selectedOcrCount} SELECTED</span>
            </div>

            <div className="btn-shadow-wrap is-lime">
              <button
                type="button"
                className="hud-btn hud-btn-lime stamp-full-btn"
                onClick={onStampOcrOnPage}
                disabled={!hasDocument || selectedOcrCount === 0}
              >
                <Stamp size={15} />
                STAMP ON PAGE
              </button>
            </div>
          </>
        ) : (
          <div className="empty-rail-note">
            RUN SCAN ON ANY PAGE TO EXTRACT EDITABLE LINES
          </div>
        )}
      </section>

      {/* 08 LAYERS */}
      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>08</strong> LAYERS
          </span>
          <span className="section-value">{pageMutations.length} ON PAGE</span>
        </div>

        {pageMutations.length > 0 ? (
          <div className="layers-list">
            {pageMutations.map((layer) => {
              const selected = layer.id === selectedLayerId;
              return (
                <div
                  key={layer.id}
                  className={`layer-row ${selected ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="layer-select-btn"
                    onClick={() => onSelectLayer(layer.id)}
                  >
                    <span className="layer-type">
                      {layer.type.replace('-', ' ')}
                    </span>
                    <span className="layer-desc">{summarizeLayer(layer)}</span>
                  </button>
                  <button
                    type="button"
                    className="layer-trash-btn"
                    onClick={() => onDeleteLayer(layer.id)}
                    aria-label={`Delete ${layer.type} layer`}
                    title="Delete layer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-rail-note">NO MUTATIONS ON THIS PAGE</div>
        )}
      </section>

      {/* 09 ACTIVITY LOG */}
      <section className="panel-section">
        <div className="section-label">
          <span>
            <strong>09</strong> ACTIVITY LOG
          </span>
          <span className="section-value">{activityLog.length}</span>
        </div>

        <div className="activity-log" role="log" aria-live="polite">
          {activityLog.map((entry) => (
            <div key={entry.id} className="log-line">
              <span className="log-ts">[{entry.timestamp}]</span>
              <span className={`log-msg is-${entry.tone}`}>{entry.message}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
