export default function Avatar({ person, size = 28 }) {
  if (!person) return null;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${person.avatarColor}22`,
        border: `1px solid ${person.avatarColor}55`,
        color: person.avatarColor,
        fontSize: size >= 28 ? 11 : 10,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {person.initials}
    </span>
  );
}
