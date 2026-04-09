/**
 * Skeleton placeholder block. Use for loading states.
 * Props: width, height, borderRadius (default 4)
 */
export default function Skeleton({ width = "100%", height = 16, borderRadius = 4, style }) {
  return (
    <div
      aria-hidden="true"
      className="haseeb-skeleton"
      style={{
        width,
        height,
        borderRadius,
        background: "var(--bg-surface-sunken)",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
