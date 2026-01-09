import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AISuggestionChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * AI Suggestion Chip - Distinct style for AI-generated suggestions
 * - Neumorphic style with normal paper background
 * - 2px white dotted border with 2px gap between dots
 * - Light teal text (text-primary) matching "TAP TO APPLY FILLA..."
 * - Hover: pressed neumorphic + brighter bg + darker text
 * - Selected: standard active chip style
 * - Smooth animation on appearance
 */
export function AISuggestionChip({ 
  label, 
  selected = false,
  onClick,
  className 
}: AISuggestionChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: -10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center px-3 py-1.5 h-[35px]",
        "font-mono text-[13px] uppercase tracking-wide",
        "relative transition-all duration-150 cursor-pointer select-none",
        "rounded-tr-[5px] rounded-br-[5px] rounded-tl-none rounded-bl-none",
        // Remove individual borders and hover - handled by parent group
        // Always transparent background to avoid double fill
        "bg-transparent",
        selected
          ? "text-foreground"
          : "text-primary group-hover:text-foreground",
        className
      )}
      onClick={onClick}
    >
      <span className="truncate max-w-[120px] relative z-10">{label}</span>
    </motion.div>
  );
}

