/**
 * @file
 * @lang zh-CN 0.3类型表达式的真实原生生产、旧读及拒绝回归。
 * @lang en Native production, legacy-reading and refusal regressions for 0.3 type expressions.
 */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {extractTsDocProject} from "../packages/ts-doc-extractor/src/project.mjs";
import {readTsDocExtraction} from "../packages/tsdoc-spec/src/index.mjs";
import {tsDocToJsDocBridgeArtifact,readTsJsDocBridgeArtifact} from "../packages/ts-jsdoc-bridge/src/index.mjs";
import {tsDocToHiaDocument} from "../packages/ts-doc-adapter/src/index.mjs";
import {createTsDocProjectSourceMap} from "../packages/ts-to-js-doc-source-map/src/project.mjs";
import {runTsDocProject} from "../packages/tsdoc-runner/src/project.mjs";

/**
 * @lang zh-CN 在本仓独占临时目录内抽取合成源码，不执行目标代码。
 * @lang en Extracts synthetic sources in an owned temporary directory without executing targets.
 * @param {string} text <lang><zh-CN>本次源码。</zh-CN><en>Source for this case.</en></lang>
 * @param {string} [version] <lang><zh-CN>显式版本，省略走旧默认。</zh-CN><en>Explicit version, omitted for the legacy default.</en></lang>
 * @returns {object} <lang><zh-CN>独占根和实际提取。</zh-CN><en>Owned root and actual extraction.</en></lang>
 */
function fixture(text,version="0.3.0-draft") {
  const parent=fileURLToPath(new URL("../temp/",import.meta.url));
  fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,"structured-types-"));
  fs.writeFileSync(path.join(root,"index.ts"),text);
  return {root,artifact:extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"],contractVersion:version})};
}

test("0.3 retains object, intersection and nonexclusive union branches with actual members",()=>{
  const {artifact}=fixture('throw new Error("DO_NOT_EXECUTE"); export type Input = ({kind: string} & (({path: string}) | {paths: string[]})); export type Json = null | {[key:string]: Json};');
  assert.equal(artifact.contractVersion,"0.3.0-draft");
  assert.deepEqual(artifact.diagnostics,[]);
  assert.strictEqual(readTsDocExtraction(artifact),artifact);
  for(const name of ["kind","path","paths","IndexSignature"]) assert(artifact.symbols.some(node=>node.name===name),name);
  const union=artifact.symbols.find(node=>node.kind==="ts-union-type");
  const branches=artifact.symbols.filter(node=>node.parentId===union.id);
  assert.deepEqual(branches.map(node=>node.metadata.typeExpression.branchIndex),[0,1]);
  assert(branches.every(node=>node.kind==="ts-type-literal"));
  assert(artifact.symbols.some(node=>node.kind==="ts-type-expression"&&node.signature==="null"));
  assert(artifact.symbols.filter(node=>node.metadata.typeExpression).every(node=>node.classification==="type-only"&&!node.comment));
});

test("nested properties and repeated branch names preserve source identity and UTF16 ranges",()=>{
  const body='/* 😀 */ export interface Root { value: ({ same: { nested: string } } | { same: number }); }\r\n';
  const {artifact}=fixture(body);
  assert.deepEqual(artifact.diagnostics,[]);
  const repeated=artifact.symbols.filter(node=>node.name==="same");
  assert.equal(repeated.length,2);
  assert.notEqual(repeated[0].id,repeated[1].id);
  assert.notEqual(repeated[0].parentId,repeated[1].parentId);
  assert(artifact.symbols.some(node=>node.name==="nested"));
  for(const node of artifact.symbols.filter(node=>node.metadata.typeExpression)) {
    const range=node.source.range;
    assert.equal(body.slice(range.start.column-1,range.end.column-1),node.signature);
  }
});

test("opaque branches cannot conceal unsupported physical anonymous members",()=>{
  const {artifact}=fixture('export type Hidden = ({ inner: string }[] | number);');
  assert(artifact.diagnostics.some(item=>item.code==="TSDOC_TYPE_EXPRESSION_UNSUPPORTED"&&item.severity==="error"));
});

test("nonselected function return shapes keep their original signature projection",()=>{
  const {root,artifact}=fixture('export declare function record(): {value:string};');
  const old=extractTsDocProject({workspaceRoot:root,entrypoints:["index.ts"]});
  assert.deepEqual(artifact.diagnostics,[]);
  assert.deepEqual(artifact.symbols,old.symbols);
  assert.match(artifact.symbols[0].signature,/\{value:string\}/);
});

