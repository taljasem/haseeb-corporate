// HASEEB-211 — BankMandateAdminScreen screenshot harness (dev-only).
// Not part of the production build surface.
//
// Renders the screen standalone with ThemeProvider + LanguageProvider +
// AuthProvider context so styles + i18n + role-aware behaviour match
// the real app. Query params drive role / language / theme / which view
// to land on (list vs. detail vs. composer) and which modal to pre-open
// so each screenshot is a single page load.

import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
// Pulls in tokens.css + themes.css + rtl.css + a11y.css + tailwind so
// the screen renders against the real design-system variables. Without
// this, `var(--bg-base)` / `var(--text-primary)` resolve to browser
// defaults and every screenshot looks light regardless of the
// `data-theme` attr.
import '../src/index.css';
import BankMandateAdminScreen from '../src/screens/owner/BankMandateAdminScreen';
import i18n from '../src/i18n';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';

const params = new URLSearchParams(window.location.search);
const role = params.get('role') || 'Owner';
const lang = params.get('lang') || 'en';
const theme = params.get('theme') || 'dark';
const view = params.get('view') || 'list';
const mandateId = params.get('mandate') || null;
const modal = params.get('modal') || null;
const composerStep = Number(params.get('composer_step') || 1);

// Prime localStorage BEFORE ThemeProvider reads its initial state, so
// it picks up the URL-requested theme rather than a stale value from a
// previous capture run. ThemeProvider reads the `data-theme` attr first
// anyway (see ThemeContext.jsx readInitialTheme), but we wipe storage
// for safety — it's the only other source that can flip us post-paint.
try { localStorage.setItem('haseeb-corporate-theme', theme); } catch { /* ignore */ }

i18n.changeLanguage(lang);
document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', lang);
document.documentElement.setAttribute('data-theme', theme);

function Harness() {
  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-theme', theme);
    // Drive the screen into the requested view post-mount via synthetic
    // clicks. The screen is self-contained and doesn't expose an
    // imperative API, so this simulates the operator's interaction.
    const timer = setTimeout(() => {
      if (view === 'detail' && mandateId) {
        const row = document.querySelector(`[data-testid="mandate-row-${mandateId}"]`);
        if (row) row.click();
      } else if (view === 'composer') {
        const btn = document.querySelector('[data-testid="bank-mandate-new-action"]')
          || document.querySelector('button[aria-label*="bank mandate" i]');
        if (btn && !btn.disabled) btn.click();
      }
    }, 260);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!modal) return undefined;
    const tries = [];
    const fire = () => {
      const testId = `detail-action-${modal}`;
      const btn = document.querySelector(`[data-testid="${testId}"]`);
      if (btn && !btn.disabled) btn.click();
    };
    // Retry a few times because the detail load is async.
    for (let i = 0; i < 6; i++) {
      tries.push(setTimeout(fire, 500 + i * 240));
    }
    return () => tries.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    // Advance the composer by clicking Next (composerStep - 1) times.
    if (view !== 'composer' || composerStep <= 1) return undefined;
    const tries = [];
    for (let i = 1; i < composerStep; i++) {
      tries.push(
        setTimeout(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const next = buttons.find((b) => /^next$/i.test(b.textContent?.trim() || ''));
          if (next) next.click();
        }, 500 + i * 260),
      );
    }
    return () => tries.forEach(clearTimeout);
  }, []);

  return (
    <LanguageProvider>
      <ThemeProvider>
        <div
          style={{
            display: 'flex',
            width: '100vw',
            minHeight: '100vh',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ flex: 1, display: 'flex', minHeight: '100vh' }}>
            <BankMandateAdminScreen role={role} />
          </div>
        </div>
      </ThemeProvider>
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
