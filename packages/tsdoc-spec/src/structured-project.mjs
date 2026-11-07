/**
 * @file
 * @lang zh-CN 0.3提取与桥接schema独立副本，原0.2定义不改写。
 * @lang en Independent 0.3 extraction and bridge schemas, preserving original 0.2 definitions.
 */
import {TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA} from "./project.mjs";
import {TSDOC_PROJECT_BRIDGE_JSON_SCHEMA} from "./project-bridge.mjs";
import {TSDOC_STRUCTURED_PROJECT_VERSION, TSDOC_TYPE_EXPRESSION_KINDS} from "./type-expressions.mjs";

/**
 * @lang zh-CN 提取schema的精确0.3身份。
 * @lang en Exact 0.3 extraction schema identity.
 */
export const TSDOC_STRUCTURED_EXTRACTION_SCHEMA_ID = "https://mandolin.github.io/HIA-Documentation/schemas/hia-tsdoc-extraction-0.3.0-draft.json";
/**
 * @lang zh-CN 桥接schema的精确0.3身份。
 * @lang en Exact 0.3 bridge schema identity.
 */
export const TSDOC_STRUCTURED_BRIDGE_SCHEMA_ID = "https://mandolin.github.io/HIA-Documentation/schemas/hia-ts-jsdoc-bridge-0.3.0-draft.json";

/**
 * @lang zh-CN 从旧形状复制新版定义，只在副本写版本与类型表达式约束。
 * @lang en Copies a legacy shape and applies version and type-expression constraints to the copy only.
 * @param {object} original <lang><zh-CN>原schema。</zh-CN><en>Original schema.</en></lang>
 * @param {string} id <lang><zh-CN>新版身份。</zh-CN><en>New identity.</en></lang>
 * @returns {object} <lang><zh-CN>顶层冻结的新schema，引用语义由读取器复核。</zh-CN><en>New top-level-frozen schema, with reference semantics checked by readers.</en></lang>
 */
function schema(original, id) {
  // <lang><zh-CN>深拷贝避免共享旧schema的defs或profile对象，六个旧导出保持原值。</zh-CN><en>Deep-copy definitions and profile objects to preserve all legacy exports.</en></lang>
  const copy = structuredClone(original);
  copy.$id = id;
  copy.properties.contractVersion.const = TSDOC_STRUCTURED_PROJECT_VERSION;
  copy.properties.profile.properties.version.const = TSDOC_STRUCTURED_PROJECT_VERSION;
  if(!copy.required.includes("metadata")) copy.required.push("metadata");
  copy.properties.metadata ??= {type: "object", required: [], properties: {}};
  copy.properties.metadata.required.push("typeExpressions");
  copy.properties.metadata.properties.typeExpressions = {const: TSDOC_STRUCTURED_PROJECT_VERSION};
  copy.$defs.symbol.properties.metadata.properties.typeExpressionRoot = {const: true};
  copy.$defs.symbol.properties.metadata.properties.typeExpression = {
    type: "object", required: ["operator", "syntaxKind"], additionalProperties: false,
    properties: {
      operator: {enum: Object.keys(TSDOC_TYPE_EXPRESSION_KINDS)},
      syntaxKind: {type: "string", minLength: 1},
      branchIndex: {type: "integer", minimum: 0, maximum: 19999}
    }
  };
  copy.$defs.symbol.allOf = [{
    if: {properties: {kind: {enum: Object.values(TSDOC_TYPE_EXPRESSION_KINDS)}}},
    then: {
      required: ["parentId", "exported"],
      properties: {classification: {const: "type-only"}, exported: {const: false}, metadata: {required: ["typeExpression"]}},
      not: {required: ["comment"]}
    }
  }];
  return Object.freeze(copy);
}

/**
 * @lang zh-CN 结构化项目提取schema，分支顺序与来源包含由读取器检查。
 * @lang en Structured project extraction schema; readers check branch order and provenance containment.
 */
export const TSDOC_STRUCTURED_EXTRACTION_JSON_SCHEMA = schema(TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA, TSDOC_STRUCTURED_EXTRACTION_SCHEMA_ID);
/**
 * @lang zh-CN 结构化项目桥接schema，不产生JavaScript发射事实。
 * @lang en Structured project bridge schema without JavaScript emission facts.
 */
export const TSDOC_STRUCTURED_BRIDGE_JSON_SCHEMA = schema(TSDOC_PROJECT_BRIDGE_JSON_SCHEMA, TSDOC_STRUCTURED_BRIDGE_SCHEMA_ID);
