import React, { useEffect, useRef, useState } from "react";

/** Smooth count-up animation. value must be a finite number. */
export default function AnimatedNumber({ value, format = (v) => v.toFixed(0), duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const start = useRef(0);
  const raf = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const from = prev.current;
    start.current = performance.now();
    const tick = (t) => {
      const elapsed = t - start.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = from + (target - from) * eased;
      setDisplay(v);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <span>{format(display)}</span>;
}
