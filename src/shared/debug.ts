// Tiny on-screen debug log. Read via useDebugLog(); write via pushDebug(msg).
// Purpose: surface the actual error text of TonConnect / auth failures to the user's screen
// on mobile, where devtools aren't available. Keep the last 40 entries.

type Listener = (entries: string[]) => void;

let entries: string[] = [];
const listeners = new Set<Listener>();

export function pushDebug(message: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  entries = [...entries.slice(-39), `[${ts}] ${message}`];
  listeners.forEach((l) => l(entries));
  // Also mirror to console for good measure.
  // eslint-disable-next-line no-console
  console.log("[wp-debug]", message);
}

export function subscribeDebug(listener: Listener): () => void {
  listeners.add(listener);
  listener(entries);
  return () => {
    listeners.delete(listener);
  };
}

export function clearDebug(): void {
  entries = [];
  listeners.forEach((l) => l(entries));
}
