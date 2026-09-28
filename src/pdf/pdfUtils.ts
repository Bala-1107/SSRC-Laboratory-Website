import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
  type PDFFont,
} from 'pdf-lib';

/* ───────────────────────────── Text fitting ───────────────────────────── */

/** Largest font size ≤ `size` (and ≥ `minSize`) at which `text` fits `maxWidth`. */
export function fitFontSize(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
  minSize: number,
): number {
  const width = font.widthOfTextAtSize(text, size);
  if (width <= maxWidth || width === 0) return size;
  const fitted = (size * maxWidth) / width;
  return Math.max(minSize, Math.floor(fitted * 100) / 100);
}

/* ─────────────────────── Content-stream run shifting ──────────────────── */

export interface RunShift {
  /** Baseline (Tm y) of the runs to move. */
  baselineY: number;
  /** Runs with Tm x in [fromX, toX) are moved by dx. */
  fromX: number;
  toX: number;
  dx: number;
}

const Y_TOLERANCE = 0.05;
// A text-matrix operator with no rotation/scale: "1 0 0 1 x y Tm".
const TM_REGEX = /(^|[\s\]>)])1 0 0 1 (-?\d*\.?\d+) (-?\d*\.?\d+) Tm/g;

/** Byte-safe (latin-1) conversions so binary content survives round-tripping. */
function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}
function latin1ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Count the template runs that a shift would move (without changing anything). */
export function countRuns(content: string, s: Omit<RunShift, 'dx'>): number {
  let count = 0;
  for (const m of content.matchAll(TM_REGEX)) {
    const x = Number(m[2]);
    const y = Number(m[3]);
    if (Math.abs(y - s.baselineY) < Y_TOLERANCE && x >= s.fromX && x < s.toX) count++;
  }
  return count;
}

/**
 * Reads the page's content stream(s) as text. Returns null if any stream is
 * not a plain raw stream (i.e. the template is not what we expect), in which
 * case callers fall back to shrinking values to fit the original blanks.
 */
export function readPageContent(doc: PDFDocument, page: PDFPage): { text: string; refs: PDFRef[] } | null {
  const contents = page.node.get(PDFName.of('Contents'));
  const refs: PDFRef[] = [];
  if (contents instanceof PDFRef) refs.push(contents);
  else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      const r = contents.get(i);
      if (!(r instanceof PDFRef)) return null;
      refs.push(r);
    }
  } else return null;

  const parts: string[] = [];
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) return null;
    parts.push(bytesToLatin1(decodePDFRawStream(stream).decode()));
  }
  return { text: parts.join('\n'), refs };
}

/**
 * Moves existing template text runs horizontally (only their position — the
 * text, fonts and every other operator are untouched) and writes the page
 * content back as a single compressed stream. Must be called BEFORE any
 * pdf-lib drawing on the page.
 */
export function shiftTemplateRuns(doc: PDFDocument, page: PDFPage, shifts: RunShift[]): void {
  const active = shifts.filter((s) => Math.abs(s.dx) > 0.001);
  if (active.length === 0) return;
  const content = readPageContent(doc, page);
  if (!content) return;

  const updated = content.text.replace(TM_REGEX, (whole, lead: string, xs: string, ys: string) => {
    const x = Number(xs);
    const y = Number(ys);
    for (const s of active) {
      if (Math.abs(y - s.baselineY) < Y_TOLERANCE && x >= s.fromX && x < s.toX) {
        return `${lead}1 0 0 1 ${fmt(x + s.dx)} ${ys} Tm`;
      }
    }
    return whole;
  });

  const newStream = doc.context.flateStream(latin1ToBytes(updated));
  const newRef = doc.context.register(newStream);
  page.node.set(PDFName.of('Contents'), newRef);
  for (const ref of content.refs) doc.context.delete(ref); // drop the replaced originals
}
