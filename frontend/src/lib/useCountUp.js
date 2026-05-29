import { useEffect, useRef, useState } from "react";

/**
 * useCountUp — animates a numeric value from prev → next over `duration` ms.
 * Returns the current interpolated value. Uses an ease-out cubic curve.
 *
 * Skips the animation if the value hasn't changed or if prefers-reduced-motion.
 */
export function useCountUp(target, { duration = 900, decimals = 0 } = {}) {
  const [val, setVal] = useState(target ?? 0);
  const ref = useRef({ from: target ?? 0, started: 0, raf: 0, target: target ?? 0 });

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = Number.isFinite(target) ? target : 0;
    if (reduce || t === ref.current.target) {
      ref.current.target = t;
      setVal(t);
      return;
    }
    ref.current.from = ref.current.target;
    ref.current.target = t;
    ref.current.started = performance.now();

    const tick = (now) => {
      const k = Math.min(1, (now - ref.current.started) / duration);
      const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic
      const v = ref.current.from + (ref.current.target - ref.current.from) * eased;
      setVal(decimals ? Number(v.toFixed(decimals)) : Math.round(v));
      if (k < 1) ref.current.raf = requestAnimationFrame(tick);
    };
    ref.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current.raf);
  }, [target, duration, decimals]);

  return val;
}
