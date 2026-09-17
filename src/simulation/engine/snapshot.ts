import { ENGINE_VERSION } from "./engine-version.ts";
export function createSnapshot(state: any): any {
  return { version: ENGINE_VERSION, state: structuredClone(state) };
}
export function loadSnapshot(snapshot: any): any {
  if (snapshot.version !== ENGINE_VERSION) throw new Error("Version mismatch");
  return structuredClone(snapshot.state);
}
