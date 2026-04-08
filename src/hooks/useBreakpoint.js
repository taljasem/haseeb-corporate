import { useEffect, useState } from "react";

/**
 * Returns { isMobile, isTablet, isDesktop } based on window width.
 * Re-evaluates on resize.
 *   mobile  : < 768
 *   tablet  : 768 – 1023
 *   desktop : >= 1024
 */
const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

function compute(width) {
  return {
    isMobile: width <= MOBILE_MAX,
    isTablet: width > MOBILE_MAX && width <= TABLET_MAX,
    isDesktop: width > TABLET_MAX,
    width,
  };
}

export default function useBreakpoint() {
  const initialWidth = typeof window !== "undefined" ? window.innerWidth : 1440;
  const [state, setState] = useState(() => compute(initialWidth));

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setState(compute(window.innerWidth));
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return state;
}
