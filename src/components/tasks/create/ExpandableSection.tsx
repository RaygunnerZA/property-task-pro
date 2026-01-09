import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ExpandableSectionProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * ExpandableSection - Smoothly animates section expansion/collapse
 * Uses slide down/up with fade for smooth transitions
 */
export function ExpandableSection({ isOpen, children, className }: ExpandableSectionProps) {
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

