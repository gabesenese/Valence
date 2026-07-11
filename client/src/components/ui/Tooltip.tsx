import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.top - 6, left: r.left + r.width / 2 });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className={className}>
        {children}
      </span>
      {visible && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-surface-400/50 bg-surface-100 p-2.5 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
