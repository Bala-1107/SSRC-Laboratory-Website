import type { QuotationTotals } from '../types/quotation';
import { GST_PERCENT } from '../utils/calculations';
import { formatRupees } from '../utils/formatting';

interface Props {
  totals: QuotationTotals;
}

export function CalculationSummary({ totals }: Props) {
  const rows: Array<[string, number]> = [
    ['Item 1 · Mobilization', totals.item1Amount],
    ['Item 2 · Boreholes & testing', totals.item2Amount],
  ];
  return (
    <section className="card summary" aria-labelledby="summary-title">
      <header className="card__header">
        <div>
          <h2 id="summary-title" className="card__title">Automatic Calculation</h2>
          <p className="card__desc">Updates as you type.</p>
        </div>
      </header>
      <dl className="summary__list" aria-live="polite">
        {rows.map(([label, v]) => (
          <div className="summary__row" key={label}>
            <dt>{label}</dt>
            <dd>{formatRupees(v)}</dd>
          </div>
        ))}
        <div className="summary__row summary__row--sub">
          <dt>Total Amount</dt>
          <dd>{formatRupees(totals.totalAmount)}</dd>
        </div>
        <div className="summary__row">
          <dt>
            GST <span className="badge" title="GST is fixed at 18%">{GST_PERCENT}% fixed</span>
          </dt>
          <dd>{formatRupees(totals.gst)}</dd>
        </div>
        <div className="summary__row summary__row--grand">
          <dt>Grand Total</dt>
          <dd>{formatRupees(totals.grandTotal)}</dd>
        </div>
      </dl>
    </section>
  );
}
