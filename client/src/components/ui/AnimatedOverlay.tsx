import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind classes for the backdrop tint. Defaults to bg-black/60. */
  backdropClassName?: string;
  /** Extra classes for the flex container (e.g. alignment). */
  className?: string;
  /** Whether clicking the backdrop closes the overlay. Defaults to true. */
  dismissOnBackdrop?: boolean;
}

/**
 * Animated modal overlay: fades the backdrop and scales the panel in/out.
 * Wrap your panel markup as the child — clicking the backdrop calls onClose.
 */
export function AnimatedOverlay({
  open,
  onClose,
  children,
  backdropClassName = 'bg-black/60',
  className = 'items-center justify-center p-4',
  dismissOnBackdrop = true,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div
            className={`absolute inset-0 ${backdropClassName}`}
            onMouseDown={dismissOnBackdrop ? onClose : undefined}
          />
          <motion.div
            className="relative z-10 flex w-full justify-center"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
