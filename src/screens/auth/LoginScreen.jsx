/**
 * LoginScreen — two-step tenant-aware login form.
 *
 * Step 1: tenant slug. "Next" fetches GET /api/auth/tenant-by-slug/:slug
 *         and shows the confirmed tenant name. Error surface for 404.
 * Step 2: email + password. Submit calls authCtx.login(...). On success,
 *         ProtectedRoute re-renders the authenticated shell automatically.
 *
 * Bilingual: strings are inline EN for Wave 2 (the existing i18n namespace
 * layout does not have a login namespace and adding one across both en/
 * and ar/ would balloon the file count). An Arabic-facing dev can still
 * render this page — direction inheritance from <html dir> kicks in via
 * LanguageContext — but the copy is English-only until Wave 3.
 * This is called out explicitly in the smoke test "known limitations".
 *
 * Accessibility:
 *   - All inputs have aria-label and visible <label>.
 *   - Errors are in role="alert" regions with aria-live="polite".
 *   - The submit button is disabled while loading AND has aria-busy.
 *
 * Dev convenience:
 *   If VITE_DEV_PREFILL_CREDENTIALS=true, the three dev values are
 *   pre-populated so smoke testing doesn't require retyping.
 */
import { useEffect, useState } from 'react';
import { Loader2, ArrowRight, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import * as authApi from '../../api/auth';

const DEV_PREFILL = import.meta.env.VITE_DEV_PREFILL_CREDENTIALS === 'true';

const COLORS = {
  bg: 'var(--bg-base)',
  card: 'var(--bg-surface)',
  border: 'var(--border-default)',
  text: 'var(--text-primary)',
  textDim: 'var(--text-secondary)',
  textFaint: 'var(--text-tertiary)',
  accent: 'var(--accent-primary)',
  danger: 'var(--semantic-danger)',
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
};

const btnPrimary = (busy) => ({
  width: '100%',
  padding: '12px 18px',
  background: 'var(--accent-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: busy ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  opacity: busy ? 0.7 : 1,
});

export default function LoginScreen() {
  const { login, sessionExpiredFlash, clearSessionExpiredFlash } = useAuth();

  const [step, setStep] = useState(1);
  const [slug, setSlug] = useState(DEV_PREFILL ? 'dev-tenant' : '');
  const [tenantInfo, setTenantInfo] = useState(null);
  const [email, setEmail] = useState(DEV_PREFILL ? 'dev@haseeb.local' : '');
  const [password, setPassword] = useState(DEV_PREFILL ? 'DevPassword123!' : '');

  const [slugLoading, setSlugLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState(null); // { step, message }

  useEffect(() => {
    // Clear the session-expired flash after the first render where it's shown.
    // The banner stays until the user moves off step 1 or submits successfully.
  }, []);

  const handleSlugNext = async (e) => {
    e?.preventDefault?.();
    setError(null);
    const trimmed = slug.trim();
    if (!trimmed) {
      setError({ step: 1, message: 'Please enter your organization slug.' });
      return;
    }
    setSlugLoading(true);
    try {
      const info = await authApi.getTenantBySlug(trimmed);
      setTenantInfo(info);
      setStep(2);
      clearSessionExpiredFlash();
    } catch (err) {
      if (err?.status === 404) {
        setError({
          step: 1,
          message: `No organization found for "${trimmed}". Check the spelling and try again.`,
        });
      } else if (err?.code === 'NETWORK_ERROR') {
        setError({
          step: 1,
          message: "Can't reach the server. Check your connection and try again.",
        });
      } else {
        setError({
          step: 1,
          message: err?.message || 'Something went wrong. Please try again.',
        });
      }
    } finally {
      setSlugLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e?.preventDefault?.();
    setError(null);
    if (!email.trim() || !password) {
      setError({ step: 2, message: 'Email and password are required.' });
      return;
    }
    setLoginLoading(true);
    const result = await login({ tenantSlug: slug.trim(), email: email.trim(), password });
    setLoginLoading(false);
    if (!result.ok) {
      let message = result.message || 'Login failed.';
      if (result.code === 'UNAUTHORIZED' || result.status === 401) {
        message = 'Invalid email or password.';
      } else if (result.code === 'NETWORK_ERROR') {
        message = "Can't reach the server. Check your connection and try again.";
      } else if (result.status === 429) {
        const retry = result.retryAfter ? ` Please wait ${result.retryAfter} seconds.` : '';
        message = 'Too many login attempts.' + retry;
      }
      setError({ step: 2, message });
    }
    // On success, AuthContext flips isAuthenticated and ProtectedRoute swaps us out.
  };

  const handleBack = () => {
    setStep(1);
    setError(null);
    setTenantInfo(null);
    setPassword('');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.bg,
        padding: 24,
      }}
    >
      <div
        role="main"
        style={{
          width: '100%',
          maxWidth: 420,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          padding: '36px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 34,
              letterSpacing: '0.04em',
              color: COLORS.text,
            }}
          >
            HASEEB.
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: COLORS.textFaint,
              marginTop: 4,
            }}
          >
            Corporate Dashboard
          </div>
        </div>

        {sessionExpiredFlash && (
          <div
            role="alert"
            style={{
              background: 'var(--semantic-warning-subtle, rgba(212,168,75,0.12))',
              border: '1px solid rgba(212,168,75,0.35)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              marginBottom: 16,
              fontSize: 12,
              color: 'var(--semantic-warning, #D4A84B)',
            }}
          >
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>Your session expired. Please sign in again.</div>
          </div>
        )}

        {/* Step 1 — slug */}
        {step === 1 && (
          <form onSubmit={handleSlugNext} aria-label="Organization slug">
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="slug" style={labelStyle}>
                Organization slug
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                autoFocus
                autoComplete="organization"
                aria-invalid={error?.step === 1 ? 'true' : 'false'}
                aria-describedby={error?.step === 1 ? 'slug-error' : undefined}
                placeholder="your-company"
                style={inputStyle}
                disabled={slugLoading}
              />
              <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 6 }}>
                Ask your administrator if you don't know your slug.
              </div>
            </div>

            {error?.step === 1 && (
              <div
                id="slug-error"
                role="alert"
                aria-live="polite"
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  background: 'rgba(253,54,28,0.08)',
                  border: '1px solid rgba(253,54,28,0.3)',
                  color: COLORS.danger,
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <div>{error.message}</div>
              </div>
            )}

            <button type="submit" disabled={slugLoading} aria-busy={slugLoading} style={btnPrimary(slugLoading)}>
              {slugLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {slugLoading ? 'Checking…' : 'Next'}
            </button>
          </form>
        )}

        {/* Step 2 — email + password */}
        {step === 2 && (
          <form onSubmit={handleLoginSubmit} aria-label="Sign in">
            <div
              style={{
                background: 'var(--bg-surface-sunken)',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLORS.textFaint }}>
                  Signing in to
                </div>
                <div style={{ fontSize: 14, color: COLORS.text, marginTop: 2 }}>
                  {tenantInfo?.nameEn || tenantInfo?.name || slug}
                </div>
              </div>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: COLORS.accent,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Change
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="email" style={labelStyle}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                required
                aria-invalid={error?.step === 2 ? 'true' : 'false'}
                placeholder="you@company.com"
                style={inputStyle}
                disabled={loginLoading}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="password" style={labelStyle}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                aria-invalid={error?.step === 2 ? 'true' : 'false'}
                aria-describedby={error?.step === 2 ? 'login-error' : undefined}
                style={inputStyle}
                disabled={loginLoading}
              />
            </div>

            {error?.step === 2 && (
              <div
                id="login-error"
                role="alert"
                aria-live="polite"
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  background: 'rgba(253,54,28,0.08)',
                  border: '1px solid rgba(253,54,28,0.3)',
                  color: COLORS.danger,
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <div>{error.message}</div>
              </div>
            )}

            <button type="submit" disabled={loginLoading} aria-busy={loginLoading} style={btnPrimary(loginLoading)}>
              {loginLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <span style={{ fontSize: 11, color: COLORS.textFaint }}>
                Forgot your password?{' '}
                <span style={{ color: COLORS.textDim }}>Contact your administrator.</span>
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
