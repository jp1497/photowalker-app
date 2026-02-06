/** Button component. */
import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      disabled={disabled ?? loading}
      {...props}
      style={{
        padding: '0.5rem 1rem',
        border: variant === 'primary' ? 'none' : '1px solid #ccc',
        borderRadius: 4,
        background: variant === 'primary' ? '#333' : '#fff',
        color: variant === 'primary' ? '#fff' : '#333',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'Saving...' : children}
    </button>
  );
}
