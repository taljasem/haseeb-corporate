/**
 * ProtectedRoute — conditional auth gate for the dashboard shell.
 *
 * The task spec was originally written for a react-router layout, but
 * the Corporate dashboard does NOT use react-router (see the Wave 2
 * inventory §"Architectural snapshot" point 1). Adding react-router
 * would be a significant architectural change outside Wave 2 scope.
 *
 * This component implements the same protection semantics without a
 * router: it renders the login screen when unauthenticated, a loading
 * spinner while bootstrap is in progress, and the authenticated
 * children otherwise. From the user's perspective this is identical
 * to a react-router `<Navigate to="/login" replace />` redirect, and
 * from the developer's perspective the API matches the spec.
 */
import { Suspense, lazy } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './shared/Spinner';

const LoginScreen = lazy(() => import('../screens/auth/LoginScreen'));

function LoadingShell() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--bg-base)',
        color: 'var(--text-secondary)',
        fontFamily: 'inherit',
      }}
    >
      <Spinner size={22} />
      <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Loading…
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingShell />;

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingShell />}>
        <LoginScreen />
      </Suspense>
    );
  }

  return children;
}
