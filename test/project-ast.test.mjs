/**
 * @lang zh-CN 通用AST提取的真实原生TypeScript7反例：公开导出、重载、字段、精度与边界。
 * @lang en Real native TypeScript 7 regression cases for generic AST extraction: exports, overloads, fields, precision, and boundaries.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { extractTsDocProject } from "../packages/ts-doc-extractor/src/project.mjs";
import { extractTsDoc } from "../packages/ts-doc-extractor/src/index.mjs";
import { readTsDocExtraction, TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA } from "../packages/tsdoc-spec/src/index.mjs";
import { tsDocToHiaDocument } from "../packages/ts-doc-adapter/src/index.mjs";
import { createTsDocProjectSourceMap } from "../packages/ts-to-js-doc-source-map/src/project.mjs";

/**
 * @lang zh-CN 每个探针建立独立忽略目录，保留源码以便复核，不清理未知文件。
 * @lang en Give each probe a unique ignored directory, retaining sources for review without deleting unknown files.
 * @param {object} files - 相对源码与内容。 Relative sources and text.
 * @returns {string} 本探针拥有的工作区。 Probe-owned workspace.
 */
function fixture(files) {
  const parent=fileURLToPath(new URL("../temp/",import.meta.url));
  fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,"project-ast-test-"));
  for(const [name,body] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),body);}
  return root;
}

