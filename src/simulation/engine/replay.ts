import type { WorldSnapshot } from "./snapshot.ts";
import type { LoggedCommand } from "./commands.ts";
import { SimulationWorld } from "./world.ts";

export interface ReplaySession {
  initialSnapshot: WorldSnapshot;
  commands: LoggedCommand[];
}

/**
 * Executes a deterministic replay of a simulation session from its initial snapshot
 * and logged commands up to a target tick or target simulated time.
 */
export function replaySimulation(
  session: ReplaySession,
  targetTick?: number
): SimulationWorld {
  const world = new SimulationWorld({
    dtSeconds: session.initialSnapshot.dtSeconds,
    initialBodies: session.initialSnapshot.bodies,
    initialSimTime: session.initialSnapshot.simTimeSeconds,
    initialTick: session.initialSnapshot.tick,
  });

  // Sort commands by tick
  const sortedCommands = [...session.commands].sort((a, b) => a.tick - b.tick);
  let cmdIndex = 0;

  const maxTick = targetTick ?? (sortedCommands.length > 0 ? sortedCommands[sortedCommands.length - 1].tick + 10 : 100);

  while (world.tick < maxTick) {
    // Apply commands scheduled for current tick before stepping
    while (cmdIndex < sortedCommands.length && sortedCommands[cmdIndex].tick === world.tick) {
      world.executeCommand(sortedCommands[cmdIndex].command, true);
      cmdIndex++;
    }

    world.step();
  }

  // Apply any remaining commands at final tick
  while (cmdIndex < sortedCommands.length && sortedCommands[cmdIndex].tick === world.tick) {
    world.executeCommand(sortedCommands[cmdIndex].command, true);
    cmdIndex++;
  }

  return world;
}
