export type SimulationProvenanceKind =
  | "canonical"
  | "calculated"
  | "estimated"
  | "custom"
  | "unsupported";

export type SimulationFieldProvenance = {
  kind: SimulationProvenanceKind;
  sourceIds?: string[];
  method?: string;
  engineVersion?: string;
  inputPaths?: string[];
  note?: string;
};
