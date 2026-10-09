import type { ReactNode } from "react";
import { ResolvableItem, ResolvableList } from "./Resolvable";

/**
 * Inflow / Issues feed whose cards can resolve into the ledger.
 * Direct keyed children of ResolvableList, as required by AnimatePresence.
 */
export function AttentionResolvableList<T extends { id: string }>({
  items,
  itemClassName,
  children,
}: {
  items: T[];
  itemClassName?: string;
  children: (item: T) => ReactNode;
}) {
  return (
    <ResolvableList>
      {items.map((item) => (
        <ResolvableItem key={item.id} id={item.id} scope="inflow" className={itemClassName}>
          <div data-resolve-content className="min-w-0">
            {children(item)}
          </div>
        </ResolvableItem>
      ))}
    </ResolvableList>
  );
}
