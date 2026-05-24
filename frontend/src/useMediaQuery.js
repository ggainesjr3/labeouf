import { useState, useEffect } from "react";

/** Mobile: viewport width < 768px */
export const MOBILE_MQ = "(max-width: 767px)";
/** Tablet: viewport width <= 1024px (includes mobile) */
export const TABLET_MQ = "(max-width: 1024px)";

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
