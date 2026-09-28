import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'prefix' | 'accept'> {
  id: string;
  label: string;
  value: string;
  onValue?: (value: string) => void;
  /** Keystroke filter — edits that don't match are ignored. */
  filter?: RegExp;
  error?: string;
  hint?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Field({ id, label, value, onValue, error, hint, prefix, suffix, readOnly, filter, className, ...rest }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${error ? 'field--error' : ''} ${readOnly ? 'field--readonly' : ''} ${className ?? ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
        {rest.required && !readOnly && <span className="field__req" aria-hidden="true"> *</span>}
      </label>
      <div className="field__control">
        {prefix && <span className="field__affix field__affix--prefix">{prefix}</span>}
        <input
          id={id}
          name={id}
          className="field__input"
          value={value}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const v = e.target.value;
            if (filter && !filter.test(v)) return;
            onValue?.(v);
          }}
          {...rest}
        />
        {suffix && <span className="field__affix field__affix--suffix">{suffix}</span>}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field__error">{error}</p>}
    </div>
  );
}
