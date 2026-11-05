/**
 * @lang zh-CN 通用项目提取0.2.0-draft独立身份与精确两代读取；旧对象保持原引用，不自动迁移。
 * @lang en Independent project extraction 0.2.0-draft identity and exact two-generation reading; legacy objects retain their references without automatic migration.
 */
/** @lang zh-CN 新通用项目提取草案，独立于旧扫描器身份。 @lang en New generic-project draft, separate from the legacy scanner identity. */
export const TSDOC_PROJECT_EXTRACTION_CONTRACT_VERSION="0.2.0-draft";
/** @lang zh-CN 新草案的可复核schema身份，未宣称正式发行。 @lang en Inspectable schema identity for the new draft, without claiming release. */
export const TSDOC_PROJECT_EXTRACTION_SCHEMA_ID="https://mandolin.github.io/HIA-Documentation/schemas/hia-tsdoc-extraction-0.2.0-draft.json";
/** @lang zh-CN 项目链的独立profile草案身份，旧profile常量保持原值。 @lang en Separate draft profile for project extraction, preserving the original profile constant. */
export const TSDOC_PROJECT_PROFILE_VERSION="0.2.0-draft";
/** @lang zh-CN 项目级提取结构，语义引用和精度仍由读取器额外校验。 @lang en Project extraction structure; readers additionally check semantic references and precision. */
export const TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA=Object.freeze({
  $schema:"https://json-schema.org/draft/2020-12/schema",$id:TSDOC_PROJECT_EXTRACTION_SCHEMA_ID,type:"object",required:["contract","contractVersion","producer","profile","source","artifacts","modules","symbols","comments","diagnostics"],
  properties:{
    contract:{const:"hia-tsdoc-extraction"},contractVersion:{const:TSDOC_PROJECT_EXTRACTION_CONTRACT_VERSION},
    producer:{type:"object",required:["name","version"],properties:{name:{$ref:"#/$defs/nonempty"},version:{$ref:"#/$defs/nonempty"}}},
    profile:{type:"object",required:["id","version"],properties:{id:{const:"ts-jsdoc-bridge"},version:{const:TSDOC_PROJECT_PROFILE_VERSION}}},
    source:{type:"object",required:["path","language","sourcesContentPolicy"],properties:{path:{$ref:"#/$defs/path"},language:{const:"typescript"},sourcesContentPolicy:{const:"none"}}},
    artifacts:{type:"array"},modules:{type:"array",minItems:1,maxItems:1000,items:{$ref:"#/$defs/module"}},
    symbols:{type:"array",maxItems:20000,items:{$ref:"#/$defs/symbol"}},comments:{type:"array",items:{type:"object",required:["symbolId","range"],properties:{symbolId:{$ref:"#/$defs/nonempty"},range:{$ref:"#/$defs/range"}}}},diagnostics:{type:"array"}
  },
  $defs:{
    nonempty:{type:"string",minLength:1},
    path:{type:"string",minLength:1,pattern:"^(?!/)(?!.*[\\\\:%?#\\u0000-\\u001f\\u007f])(?!.*(?:^|/)\\.{1,2}(?:/|$))(?!.*//)(?!.*\\/$).+$"},
    position:{type:"object",required:["line","column"],properties:{line:{type:"integer",minimum:1,maximum:Number.MAX_SAFE_INTEGER},column:{type:"integer",minimum:1,maximum:Number.MAX_SAFE_INTEGER}}},
    range:{type:"object",required:["start","end"],properties:{start:{$ref:"#/$defs/position"},end:{$ref:"#/$defs/position"}}},
    convention:{type:"object",required:["endBoundary","columnUnit"],properties:{endBoundary:{const:"exclusive"},columnUnit:{const:"utf16-code-unit"}}},
    module:{
      type:"object",required:["path","exports"],
      properties:{
        path:{$ref:"#/$defs/path"},
        exports:{
          type:"array",items:{
            type:"object",required:["name","declarationName","symbolIds"],
            properties:{name:{$ref:"#/$defs/nonempty"},declarationName:{$ref:"#/$defs/nonempty"},symbolIds:{type:"array",uniqueItems:true,items:{$ref:"#/$defs/nonempty"}}}
          }
        }
      }
    },
    symbol:{type:"object",required:["id","name","kind","classification","signature","source","metadata"],properties:{id:{$ref:"#/$defs/nonempty"},name:{$ref:"#/$defs/nonempty"},kind:{$ref:"#/$defs/nonempty"},classification:{enum:["runtime","type-only"]},signature:{type:"string"},parentId:{$ref:"#/$defs/nonempty"},source:{type:"object",required:["path","range","rangeConvention"],properties:{path:{$ref:"#/$defs/path"},range:{$ref:"#/$defs/range"},rangeConvention:{$ref:"#/$defs/convention"}}},metadata:{type:"object",required:["modulePath"],properties:{modulePath:{$ref:"#/$defs/path"}}}}}
  }
});

/**
 * @lang zh-CN 核验JSON中的非空canonical相对路径，不解析或读取它。
 * @lang en Check nonempty canonical relative paths in JSON without resolving or reading them.
 * @param {unknown} value - 路径字段。 Path field.
 * @returns {boolean} 是否安全。 Whether the path is safe.
 */
