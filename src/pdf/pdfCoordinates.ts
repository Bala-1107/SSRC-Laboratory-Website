/**
 * ════════════════════════════════════════════════════════════════════════
 *  CENTRAL PDF COORDINATE MAP — the ONLY place PDF positions are defined.
 * ════════════════════════════════════════════════════════════════════════
 *
 * Units: PDF points (1 pt = 1/72 inch). Origin: BOTTOM-LEFT of the page,
 * exactly as in the PDF itself (pdf-lib uses the same system, so no
 * screen/pixel conversion is involved and output is identical on every
 * device). `y` is always the text BASELINE.
 *
 * How these numbers were obtained
 * -------------------------------
 * Every anchor was read from the template's own content stream (the text
 * matrix `1 0 0 1 x y Tm` of each run Word wrote), not estimated from an
 * image. Offsets and styling were then taken from the completed reference
 * quotation (Q119 Arakkonam):
 *   • Name/Place indent 19.2 pt right of "To," (x 91.22), line pitch 15.24 pt
 *   • Date value 3.32 pt after "Date:"            (ref: 457.58 → 460.90)
 *   • Values follow "Rs." after one space (2.76 pt at 11.04 pt Times)
 *   • Body values: Times 11.04 pt regular; the reference prints the
 *     totals and the term-1 rate in bold.
 * NOTE: the reference was produced from an older layout (everything ~13 pt
 * lower, different terms), so its ABSOLUTE coordinates are not reusable —
 * only its relative placement/style. The anchors below are the template's.
 *
 * Calibration: if the template PDF is ever replaced, re-measure the anchor
 * comments below (e.g. `pdftotext -bbox` or `npm run sample` + visual check)
 * and update x / y here. Nothing else in the app needs to change.
 */

/** Page size of public/quotation-template.pdf (A4, as saved by Word). */
export const TEMPLATE_PAGE = { width: 595.56, height: 842.04 } as const;

/** Template body font size (Times New Roman 11.04 pt). */
export const BODY = 11.04;
/** Width of one space at 11.04 pt Times (0.25 em). */
export const SPACE = 2.76;

export type FontKey = 'regular' | 'bold';

/**
 * "Make room" — some blanks in the template are narrower than the values
 * that go in them (e.g. the ₹ blank in Terms 1 is only 13.8 pt wide; "180"
 * needs 16.6 pt + spacing). Word writes each text run with its own absolute
 * position, so the runs that FOLLOW the blank on that single baseline
 * (e.g. "+ 18% GST per") are moved right by exactly the space needed.
 * Their text, font and wording are untouched and remain fully visible.
 * If the runs cannot be found (template changed), the value is shrunk to
 * fit the original blank instead, so nothing is ever overlapped.
 */
export interface MakeRoom {
  /** Baseline (Tm y) of the runs to move. */
  baselineY: number;
  /** Runs whose Tm x is within [fromX, toX) are moved. */
  fromX: number;
  toX: number;
  /** x where the first following run currently starts. */
  tailStartX: number;
  /** Required clear space between the value and the following run. */
  gap: number;
  /** Largest allowed shift (keeps the moved text inside the margin). */
  maxShift: number;
  /** Allow a NEGATIVE shift to close up a blank that is wider than the value. */
  allowClose?: boolean;
}

export interface PdfField {
  /** Left edge (align 'left') or centre (align 'center'), PDF points. */
  x: number;
  /** Baseline, PDF points from the bottom. */
  y: number;
  align: 'left' | 'center';
  font: FontKey;
  size: number;
  /** Text may not extend past this x — the font shrinks to fit if needed. */
  maxX: number;
  /** For centred fields: left edge of the box (maxX is the right edge). */
  minX?: number;
  /** Smallest font size allowed when shrinking to fit. */
  minSize?: number;
  /** Punctuation appended as in the reference ("Mr. Naveen Kumar,"). */
  suffix?: string;
  makeRoom?: MakeRoom;
  /** Human note: which template anchor this is measured from. */
  anchor: string;
}

// Table geometry measured from the template's ruling lines.
const COL_QTY = { left: 348.2, right: 383.6 };
const COL_RATE_RIGHT = 475.8;
const COL_AMOUNT_RIGHT = 546.7;
const CELL_PAD = 1.2;

/** Line pitch below "To," taken from the reference (136.08 → 151.32 → 166.56). */
const ADDRESS_PITCH = 15.24;
const TO_BASELINE = 710.62;

