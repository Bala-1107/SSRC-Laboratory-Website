import type { ReactNode } from 'react';

interface Props {
  step?: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSection({ step, title, description, children, className }: Props) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section className={`card ${className ?? ''}`} aria-labelledby={id}>
      <header className="card__header">
        {step !== undefined && <span className="card__step" aria-hidden="true">{step}</span>}
        <div>
          <h2 id={id} className="card__title">{title}</h2>
          {description && <p className="card__desc">{description}</p>}
        </div>
      </header>
      <div className="card__body">{children}</div>
    </section>
  );
}
