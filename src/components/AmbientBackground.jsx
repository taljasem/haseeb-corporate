export default function AmbientBackground() {
  return (
    <>
      {/* SVG noise filter def */}
      <svg style={{ display: "none" }} aria-hidden="true">
        <filter id="n">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
      </svg>

      {/* Noise layer — opacity from theme token */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: "var(--ambient-noise-opacity)",
        }}
      >
        <svg width="100%" height="100%">
          <rect width="100%" height="100%" filter="url(#n)" opacity="0.5" />
        </svg>
      </div>

      {/* Animated dot grid — color from theme token via CSS class */}
      <div
        className="ambient-dot-grid"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundSize: "24px 24px",
          animation: "dotPulse 6s ease-in-out infinite",
        }}
      />

      {/* Top-left teal glow — color from theme token via CSS class */}
      <div
        className="ambient-glow-teal"
        style={{
          position: "fixed",
          top: "-20%",
          left: "-10%",
          width: "50%",
          height: "60%",
          pointerEvents: "none",
          zIndex: 0,
          animation: "glowDrift1 10s ease-in-out infinite",
        }}
      />

      {/* Top-right purple glow — color from theme token via CSS class */}
      <div
        className="ambient-glow-purple"
        style={{
          position: "fixed",
          top: "10%",
          right: "-10%",
          width: "45%",
          height: "50%",
          pointerEvents: "none",
          zIndex: 0,
          animation: "glowDrift2 12s ease-in-out infinite",
        }}
      />

      {/* Inset vignette — from theme token */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          boxShadow: "var(--ambient-vignette)",
        }}
      />
    </>
  );
}
