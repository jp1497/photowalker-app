/** Create route page. Form + map, submit to POST /v1/routes, redirect on success. Protected by ProtectedRoute. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RouteForm } from '../components/routes/RouteForm';
import { createRoute } from '../api/routes';
import type { RouteCreatePayload } from '../types/route';

export function CreateRoute() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (payload: RouteCreatePayload) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const { route } = await createRoute(payload);
      navigate(`/routes/${route.slug}`, { replace: true });
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : null;
      setSubmitError(message ?? 'Failed to create route. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Create a route</h1>
      {submitError && (
        <p style={{ color: '#c00', marginBottom: '1rem' }}>{submitError}</p>
      )}
      <RouteForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
