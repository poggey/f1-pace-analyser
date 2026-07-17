"use client";

import { useEffect, useRef, useState } from "react";

/** Track the rendered size of an element so SVG charts can be responsive. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries)
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
