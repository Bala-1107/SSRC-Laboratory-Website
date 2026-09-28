/**
 * Raw form state. Numeric inputs are kept as strings while the user types so
 * that an empty field can be told apart from a real 0 (needed for "required"
 * validation). They are parsed into `QuotationData` before calculation.
 */
export interface BoqItemInput {
  quantity: string;
  rate: string;
}

export interface QuotationForm {
  quotationNumber: string;
  /** ISO yyyy-mm-dd, as produced by <input type="date"> */
  date: string;
  name: string;
  place: string;
  subjectPlace: string;

  item1: BoqItemInput;
  item2: BoqItemInput;

  drillingAfter10m: string;
  refusalStrata: string;
  drillingRock: string;
}

/** Parsed, validated quotation input (the data model from the spec). */
export interface QuotationData {
  quotationNumber: string;
  date: string;
  name: string;
  place: string;
  subjectPlace: string;

  item1: { quantity: number; rate: number };
  item2: { quantity: number; rate: number };

  drillingAfter10m: number;
  refusalStrata: number;
  drillingRock: number;
}

/** Values derived from the input — never entered manually. */
export interface QuotationTotals {
  item1Amount: number;
  item2Amount: number;
  totalAmount: number;
  gst: number;
  grandTotal: number;
}

export type FieldPath =
  | 'quotationNumber'
  | 'date'
  | 'name'
  | 'place'
  | 'subjectPlace'
  | 'item1.quantity'
  | 'item1.rate'
  | 'item2.quantity'
  | 'item2.rate'
  | 'drillingAfter10m'
  | 'refusalStrata'
  | 'drillingRock';

export type ValidationErrors = Partial<Record<FieldPath, string>>;

export const EMPTY_FORM: QuotationForm = {
  quotationNumber: '',
  date: '',
  name: '',
  place: '',
  subjectPlace: '',
  item1: { quantity: '', rate: '' },
  item2: { quantity: '', rate: '' },
  drillingAfter10m: '',
  refusalStrata: '',
  drillingRock: '',
};
