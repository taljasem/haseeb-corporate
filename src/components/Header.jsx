// DEMO ONLY — production roles come from auth
const ROLES = ["Owner", "CFO", "Junior"];
// Canonical role accent colors (match team member avatar colors)
const ROLE_COLOR = {
  Owner:  "#8B5CF6", // Tarek purple
  CFO:    "#00C48C", // You teal
  Junior: "#3B82F6", // Sara blue
};

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Header({ role, setRole }) {
  return (
    <header
      style={{
        position: "relative",
        zIndex: 10,
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        display: "flex",
        alignItems: "center",
        height: 52,
        padding: "0 24px",
        flexShrink: 0,
        background: "rgba(5,7,10,0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Logo block */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 20,
          borderRight: "1px solid rgba(255,255,255,0.10)",
          height: "100%",
        }}
      >
        <div
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: "#00C48C",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 11, position: "relative", zIndex: 1 }}>
            H
          </span>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, rgba(255,255,255,0.2), transparent 50%)",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 19,
            color: "#E6EDF3",
            letterSpacing: "0.02em",
          }}
        >
          HASEEB.
        </span>
      </div>

      {/* Right cluster */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Role switcher — DEMO ONLY */}
        <div style={{ display: "flex", gap: 4 }}>
          {ROLES.map((r) => {
            const on = role === r;
            const color = ROLE_COLOR[r];
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  padding: "4px 10px",
                  borderRadius: 4,
                  background: on ? `${color}14` : "rgba(255,255,255,0.02)",
                  border: on ? `1px solid ${color}66` : "1px solid rgba(255,255,255,0.08)",
                  color: on ? color : "#5B6570",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* Bell with red dot */}
        <button
          aria-label="Notifications"
          style={{
            position: "relative",
            width: 28, height: 28,
            background: "transparent",
            border: "none",
            color: "#5B6570",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BellIcon />
          <span
            style={{
              position: "absolute",
              top: 4, right: 4,
              width: 6, height: 6,
              borderRadius: "50%",
              background: "#FF5A5F",
            }}
          />
        </button>

        {/* Theme toggle */}
        <button
          aria-label="Theme"
          style={{
            width: 28, height: 28,
            background: "transparent",
            border: "none",
            color: "#5B6570",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MoonIcon />
        </button>

        {/* Language toggle */}
        <button
          style={{
            fontFamily: "'Noto Sans Arabic', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#5B6570",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          عربي
        </button>

        {/* Avatar */}
        <div
          style={{
            width: 26, height: 26,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5B6570",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          T
        </div>
      </div>
    </header>
  );
}
