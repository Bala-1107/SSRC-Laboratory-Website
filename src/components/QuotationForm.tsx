import type { FieldPath, QuotationForm as FormState, QuotationTotals, ValidationErrors } from '../types/quotation';
import { formatIndian, QUOTATION_PREFIX, QUOTATION_SUFFIX } from '../utils/formatting';
import { MONEY_PATTERN, QUANTITY_PATTERN, QUOTATION_NUMBER_PATTERN } from '../utils/validation';
import { Field } from './Field';
import { FormSection } from './FormSection';

interface Props {
  form: FormState;
  errors: ValidationErrors;
  totals: QuotationTotals;
  onChange: (path: FieldPath, value: string) => void;
}

/** DOM id for each form path (also used to focus the first invalid field). */
export const fieldId = (path: FieldPath) => `f-${path.replace('.', '-')}`;

const BOQ_ITEMS = [
  {
    key: 'item1' as const,
    no: 1,
    label: 'Mobilization & Site Investigation',
    detail: 'Mobilization of men & machinery, sub-soil exploration and demobilization.',
    unit: 'LS',
  },
  {
    key: 'item2' as const,
    no: 2,
    label: 'Borehole, Sample Collection & Soil Testing',
    detail: '100 mm boreholes up to 10 m / SPT refusal, lab tests (IS 2720), SBC (IS 6403) and report.',
    unit: 'Per Point',
  },
];

const DRILLING = [
  { path: 'drillingAfter10m' as const, label: 'Rate for Drilling After 10m', hint: 'Term 1 · per running metre + 18% GST' },
  { path: 'refusalStrata' as const, label: 'Rate for Drilling in Refusal Strata', hint: 'Term 2 · SPT N > 100, per running metre + 18% GST' },
  { path: 'drillingRock' as const, label: 'Rate for Drilling Rock', hint: 'Term 3 · soft / hard rock, per running metre + 18% GST' },
];

export function QuotationForm({ form, errors, totals, onChange }: Props) {
  const money = { inputMode: 'decimal' as const, filter: MONEY_PATTERN, autoComplete: 'off', placeholder: '0' };
  const qty = { inputMode: 'decimal' as const, filter: QUANTITY_PATTERN, autoComplete: 'off', placeholder: '0' };

  return (
    <form className="form" noValidate onSubmit={(e) => e.preventDefault()} aria-label="Create quotation">
      <FormSection step={1} title="Quotation Details">
        <div className="grid grid--2">
          <Field
            id={fieldId('quotationNumber')}
            label="Quotation Number"
            required
            value={form.quotationNumber}
            onValue={(v) => onChange('quotationNumber', v)}
            filter={QUOTATION_NUMBER_PATTERN}
            inputMode="numeric"
            autoComplete="off"
            placeholder="123"
            prefix={QUOTATION_PREFIX}
            suffix={QUOTATION_SUFFIX}
            hint="Enter only the number — the prefix and year are added automatically."
            error={errors.quotationNumber}
          />
          <Field
            id={fieldId('date')}
            label="Date"
            type="date"
            required
            value={form.date}
            onValue={(v) => onChange('date', v)}
            error={errors.date}
          />
        </div>
      </FormSection>

      <FormSection step={2} title="Client Details" description="Name and Place print under “To,”. Subject Place prints at the end of the subject line.">
        <div className="grid grid--3">
          <Field
            id={fieldId('name')}
            label="Name"
            required
            value={form.name}
            onValue={(v) => onChange('name', v)}
            autoComplete="off"
            placeholder="e.g. Bala"
            maxLength={60}
            error={errors.name}
          />
          <Field
            id={fieldId('place')}
            label="Place"
            required
            value={form.place}
            onValue={(v) => onChange('place', v)}
            autoComplete="off"
            placeholder="e.g. Chennai"
            maxLength={60}
            error={errors.place}
          />
          <Field
            id={fieldId('subjectPlace')}
            label="Subject Place"
            required
            value={form.subjectPlace}
            onValue={(v) => onChange('subjectPlace', v)}
            autoComplete="off"
            placeholder="e.g. Avadi"
            maxLength={60}
            hint="…Residential / Commercial Building in ___"
            error={errors.subjectPlace}
          />
        </div>
      </FormSection>

      <FormSection step={3} title="Bill of Quantities" description="Descriptions are fixed in the quotation. Amount = Quantity × Rate.">
        <div className="boq">
          {BOQ_ITEMS.map((item) => {
            const amount = item.key === 'item1' ? totals.item1Amount : totals.item2Amount;
            return (
              <fieldset key={item.key} className="boq__item">
                <legend className="boq__legend">
                  <span className="boq__no">{item.no}</span>
                  <span>
                    <span className="boq__label">{item.label}</span>
                    <span className="boq__detail">{item.detail}</span>
                  </span>
                  <span className="boq__unit">Unit: {item.unit}</span>
                </legend>
                <div className="grid grid--boq">
                  <Field
                    id={fieldId(`${item.key}.quantity`)}
                    label="Quantity"
                    required
                    value={form[item.key].quantity}
                    onValue={(v) => onChange(`${item.key}.quantity`, v)}
                    error={errors[`${item.key}.quantity`]}
                    {...qty}
                  />
                  <Field
                    id={fieldId(`${item.key}.rate`)}
                    label="Rate"
                    required
                    prefix="₹"
                    value={form[item.key].rate}
                    onValue={(v) => onChange(`${item.key}.rate`, v)}
                    error={errors[`${item.key}.rate`]}
                    {...money}
                  />
                  <Field
                    id={`f-${item.key}-amount`}
                    label="Amount"
                    readOnly
                    prefix="₹"
                    value={formatIndian(amount)}
                    aria-live="polite"
                  />
                </div>
              </fieldset>
            );
          })}
        </div>
      </FormSection>

      <FormSection step={4} title="Additional Drilling Rates" description="Printed in Terms & Conditions right after the existing ₹, before “+ 18% GST”.">
        <div className="grid grid--drill">
          {DRILLING.map((d) => (
            <Field
              key={d.path}
              id={fieldId(d.path)}
              label={d.label}
              required
              prefix="₹"
              value={form[d.path]}
              onValue={(v) => onChange(d.path, v)}
              hint={d.hint}
              error={errors[d.path]}
              {...money}
            />
          ))}
        </div>
      </FormSection>
    </form>
  );
}
