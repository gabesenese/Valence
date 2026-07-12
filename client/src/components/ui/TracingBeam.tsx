import { motion } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function TracingBeam({ children, className = '', delay = 0.1 }: Props) {
  return (
    <div className={`relative ${className}`}>
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-px origin-top pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgb(var(--brand-400) / 0.85), transparent 90%)' }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay }}
      />
      {children}
    </div>
  );
}
