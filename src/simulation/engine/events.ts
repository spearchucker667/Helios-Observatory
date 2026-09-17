export type SimulationEvent =
  | { type: "collision"; bodyA: string; bodyB: string; time: number };
