import type { SimulationFieldProvenance } from "./provenance.ts";

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

export interface SimulationRotation {
  periodSeconds?: number;
  axialTiltDeg?: number;
  angleRad?: number;
}

export interface SimulationThermal {
  surfaceTempK?: number;
  equilibriumTempK?: number;
  albedo?: number;
  emissivity?: number;
  greenhouseEffectK?: number;
}

export interface SimulationRadiative {
  luminosityWatts?: number;
}

export interface SimulationCompact {
  schwarzschildRadiusM?: number;
  magneticFieldTesla?: number;
  beamConeAngleDeg?: number;
  magneticAxisTiltDeg?: number;
  spinPeriodSeconds?: number;
}

export interface SimulationPhysicsCapabilities {
  hasAtmosphere?: boolean;
  isLuminous?: boolean;
  isRelativistic?: boolean;
  isTidallyLocked?: boolean;
}

export interface SimulationBody {
  id: string;
  name: string;
  classification: SimulationBodyClass;
  gravityRole: GravityRole;
  
  // Physical quantities (strict SI units)
  mass: number; // kg
  radius: number; // m
  density?: number; // kg / m^3
  
  // Cartesian state vectors (strict SI units)
  position: [number, number, number]; // m
  velocity: [number, number, number]; // m/s
  
  // Extended astrophysics
  rotation?: SimulationRotation;
  thermal?: SimulationThermal;
  radiative?: SimulationRadiative;
  compact?: SimulationCompact;
  physicsCapabilityFlags?: SimulationPhysicsCapabilities;
  
  // Hierarchy & presentation
  parentBodyId?: string;
  color?: string;
  
  // Rigorous provenance tracking
  provenance: {
    mass: SimulationFieldProvenance;
    radius: SimulationFieldProvenance;
    state: SimulationFieldProvenance;
    density?: SimulationFieldProvenance;
    thermal?: SimulationFieldProvenance;
    radiative?: SimulationFieldProvenance;
    compact?: SimulationFieldProvenance;
    [key: string]: SimulationFieldProvenance | undefined;
  };
}
