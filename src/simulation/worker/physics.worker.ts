import { SimulationWorld } from "../engine/world.ts";
import { TimestepScheduler } from "../engine/timestep.ts";
import { ENGINE_VERSION } from "../engine/engine-version.ts";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "./protocol.ts";

let world: SimulationWorld | null = null;
let scheduler: TimestepScheduler = new TimestepScheduler();
let loopTimer: any = null;
let lastWallClockTimeMs: number = Date.now();

function postTypedMessage(msg: WorkerOutboundMessage, transferList?: Transferable[]) {
  if (typeof self !== "undefined" && typeof self.postMessage === "function") {
    if (transferList && transferList.length > 0) {
      (self as any).postMessage(msg, transferList);
    } else {
      (self as any).postMessage(msg);
    }
  }
}

function tickLoop() {
  if (!world) return;

  const now = Date.now();
  const deltaRealSeconds = Math.max(0, (now - lastWallClockTimeMs) / 1000);
  lastWallClockTimeMs = now;

  const stepsToRun = scheduler.advanceRealTime(deltaRealSeconds);

  for (let s = 0; s < stepsToRun; s++) {
    world.step(scheduler.dt);
  }

  // Emit render snapshot at update tick
  const snapshot = world.getRenderSnapshot();
  const transfer: Transferable[] = [
    snapshot.positions.buffer,
    snapshot.velocities.buffer,
    snapshot.masses.buffer,
    snapshot.radii.buffer,
    snapshot.isTracer.buffer,
  ];

  postTypedMessage({ type: "snapshot", data: snapshot }, transfer);
  postTypedMessage({ type: "performance_status", stats: scheduler.getStats() });
}

function startLoop() {
  if (loopTimer) clearInterval(loopTimer);
  lastWallClockTimeMs = Date.now();
  loopTimer = setInterval(tickLoop, 33); // ~30 Hz snapshot rate
}

// Handle incoming worker messages
if (typeof self !== "undefined") {
  self.onmessage = (e: MessageEvent<WorkerInboundMessage>) => {
    const msg = e.data;
    if (!msg || typeof msg.type !== "string") {
      postTypedMessage({ type: "error", error: "Malformed worker message: missing type" });
      return;
    }

    try {
      switch (msg.type) {
        case "init": {
          scheduler = new TimestepScheduler(msg.dtSeconds ?? 900);
          world = new SimulationWorld({
            dtSeconds: scheduler.dt,
            initialBodies: msg.bodies,
            initialSimTime: msg.simTimeSeconds ?? 0,
            initialTick: msg.tick ?? 0,
          });

          // Forward events to main thread
          world.eventBus.subscribe((evt) => {
            postTypedMessage({ type: "event", event: evt });
          });

          postTypedMessage({ type: "ready", engineVersion: ENGINE_VERSION });
          const snap = world.getRenderSnapshot();
          postTypedMessage({ type: "snapshot", data: snap });
          startLoop();
          break;
        }

        case "command": {
          if (!world) throw new Error("World not initialized");
          world.executeCommand(msg.command);
          const snap = world.getRenderSnapshot();
          postTypedMessage({ type: "snapshot", data: snap });
          break;
        }

        case "pause": {
          scheduler.setPaused(true);
          postTypedMessage({ type: "performance_status", stats: scheduler.getStats() });
          break;
        }

        case "resume": {
          scheduler.setPaused(false);
          lastWallClockTimeMs = Date.now();
          postTypedMessage({ type: "performance_status", stats: scheduler.getStats() });
          break;
        }

        case "step_once": {
          if (!world) throw new Error("World not initialized");
          scheduler.stepOnce();
          world.step(scheduler.dt);
          const snap = world.getRenderSnapshot();
          postTypedMessage({ type: "snapshot", data: snap });
          postTypedMessage({ type: "performance_status", stats: scheduler.getStats() });
          break;
        }

        case "set_time_multiplier": {
          scheduler.setTimeMultiplier(msg.multiplier);
          postTypedMessage({ type: "performance_status", stats: scheduler.getStats() });
          break;
        }

        case "set_dt": {
          scheduler.setDt(msg.dtSeconds);
          if (world) world.setDt(msg.dtSeconds);
          postTypedMessage({ type: "performance_status", stats: scheduler.getStats() });
          break;
        }

        case "set_quality": {
          scheduler.setQuality(msg.quality);
          if (world) world.setDt(scheduler.dt);
          postTypedMessage({ type: "performance_status", stats: scheduler.getStats() });
          break;
        }

        case "request_snapshot": {
          if (!world) throw new Error("World not initialized");
          const snap = world.getRenderSnapshot();
          postTypedMessage({ type: "snapshot", data: snap });
          break;
        }

        case "request_trajectory": {
          if (!world) throw new Error("World not initialized");
          const trajectory = world.predictTrajectory(msg.bodyId, { steps: msg.steps, dt: msg.dt });
          postTypedMessage({ type: "trajectory_result", bodyId: msg.bodyId, trajectory });
          break;
        }

        case "request_checkpoint": {
          if (!world) throw new Error("World not initialized");
          const checkpoint = world.getSnapshot();
          postTypedMessage({ type: "checkpoint", snapshot: checkpoint });
          break;
        }

        case "load_checkpoint": {
          if (!world) {
            world = new SimulationWorld();
          }
          world.restoreSnapshot(msg.snapshot);
          scheduler.reset(msg.snapshot.simTimeSeconds, msg.snapshot.tick);
          const snap = world.getRenderSnapshot();
          postTypedMessage({ type: "snapshot", data: snap });
          break;
        }

        case "reset_to_initial": {
          if (!world) throw new Error("World not initialized");
          world.executeCommand({ type: "reset_to_initial" });
          scheduler.reset();
          const snap = world.getRenderSnapshot();
          postTypedMessage({ type: "snapshot", data: snap });
          break;
        }

        default:
          postTypedMessage({ type: "error", error: `Unknown worker message type` });
      }
    } catch (err: any) {
      postTypedMessage({ type: "error", error: err.message ?? String(err) });
    }
  };
}
