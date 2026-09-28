import type { FieldPath, QuotationData, QuotationForm, ValidationErrors } from '../types/quotation';
import { normalizeQuotationNumber } from './formatting';

/**
 * Keystroke filters for numeric inputs — invalid text can never be typed.
 * Quantity allows up to 3 decimals, money up to 2 (paise).
 */
export const QUANTITY_PATTERN = /^\d{0,7}(\.\d{0,3})?$/;
export const MONEY_PATTERN = /^\d{0,9}(\.\d{0,2})?$/;
export const QUOTATION_NUMBER_PATTERN = /^[A-Za-z0-9-]{0,12}$/;

/**
 * The PDF uses the standard Times fonts (WinAnsi encoding). Characters
 * outside that set (e.g. Tamil script, emoji) cannot be drawn, so they are
 * rejected with a clear message instead of failing during generation.
 */
const PDF_SAFE_TEXT = /^[\x20-\x7E -ÿ‘’“”–—…•€]*$/;

const MAX_TEXT = { name: 60, place: 60, subjectPlace: 60 } as const;

function strictNumber(raw: string): number | null {
  const v = raw.trim();
  if (v === '' || !/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function validateQuotation(form: QuotationForm): {
  errors: ValidationErrors;
  data: QuotationData | null;
} {
  const errors: ValidationErrors = {};
  const set = (f: FieldPath, msg: string) => {
    if (!errors[f]) errors[f] = msg;
  };

  // Quotation number
  const qn = normalizeQuotationNumber(form.quotationNumber);
  if (!qn) set('quotationNumber', 'Enter the quotation number (e.g. 123).');
  else if (!QUOTATION_NUMBER_PATTERN.test(qn)) set('quotationNumber', 'Use letters, digits or "-" only.');

  // Date
  if (!form.date) set('date', 'Select the quotation date.');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || Number.isNaN(Date.parse(form.date)))
    set('date', 'Enter a valid date.');

  // Client text fields
  const textField = (f: 'name' | 'place' | 'subjectPlace', label: string) => {
    const v = form[f].trim();
    if (!v) set(f, `${label} is required.`);
    else if (v.length > MAX_TEXT[f]) set(f, `${label} must be ${MAX_TEXT[f]} characters or fewer.`);
    else if (!PDF_SAFE_TEXT.test(v))
      set(f, `${label} contains characters the quotation font cannot print. Use English letters.`);
  };
  textField('name', 'Name');
  textField('place', 'Place');
  textField('subjectPlace', 'Subject place');

  // Numbers
  const qty = (f: FieldPath, raw: string, label: string) => {
    const n = strictNumber(raw);
    if (raw.trim() === '') set(f, `${label} is required.`);
    else if (n === null) set(f, `${label} must be a number.`);
    else if (n <= 0) set(f, `${label} must be greater than 0.`);
    return n ?? 0;
  };
  const money = (f: FieldPath, raw: string, label: string) => {
    const n = strictNumber(raw);
    if (raw.trim() === '') set(f, `${label} is required.`);
    else if (n === null) set(f, `${label} must be a number.`);
    else if (n < 0) set(f, `${label} cannot be negative.`);
    return n ?? 0;
  };

  const i1q = qty('item1.quantity', form.item1.quantity, 'Quantity');
  const i1r = money('item1.rate', form.item1.rate, 'Rate');
  const i2q = qty('item2.quantity', form.item2.quantity, 'Quantity');
  const i2r = money('item2.rate', form.item2.rate, 'Rate');
  const d10 = money('drillingAfter10m', form.drillingAfter10m, 'Rate');
  const dRef = money('refusalStrata', form.refusalStrata, 'Rate');
  const dRock = money('drillingRock', form.drillingRock, 'Rate');

  if (Object.keys(errors).length > 0) return { errors, data: null };

  return {
    errors,
    data: {
      quotationNumber: qn,
      date: form.date,
      name: form.name.trim(),
      place: form.place.trim(),
      subjectPlace: form.subjectPlace.trim(),
      item1: { quantity: i1q, rate: i1r },
      item2: { quantity: i2q, rate: i2r },
      drillingAfter10m: d10,
      refusalStrata: dRef,
      drillingRock: dRock,
    },
  };
}

/** Display order of fields — used to focus the first invalid input. */
export const FIELD_ORDER: FieldPath[] = [
  'quotationNumber',
  'date',
  'name',
  'place',
  'subjectPlace',
  'item1.quantity',
  'item1.rate',
  'item2.quantity',
  'item2.rate',
  'drillingAfter10m',
  'refusalStrata',
  'drillingRock',
];
