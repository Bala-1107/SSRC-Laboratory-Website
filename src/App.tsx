import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionButtons, type BusyAction } from './components/ActionButtons';
import { CalculationSummary } from './components/CalculationSummary';
import { PreviewPanel, type PreviewPdf } from './components/PreviewPanel';
import { QuotationForm, fieldId } from './components/QuotationForm';
import { EMPTY_FORM, type FieldPath, type QuotationForm as FormState, type ValidationErrors } from './types/quotation';
import { calculateTotals, parseNumberOrZero } from './utils/calculations';
import { todayIso } from './utils/formatting';
import { FIELD_ORDER, validateQuotation } from './utils/validation';

/** pdf-lib is loaded on demand so the form appears quickly on phones. */
const loadPdfModule = () => import('./pdf/generateQuotationPdf');

type Notice = { kind: 'error' | 'info' | 'success'; text: string } | null;

const freshForm = (): FormState => ({ ...EMPTY_FORM, date: todayIso(), item1: { ...EMPTY_FORM.item1 }, item2: { ...EMPTY_FORM.item2 } });

function setPath(form: FormState, path: FieldPath, value: string): FormState {
  if (path.startsWith('item1.') || path.startsWith('item2.')) {
    const [item, key] = path.split('.') as ['item1' | 'item2', 'quantity' | 'rate'];
    return { ...form, [item]: { ...form[item], [key]: value } };
  }
  return { ...form, [path]: value };
}

const shareSupported = (): boolean => {
  try {
    if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
    const probe = new File([new Uint8Array([37])], 'probe.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
};

export default function App() {
  const [form, setForm] = useState<FormState>(freshForm);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<PreviewPdf | null>(null);
  /** JSON of the form the current preview was generated from. */
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const canShare = useMemo(shareSupported, []);

  // Warm the PDF engine + template cache so the first preview is instant.
  useEffect(() => {
    loadPdfModule()
      .then((m) => m.loadTemplateBytes())
      .catch(() => undefined);
  }, []);

  // Revoke the old blob URL whenever the preview is replaced.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  // Live calculation — no Calculate button.
  const totals = useMemo(
    () =>
      calculateTotals(
        { quantity: parseNumberOrZero(form.item1.quantity), rate: parseNumberOrZero(form.item1.rate) },
        { quantity: parseNumberOrZero(form.item2.quantity), rate: parseNumberOrZero(form.item2.rate) },
      ),
    [form.item1, form.item2],
  );

  const formKey = JSON.stringify(form);
  const stale = preview !== null && previewKey !== formKey;

  const onChange = useCallback((path: FieldPath, value: string) => {
    setForm((f) => setPath(f, path, value));
  }, []);

  // After the first generate attempt, re-validate live so messages clear as they're fixed.
  useEffect(() => {
    if (submitted) setErrors(validateQuotation(form).errors);
  }, [form, submitted]);

  /** Validates, then generates the filled PDF from the current form. */
  const build = useCallback(async (): Promise<PreviewPdf | null> => {
    setSubmitted(true);
    const { errors: errs, data } = validateQuotation(form);
    setErrors(errs);
    if (!data) {
      const count = Object.keys(errs).length;
      setNotice({ kind: 'error', text: `Please fix ${count} field${count > 1 ? 's' : ''} before generating the PDF.` });
      const first = FIELD_ORDER.find((p) => errs[p]);
      if (first) {
        const el = document.getElementById(fieldId(first));
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
      }
      return null;
    }
    // Reuse the current preview if nothing changed — download === preview.
    if (preview && previewKey === formKey) return preview;

    const { generateQuotationPdf } = await loadPdfModule();
    const out = await generateQuotationPdf(data);
    const next: PreviewPdf = { bytes: out.bytes, url: URL.createObjectURL(out.blob), fileName: out.fileName };
    setPreview(next);
    setPreviewKey(formKey);
    return next;
  }, [form, formKey, preview, previewKey]);

  const run = async (action: Exclude<BusyAction, null>, fn: () => Promise<void>) => {
    setBusy(action);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', text: (err as Error)?.message || 'Something went wrong while creating the PDF.' });
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = () =>
    run('preview', async () => {
      const pdf = await build();
      if (pdf && window.matchMedia('(max-width: 1023px)').matches) {
        requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    });

  const download = (pdf: PreviewPdf) => {
    const a = document.createElement('a');
    a.href = pdf.url;
    a.download = pdf.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownload = () =>
    run('download', async () => {
      const pdf = await build();
      if (!pdf) return;
      download(pdf);
      setNotice({ kind: 'success', text: `Downloaded ${pdf.fileName}` });
    });

  const handleShare = () =>
    run('share', async () => {
      const wasFresh = preview !== null && previewKey === formKey;
      const pdf = await build();
      if (!pdf) return;
      if (!canShare) {
        download(pdf);
        setNotice({
          kind: 'info',
          text: 'This browser cannot share files directly, so the PDF was downloaded. You can attach it in WhatsApp, email, etc.',
        });
        return;
      }
      const file = new File([pdf.bytes], pdf.fileName, { type: 'application/pdf' });
      try {
        await navigator.share({ files: [file], title: pdf.fileName.replace(/\.pdf$/, '') });
      } catch (err) {
        const name = (err as Error)?.name;
        if (name === 'AbortError') return; // user closed the share sheet
        if (name === 'NotAllowedError' && !wasFresh) {
          // Some browsers (iOS Safari) require share() to follow the tap directly;
          // generating the PDF first can use up that permission. It is ready now.
          setNotice({ kind: 'info', text: 'Your PDF is ready — tap “Share PDF” once more to open the share sheet.' });
          return;
        }
        download(pdf);
        setNotice({ kind: 'info', text: 'Sharing was not available, so the PDF was downloaded instead.' });
      }
    });

  const handleReset = () => {
    const dirty = JSON.stringify(form) !== JSON.stringify(freshForm());
    if (dirty && !window.confirm('Clear all fields and start a new quotation?')) return;
    setForm(freshForm());
    setErrors({});
    setSubmitted(false);
    setNotice(null);
    setPreview(null);
    setPreviewKey(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">SSRC</span>
            <div>
              <p className="brand__name">SSRC Laboratory</p>
              <h1 className="brand__title">Quotation Generator</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="page-heading">
          <h2>Create Quotation</h2>
          <p>Fill in the details. The values are printed onto the official quotation template.</p>
        </div>

        {notice && (
          <div className={`notice notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            <span>{notice.text}</span>
            <button type="button" className="notice__close" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
          </div>
        )}

        <div className="layout">
          <div className="layout__main">
            <QuotationForm form={form} errors={errors} totals={totals} onChange={onChange} />
          </div>

          <aside className="layout__side" aria-label="Calculation and preview">
            <CalculationSummary totals={totals} />
            <ActionButtons
              busy={busy}
              canShare={canShare}
              onPreview={handlePreview}
              onDownload={handleDownload}
              onShare={handleShare}
              onReset={handleReset}
            />
            <div ref={previewRef} className="scroll-anchor">
              <PreviewPanel pdf={preview} stale={stale} onRefresh={handlePreview} />
            </div>
          </aside>
        </div>
      </main>

      <footer className="footer">
        SSRC Laboratory · Soil Investigation &amp; Geotechnical Services · PDFs are generated on this device
      </footer>
    </div>
  );
}
