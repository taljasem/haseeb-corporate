export default function BankChip({ abbreviation, brandColor, show = true, size = "sm" }) {
  if (!show || !abbreviation) return null;
  const color = brandColor || "var(--accent-primary)";
  const dim = size === "lg" ? 36 : 30;
  return (
    <span
      style={{
        width: dim,
        height: dim,
        borderRadius: 5,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        fontSize: size === "lg" ? 11 : 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {abbreviation}
    </span>
  );
}
