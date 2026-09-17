import { SimulationCommand } from "./commands.ts";
import { SimulationEvent } from "./events.ts";
export type ReplayState = {
  initialSnapshot: any;
  commands: { tick: number; command: SimulationCommand }[];
  events: { tick: number; event: SimulationEvent }[];
};
