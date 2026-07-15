export const TSDOC_EXTRACTION_CONTRACT = "hia-tsdoc-extraction";
export const TSDOC_EXTRACTION_CONTRACT_VERSION = "0.1.0-draft";
export const TSDOC_EXTRACTION_SCHEMA_ID = "https://mandolin.github.io/HIA-Documentation/schemas/hia-tsdoc-extraction-0.1.0-draft.json";
export const TSDOC_PROFILE_VERSION = "0.1.0-draft";

export const TSDOC_SYMBOL_KINDS = Object.freeze({
  runtimeFunction: "ts-runtime-function",
  runtimeClass: "ts-runtime-class",
  interface: "ts-interface",
  typeAlias: "ts-type-alias"
});

export const TSDOC_CLASSIFICATIONS = Object.freeze({
  runtime: "runtime",
  typeOnly: "type-only"
});

export const TSDOC_TAGS = Object.freeze([
  "public",
  "remarks",
  "param",
  "returns",
  "example",
  "deprecated",
  "beta",
  "alpha",
  "internal"
]);

export const TSDOC_EXTRACTION_JSON_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: TSDOC_EXTRACTION_SCHEMA_ID,
  type: "object",
  required: ["contract", "contractVersion", "producer", "profile", "source", "artifacts", "symbols", "comments", "diagnostics"],
  additionalProperties: true,
  properties: {
    contract: { const: TSDOC_EXTRACTION_CONTRACT },
    contractVersion: { const: TSDOC_EXTRACTION_CONTRACT_VERSION },
    producer: { type: "object" },
    profile: { type: "object" },
    source: { type: "object" },
    artifacts: { type: "array" },
    symbols: { type: "array" },
    comments: { type: "array" },
    diagnostics: { type: "array" },
    metadata: { type: "object" }
  }
});

export function isTSDocTag(tag) {
  return TSDOC_TAGS.includes(normalizeTSDocTag(tag));
}

export function normalizeTSDocTag(tag) {
  return String(tag).toLowerCase().replace(/^@/, "");
}
