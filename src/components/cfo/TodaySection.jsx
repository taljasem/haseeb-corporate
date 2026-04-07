import SectionHeader from "../SectionHeader";

export default function TodaySection({ label, extra, aminah = false, children }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <SectionHeader label={label} extra={extra} aminah={aminah} />
      {children}
    </div>
  );
}
