/**
 * Generates the acceptance-test quotation with the SAME code the web app uses
 * (src/pdf/generateQuotationPdf.ts) and writes it to sample-output/.
 *   npm run sample
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { generateQuotationPdf } from '../src/pdf/generateQuotationPdf.ts';
import { validateQuotation } from '../src/utils/validation.ts';
import { calculateTotals } from '../src/utils/calculations.ts';

const { data, errors } = validateQuotation({
  quotationNumber: '123',
  date: '2026-09-28',
  name: 'Bala',
  place: 'Chennai',
  subjectPlace: 'Avadi',
  item1: { quantity: '5', rate: '3000' },
  item2: { quantity: '5', rate: '5000' },
  drillingAfter10m: '180',
  refusalStrata: '200',
  drillingRock: '500',
});
if (!data) throw new Error('Sample failed validation: ' + JSON.stringify(errors));

const t = calculateTotals(data.item1, data.item2);
const expect = { item1Amount: 15000, item2Amount: 25000, totalAmount: 40000, gst: 7200, grandTotal: 47200 };
for (const [k, v] of Object.entries(expect)) {
  const got = t[k as keyof typeof t];
  if (got !== v) throw new Error(`${k}: expected ${v}, got ${got}`);
}
console.log('Calculations OK', t);

const template = await readFile(new URL('../public/quotation-template.pdf', import.meta.url));
const out = await generateQuotationPdf(data, template);
await mkdir(new URL('../sample-output/', import.meta.url), { recursive: true });
await writeFile(new URL(`../sample-output/${out.fileName}`, import.meta.url), out.bytes);
console.log(`Wrote sample-output/${out.fileName} (${out.bytes.length} bytes)`);
