import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { QuotationData } from '../types/quotation';
import { calculateTotals } from '../utils/calculations';
import {
  formatDisplayDate,
  formatIndian,
  formatPdfAmount,
  formatPdfRate,
  formatQuantity,
  fullQuotationNumber,
  pdfFileName,
} from '../utils/formatting';
import {
  DEFAULT_MIN_SIZE,
  PDF_FIELDS,
  TEMPLATE_PAGE,
  type FontKey,
  type PdfField,
  type PdfFieldKey,
} from './pdfCoordinates';
import { countRuns, fitFontSize, readPageContent, shiftTemplateRuns, type RunShift } from './pdfUtils';

export interface GeneratedQuotation {
  bytes: Uint8Array;
  blob: Blob;
  fileName: string;
}

/* ───────────────────────────── Template loading ───────────────────────── */

let templateCache: Promise<ArrayBuffer> | null = null;

/** Fetches public/quotation-template.pdf once and caches the bytes. */
export function loadTemplateBytes(): Promise<ArrayBuffer> {
  if (!templateCache) {
    const base = import.meta.env?.BASE_URL ?? '/';
    templateCache = fetch(`${base}quotation-template.pdf`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the quotation template (HTTP ${res.status}).`);
        return res.arrayBuffer();
      })
      .catch((err) => {
        templateCache = null; // allow a retry
        throw err;
      });
  }
  return templateCache;
}

/* ───────────────────────────── Value strings ──────────────────────────── */

/** Appends reference-style punctuation unless the user already typed some. */
function withSuffix(text: string, suffix?: string): string {
  if (!suffix) return text;
  return /[.,;:]$/.test(text) ? text : text + suffix;
}

/** The exact strings to overlay — numbers only; the template supplies "Rs." / "₹". */
export function buildPdfValues(data: QuotationData): Record<PdfFieldKey, string> {
  const t = calculateTotals(data.item1, data.item2);
  return {
    quotationNumber: data.quotationNumber,
    date: formatDisplayDate(data.date),
    name: withSuffix(data.name, PDF_FIELDS.name.suffix),
    place: withSuffix(data.place, PDF_FIELDS.place.suffix),
    subjectPlace: withSuffix(data.subjectPlace, PDF_FIELDS.subjectPlace.suffix),
    item1Qty: formatQuantity(data.item1.quantity),
    item1Rate: formatPdfRate(data.item1.rate),
    item1Amount: formatPdfAmount(t.item1Amount),
    item2Qty: formatQuantity(data.item2.quantity),
    item2Rate: formatPdfRate(data.item2.rate),
    item2Amount: formatPdfAmount(t.item2Amount),
    totalAmount: formatPdfAmount(t.totalAmount),
    gst: formatPdfAmount(t.gst),
    grandTotal: formatPdfAmount(t.grandTotal),
    drillingAfter10m: formatIndian(data.drillingAfter10m),
    refusalStrata: formatIndian(data.refusalStrata),
    drillingRock: formatIndian(data.drillingRock),
  };
}

/* ───────────────────────────── Layout planning ────────────────────────── */

interface PlannedText {
  key: PdfFieldKey;
  text: string;
  x: number;
  y: number;
  size: number;
  font: FontKey;
}

function planField(
  key: PdfFieldKey,
  field: PdfField,
  text: string,
  fonts: Record<FontKey, PDFFont>,
  content: string | null,
  shifts: RunShift[],
): PlannedText {
  const font = fonts[field.font];
  const minSize = field.minSize ?? DEFAULT_MIN_SIZE;

  if (field.align === 'center') {
    const boxWidth = field.maxX - (field.minX ?? 2 * field.x - field.maxX);
    const size = fitFontSize(font, text, field.size, boxWidth, minSize);
    const width = font.widthOfTextAtSize(text, size);
    return { key, text, x: field.x - width / 2, y: field.y, size, font: field.font };
  }

  const mr = field.makeRoom;
  const canShift = !!mr && content !== null && countRuns(content, mr) > 0;

  if (mr && canShift) {
    // Room available if following text may move up to maxShift.
    const hardRight = Math.min(field.maxX, mr.tailStartX + mr.maxShift - mr.gap);
    const size = fitFontSize(font, text, field.size, hardRight - field.x, minSize);
    const end = field.x + font.widthOfTextAtSize(text, size);
    let dx = end + mr.gap - mr.tailStartX;
    if (dx < 0 && !mr.allowClose) dx = 0;
    if (Math.abs(dx) > 0.001) {
      shifts.push({ baselineY: mr.baselineY, fromX: mr.fromX, toX: mr.toX, dx });
    }
    return { key, text, x: field.x, y: field.y, size, font: field.font };
  }

  // No run-shifting possible → must fit inside the original blank.
  const right = mr ? Math.min(field.maxX, mr.tailStartX - mr.gap) : field.maxX;
  const size = fitFontSize(font, text, field.size, right - field.x, minSize);
  return { key, text, x: field.x, y: field.y, size, font: field.font };
}

/* ───────────────────────────── Main entry point ───────────────────────── */

/**
 * Builds the filled quotation:
 *   1. load the untouched template   2. take page 1   3. embed Times fonts
 *   4. draw ONLY the dynamic values  5. keep all original content
 *   6. return the PDF bytes / Blob
 */
export async function generateQuotationPdf(
  formData: QuotationData,
  templateBytes?: ArrayBuffer | Uint8Array,
): Promise<GeneratedQuotation> {
  const source = templateBytes ?? (await loadTemplateBytes());
  // pdf-lib may keep references to the buffer — give it its own copy.
  const pdfDoc = await PDFDocument.load(source.slice(0), { updateMetadata: false });
  const page = pdfDoc.getPage(0);

  const { width, height } = page.getSize();
  if (Math.abs(width - TEMPLATE_PAGE.width) > 1 || Math.abs(height - TEMPLATE_PAGE.height) > 1) {
    console.warn(
      `[quotation] Template page is ${width}×${height} pt but coordinates were calibrated for ` +
        `${TEMPLATE_PAGE.width}×${TEMPLATE_PAGE.height} pt. Re-check src/pdf/pdfCoordinates.ts.`,
    );
  }

  // Times Roman is metrically equivalent to the template's Times New Roman.
  const fonts: Record<FontKey, PDFFont> = {
    regular: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
  };

  const values = buildPdfValues(formData);
  const content = readPageContent(pdfDoc, page)?.text ?? null;
  const shifts: RunShift[] = [];

  const plan = (Object.keys(PDF_FIELDS) as PdfFieldKey[]).map((key) =>
    planField(key, PDF_FIELDS[key] as PdfField, values[key], fonts, content, shifts),
  );

  // Make room in narrow blanks first (moves template runs), then draw.
  shiftTemplateRuns(pdfDoc, page, shifts);

  for (const p of plan) {
    if (!p.text) continue;
    page.drawText(p.text, {
      x: p.x,
      y: p.y,
      size: p.size,
      font: fonts[p.font],
      color: rgb(0, 0, 0),
    });
  }

  const quotationNo = fullQuotationNumber(formData.quotationNumber);
  pdfDoc.setTitle(`Quotation ${quotationNo}`);
  pdfDoc.setSubject(`Soil investigation quotation — ${formData.name}, ${formData.place}`);
  pdfDoc.setAuthor('SSRC Laboratory');
  pdfDoc.setCreator('SSRC Quotation Generator');
  pdfDoc.setModificationDate(new Date());

  const bytes = await pdfDoc.save();
  return {
    bytes,
    blob: new Blob([bytes], { type: 'application/pdf' }),
    fileName: pdfFileName(formData.quotationNumber, formData.date),
  };
}
