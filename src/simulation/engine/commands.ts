export type SimulationCommand =
  | { type: "addBody"; body: any }
  | { type: "removeBody"; id: string }
  | { type: "applyImpulse"; id: string; impulse: [number, number, number] };
