import type { ReactNode } from 'react';

export default function FigmaState({ title, description, children, actions, error = false }: {
  title: string; description?: string; children?: ReactNode; actions?: ReactNode; error?: boolean;
}) {
  return <div className={'next-state' + (error ? ' exception-state' : '')}>
    <div role={error ? 'alert' : 'status'}><h2>{title}</h2>{description && <p>{description}</p>}{children}</div>
    {actions && <div className="next-state-actions">{actions}</div>}
  </div>;
}
