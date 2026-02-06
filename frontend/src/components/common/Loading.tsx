/** Loading spinner for async operations. */
interface Props {
  label?: string;
}

export function Loading({ label }: Props) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div
        className="loading-spinner"
        role="status"
        aria-label={label ?? 'Loading'}
      />
      {label && (
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{label}</span>
      )}
    </div>
  );
}
