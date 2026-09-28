/**
 * Indian digit grouping: 3000 → 3,000 · 150000 → 1,50,000.
 * Whole numbers show no decimals; fractional values show exactly 2.
 */
export function formatIndian(value: number): string {
  const isWhole = Math.abs(value - Math.round(value)) < 1e-9;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(isWhole ? Math.round(value) : value);
}

/**
 * Amount as printed in the PDF next to the template's existing "Rs." —
 * the "Rs." itself is NEVER added here.
 * Whole rupees get the conventional "/-" suffix (Rs. 3,000/-), as in the
 * completed reference quotation. Values with paise are printed as-is.
 */
export function formatPdfAmount(value: number): string {
  const text = formatIndian(value);
  return Number.isInteger(value) ? `${text}/-` : text;
}

/** Rate as printed in the PDF (reference prints "Rs. 8,500" — no suffix). */
export function formatPdfRate(value: number): string {
  return formatIndian(value);
}

/** Quantity as printed in the QTY column. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(value);
}

/** Currency for the web UI only (never used in the PDF). */
export function formatRupees(value: number): string {
  return `₹ ${formatIndian(value)}`;
}

/** yyyy-mm-dd → dd/mm/yyyy */
export function formatDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export const QUOTATION_PREFIX = 'SSRC/SPT/';
export const QUOTATION_SUFFIX = '/2026-27';

/**
 * Only the value that fills the blank between "SSRC/SPT/" and "/2026-27".
 * Defensively strips a prefix/suffix if the user pasted the full number, so
 * the PDF can never show "SSRC/SPT/SSRC/SPT/123".
 */
export function normalizeQuotationNumber(raw: string): string {
  let v = raw.trim();
  v = v.replace(/^SSRC\s*\/\s*SPT\s*\//i, '');
  v = v.replace(/\/\s*2026\s*-\s*27$/, '');
  return v.replace(/^\/+|\/+$/g, '').trim();
}

export function fullQuotationNumber(raw: string): string {
  return `${QUOTATION_PREFIX}${normalizeQuotationNumber(raw)}${QUOTATION_SUFFIX}`;
}

export function pdfFileName(quotationNumber: string, isoDate: string): string {
  const num = normalizeQuotationNumber(quotationNumber).replace(/[^A-Za-z0-9_-]+/g, '-');
  return `SSRC-SPT-${num}-${isoDate}.pdf`;
}

export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
