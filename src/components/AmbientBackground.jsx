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

      {/* Noise layer */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.08,
        }}
      >
        <svg width="100%" height="100%">
          <rect width="100%" height="100%" filter="url(#n)" opacity="0.5" />
        </svg>
      </div>

      {/* Animated dot grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.12) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
          animation: "dotPulse 6s ease-in-out infinite",
        }}
      />

      {/* Top-left teal glow */}
      <div
        style={{
          position: "fixed",
          top: "-20%",
          left: "-10%",
          width: "50%",
          height: "60%",
          background:
            "radial-gradient(ellipse, rgba(0,196,140,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
          animation: "glowDrift1 10s ease-in-out infinite",
        }}
      />

      {/* Top-right purple glow */}
      <div
        style={{
          position: "fixed",
          top: "10%",
          right: "-10%",
          width: "45%",
          height: "50%",
          background:
            "radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
          animation: "glowDrift2 12s ease-in-out infinite",
        }}
      />

      {/* Inset vignette */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          boxShadow: "inset 0 0 100px 30px rgba(0,0,0,0.25)",
        }}
      />
    </>
  );
}
