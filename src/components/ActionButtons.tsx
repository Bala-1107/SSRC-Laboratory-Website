export type BusyAction = 'preview' | 'download' | 'share' | null;

interface Props {
  busy: BusyAction;
  canShare: boolean;
  onPreview: () => void;
  onDownload: () => void;
  onShare: () => void;
  onReset: () => void;
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function ActionButtons({ busy, canShare, onPreview, onDownload, onShare, onReset }: Props) {
  const disabled = busy !== null;
  return (
    <div className="actions" role="group" aria-label="Quotation actions">
      <button type="button" className="btn btn--primary btn--wide" onClick={onPreview} disabled={disabled}>
        {busy === 'preview' ? <Spinner /> : <IconEye />}
        Preview Quotation
      </button>
      <button type="button" className="btn btn--secondary" onClick={onDownload} disabled={disabled}>
        {busy === 'download' ? <Spinner /> : <IconDownload />}
        Download PDF
      </button>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={onShare}
        disabled={disabled}
        title={canShare ? 'Share with the device share sheet' : 'Sharing files is not supported in this browser — the PDF will be downloaded instead'}
      >
        {busy === 'share' ? <Spinner /> : <IconShare />}
        Share PDF
      </button>
      <button type="button" className="btn btn--ghost btn--wide" onClick={onReset} disabled={disabled}>
        Reset Form
      </button>
    </div>
  );
}

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
const IconEye = () => (
  <svg {...svg}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IconDownload = () => (
  <svg {...svg}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
);
const IconShare = () => (
  <svg {...svg}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" /></svg>
);
