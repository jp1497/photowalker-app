/** Create route page. Form + map, submit to POST /v1/routes, redirect on success. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { RouteForm } from '../components/routes/RouteForm';
import { createRoute } from '../api/routes';
import type { RouteCreatePayload } from '../types/route';

export function CreateRoute() {
  const { isAuthenticated, loading: authLoading } = useAuth();
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

  if (authLoading) {
    return <p style={{ padding: '2rem', textAlign: 'center' }}>Loading...</p>;
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>You must be signed in to create a route.</p>
        <Link to="/login">Sign in</Link>
      </div>
    );
  }

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
