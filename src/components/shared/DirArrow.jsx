import { useLanguage } from "../../i18n/LanguageContext";

/**
 * Returns → in LTR mode, ← in RTL mode.
 * Used for inline text "go forward" arrows in links and buttons.
 */
export default function DirArrow() {
  const { isRTL } = useLanguage();
  return <>{isRTL ? "←" : "→"}</>;
}
