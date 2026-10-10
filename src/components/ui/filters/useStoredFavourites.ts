import { useCallback, useEffect, useRef, useState } from "react";
import {
  readStoredFavourites,
  writeStoredFavourites,
  type FilterFavourite,
} from "@/lib/filterFavourites";

export function useStoredFavourites(
  storageKey: string | undefined,
  defaults: FilterFavourite[]
) {
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const [items, setItems] = useState<FilterFavourite[]>(() => {
    if (!storageKey) return defaults;
    return readStoredFavourites(storageKey) ?? defaults;
  });

  useEffect(() => {
    if (!storageKey) {
      setItems(defaultsRef.current);
      return;
    }
    setItems(readStoredFavourites(storageKey) ?? defaultsRef.current);
  }, [storageKey]);

  const update = useCallback(
    (next: FilterFavourite[] | ((current: FilterFavourite[]) => FilterFavourite[])) => {
      setItems((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (storageKey) writeStoredFavourites(storageKey, resolved);
        return resolved;
      });
    },
    [storageKey]
  );

  return [items, update] as const;
}
