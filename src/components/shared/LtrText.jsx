export default function LtrText({ children, className, style, ...rest }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "embed", ...style }} className={className} {...rest}>
      {children}
    </span>
  );
}
