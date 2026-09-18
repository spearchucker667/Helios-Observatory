import type { WorldSnapshot } from "./snapshot.ts";
import type { LoggedCommand } from "./commands.ts";
import { SimulationWorld } from "./world.ts";

export interface ReplaySession {
  initialSnapshot: WorldSnapshot;
  commands: LoggedCommand[];
  /** Authoritative endpoint of the session. Replay stops exactly here. */
  finalState: { tick: number; simTimeSeconds: number };
}

export interface ReplayResult {
  world: SimulationWorld;
  finalTick: number;
  finalSimTimeSeconds: number;
  /** |replayed time - documented final time| in seconds. */
  timeDeltaSeconds: number;
  /** True when the replayed endpoint is exactly the documented one. */
  matchesFinalState: boolean;
}

export const REPLAY_TIME_EPSILON_SECONDS = 1e-6;
export const MAX_REPLAY_STEPS = 5_000_000;

/**
 * Deterministic replay of a simulation session from its initial snapshot and
 * authoritative tick-stamped command log, stopping at the documented final
 * tick. Commands are applied at their recorded tick, so the simulated time
 * between commands is preserved.
 */
export function replaySimulation(session: ReplaySession): ReplayResult {
  const { initialSnapshot, finalState } = session;

  const startTick = initialSnapshot.tick;
  const totalSteps = finalState.tick - startTick;
  if (!Number.isFinite(totalSteps) || totalSteps < 0) {
    throw new Error(
      `Invalid replay endpoint: final tick ${finalState.tick} precedes initial tick ${startTick}`
    );
  }
  if (totalSteps > MAX_REPLAY_STEPS) {
    throw new Error(`Replay endpoint ${finalState.tick} exceeds the ${MAX_REPLAY_STEPS}-step replay budget`);
  }

  // Stable order: tick first, then the order the commands were originally recorded.
  const sortedCommands = session.commands
    .map((cmd, index) => ({ cmd, index }))
    .sort((a, b) => a.cmd.tick - b.cmd.tick || a.index - b.index)
    .map((entry) => entry.cmd);

  const world = new SimulationWorld({
    dtSeconds: initialSnapshot.dtSeconds,
    initialBodies: initialSnapshot.bodies,
    initialSimTime: initialSnapshot.simTimeSeconds,
    initialTick: initialSnapshot.tick,
  });

  let cmdIndex = 0;

  // Commands recorded at the *initial* tick execute before any step.
  while (cmdIndex < sortedCommands.length && sortedCommands[cmdIndex].tick <= world.tick) {
    world.executeCommand(sortedCommands[cmdIndex].command, true);
    cmdIndex++;
  }

  while (world.tick < finalState.tick) {
    const target = world.tick + 1;
    world.step();
    // Commands recorded at the tick we just completed.
    while (cmdIndex < sortedCommands.length && sortedCommands[cmdIndex].tick <= target) {
      world.executeCommand(sortedCommands[cmdIndex].command, true);
      cmdIndex++;
    }
  }

  const timeDeltaSeconds = Math.abs(world.simTime - finalState.simTimeSeconds);

  return {
    world,
    finalTick: world.tick,
    finalSimTimeSeconds: world.simTime,
    timeDeltaSeconds,
    matchesFinalState: timeDeltaSeconds <= REPLAY_TIME_EPSILON_SECONDS,
  };
}
