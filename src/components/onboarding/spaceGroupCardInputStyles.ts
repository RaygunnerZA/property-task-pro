import { cn } from "@/lib/utils";

/** Typography matches NeomorphicInput: Inter Tight 400, 14px, sentence case. */
export const SPACE_GROUP_ADD_INPUT_CLASS = cn(
  "min-w-0 flex-1 rounded-lg bg-[#F6F4F2] px-2.5 py-1.5",
  "font-sans font-normal text-sm normal-case tracking-normal text-foreground",
  "placeholder:normal-case placeholder:text-[#6D7480]/60",
  "outline-none focus:ring-2 focus:ring-[#8EC9CE]/40"
);

export const SPACE_GROUP_ADD_INPUT_SHADOW = {
  boxShadow:
    "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)",
} as const;
