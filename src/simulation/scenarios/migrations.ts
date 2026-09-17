import { ScenarioEnvelopeSchema, ScenarioDocumentSchema, type ScenarioDocument } from "./schema.ts";

export const CURRENT_SCHEMA_VERSION = 1;

export function migrateScenario(raw: unknown): ScenarioDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid scenario document: root must be an object");
  }

  // 1. Minimal envelope parse
  const envelopeResult = ScenarioEnvelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    throw new Error(`Invalid scenario envelope: ${envelopeResult.error.message}`);
  }

  const { format, schemaVersion } = envelopeResult.data;

  if (format !== "helios-scenario") {
    throw new Error(`Unsupported scenario format: ${format}`);
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported future scenario schema version: ${schemaVersion} (highest supported version is ${CURRENT_SCHEMA_VERSION})`
    );
  }

  // Version 1 is current
  const currentDoc: any = raw;

  // 2. Strict final validation
  const validationResult = ScenarioDocumentSchema.safeParse(currentDoc);
  if (!validationResult.success) {
    throw new Error(`Scenario schema validation failed: ${validationResult.error.message}`);
  }

  return validationResult.data;
}
