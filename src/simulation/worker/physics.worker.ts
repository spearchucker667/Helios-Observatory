import { SimulationHost } from "./simulation-host.ts";
import type { WorkerOutboundMessage } from "./protocol.ts";

/**
 * Web Worker entry point.
 *
 * All simulation logic lives in SimulationHost, which is shared with the
 * in-process fallback so both modes are semantically identical.
 */
const host = new SimulationHost({
  emit: (msg: WorkerOutboundMessage, transfer?: Transferable[]) => {
    if (typeof self === "undefined" || typeof self.postMessage !== "function") return;
    if (transfer && transfer.length > 0) {
      (self as unknown as { postMessage: (m: unknown, t: Transferable[]) => void }).postMessage(msg, transfer);
    } else {
      self.postMessage(msg);
    }
  },
  // Keep outbound validation on inside the worker: a protocol violation is a
  // bug we want surfaced immediately rather than silently transferred.
  validateOutbound: true,
});

if (typeof self !== "undefined") {
  self.onmessage = (event: MessageEvent) => {
    host.handleMessage(event.data);
  };

  self.onerror = (event) => {
    self.postMessage({
      type: "error",
      error: `Worker runtime error: ${event instanceof ErrorEvent ? event.message : String(event)}`,
      code: "WORKER_RUNTIME_ERROR",
    });
  };
}