test("old default and exact old readers retain the old object and symbol tree",()=>{
  const {root}=fixture('export type Input = {kind:string} & ({path:string}|{paths:string[]});');
  const request={workspaceRoot:root,entrypoints:["index.ts"]};
  const old=extractTsDocProject(request);
  const explicit=extractTsDocProject({...request,contractVersion:"0.2.0-draft"});
  assert.equal(old.contractVersion,"0.2.0-draft");
  assert.deepEqual(old,explicit);
  assert.strictEqual(readTsDocExtraction(old),old);
  assert.equal(old.symbols.length,1);
  for(const contractVersion of ["9.0.0",null,""]) assert.throws(()=>extractTsDocProject({...request,contractVersion}));
  assert.throws(()=>readTsDocExtraction({...old,contractVersion:"0.3.0-draft",profile:{id:"ts-jsdoc-bridge",version:"0.3.0-draft"}}));
});

test("0.3 readers refuse duplicate branches, invalid parentage, fabricated docs and cyclic trees",()=>{
  const {artifact}=fixture('export type Input = {path:string}|{paths:string[]};');
  for(const change of ["branch","parent","comment","kind","cycle","owner"]) {
    const invalid=structuredClone(artifact);
    const union=invalid.symbols.find(node=>node.kind==="ts-union-type");
    const branches=invalid.symbols.filter(node=>node.parentId===union.id);
    if(change==="branch") branches[1].metadata.typeExpression.branchIndex=0;
    if(change==="parent") branches[0].parentId=invalid.symbols[0].id;
    if(change==="comment") branches[0].comment={range:branches[0].source.range};
    if(change==="kind") branches[0].kind="ts-runtime-function";
    if(change==="cycle") union.parentId=branches[0].id;
    if(change==="owner") delete invalid.symbols[0].metadata.typeExpressionRoot;
    assert.throws(()=>readTsDocExtraction(invalid),undefined,change);
  }
});

test("0.3 bridge, HIA and direct maps retain every expression and precise version",()=>{
  const {artifact}=fixture('/** @lang en Input.\n * @lang zh-CN 输入。 */ export type Input = {/** @lang en Path.\n * @lang zh-CN 路径。 */path:string}|{paths:string[]};');
  const bridge=tsDocToJsDocBridgeArtifact(artifact);
  assert.equal(bridge.contractVersion,"0.3.0-draft");
  assert.strictEqual(readTsJsDocBridgeArtifact(bridge),bridge);
  const document=tsDocToHiaDocument(artifact);
  const map=createTsDocProjectSourceMap(artifact,{jsDocBridgePath:"project.bridge.json"});
  assert.equal(document.symbols.length,artifact.symbols.length);
  assert.equal(map.entries.length,artifact.symbols.length);
  assert.equal(map.artifacts.find(item=>item.kind==="bridge-artifact").contractRefs[0].contractVersion,"0.3.0-draft");
  for(const node of artifact.symbols.filter(node=>node.metadata.typeExpression)) {
    const core=document.symbols.find(item=>item.id===node.id);
    assert.equal(core.kind,"typedef");
    assert.deepEqual(core.metadata.tsdoc.typeExpression,node.metadata.typeExpression);
    assert.equal(map.entries.find(item=>item.symbolId===node.id).sourceRefs.length,1);
  }
});

test("explicit runner selection writes coherent 0.3 outputs and retains default 0.2",async()=>{
  const {root}=fixture('export type Input = {path:string}|{paths:string[]};');
  const request={workspaceRoot:root,outputDirectory:path.join(root,"out"),inputs:[{kind:"typescript-project",paths:["index.ts"]}],options:{extractionVersion:"0.3.0-draft"}};
  const result=await runTsDocProject(request);
  assert.equal(result.status,"success",JSON.stringify(result.diagnostics));
  assert.deepEqual(result.artifacts.filter(item=>["tsdoc-extraction","ts-jsdoc-bridge"].includes(item.kind)).map(item=>item.contractVersion),["0.3.0-draft","0.3.0-draft"]);
  assert.throws(()=>readTsJsDocBridgeArtifact({...JSON.parse(fs.readFileSync(path.join(root,"out/project.jsdoc-bridge.json"),'utf8')),contractVersion:"0.2.0-draft"}));
});

test("structural leaves count toward the unchanged 20000 symbol budget",()=>{
  assert.throws(()=>fixture('export type Budget = '+Array.from({length:20001},(_,index)=>String(index)).join('|')+';'),/extraction failed/);
});

test("CLI explicitly selects 0.3 and refuses unknown versions with controlled errors",()=>{
  const {root}=fixture('export type Input = {path:string}|{paths:string[]};');
  const cli=fileURLToPath(new URL("../packages/tsdoc-runner/src/cli.mjs",import.meta.url));
  const args=[cli,"--project","--workspace-root",root,"--out-dir","cli","--extraction-version","0.3.0-draft","index.ts"];
  const result=spawnSync(process.execPath,args,{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  const artifact=JSON.parse(fs.readFileSync(path.join(root,"cli/project.tsdoc.json"),"utf8"));
  assert.equal(artifact.contractVersion,"0.3.0-draft");
  args[args.indexOf("0.3.0-draft")]="9.0.0";
  const invalid=spawnSync(process.execPath,args,{encoding:"utf8"});
  assert.equal(invalid.status,1);
  assert(!invalid.stderr.includes(root));
});