function safePath(value) {return typeof value==="string" && value.length>0 && !value.startsWith("/") && !/[\\:%?#\u0000-\u001f\u007f]/.test(value) && value.split("/").every(part=>part && part!=="." && part!=="..");}

/**
 * @lang zh-CN 校验一基UTF-16终点排除范围，保持已有文档源码映射单位词汇。
 * @lang en Validate one-based exclusive-end UTF-16 ranges using existing source-map unit vocabulary.
 * @param {object} range - 范围。 Range.
 * @returns {boolean} 是否有效。 Whether the range is valid.
 */
function validRange(range) {return range && [range.start?.line,range.start?.column,range.end?.line,range.end?.column].every(value=>Number.isSafeInteger(value) && value>0) && (range.end.line>range.start.line || range.end.line===range.start.line && range.end.column>range.start.column);}

/**
 * @lang zh-CN 精确读取旧单文件/新项目提取对象，不执行、不复制、不改版本。新版必须具备真实模块绑定和逐声明范围。
 * @lang en Read exact legacy single-file or new project extraction objects without execution, copying, or relabeling; new objects require module bindings and declaration ranges.
 * @param {object} artifact - 调用方已解析的JSON对象。 Caller-parsed JSON object.
 * @returns {object} 原始有效对象。 The original valid object.
 * @throws {Error} 身份、版本、结构或引用不符合；固定文案不回显输入。 Invalid identity, version, structure, or references without echoing input.
 */
export function readTsDocExtraction(artifact) {
  if(!artifact || artifact.contract!=="hia-tsdoc-extraction" || !Array.isArray(artifact.symbols)) throw new Error("Invalid TypeScript extraction artifact.");
  if(artifact.contractVersion==="0.1.0-draft") return artifact;
  if(artifact.contractVersion!==TSDOC_PROJECT_EXTRACTION_CONTRACT_VERSION) throw new Error("Unsupported TypeScript extraction version.");
  if(!artifact.producer?.name || !artifact.producer?.version || artifact.profile?.id!=="ts-jsdoc-bridge" || artifact.profile?.version!==TSDOC_PROJECT_PROFILE_VERSION
    || !safePath(artifact.source?.path) || artifact.source?.language!=="typescript" || artifact.source?.sourcesContentPolicy!=="none"
    || !Array.isArray(artifact.artifacts) || !Array.isArray(artifact.modules) || !artifact.modules.length || artifact.modules.length>1000 || !Array.isArray(artifact.comments) || !Array.isArray(artifact.diagnostics) || artifact.symbols.length>20000) throw new Error("Invalid TypeScript project extraction.");
  // <lang lang="zh-CN">先建立唯一声明身份再核公开绑定，旧工件不能仅换版本号通过。</lang><lang lang="en">Establish unique declaration identities before checking export bindings so relabeled legacy objects cannot pass.</lang>
  const ids=new Set(artifact.symbols.map(symbol=>symbol?.id));
  if(ids.size!==artifact.symbols.length || [...ids].some(id=>typeof id!=="string" || !id)) throw new Error("Invalid TypeScript project symbols.");
  for(const symbol of artifact.symbols) {
    const source=symbol.source;
    const range=source?.range;
    if(typeof symbol.name!=="string" || !symbol.name || typeof symbol.kind!=="string" || !symbol.kind || typeof symbol.signature!=="string" || !["runtime","type-only"].includes(symbol.classification) || !source || !safePath(source.path) || !safePath(symbol.metadata?.modulePath)
      || source.rangeConvention?.endBoundary!=="exclusive" || source.rangeConvention?.columnUnit!=="utf16-code-unit" || !validRange(range)
      || symbol.parentId && (!ids.has(symbol.parentId) || symbol.parentId===symbol.id) || symbol.comment && !validRange(symbol.comment.range)) throw new Error("Invalid TypeScript project symbol reference.");
  }
  // <lang lang="zh-CN">公开模块及同模块绑定必须唯一；绑定只能引用该入口的顶层声明。</lang><lang lang="en">Modules and their binding names must be unique; bindings may reference only top-level declarations of that entry.</lang>
  const modulePaths=new Set();
  const byId=new Map(artifact.symbols.map(symbol=>[symbol.id,symbol]));
  for(const module of artifact.modules) {
    if(!safePath(module?.path) || modulePaths.has(module.path) || !Array.isArray(module.exports)) throw new Error("Invalid TypeScript project module.");
    modulePaths.add(module.path);
    const names=new Set();
    for(const binding of module.exports) {
      if(typeof binding?.name!=="string" || !binding.name || names.has(binding.name) || typeof binding.declarationName!=="string" || !binding.declarationName || !Array.isArray(binding.symbolIds) || new Set(binding.symbolIds).size!==binding.symbolIds.length
        || binding.symbolIds.some(id=>!ids.has(id) || byId.get(id).parentId || byId.get(id).metadata.modulePath!==module.path || byId.get(id).name!==binding.name)) throw new Error("Invalid TypeScript project binding.");
      names.add(binding.name);
    }
  }
  for(const symbol of artifact.symbols) if(!modulePaths.has(symbol.metadata.modulePath) || symbol.parentId && byId.get(symbol.parentId).metadata.modulePath!==symbol.metadata.modulePath) throw new Error("Invalid TypeScript project membership.");
  for(const comment of artifact.comments) if(!ids.has(comment?.symbolId) || !validRange(comment.range)) throw new Error("Invalid TypeScript project comment reference.");
  return artifact;
}
