import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function NumberTicker({
  value, prefix = '', suffix = '', decimals = 0, duration = 1.1, className,
}: Props) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<number>(value);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const from = prevRef.current;
    prevRef.current = value;
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        const formatted = decimals > 0
          ? v.toFixed(decimals)
          : Math.round(v).toLocaleString();
        node.textContent = `${prefix}${formatted}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [value, prefix, suffix, decimals, duration]);

  const initial = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
  return (
    <span ref={nodeRef} className={className}>
      {prefix}{initial}{suffix}
    </span>
  );
}
