// Must be imported before anything that transitively pulls in @ton/core or @tonconnect/sdk —
// they reference Node's `Buffer` at module-evaluation time, and ES module imports are hoisted,
// so a plain assignment statement placed "first" in main.tsx still runs after all its imports
// (including App.tsx's transitive TonConnect imports) have already executed. Being its own
// side-effect-only module and the literal first `import` line is what makes the ordering work.
import { Buffer } from 'buffer'

globalThis.Buffer = globalThis.Buffer ?? Buffer