export const PDF_FIELDS = {
  quotationNumber: {
    x: 198.41, y: 740.98, align: 'left', font: 'regular', size: BODY, maxX: 340,
    anchor: '"SSRC/SPT/" run ends at x 198.41; "/2026-27" run starts at 217.61 (baseline 740.98)',
    // Reference prints it as one unbroken string: SSRC/SPT/Q0119/2026-27.
    // The template blank is 19.2 pt; "/2026-27" is moved so it sits directly
    // after the number (moves left for short numbers, right for long ones).
    makeRoom: { baselineY: 740.98, fromX: 210, toX: 300, tailStartX: 217.61, gap: 0, maxShift: 120, allowClose: true },
  },
  date: {
    x: 460.9, y: 740.98, align: 'left', font: 'regular', size: BODY, maxX: 546,
    anchor: '"Date:" ends at 457.58; reference date starts at 460.90',
  },
  name: {
    x: 91.22, y: TO_BASELINE - ADDRESS_PITCH, align: 'left', font: 'regular', size: BODY, maxX: 520,
    suffix: ',',
    anchor: '"To," baseline 710.62; reference name indented to x 91.22, one line (15.24 pt) below',
  },
  place: {
    x: 91.22, y: TO_BASELINE - 2 * ADDRESS_PITCH, align: 'left', font: 'regular', size: BODY, maxX: 520,
    suffix: '.',
    anchor: 'one more line (15.24 pt) below the name, same indent',
  },
  subjectPlace: {
    x: 237.89, y: 630.82, align: 'left', font: 'regular', size: BODY, maxX: 524,
    suffix: '.',
    anchor: '"...Building in" — "in" ends at 235.37 (baseline 630.82); reference place starts at 237.89',
  },

  // ── Bill of Quantities ───────────────────────────────────────────────
  item1Qty: {
    x: (COL_QTY.left + COL_QTY.right) / 2, y: 567.67, align: 'center', font: 'regular', size: BODY,
    minX: COL_QTY.left + CELL_PAD, maxX: COL_QTY.right - CELL_PAD,
    anchor: 'QTY column 348.2–383.6, centred; baseline of Sl.No "1" / "LS" = 567.67',
  },
  item1Rate: {
    x: 441.22 + SPACE, y: 567.79, align: 'left', font: 'regular', size: BODY, maxX: COL_RATE_RIGHT - CELL_PAD,
    anchor: 'template "Rs." at 426.70 ends 441.22 (baseline 567.79); value after one space',
  },
  item1Amount: {
    x: 501.94 + SPACE, y: 567.67, align: 'left', font: 'regular', size: BODY, maxX: COL_AMOUNT_RIGHT - CELL_PAD,
    anchor: 'template "Rs." at 487.42 ends 501.94 (baseline 567.67); value after one space',
  },
  item2Qty: {
    x: (COL_QTY.left + COL_QTY.right) / 2, y: 489.31, align: 'center', font: 'regular', size: BODY,
    minX: COL_QTY.left + CELL_PAD, maxX: COL_QTY.right - CELL_PAD,
    anchor: 'QTY column centred; baseline of Sl.No "2" / "Per" = 489.31',
  },
  item2Rate: {
    x: 443.86 + SPACE, y: 481.87, align: 'left', font: 'regular', size: BODY, maxX: COL_RATE_RIGHT - CELL_PAD,
    anchor: 'template "Rs." at 429.46 ends 443.86 (baseline 481.87); value after one space',
  },
  item2Amount: {
    x: 501.7 + SPACE, y: 485.71, align: 'left', font: 'regular', size: BODY, maxX: COL_AMOUNT_RIGHT - CELL_PAD,
    anchor: 'template "Rs." at 487.30 ends 501.70 (baseline 485.71); value after one space',
  },

  // ── Totals (reference prints these in bold) ───────────────────────────
  totalAmount: {
    x: 504.46 + SPACE, y: 432.91, align: 'left', font: 'bold', size: BODY, maxX: COL_AMOUNT_RIGHT - CELL_PAD,
    anchor: 'template "Rs." at 489.94 ends 504.46 (baseline 432.91)',
  },
  gst: {
    x: 504.46 + SPACE, y: 412.37, align: 'left', font: 'bold', size: BODY, maxX: COL_AMOUNT_RIGHT - CELL_PAD,
    anchor: 'template "Rs." at 489.94 ends 504.46 (baseline 412.37)',
  },
  grandTotal: {
    x: 504.46 + SPACE, y: 391.85, align: 'left', font: 'bold', size: BODY, maxX: COL_AMOUNT_RIGHT - CELL_PAD,
    anchor: 'template "Rs." at 489.94 ends 504.46 (baseline 391.85)',
  },

  // ── Terms & Conditions — values go right after the existing ₹ ──────────
  drillingAfter10m: {
    x: 409.18 + SPACE, y: 342.29, align: 'left', font: 'bold', size: BODY, maxX: 470,
    anchor: 'Term 1: "₹" at 403.63 ends 409.18; bold "+ 18% GST per" starts 422.98 (baseline 342.29)',
    // "GST per " ends at 497.23 → may move up to ~38 pt before reaching 535.
    makeRoom: { baselineY: 342.29, fromX: 420, toX: 600, tailStartX: 422.98, gap: SPACE, maxShift: 38 },
  },
  refusalStrata: {
    x: 167.18 + SPACE, y: 294.89, align: 'left', font: 'bold', size: BODY, maxX: 260,
    anchor: 'Term 2: "₹" at 161.66 ends 167.18; bold "+18% GST per running meter" starts 183.65 (baseline 294.89)',
    makeRoom: { baselineY: 294.89, fromX: 180, toX: 600, tailStartX: 183.65, gap: SPACE, maxShift: 150 },
  },
  drillingRock: {
    x: 463.3 + SPACE, y: 272.69, align: 'left', font: 'regular', size: BODY, maxX: 535,
    anchor: 'Term 3: "₹" at 457.78 ends 463.30 at end of line (baseline 272.69); "+18%GST" wraps to next line',
  },
} satisfies Record<string, PdfField>;

export type PdfFieldKey = keyof typeof PDF_FIELDS;

/** Minimum font size used when a value has to shrink to fit its cell. */
export const DEFAULT_MIN_SIZE = 7;
