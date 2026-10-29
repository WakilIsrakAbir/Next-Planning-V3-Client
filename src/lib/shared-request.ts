// In-flight request sharing: screens and background prefetches that ask for the same URL
// while a request for it is still running get that request's promise instead of a new request.
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Runs `run` once per `key` at a time; callers that arrive while it is pending share its result.
 * `fresh` always starts a new request (e.g. a refresh right after saving must not reuse an older read).
 */
export function sharedRequest<T>(key: string, run: () => Promise<T>, fresh = false): Promise<T> {
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running && !fresh) return running;

  const request: Promise<T> = run().finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  inFlight.set(key, request);
  return request;
}

/** Resolves once no shared request is in flight (background work waits for the screen's own requests). */
export async function whenRequestsSettled(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.allSettled([...inFlight.values()]);
  }
}

/** Resolves when the browser is idle (falls back to a timer where requestIdleCallback is missing). */
export function whenBrowserIdle(timeout = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => resolve(), { timeout });
    } else {
      setTimeout(resolve, 200);
    }
  });
}

/** GET `url` with the stored bearer token, shared while in flight; resolves `null` for a non-OK response. */
export function sharedGetJson<T>(url: string, fresh = false): Promise<T | null> {
  return sharedRequest(
    url,
    async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? ((await res.json()) as T) : null;
    },
    fresh
  );
}
