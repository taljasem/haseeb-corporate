export default function TensionDot({ count, severity = "info" }) {
  if (count == null) return null;
  return <span className={`tension-dot tension-dot--${severity}`}>{count}</span>;
}
