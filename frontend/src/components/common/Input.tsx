/** Input component. */
import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: error ? '1px solid #c00' : '1px solid #ccc',
          borderRadius: 4,
        }}
      />
      {error && <span style={{ fontSize: '0.875rem', color: '#c00', marginTop: '0.25rem', display: 'block' }}>{error}</span>}
    </div>
  );
}
