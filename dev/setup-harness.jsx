// HASEEB-448 — SetupScreen onboarding-polish screenshot harness.
// Mounts SetupScreen directly with the providers it needs, so the new
// Company section + CoA templates + fiscal-position + invoice-preview
// surfaces can be screenshotted without going through login.
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import SetupScreen from '../src/screens/cfo/SetupScreen';
import i18n from '../src/i18n';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { TenantProvider } from '../src/components/shared/TenantContext';

const params = new URLSearchParams(window.location.search);
const section = params.get('section') || 'company';
const role = params.get('role') || 'CFO';
const lang = params.get('lang') || 'en';

await i18n.changeLanguage(lang);
document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', lang);
document.documentElement.setAttribute('data-theme', 'dark');

function Harness() {
  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);
  const [activated, setActivated] = useState(false);
  // Programmatically click the sidebar tab for the requested section
  // after the first paint.
  useEffect(() => {
    if (activated) return;
    const timer = setTimeout(() => {
      // Sidebar buttons don't expose data-testid. They have a span with
      // the localized section label — we match by lucide icon class as
      // a stable anchor per section.
      const sectionIconClass = {
        company: 'lucide-building-2',
        chart: 'lucide-book-open',
        fiscal: 'lucide-calendar',
      }[section] || 'lucide-building-2';
      const buttons = Array.from(document.querySelectorAll('aside button'));
      const match = buttons.find((b) => b.querySelector(`svg.${sectionIconClass}`));
      if (match) match.click();
      setActivated(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [activated]);
  return (
    <LanguageProvider>
      <ThemeProvider>
        <TenantProvider>
          <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--bg-base)' }}>
            <SetupScreen role={role} />
          </div>
        </TenantProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
