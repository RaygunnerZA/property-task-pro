import { lazy, type ComponentType } from "react";

type ModuleDefault<T> = { default: T };

const CHUNK_FETCH_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed/i;

export function isLazyChunkFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_FETCH_ERROR.test(message);
}

/**
 * React.lazy wrapper that retries once when Vite fails to fetch a dynamic chunk
 * (common after dev-server restart or HMR invalidation).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<ModuleDefault<T>>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!isLazyChunkFetchError(error)) throw error;

      await new Promise((resolve) => setTimeout(resolve, 150));
      return factory();
    }
  });
}
