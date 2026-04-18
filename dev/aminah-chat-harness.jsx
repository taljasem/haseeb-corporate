// Wave 6B.3 Layer 3 — AminahChat screenshot harness (dev-only).
// Not part of the production build surface.
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';
import AminahChat from '../src/components/AminahChat';
import i18n from '../src/i18n';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { _resetAdvisorPendingStub } from '../src/engine/aminah/advisor-pending-stub';

const params = new URLSearchParams(window.location.search);
const role = params.get('role') || 'Owner';
const lang = params.get('lang') || 'en';
const empty = params.get('empty') === '1';

// Reset before first paint. AminahChat's mount-effect fetches the list
// AFTER this runs because the reset is synchronous.
_resetAdvisorPendingStub();

// For the empty-state screenshot we intercept AT the stub level BEFORE
// the engine module is imported for the first time. The engine's MOCK
// surface captures the stub functions by reference at init, so
// replacing the stub module's export doesn't help — but we can clear
// the seed list directly since _resetAdvisorPendingStub() is idempotent
// AND the listAdvisorPendingMock closes over the current _items variable.
if (empty) {
  // Mutate the stub's internal list to empty by dismissing each seed.
  // Using the stub's own mutators keeps closures in sync.
  const stub = await import('../src/engine/aminah/advisor-pending-stub');
  stub._resetAdvisorPendingStub();
  const current = await stub.listAdvisorPendingMock();
  for (const item of current) {
    // eslint-disable-next-line no-await-in-loop
    await stub.dismissAdvisorPendingMock(item.id, 'harness-empty');
  }
}

i18n.changeLanguage(lang);
document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', lang);
document.documentElement.setAttribute('data-theme', 'dark');

function Harness() {
  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--bg-base)' }}>
            <AminahChat role={role} />
            <div style={{ flex: 1, padding: 24, color: 'var(--text-tertiary)', fontSize: 11 }}>
              <div style={{ marginBottom: 6 }}>Harness — role: <strong>{role}</strong> · lang: <strong>{lang}</strong> · empty: <strong>{empty ? 'yes' : 'no'}</strong></div>
              <div>The proactive-surface cards render at the top of AminahChat on the left.</div>
            </div>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
