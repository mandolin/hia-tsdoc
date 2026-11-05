/**
 * @lang zh-CN 无JavaScript发射事实的项目桥接草案；身份独立于原0.1桥接。
 * @lang en Project bridge draft without JavaScript emission facts, independent of the original 0.1 bridge.
 */
import {TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA} from "./project.mjs";

/** @lang zh-CN 项目桥接精确新版本。 @lang en Exact new project bridge version. */
export const TSDOC_PROJECT_BRIDGE_CONTRACT_VERSION="0.2.0-draft";
/** @lang zh-CN 新桥接schema身份，未宣称线上发行。 @lang en New bridge schema identity without claiming online publication. */
export const TSDOC_PROJECT_BRIDGE_SCHEMA_ID="https://mandolin.github.io/HIA-Documentation/schemas/hia-ts-jsdoc-bridge-0.2.0-draft.json";
/** @lang zh-CN 新桥接复用项目声明结构，交叉引用由读取器额外核验。 @lang en The new bridge reuses project declarations; its reader additionally verifies cross-references. */
export const TSDOC_PROJECT_BRIDGE_JSON_SCHEMA=Object.freeze({
  $schema:"https://json-schema.org/draft/2020-12/schema",$id:TSDOC_PROJECT_BRIDGE_SCHEMA_ID,type:"object",
  required:["contract","contractVersion","producer","profile","source","modules","artifact","runtimeSymbols","typeOnlySymbols","diagnostics","metadata"],
  properties:{
    contract:{const:"hia-ts-jsdoc-bridge"},contractVersion:{const:TSDOC_PROJECT_BRIDGE_CONTRACT_VERSION},producer:{type:"object"},
    profile:TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA.properties.profile,source:TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA.properties.source,modules:TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA.properties.modules,
    artifact:{type:"null"},
    runtimeSymbols:{type:"array",items:{allOf:[{$ref:"#/$defs/symbol"},{required:["bridgeStatus"],properties:{classification:{const:"runtime"},bridgeStatus:{const:"not-emitted"}}}]}},
    typeOnlySymbols:{type:"array",items:{allOf:[{$ref:"#/$defs/symbol"},{required:["bridgeStatus"],properties:{classification:{const:"type-only"},bridgeStatus:{const:"ts-only"}}}]}},
    diagnostics:{type:"array"},metadata:{type:"object",required:["symbolOrder"],properties:{symbolOrder:{type:"array",uniqueItems:true,items:{$ref:"#/$defs/nonempty"}}}}
  },
  $defs:TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA.$defs
});