test("native AST resolves constants, generic functions, aliases and type-only exports",()=>{
  const root=fixture({"index.ts":'export * from "./value.js"; export { COUNT as ALIAS } from "./value.js";',"value.ts":'/** @lang en Count.\n * @lang zh-CN 数量。 */\nexport const COUNT = 3;\nexport function identity<T>(value:T):T {return value;}\nexport interface Item { id:string; }'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  assert.equal(artifact.contractVersion,"0.2.0-draft");
  assert.deepEqual(artifact.modules[0].exports.map(item=>item.name).sort(),["ALIAS","COUNT","Item","identity"]);
  assert.equal(artifact.diagnostics.filter(item=>item.severity==="error").length,0);
  const count=artifact.symbols.find(item=>item.name==="COUNT");
  assert.equal(count.kind,"ts-runtime-constant");
  assert.equal(count.source.path,"value.ts");
  assert.equal(count.comment.i18n.fields.description.localizedText["zh-CN"],"数量。");
  assert.match(artifact.symbols.find(item=>item.name==="identity").signature,/<T>/);
  assert(artifact.symbols.some(item=>item.name==="Item" && item.classification==="type-only"));
});
test("all overload declarations and their own documentation survive",()=>{
  const root=fixture({"index.ts":'/** String overload. */ export function choose(x:string):string;\n/** Number overload. */ export function choose(x:number):number;\n/** Implementation. */ export function choose(x:string|number){return x;}'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const binding=artifact.modules[0].exports.find(item=>item.name==="choose");
  assert.equal(binding.symbolIds.length,3);
  const symbols=binding.symbolIds.map(id=>artifact.symbols.find(item=>item.id===id));
  assert.deepEqual(symbols.map(item=>item.comment.summary),["String overload.","Number overload.","Implementation."]);
  assert.equal(new Set(symbols.map(item=>item.id)).size,3);
  assert(symbols.every(item=>!item.signature.includes("return x")));
});
test("public class/interface members, parameters and returns are retained",()=>{
  const root=fixture({"index.ts":'export interface Item { /** Identifier. */ id:string; }\nexport class Store { private secret=1;\n/** Return text.\n * @remarks No I/O.\n * @param value - Input text.\n * @returns Trimmed text.\n * @throws Error on invalid input.\n */ format(value:string):string {return value.trim();} }'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const method=artifact.symbols.find(item=>item.name==="format");
  assert(method.parentId);
  assert(method.comment.i18n.fields["params.value.description"].defaultText.includes("Input text"));
  assert(method.comment.i18n.fields.remarks.defaultText.includes("No I/O"));
  assert(method.comment.i18n.fields.returns.defaultText.includes("Trimmed text"));
  assert(artifact.symbols.some(item=>item.name==="id" && item.parentId));
  assert(!artifact.symbols.some(item=>item.name==="secret"));
  const document=tsDocToHiaDocument(artifact);
  assert(document.symbols.some(item=>item.name==="Item"));
  assert(document.symbols.some(item=>item.name==="id"));
});
test("source ranges preserve actual CRLF/non-BMP UTF-16 positions and exclusive ends",()=>{
  const body='/* 😀 */ export const first = 1; export const second = 2;\r\n';
  const root=fixture({"index.ts":body});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  for(const symbol of artifact.symbols){
    assert.deepEqual(symbol.source.rangeConvention,{endBoundary:"exclusive",columnUnit:"utf16-code-unit"});
    const fragment=body.slice(symbol.source.range.start.column-1,symbol.source.range.end.column-1);
    assert(fragment.includes(symbol.name));
    assert(!fragment.includes(symbol.name==="first" ? "second" : "first"));
  }
});
test("target statements are never evaluated and unresolved exports remain explicit",()=>{
  const root=fixture({"index.ts":'throw new Error("Never evaluate target"); export const answer=42; export { absent } from "./missing.js";'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  assert(artifact.symbols.some(item=>item.name==="answer"));
  assert(artifact.diagnostics.some(item=>item.code==="TSDOC_AST_EXPORT_UNRESOLVED" && item.severity==="error"));
  assert.equal(artifact.modules[0].exports.find(item=>item.name==="absent").symbolIds.length,0);
});
test("invalid entry paths and private external declarations cannot expand source authority",()=>{
  const root=fixture({"index.ts":'export { outside } from "../outside.js";'});
  assert.throws(()=>extractTsDocProject({workspaceRoot:root,entrypoints:["../outside.ts"]}));
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  assert(artifact.diagnostics.some(item=>item.severity==="error"));
  assert(!JSON.stringify(artifact).includes(root));
});
test("versioned reader preserves legacy objects and never upgrades version labels",()=>{
  const legacy=extractTsDoc("export function before() {}",{path:"before.ts"});
  assert.strictEqual(readTsDocExtraction(legacy),legacy);
  assert.equal(legacy.contractVersion,"0.1.0-draft");
  assert.throws(()=>readTsDocExtraction({...legacy,contractVersion:"0.2.0-draft"}),/Invalid/);
  assert.throws(()=>readTsDocExtraction({...legacy,contractVersion:"9.0.0"}),/Unsupported/);
});

test("multiline examples, generic parameters, mutable bindings and namespace members survive",()=>{
  const root=fixture({"index.ts":'/** Identity.\n * @typeParam T - Value type.\n * @example\n * const a = 1;\n * console.log(a);\n */\nexport function identity<T>(x:T):T{return x;}\nexport let mutable=1;\nexport namespace Values { export const inside=3; const hidden=4; }\nexport type Item = { /** Actual field. */ id:string; };'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const identity=artifact.symbols.find(item=>item.name==="identity");
  assert(identity.comment.i18n.fields["typeParams.T.description"].defaultText.includes("Value type"));
  assert.match(identity.comment.i18n.fields["examples.0"].defaultText,/const a = 1;\nconsole.log\(a\);/);
  assert.equal(artifact.symbols.find(item=>item.name==="mutable").kind,"ts-runtime-variable");
  assert(artifact.symbols.some(item=>item.name==="inside" && item.parentId));
  assert(!artifact.symbols.some(item=>item.name==="hidden"));
  assert(artifact.symbols.some(item=>item.name==="id" && item.parentId));
});
test("direct maps retain actual multi-file sources, types and comments without invented JS",()=>{
  const root=fixture({"index.ts":'export * from "./types.js"; export const count=1;',"types.ts":'/** Public type. */ export interface Item { id:string; }'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const map=createTsDocProjectSourceMap(artifact);
  assert.deepEqual(map.sources.map(item=>item.path).sort(),["index.ts","types.ts"]);
  assert.equal(map.entries.length,artifact.symbols.length);
  assert.deepEqual(map.sourceMaps,[]);
  assert(!map.artifacts.some(item=>item.kind==="generated-js"));
  assert(map.entries.every(entry=>entry.sourceRefs.every(ref=>ref.rangeConvention.endBoundary==="exclusive" && ref.rangeConvention.columnUnit==="utf16-code-unit")));
  assert(map.entries.some(entry=>entry.classification==="type-only"));
  assert.throws(()=>createTsDocProjectSourceMap(artifact,{hiaDocumentPath:"../outside.json"}));
});

test("cyclic namespace aliases fail explicitly and new invalid references are rejected",()=>{
  const root=fixture({"index.ts":'export namespace Cycle { export import self = Cycle; }'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  assert(artifact.diagnostics.some(item=>item.code==="TSDOC_AST_DECLARATION_CYCLE"));
  const valid=extractTsDocProject({workspaceRoot:fixture({"index.ts":'export const value=1;'}),entrypoints:["index.ts"]});
  const invalid=structuredClone(valid);
  invalid.modules[0].path="../outside.ts";
  assert.throws(()=>readTsDocExtraction(invalid),/Invalid/);
  invalid.modules[0].path="index.ts";
  invalid.symbols[0].source.range.end=invalid.symbols[0].source.range.start;
  assert.throws(()=>readTsDocExtraction(invalid),/Invalid/);
});

test("inline bilingual fields retain localized values with valid relocated segment identities",()=>{
  const root=fixture({"index.ts":'/** Count.\n * @param value - <lang><en>Input.</en><zh-CN>输入。</zh-CN></lang>\n * @returns <lang><en>Output.</en><zh-CN>输出。</zh-CN></lang>\n */ export function count(value:number):number {return value;}'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const document=tsDocToHiaDocument(artifact);
  for(const name of ["params.value.description","returns"]) {
    const field=document.symbols[0].i18n.fields[name];
    assert(field.localizedText["zh-CN"]);
    assert.equal(field.segments[0].fieldPath,name);
    assert.equal(field.segments[0].id,`${name}.0`);
    assert(!Object.hasOwn(field.segments[0],"key"));
    assert(!Object.hasOwn(field.segments[0],"path"));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(document)),document);
});

test("project reader rejects cross-module aliases, duplicates and missing draft identity",()=>{
  const artifact=extractTsDocProject({workspaceRoot:fixture({"a.ts":"export const A=1;","b.ts":"export const B=2;"}),entrypoints:["a.ts","b.ts"]});
  for(const change of [
    value=>{delete value.producer;},
    value=>{value.profile.version="0.1.0-draft";},
    value=>{value.modules.push(value.modules[0]);},
    value=>{value.modules[0].exports.push(value.modules[0].exports[0]);},
    value=>{value.modules[0].exports[0].symbolIds=value.modules[1].exports[0].symbolIds;},
    value=>{value.comments.push({symbolId:"absent",range:value.symbols[0].source.range});}
  ]) {const copy=structuredClone(artifact);change(copy);assert.throws(()=>readTsDocExtraction(copy),/Invalid/);}
  const pattern=new RegExp(TSDOC_PROJECT_EXTRACTION_JSON_SCHEMA.$defs.path.pattern);
  assert(pattern.test("src/index.ts"));
  for(const invalid of ["../index.ts","/index.ts","src//index.ts","src/./index.ts","K:/private.ts","src/%2e.ts","src\\index.ts"]) assert(!pattern.test(invalid),invalid);
  assert.strictEqual(readTsDocExtraction(artifact),artifact);
});

test("export type of a runtime class stays type-only including its members",()=>{
  const root=fixture({"index.ts":'export type { Widget } from "./widget.js"; export { Widget as LiveWidget } from "./widget.js";',"widget.ts":'export class Widget { value=1; }'});
  const artifact=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  const type=artifact.symbols.find(item=>item.name==="Widget");
  const live=artifact.symbols.find(item=>item.name==="LiveWidget");
  assert.equal(type.classification,"type-only");
  assert.equal(live.classification,"runtime");
  assert.equal(artifact.symbols.find(item=>item.parentId===type.id).classification,"type-only");
});
