import SectionHeader from "../SectionHeader";

export default function SectionCard({ label, extra, aminah = true, children, delay = 0.2 }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: "16px 18px",
        animation: `fadeUp 0.4s ease ${delay}s both`,
      }}
    >
      <SectionHeader label={label} extra={extra} aminah={aminah} />
      {children}
    </div>
  );
}
