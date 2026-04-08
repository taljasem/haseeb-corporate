export default function AminahTag() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: "var(--role-owner)",
        background: "rgba(139,92,246,0.08)",
        padding: "2px 7px",
        borderRadius: 3,
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "var(--role-owner)",
          animation: "aminahAlive 2.5s ease-in-out infinite",
          display: "inline-block",
        }}
      />
      AMINAH
    </span>
  );
}
