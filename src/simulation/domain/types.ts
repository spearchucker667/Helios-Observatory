import type { SimulationFieldProvenance } from "./provenance";

export type GravityRole = "massive" | "tracer";

export type SimulationBodyClass =
  | "star"
  | "planet"
  | "dwarf-planet"
  | "moon"
  | "asteroid"
  | "comet"
  | "artificial"
  | "white-dwarf"
  | "neutron-star"
  | "pulsar"
  | "magnetar"
  | "black-hole";

export type SimulationBody = {
  id: string;
  name: string;
  classification: SimulationBodyClass;
  gravityRole: GravityRole;
  
  // Physical (SI units)
  mass: number;
  radius: number;
  
  // State vectors (SI units)
  position: [number, number, number];
  velocity: [number, number, number];
  
  // Provenance
  provenance: {
    mass: SimulationFieldProvenance;
    radius: SimulationFieldProvenance;
    state: SimulationFieldProvenance;
  };
  
  // Rendering hints (inherited from canonical if applicable)
  color?: string;
};
