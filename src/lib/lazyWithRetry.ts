import { lazy, type ComponentType } from "react";

type ModuleDefault<T> = { default: T };

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
      const message = error instanceof Error ? error.message : String(error);
      const isChunkFetchFailure =
        error instanceof TypeError &&
        /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
          message
        );

      if (!isChunkFetchFailure) throw error;

      await new Promise((resolve) => setTimeout(resolve, 150));
      return factory();
    }
  });
}
