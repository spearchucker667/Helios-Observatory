import { ScenarioDocumentSchema, type ScenarioDocument } from "./schema.ts";
import { migrateScenario } from "./migrations.ts";

export const MAX_SCENARIO_JSON_BYTES = 10 * 1024 * 1024; // 10 MB limit per Section 38

/**
 * Serializes a ScenarioDocument to a JSON string.
 */
export function serializeScenario(scenario: ScenarioDocument, pretty = true): string {
  // Validate before serializing
  const validated = ScenarioDocumentSchema.parse(scenario);
  return JSON.stringify(validated, null, pretty ? 2 : undefined);
}

/**
 * Parses and validates an untrusted scenario JSON string.
 * Enforces size limits and schema constraints.
 */
export function deserializeScenario(jsonString: string): ScenarioDocument {
  if (typeof jsonString !== "string") {
    throw new Error("Invalid scenario input: expected JSON string");
  }

  const byteLength = new TextEncoder().encode(jsonString).length;
  if (byteLength > MAX_SCENARIO_JSON_BYTES) {
    throw new Error(`Scenario file exceeds 10 MB size limit (${byteLength} bytes)`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`Malformed JSON in scenario document: ${err.message}`);
  }

  return migrateScenario(parsed);
}
