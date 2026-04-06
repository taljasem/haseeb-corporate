import AminahTag from "./AminahTag";

export default function SectionHeader({ label, aminah = false, extra = null }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <div className="section-label">
        {label}
        {extra}
      </div>
      {aminah && <AminahTag />}
    </div>
  );
}
