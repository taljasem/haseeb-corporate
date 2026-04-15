/**
 * ModeIndicator — tiny dev-only badge showing whether the dashboard
 * is running against the mock engine or a real Corporate API.
 *
 * Visible only in development builds (hidden via import.meta.env.DEV).
 * MOCK mode: orange badge, text "MOCK".
 * LIVE mode: green badge, text "LIVE <host>".
 *
 * No Arabic translation — this is a dev-only affordance, never ships
 * to end users. Still given an aria-label for screen readers.
 */
export default function ModeIndicator() {
  if (!import.meta.env.DEV) return null;

  const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  let host = baseUrl;
  try {
    const u = new URL(baseUrl);
    host = u.host;
  } catch {
    // leave baseUrl as-is
  }

  const isMock = useMocks;
  const label = isMock ? 'MOCK' : `LIVE ${host}`;
  const ariaLabel = isMock
    ? 'Dashboard is using mock data'
    : `Dashboard is using live API at ${host}`;

  const bg = isMock ? 'rgba(212, 168, 75, 0.18)' : 'rgba(0, 166, 132, 0.18)';
  const color = isMock ? '#D4A84B' : '#00A684';
  const border = isMock ? 'rgba(212, 168, 75, 0.45)' : 'rgba(0, 166, 132, 0.45)';

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 4,
        background: bg,
        color,
        border: `1px solid ${border}`,
        fontFamily: "'DM Mono', ui-monospace, monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
