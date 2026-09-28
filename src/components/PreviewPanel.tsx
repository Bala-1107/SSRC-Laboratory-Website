import { useEffect, useRef, useState } from 'react';

export interface PreviewPdf {
  bytes: Uint8Array;
  url: string;
  fileName: string;
}

interface Props {
  pdf: PreviewPdf | null;
  stale: boolean;
  onRefresh: () => void;
}

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * pdf.js is loaded on demand (legacy build → works on older iOS/Android too).
 * It renders the ACTUAL generated PDF bytes; it is not an HTML imitation.
 * Rendering with pdf.js instead of relying on an <iframe> alone is what makes
 * the preview work on Android Chrome, which has no built-in PDF viewer.
 */
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      const pdfjs = lib as unknown as PdfJs;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function PreviewPanel({ pdf, stale, onRefresh }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'failed'>('idle');

  // Track the available width so the page always fits the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let t: number | undefined;
    const ro = new ResizeObserver(([entry]) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setWidth(Math.floor(entry.contentRect.width)), 80);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [pdf !== null]);

  useEffect(() => {
    if (!pdf || !width || !canvasRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let doc: { destroy: () => Promise<void> } | null = null;
    setStatus('rendering');

    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        // pdf.js transfers the buffer to its worker — always hand it a copy.
        const loaded = await pdfjs.getDocument({ data: pdf.bytes.slice() }).promise;
        doc = loaded;
        if (cancelled) return;
        const page = await loaded.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const cssScale = width / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const viewport = page.getViewport({ scale: cssScale * dpr });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${Math.floor(base.height * cssScale)}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not available');
        task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
        if (!cancelled) setStatus('done');
      } catch (err) {
        if (cancelled || (err as Error)?.name === 'RenderingCancelledException') return;
        console.error('[preview] pdf.js render failed, falling back to the browser viewer', err);
        setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
      void doc?.destroy();
    };
  }, [pdf, width]);

  return (
    <section className="card preview" aria-labelledby="preview-title">
      <header className="card__header card__header--row">
        <div>
          <h2 id="preview-title" className="card__title">PDF Preview</h2>
          <p className="card__desc">
            {pdf ? pdf.fileName : 'Tap “Preview Quotation” to generate the actual PDF.'}
          </p>
        </div>
        {pdf && (
          <a className="btn btn--small btn--ghost" href={pdf.url} target="_blank" rel="noopener">
            Open PDF
          </a>
        )}
      </header>

      {pdf && stale && (
        <div className="notice notice--warn" role="status">
          <span>The form changed after this preview.</span>
          <button type="button" className="btn btn--small btn--secondary" onClick={onRefresh}>
            Update preview
          </button>
        </div>
      )}

      <div ref={wrapRef} className={`preview__frame ${pdf ? '' : 'preview__frame--empty'}`}>
        {!pdf && (
          <div className="preview__placeholder">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" />
            </svg>
            <p>No preview yet</p>
          </div>
        )}
        {pdf && status !== 'failed' && (
          <canvas
            ref={canvasRef}
            className={`preview__canvas ${stale ? 'preview__canvas--stale' : ''}`}
            role="img"
            aria-label={`Preview of ${pdf.fileName}`}
          />
        )}
        {pdf && status === 'failed' && (
          <iframe className="preview__iframe" src={pdf.url} title={`Preview of ${pdf.fileName}`} />
        )}
        {pdf && status === 'rendering' && <div className="preview__loading"><span className="spinner" /> Rendering…</div>}
      </div>
    </section>
  );
}
