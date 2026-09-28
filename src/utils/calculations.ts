import type { QuotationTotals } from '../types/quotation';

/** GST is fixed by business rule — not user editable. */
export const GST_PERCENT = 18;

/**
 * All money maths is done in integer paise to avoid floating-point drift
 * (e.g. 0.1 + 0.2), then converted back to rupees.
 */
const toPaise = (rupees: number) => Math.round(rupees * 100);
const toRupees = (paise: number) => paise / 100;

export function lineAmount(quantity: number, rate: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(rate)) return 0;
  return toRupees(Math.round(quantity * toPaise(rate)));
}

export function calculateTotals(
  item1: { quantity: number; rate: number },
  item2: { quantity: number; rate: number },
): QuotationTotals {
  const a1 = toPaise(lineAmount(item1.quantity, item1.rate));
  const a2 = toPaise(lineAmount(item2.quantity, item2.rate));
  const total = a1 + a2;
  const gst = Math.round((total * GST_PERCENT) / 100);
  return {
    item1Amount: toRupees(a1),
    item2Amount: toRupees(a2),
    totalAmount: toRupees(total),
    gst: toRupees(gst),
    grandTotal: toRupees(total + gst),
  };
}

/** Lenient parse used for live calculation while the user is still typing. */
export function parseNumberOrZero(value: string): number {
  if (value.trim() === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
