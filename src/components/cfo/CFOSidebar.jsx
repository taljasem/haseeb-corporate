// Simple inline SVG icon set — 16px stroke icons
const I = (path) => (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {path}
  </svg>
);

const HomeIcon = I(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>);
const CheckIcon = I(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
const BankIcon = I(<><line x1="3" y1="21" x2="21" y2="21" /><polyline points="3 10 12 3 21 10" /><line x1="6" y1="21" x2="6" y2="10" /><line x1="10" y1="21" x2="10" y2="10" /><line x1="14" y1="21" x2="14" y2="10" /><line x1="18" y1="21" x2="18" y2="10" /></>);
const ChatIcon = I(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
const PencilIcon = I(<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" /></>);
const RecIcon = I(<><polyline points="20 6 9 17 4 12" /><polyline points="14 11 9 17" /></>);
const DocIcon = I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>);
const ClockIcon = I(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
const ChartIcon = I(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
const CalIcon = I(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>);
const ShieldIcon = I(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
const InboxIcon = I(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>);
const FileText  = I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></>);
const GearIcon = I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        height: 36,
        padding: "0 16px 0 20px",
        background: active ? "rgba(255,255,255,0.04)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "#E6EDF3" : "#5B6570",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textAlign: "left",
        boxShadow: active ? "inset 2px 0 0 #00C48C" : "none",
        transition: "all 0.12s ease",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            background: "#FF5A5F",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'DM Mono', monospace",
            padding: "2px 6px",
            borderRadius: 8,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function GroupLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "#5B6570",
        padding: "16px 20px 8px",
      }}
    >
      {children}
    </div>
  );
}

export default function CFOSidebar({ active, setActive, pendingApprovals = 0, taskboxOpen = 0 }) {
  const isActive = (k) => active === k;
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "rgba(255,255,255,0.02)",
        borderRight: "1px solid rgba(255,255,255,0.10)",
        padding: "20px 0",
        overflowY: "auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <NavItem icon={HomeIcon}  label="Today"     active={isActive("today")}     onClick={() => setActive("today")} />
      <NavItem icon={CheckIcon} label="Approvals" active={isActive("approvals")} onClick={() => setActive("approvals")} badge={pendingApprovals > 0 ? pendingApprovals : null} />
      <NavItem icon={InboxIcon} label="Taskbox"   active={isActive("taskbox")}   onClick={() => setActive("taskbox")}   badge={taskboxOpen > 0 ? taskboxOpen : null} />

      <GroupLabel>BOOKKEEPING</GroupLabel>
      <NavItem icon={BankIcon}    label="Bank Transactions"   active={isActive("bank-transactions")}   onClick={() => setActive("bank-transactions")} />
      <NavItem icon={ChatIcon}    label="Conversational JE"   active={isActive("conversational-je")}   onClick={() => setActive("conversational-je")} />
      <NavItem icon={PencilIcon}  label="Manual JE"           active={isActive("manual-je")}           onClick={() => setActive("manual-je")} />
      <NavItem icon={FileText}    label="Rules"               active={isActive("rules")}               onClick={() => setActive("rules")} />
      <NavItem icon={RecIcon}     label="Reconciliation"      active={isActive("reconciliation")}      onClick={() => setActive("reconciliation")} />

      <GroupLabel>REPORTING</GroupLabel>
      <NavItem icon={DocIcon}   label="Financial Statements" active={isActive("financial-statements")} onClick={() => setActive("financial-statements")} />
      <NavItem icon={ClockIcon} label="Aging Reports"        active={isActive("aging-reports")}        onClick={() => setActive("aging-reports")} />
      <NavItem icon={ChartIcon} label="Variance Analysis"    active={isActive("variance-analysis")}    onClick={() => setActive("variance-analysis")} />

      <GroupLabel>OPERATIONS</GroupLabel>
      <NavItem icon={CalIcon}    label="Month-End Close" active={isActive("month-end-close")} onClick={() => setActive("month-end-close")} />
      <NavItem icon={ShieldIcon} label="Audit Bridge"    active={isActive("audit-bridge")}    onClick={() => setActive("audit-bridge")} />
      <NavItem icon={GearIcon}   label="Setup"           active={isActive("setup")}           onClick={() => setActive("setup")} />
    </aside>
  );
}
