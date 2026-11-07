/**
 * @file
 * @lang zh-CN 泛型/数组包装0.4独立schema，从0.3深复制后增加语法角色。
 * @lang en Independent 0.4 generic/array wrapper schemas, adding syntactic roles to deep copies of 0.3.
 */
import { TSDOC_STRUCTURED_EXTRACTION_JSON_SCHEMA, TSDOC_STRUCTURED_BRIDGE_JSON_SCHEMA } from "./structured-project.mjs";
import { TSDOC_WRAPPED_PROJECT_VERSION, TSDOC_WRAPPED_TYPE_EXPRESSION_KINDS } from "./type-expressions.mjs";
/**
 * @lang zh-CN 包装提取schema精确身份。
 * @lang en Exact wrapper extraction schema identity.
 */
export const TSDOC_WRAPPED_EXTRACTION_SCHEMA_ID = "https://mandolin.github.io/HIA-Documentation/schemas/hia-tsdoc-extraction-0.4.0-draft.json";
/**
 * @lang zh-CN 包装桥接schema精确身份。
 * @lang en Exact wrapper bridge schema identity.
 */
export const TSDOC_WRAPPED_BRIDGE_SCHEMA_ID = "https://mandolin.github.io/HIA-Documentation/schemas/hia-ts-jsdoc-bridge-0.4.0-draft.json";
/**
 * @lang zh-CN 复制旧定义并协调版本、角色及包装属性，树关系仍由读取器复核。
 * @lang en Copies legacy definitions and coordinates versions, roles and wrapper attributes, leaving graph checks to the reader.
 * @param {object} original <lang><zh-CN>原schema。</zh-CN><en>Original schema.</en></lang>
 * @param {string} id <lang><zh-CN>新身份。</zh-CN><en>New identity.</en></lang>
 * @returns {object} <lang><zh-CN>独立冻结顶层schema。</zh-CN><en>Independent top-level-frozen schema.</en></lang>
 */
function wrappedSchema(original, id) {
    // <lang><zh-CN>仅修改深复制的新schema，避免回写旧身份的嵌套定义。</zh-CN><en>Modify only a deep-copied schema to avoid mutating nested definitions of legacy identities.</en></lang>
    const copy = structuredClone(original);
    copy.$id = id;
    copy.properties.contractVersion.const = TSDOC_WRAPPED_PROJECT_VERSION;
    copy.properties.profile.properties.version.const = TSDOC_WRAPPED_PROJECT_VERSION;
    copy.properties.metadata.properties.typeExpressions.const = TSDOC_WRAPPED_PROJECT_VERSION;
    // <lang><zh-CN>角色对象是新副本内的可变引用，树的实参数量/顺序由读取器进一步核验。</zh-CN><en>The role is a mutable reference inside the new copy; the reader additionally checks argument counts and ordering.</en></lang>
    const role = copy.$defs.symbol.properties.metadata.properties.typeExpression;
    role.properties.operator.enum = Object.keys(TSDOC_WRAPPED_TYPE_EXPRESSION_KINDS);
    role.properties.argumentIndex = { type: "integer", minimum: 0, maximum: 19999 };
    role.properties.targetName = { type: "string", minLength: 1 };
    role.properties.typeOperator = { const: "readonly" };
    role.allOf = [
        { if: { properties: { operator: { const: "application" } } }, then: { required: ["targetName"] }, else: { not: { required: ["targetName"] } } },
        { if: { properties: { operator: { const: "type-operator" } } }, then: { required: ["typeOperator"] }, else: { not: { required: ["typeOperator"] } } }
    ];
    copy.$defs.symbol.allOf[0].if.properties.kind.enum = Object.values(TSDOC_WRAPPED_TYPE_EXPRESSION_KINDS);
    return Object.freeze(copy);
}
/**
 * @lang zh-CN 0.4提取结构及语法属性schema。
 * @lang en 0.4 extraction structure and syntax-attribute schema.
 */
export const TSDOC_WRAPPED_EXTRACTION_JSON_SCHEMA = wrappedSchema(TSDOC_STRUCTURED_EXTRACTION_JSON_SCHEMA, TSDOC_WRAPPED_EXTRACTION_SCHEMA_ID);
/**
 * @lang zh-CN 0.4无发射桥接结构schema。
 * @lang en 0.4 non-emitting bridge structure schema.
 */
export const TSDOC_WRAPPED_BRIDGE_JSON_SCHEMA = wrappedSchema(TSDOC_STRUCTURED_BRIDGE_JSON_SCHEMA, TSDOC_WRAPPED_BRIDGE_SCHEMA_ID);
