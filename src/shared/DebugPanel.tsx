import { useEffect, useState } from "react";
import { subscribeDebug, clearDebug } from "./debug";

/**
 * On-screen debug log. Fixed bottom overlay showing the last N connection events, so
 * failures visible only in mobile devtools become visible on screen too. Toggle with the
 * "×" / "debug" button. Disabled by default — flip the initial `open` state to `true`
 * while chasing a specific issue.
 */
export function DebugPanel() {
  const [entries, setEntries] = useState<string[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => subscribeDebug(setEntries), []);

  return (
    <div className="debug-panel" data-open={open}>
      <div className="debug-panel-head">
        <span>debug</span>
        <button type="button" onClick={() => clearDebug()}>clear</button>
        <button type="button" onClick={() => setOpen((o) => !o)}>{open ? "×" : "…"}</button>
      </div>
      {open && (
        <div className="debug-panel-body">
          {entries.length === 0 && <div className="debug-panel-empty">no events yet</div>}
          {entries.map((e, i) => (
            <div key={i} className="debug-panel-entry">{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
