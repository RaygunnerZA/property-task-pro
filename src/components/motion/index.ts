/**
 * Filla Motion System primitives. Spec: @Docs/33_Motion_System.md
 *
 * LIFT    — an object becomes active or relevant          → Lift
 * ALIGN   — information has been connected                → AlignBlock, AlignItem
 * STACK   — knowledge/history is accumulating             → SheetStack, ResolutionLedger
 * UNFOLD  — understanding/detail is being revealed        → Unfold
 * SETTLE  — Filla has reached a decision/state            → Settle, SettleValue
 * SIGNAL  — something requires attention                  → SignalMark
 *
 * Compositions: MotionSequence (ordered understanding), ResolvableList/Item
 * (Inflow resolution), KnowledgeThread (knowledge connection).
 */

export { MotionSequence, useFillaReducedMotion, useSequenceEntrance } from "./MotionSequence";
export { Unfold } from "./Unfold";
export { Settle, SettleValue } from "./Settle";
export { Lift } from "./Lift";
export { AlignBlock, AlignItem } from "./Align";
export { SignalMark, type SignalTone } from "./Signal";
export { SheetStack } from "./SheetStack";
export {
  ResolutionLedgerProvider,
  ResolutionLedger,
  ResolvableList,
  ResolvableItem,
  useResolutionLedger,
} from "./Resolvable";
export { KnowledgeThread } from "./KnowledgeThread";
export { AttentionResolvableList } from "./AttentionResolvableList";
export type { KnowledgeNode, KnowledgeNodeKind } from "@/lib/motion/knowledgeNode";
