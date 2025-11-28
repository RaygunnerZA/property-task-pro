export async function tryCatch<T>(fn: () => Promise<T>) {
  try {
    return { data: await fn(), error: null };
  } catch (err: any) {
    return { data: null, error: err?.message ?? String(err) };
  }
}
