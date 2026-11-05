/**
 * @lang zh-CN 通用AST到HIA的直接文档源码映射；没有JS生成事实时不构造普通source map或JavaScript链接。
 * @lang en Direct AST-to-HIA documentation source maps; without JS emission evidence, never fabricate ordinary source maps or JavaScript linkage.
 */
import { createHash } from "node:crypto";
import { readTsDocExtraction } from "@hia-doc/tsdoc-spec";

/**
 * @lang zh-CN 为新项目提取逐声明/注释写精确范围引用，保留多文件来源和类型/成员链接。
 * @lang en Map each declaration/comment of a project extraction with precise ranges, retaining multiple sources and type/member linkage.
 * @param {object} artifact - 新0.2.0-draft提取对象。 New 0.2.0-draft extraction.
 * @param {object} [options] - 输出工件相对定位器。 Relative output artifact locators.
 * @param {string} [options.extractionPath="project.tsdoc.json"] - 已写/拟写提取工件。 Written or planned extraction artifact.
 * @param {string} [options.hiaDocumentPath="project.hia.json"] - 对应HIA工件。 Corresponding HIA artifact.
 * @returns {object} doc-source-map1.1.0，不嵌入源码正文。 doc-source-map 1.1.0 without source bodies.
 * @throws {Error} 版本或工件定位不符。 Invalid version or artifact locator.
 */
export function createTsDocProjectSourceMap(artifact,options={}) {
  readTsDocExtraction(artifact);
  if(artifact.contractVersion!=="0.2.0-draft") throw new Error("Project mapping requires project extraction.");
  const extractionPath=options.extractionPath ?? "project.tsdoc.json";
  const hiaDocumentPath=options.hiaDocumentPath ?? "project.hia.json";
  for(const value of [extractionPath,hiaDocumentPath]) if(typeof value!=="string" || !value || /[\\:%?#\u0000-\u001f\u007f]/.test(value) || value.split("/").some(part=>!part || part==="." || part==="..")) throw new Error("Invalid project artifact path.");
  // <lang lang="zh-CN">来源身份仅由已核相对路径生成，公开绑定可共享来源但各自声明身份独立。</lang><lang lang="en">Derive source identities only from validated relative paths; public bindings may share a source while keeping distinct declaration identities.</lang>
  const paths=[...new Set(artifact.symbols.map(symbol=>symbol.source.path))].sort();
  const sourceId=file=>"source:ts:"+createHash("sha256").update(file).digest("hex");
  const entries=artifact.symbols.map(symbol=>({
    id:"entry:"+symbol.id,kind:"symbol",symbolId:symbol.id,symbolKind:symbol.kind,classification:symbol.classification,
    sourceRefs:[{sourceId:sourceId(symbol.source.path),range:symbol.source.range,rangeConvention:{endBoundary:"exclusive",columnUnit:"utf16-code-unit"},rangeSource:"compiler",rangeSourceDetail:"typescript-native-ast:declaration",confidence:"high"},
      ...(symbol.comment ? [{sourceId:sourceId(symbol.source.path),range:symbol.comment.range,rangeConvention:{endBoundary:"exclusive",columnUnit:"utf16-code-unit"},rangeSource:"compiler",rangeSourceDetail:"typescript-native-ast:documentation-comment",confidence:"high"}] : [])],
    artifactRefs:[{artifactId:"artifact:tsdoc:project",rangeSource:"adapter",confidence:"high"},{artifactId:"artifact:hia:project",rangeSource:"adapter",confidence:"high"}],diagnostics:[]
  }));
  return {contract:"doc-source-map",contractVersion:"1.1.0",id:"docmap:typescript-project",producer:{name:"@hia-doc/ts-to-js-doc-source-map",version:"0.1.3",profile:"ts-jsdoc-bridge"},
    artifacts:[{id:"artifact:tsdoc:project",kind:"extraction-artifact",path:extractionPath,language:"json",role:"generated",contractRefs:[{contract:"hia-tsdoc-extraction",contractVersion:artifact.contractVersion,path:extractionPath}]},{id:"artifact:hia:project",kind:"hia-document",path:hiaDocumentPath,language:"json",role:"generated"}],
    sources:paths.map(file=>({id:sourceId(file),kind:"typescript-source",path:file,language:"typescript",role:"original",sourcesContentPolicy:"none"})),sourceMaps:[],
    chains:paths.map(file=>({id:"chain:"+sourceId(file),stages:[{from:sourceId(file),to:"artifact:hia:project",transform:"typescript-native-ast-to-hia",sourceMap:null,linkage:entries.filter(entry=>entry.sourceRefs[0].sourceId===sourceId(file)).map(entry=>entry.id)}]})),
    entries,diagnostics:[],privacy:{sourcesContentPolicy:"none",allowAbsolutePaths:false,allowUncPaths:false,allowPathTraversal:false,releaseGate:{requireExplicitEmbedOptIn:true,failOnUnsafePath:true,failOnUnexpectedSourcesContent:true}}
  };
}
