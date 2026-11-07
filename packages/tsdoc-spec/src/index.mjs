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
  "throws",
  "example",
  "deprecated",
  "beta",
  "alpha",
  "internal",
  "performance",
  "lang"
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

/** @lang zh-CN 新通用项目提取使用独立草案身份，原常量及schema保持。 @lang en Generic-project extraction uses a separate draft identity while original constants and schema stay unchanged. */
export { TSDOC_PROJECT_EXTRACTION_CONTRACT_VERSION, TSDOC_PROJECT_EXTRACTION_SCHEMA_ID, TSDOC_PROJECT_PROFILE_VERSION, TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA, readTsDocExtraction } from "./project.mjs";
/** @lang zh-CN 无发射项目桥接采用独立草案身份。 @lang en Non-emitting project bridges use an independent draft identity. */
export {TSDOC_PROJECT_BRIDGE_CONTRACT_VERSION,TSDOC_PROJECT_BRIDGE_SCHEMA_ID,TSDOC_PROJECT_BRIDGE_JSON_SCHEMA} from "./project-bridge.mjs";
/**
 * @lang zh-CN 显式0.3类型表达式身份、种类与schema，旧常量和默认版本保持。
 * @lang en Explicit 0.3 type-expression identity, kinds and schemas, preserving legacy constants and defaults.
 */
export {TSDOC_STRUCTURED_PROJECT_VERSION,TSDOC_TYPE_EXPRESSION_KINDS} from "./type-expressions.mjs";
export {TSDOC_STRUCTURED_EXTRACTION_SCHEMA_ID,TSDOC_STRUCTURED_BRIDGE_SCHEMA_ID,TSDOC_STRUCTURED_EXTRACTION_JSON_SCHEMA,TSDOC_STRUCTURED_BRIDGE_JSON_SCHEMA} from "./structured-project.mjs";
